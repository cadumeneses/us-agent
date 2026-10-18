import { createHash } from 'node:crypto';
import { z } from 'zod';
import { canonicalJson, snapshotContent } from '../domain/content-snapshot.js';
import { parseImportCsv } from '../domain/import-formats.js';
import { reviewAssociationLines } from './testrec-source-preparation.js';

export const E26_TRANSPORT_VERSION = 'e26-literal-title-encoding-v1';
const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const e26TransportPlanSchema = z.strictObject({
  schemaVersion: z.literal(1), id: z.string().regex(/^[a-z0-9][a-z0-9._-]{0,99}$/), version: z.literal(E26_TRANSPORT_VERSION),
  source: z.strictObject({ file: z.literal('test_cases_for_user_stories.csv'), sha256: hash, bytes: z.number().int().positive() }),
  review: z.strictObject({ actor: z.literal('codex_technical_review'), date: z.literal('2026-10-18'),
    basis: z.literal('explicit_literal_cells_transport_convention'), validation: z.literal('not_author_or_supervisor_validation') }),
  decisions: z.array(z.strictObject({ physicalLine: z.number().int().min(3), spanSha256: hash,
    previousSpanSha256: hash, nextSpanSha256: hash,
    operation: z.literal('quote_unquoted_title_preserving_literal_characters'),
    beforeCells: z.array(z.string()).length(5) })).min(1).max(100)
});
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const decode = (bytes: Uint8Array) => new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
const ending = (text: string) => text.endsWith('\r\n') ? '\r\n' : text.endsWith('\n') ? '\n' : text.endsWith('\r') ? '\r' : '';
const body = (text: string) => { const eol = ending(text); return eol ? text.slice(0, -eol.length) : text; };

/** Only transport syntax is changed. Literal source cells are an explicit local convention, not confirmed author intent. */
export function applyE26TransportPlan(source: Uint8Array, rawPlan: unknown) {
  canonicalJson(rawPlan);
  const plan = e26TransportPlanSchema.parse(rawPlan);
  if (sha(source) !== plan.source.sha256 || source.length !== plan.source.bytes) throw new Error('Source bytes differ from the reviewed plan.');
  if (new Set(plan.decisions.map(row => row.physicalLine)).size !== plan.decisions.length) throw new Error('Duplicate transport decisions.');
  const inspection = reviewAssociationLines(source), header = body(inspection.header.rawText).replace(/^\uFEFF/, '');
  const headers = parseImportCsv(header, ';').fields;
  const spanText = (line: number) => {
    const span = inspection.units.find(row => row.physicalLine === line);
    if (!span) throw new Error('Missing adjacent source span.');
    return { ...span, text: decode(source.subarray(span.startByte, span.endByteExclusive)) };
  };
  const patches = plan.decisions.map(decision => {
    const current = spanText(decision.physicalLine), previous = spanText(decision.physicalLine - 1), next = spanText(decision.physicalLine + 1);
    if (current.sha256 !== decision.spanSha256 || previous.sha256 !== decision.previousSpanSha256 || next.sha256 !== decision.nextSpanSha256) throw new Error('Reviewed source/context span differs.');
    if (current.status !== 'requires_review' || previous.status !== 'parseable_in_isolation' || next.status !== 'parseable_in_isolation') throw new Error('Only isolated reviewed units with parseable adjacent anchors are supported.');
    const cells = body(current.text).split(';');
    if (canonicalJson(cells) !== canonicalJson(decision.beforeCells)) throw new Error('Literal cells differ from the reviewed decision.');
    if (cells.length !== 5 || cells.slice(0, 3).some(value => !value.trim() || /["\r\n]/.test(value)) ||
        !/^[0-9]+$/.test(cells[2]) || !/^[0-9]+[ \t]*$/.test(cells[4]) || !cells[3].includes('"') || cells[3].trimStart().startsWith('"')) {
      throw new Error('Ambiguous separators, identity, title boundary or output ID require a separate review.');
    }
    const neighborId = (text: string) => {
      const parsed = parseImportCsv(header + '\n' + text, ';');
      if (parsed.rows.length !== 1 || parsed.rows[0].error) throw new Error('Adjacent anchor is not one complete row.');
      const value = (parsed.rows[0].value as Record<string, string>)[headers[2]];
      if (!/^[0-9]+$/.test(value)) throw new Error('Adjacent anchor lacks a numeric source ID.');
      return BigInt(value);
    };
    if (neighborId(previous.text) + 1n !== BigInt(cells[2]) || BigInt(cells[2]) + 1n !== neighborId(next.text)) throw new Error('Source ID sequence does not support the reviewed isolated span.');
    const encoded = [...cells]; encoded[3] = '"' + cells[3].replaceAll('"', '""') + '"';
    const after = Buffer.from(encoded.join(';') + ending(current.text), 'utf8');
    const decoded = parseImportCsv(header + '\n' + decode(after), ';');
    if (decoded.rows.length !== 1 || decoded.rows[0].error || canonicalJson(headers.map(field => (decoded.rows[0].value as Record<string, string>)[field])) !== canonicalJson(cells)) {
      throw new Error('CSV encoding did not preserve every literal cell.');
    }
    const before = source.subarray(current.startByte, current.endByteExclusive);
    return { physicalLine: current.physicalLine, sourceStartByte: current.startByte, sourceEndByteExclusive: current.endByteExclusive,
      beforeBase64: Buffer.from(before).toString('base64'), beforeSha256: sha(before),
      afterBase64: after.toString('base64'), afterSha256: sha(after), beforeCells: cells,
      operation: decision.operation };
  }).sort((left, right) => left.sourceStartByte - right.sourceStartByte);
  const chunks: Uint8Array[] = []; let cursor = 0, delta = 0;
  const ledger = patches.map(patch => {
    if (patch.sourceStartByte < cursor) throw new Error('Overlapping source patches.');
    const replacement = Buffer.from(patch.afterBase64, 'base64');
    chunks.push(source.subarray(cursor, patch.sourceStartByte), replacement); cursor = patch.sourceEndByteExclusive;
    const outputStartByte = patch.sourceStartByte + delta;
    delta += replacement.length - (patch.sourceEndByteExclusive - patch.sourceStartByte);
    return { ...patch, outputStartByte, outputEndByteExclusive: outputStartByte + replacement.length };
  });
  chunks.push(source.subarray(cursor));
  const bytes = Buffer.concat(chunks), afterInspection = reviewAssociationLines(bytes);
  const report = snapshotContent({ schemaVersion: 1, version: E26_TRANSPORT_VERSION, scope: 'literal_cells_transport_normalization_only',
    plan: snapshotContent(plan), sourceSha256: sha(source), sourceBytes: source.length, outputSha256: sha(bytes), outputBytes: bytes.length,
    scientificReproduction: false, readyForScientificExecution: false, authorIntentConfirmed: false, logicalRecordBoundariesConfirmed: false,
    changes: { encodedTitleCells: ledger.length, sourceCellCharactersChanged: 0, excludedRecords: 0, identityAliasesApplied: 0 },
    before: inspection.summary, after: afterInspection.summary, wholeFileAfter: afterInspection.wholeFile, patches: ledger,
    limits: ['literal_cells_are_a_declared_local_convention', 'no_semantic_repair_of_odd_or_duplicated_text',
      'remaining_spans_profiles_aliases_and_subset_unresolved', 'Q01_Q02_Q03_open', 'no_operational_import'] });
  return { bytes, report };
}

/** Reconstruct the complete original, not just an equivalent parsed CSV. */
export function reconstructE26Source(output: Uint8Array, report: ReturnType<typeof applyE26TransportPlan>['report']) {
  if (canonicalJson(snapshotContent(report.content)) !== canonicalJson(report)) throw new Error('Invalid transport ledger snapshot.');
  if (output.length !== report.content.outputBytes || sha(output) !== report.content.outputSha256) throw new Error('Derived bytes differ from the ledger.');
  const chunks: Uint8Array[] = []; let cursor = 0;
  for (const patch of report.content.patches) {
    if (!Number.isSafeInteger(patch.outputStartByte) || !Number.isSafeInteger(patch.outputEndByteExclusive) ||
        patch.outputStartByte < cursor || patch.outputEndByteExclusive > output.length || patch.outputEndByteExclusive <= patch.outputStartByte) throw new Error('Invalid inverse patch range.');
    const after = output.subarray(patch.outputStartByte, patch.outputEndByteExclusive), before = Buffer.from(patch.beforeBase64, 'base64');
    if (sha(after) !== patch.afterSha256 || Buffer.from(patch.afterBase64, 'base64').compare(Buffer.from(after)) !== 0 || sha(before) !== patch.beforeSha256) throw new Error('Inverse patch content differs.');
    chunks.push(output.subarray(cursor, patch.outputStartByte), before); cursor = patch.outputEndByteExclusive;
  }
  chunks.push(output.subarray(cursor));
  const source = Buffer.concat(chunks);
  if (source.length !== report.content.sourceBytes || sha(source) !== report.content.sourceSha256) throw new Error('Original reconstruction differs.');
  return source;
}
