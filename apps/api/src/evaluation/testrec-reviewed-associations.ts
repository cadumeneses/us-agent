import { createHash } from 'node:crypto';
import { z } from 'zod';
import { canonicalJson, snapshotContent } from '../domain/content-snapshot.js';
import { parseImportCsv } from '../domain/import-formats.js';
import { reviewAssociationLines } from './testrec-source-preparation.js';

export const E26_REVIEWED_ASSOCIATIONS = 'e26-reviewed-associations-v1';
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const source = z.strictObject({ path: z.string(), sha256: hash, bytes: z.number().int().positive() });
const span = z.strictObject({ startPhysicalLine: z.number().int().min(2), endPhysicalLine: z.number().int().min(2),
  startByte: z.number().int().nonnegative(), endByteExclusive: z.number().int().positive(), sha256: hash });
const planSchema = z.strictObject({ schemaVersion: z.literal(1), id: z.literal(E26_REVIEWED_ASSOCIATIONS),
  status: z.literal('candidate_local_derivation'), sourcePolicy: z.literal('latest_with_explicit_earlier_record_substitutions'),
  sources: z.strictObject({ latest: source, earlier: source }),
  review: z.strictObject({ actor: z.literal('codex_technical_review'), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    validation: z.literal('not_author_or_supervisor_validation') }),
  decisions: z.array(z.strictObject({ target: span, operation: z.enum(['encode_latest_literal_title', 'adopt_explicit_earlier_record']),
    supportingSource: z.enum(['latest', 'earlier']), supporting: span,
    decoding: z.enum(['strict_csv', 'declared_literal_unquoted_title']), afterCells: z.array(z.string()).length(5),
    rationale: z.string().min(1) })).min(1).max(100)
});
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const decode = (bytes: Uint8Array) => new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
const ending = (text: string) => text.endsWith('\r\n') ? '\r\n' : text.endsWith('\n') ? '\n' : text.endsWith('\r') ? '\r' : '';
const body = (text: string) => text.slice(0, text.length - ending(text).length);
const header = 'Projeto;ID_US;ID;ID_TC;ID_STD_TC';
const headers = header.split(';');
const csvCell = (value: string) => /[;"\r\n]/.test(value) ? '"' + value.replaceAll('"', '""') + '"' : value;
type Inspection = ReturnType<typeof reviewAssociationLines>;

function selectedSpan(bytes: Uint8Array, inspection: Inspection, selection: z.infer<typeof span>) {
  const first = inspection.units.find(row => row.physicalLine === selection.startPhysicalLine);
  const last = inspection.units.find(row => row.physicalLine === selection.endPhysicalLine);
  if (!first || !last || selection.endPhysicalLine < selection.startPhysicalLine ||
      selection.startByte !== first.startByte || selection.endByteExclusive !== last.endByteExclusive) throw new Error('Reviewed span boundaries differ.');
  const content = bytes.subarray(first.startByte, last.endByteExclusive);
  if (sha(content) !== selection.sha256) throw new Error('Reviewed span bytes differ.');
  return content;
}

function strictCells(text: string) {
  const parsed = parseImportCsv(header + '\n' + text, ';');
  if (parsed.rows.length !== 1 || parsed.rows[0].error) throw new Error('Supporting span must decode as exactly one record.');
  return headers.map(field => (parsed.rows[0].value as Record<string, string>)[field]);
}

/** Candidate source derivation only. Every substitution has an explicit published source; no inferred fields or operational import. */
export function prepareReviewedE26Associations(latest: Uint8Array, earlier: Uint8Array, rawPlan: unknown) {
  canonicalJson(rawPlan);
  const plan = planSchema.parse(rawPlan), sources = { latest, earlier };
  const inspections = { latest: reviewAssociationLines(latest), earlier: reviewAssociationLines(earlier) };
  const paths = { latest: 'research/sources/testrec-e26/zenodo-16133793/test_cases_for_user_stories.csv',
    earlier: 'research/sources/testrec-e26/zenodo-16133229/tcs.csv' };
  for (const name of ['latest', 'earlier'] as const) {
    if (plan.sources[name].path !== paths[name] || sha(sources[name]) !== plan.sources[name].sha256 || sources[name].length !== plan.sources[name].bytes) throw new Error('Source bytes/path differ from the reviewed plan.');
  }
  const covered = new Set<number>();
  const patches = plan.decisions.map(decision => {
    const before = selectedSpan(latest, inspections.latest, decision.target);
    for (let line = decision.target.startPhysicalLine; line <= decision.target.endPhysicalLine; line++) {
      if (covered.has(line)) throw new Error('Overlapping review decisions.');
      covered.add(line);
      if (!inspections.latest.review.some(row => row.physicalLine === line)) throw new Error('Decision changes an unflagged latest physical unit.');
    }
    if ((decision.operation === 'encode_latest_literal_title') !== (decision.supportingSource === 'latest')) throw new Error('Operation/source mismatch.');
    if (decision.supporting.startPhysicalLine !== decision.target.startPhysicalLine || decision.supporting.endPhysicalLine !== decision.target.endPhysicalLine) throw new Error('Source alignment requires a separate review.');
    const supporting = selectedSpan(sources[decision.supportingSource], inspections[decision.supportingSource], decision.supporting);
    let cells: string[];
    if (decision.decoding === 'strict_csv') cells = strictCells(decode(supporting));
    else {
      cells = body(decode(supporting)).split(';');
      if (cells.length !== 5 || /[\r\n]/.test(body(decode(supporting))) || cells.slice(0, 3).some(value => !value || /"/.test(value)) ||
          !cells[3].includes('"') || cells[3].trimStart().startsWith('"') || !/^[0-9]+[ \t]*$/.test(cells[4])) throw new Error('Ambiguous literal-title boundaries.');
      // This convention is only valid for a source span that the strict parser rejects.
      let parseable = false;
      try { strictCells(decode(supporting)); parseable = true; } catch { /* recorded, reviewed invalid syntax */ }
      if (parseable) throw new Error('Literal convention cannot reinterpret a valid CSV record.');
    }
    if (canonicalJson(cells) !== canonicalJson(decision.afterCells)) throw new Error('Declared cells differ from the identified supporting source.');
    const targetIdentity = decode(before).split(/\r\n|\n|\r/, 1)[0].split(';').slice(0, 3);
    if (targetIdentity.length !== 3 || !/^[0-9]+$/.test(targetIdentity[2]) || targetIdentity[2] !== cells[2] ||
        targetIdentity[1] !== cells[1] || targetIdentity[0].replaceAll('"', '') !== cells[0]) throw new Error('Source record/story identity or reviewed project quote difference does not match.');
    const after = Buffer.from(cells.map(csvCell).join(';') + ending(decode(before)), 'utf8');
    if (canonicalJson(strictCells(decode(after))) !== canonicalJson(cells)) throw new Error('CSV encoding changed source cell characters.');
    return { ...decision, beforeBase64: Buffer.from(before).toString('base64'), afterBase64: after.toString('base64'), afterSha256: sha(after),
      projectQuoteDifference: targetIdentity[0] !== cells[0] };
  }).sort((a, b) => a.target.startByte - b.target.startByte);
  if (covered.size !== inspections.latest.review.length) throw new Error('Plan must account for all flagged latest physical units.');
  const chunks: Uint8Array[] = []; let cursor = 0, delta = 0;
  const ledger = patches.map(patch => {
    if (patch.target.startByte < cursor) throw new Error('Overlapping source spans.');
    const after = Buffer.from(patch.afterBase64, 'base64');
    chunks.push(latest.subarray(cursor, patch.target.startByte), after); cursor = patch.target.endByteExclusive;
    const outputStartByte = patch.target.startByte + delta;
    delta += after.length - (patch.target.endByteExclusive - patch.target.startByte);
    return { ...patch, outputStartByte, outputEndByteExclusive: outputStartByte + after.length };
  });
  chunks.push(latest.subarray(cursor));
  const bytes = Buffer.concat(chunks), parsed = parseImportCsv(decode(bytes).replace(/^\uFEFF/, ''), ';');
  if (canonicalJson(parsed.fields.map(field => field.trim())) !== canonicalJson(headers) || parsed.rows.some(row => row.error)) throw new Error('Derived CSV is not completely parseable.');
  const records = parsed.rows.map(row => ({ ordinal: row.ordinal, physicalLine: row.line!,
    cells: headers.map((_, i) => (row.value as Record<string, string>)[parsed.fields[i]]) }));
  const ids = records.map(row => row.cells[2]);
  if (new Set(ids).size !== ids.length || ids.some((id, index) => id !== String(index + 1))) throw new Error('Source record sequence is incomplete or ambiguous.');
  const unknown = records.filter(row => !row.cells[4].trim());
  const storyKeys = new Set(records.map(row => JSON.stringify([row.cells[0].trim(), row.cells[1].trim().replace(/^#/, '').trim()])));
  const report = snapshotContent({ schemaVersion: 1, version: E26_REVIEWED_ASSOCIATIONS, status: plan.status, sourcePolicy: plan.sourcePolicy,
    plan: snapshotContent(plan), sourceSha256: sha(latest), sourceBytes: latest.length, outputSha256: sha(bytes), outputBytes: bytes.length,
    scientificReproduction: false, readyForScientificExecution: false, authorIntentConfirmed: false, operationalImport: false,
    summary: { latestLiteralTitleEncodings: ledger.filter(row => row.supportingSource === 'latest').length,
      earlierRecordSubstitutions: ledger.filter(row => row.supportingSource === 'earlier').length,
      earlierMultilineRecords: ledger.filter(row => row.target.endPhysicalLine > row.target.startPhysicalLine).length,
      reviewedPhysicalUnits: covered.size, pendingSyntaxUnitsInThisDerivation: 0, logicalRecords: records.length, storyKeys: storyKeys.size,
      projects: new Set(records.map(row => row.cells[0].trim())).size, missingStandardTestIdRows: unknown.length,
      distinctNonemptyStandardTestIds: new Set(records.map(row => row.cells[4].trim()).filter(Boolean)).size,
      sourceRecordsExcluded: 0, inferredFieldValues: 0, projectAliasesApplied: 0, titlesConvertedToGherkin: 0 },
    headers: parsed.fields, patches: ledger,
    missingStandardTestIdRows: unknown.map(row => ({ ordinal: row.ordinal, physicalLine: row.physicalLine, sourceRecordId: row.cells[2] })),
    limits: ['candidate_cross_version_derivation_not_an_original_author_dataset', 'earlier_source_cells_adopted_only_at_explicit_reviewed_spans',
      'unmodified_latest_bytes_preserved_outside_patches', 'literal_title_convention_does_not_confirm_author_intent',
      'no_profile_domain_catalog_completion_or_alias_resolution', 'experimental_subset_folds_and_Q01_Q03_unconfirmed', 'not_an_empirical_evaluation'] });
  return { bytes, records, report };
}

/** Byte-exact recovery of the latest source, including invalid syntax and whitespace. */
export function reconstructReviewedE26Source(output: Uint8Array, report: ReturnType<typeof prepareReviewedE26Associations>['report']) {
  if (canonicalJson(snapshotContent(report.content)) !== canonicalJson(report) || sha(output) !== report.content.outputSha256 || output.length !== report.content.outputBytes) throw new Error('Derived output/report differs.');
  const chunks: Uint8Array[] = []; let cursor = 0;
  for (const patch of report.content.patches) {
    if (!Number.isSafeInteger(patch.outputStartByte) || !Number.isSafeInteger(patch.outputEndByteExclusive) || patch.outputStartByte < cursor ||
        patch.outputEndByteExclusive <= patch.outputStartByte || patch.outputEndByteExclusive > output.length) throw new Error('Invalid inverse span.');
    const after = output.subarray(patch.outputStartByte, patch.outputEndByteExclusive), before = Buffer.from(patch.beforeBase64, 'base64');
    if (sha(after) !== patch.afterSha256 || !Buffer.from(after).equals(Buffer.from(patch.afterBase64, 'base64')) || sha(before) !== patch.target.sha256) throw new Error('Inverse span differs.');
    chunks.push(output.subarray(cursor, patch.outputStartByte), before); cursor = patch.outputEndByteExclusive;
  }
  chunks.push(output.subarray(cursor));
  const source = Buffer.concat(chunks);
  if (sha(source) !== report.content.sourceSha256 || source.length !== report.content.sourceBytes) throw new Error('Original reconstruction differs.');
  return source;
}
