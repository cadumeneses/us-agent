import { createHash } from 'node:crypto';
import { snapshotContent } from '../domain/content-snapshot.js';
import { ImportFormatError, parseImportCsv } from '../domain/import-formats.js';
import { E26_SOURCE_FILES } from './testrec-source-audit.js';
import { reviewAssociationLines } from './testrec-source-preparation.js';

export const E26_VERSION_COMPARISON = 'e26-source-version-comparison-v1';
export const E26_EARLIER_FILES = ['uss.csv', 'usscas.csv', 'cas2.csv', 'tcs.csv'] as const;
type Earlier = Record<typeof E26_EARLIER_FILES[number], Uint8Array>;
type Latest = Record<typeof E26_SOURCE_FILES[number], Uint8Array>;
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const decode = (bytes: Uint8Array) => new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
const body = (value: string) => value.replace(/(?:\r\n|\r|\n)$/, '');
const roles = [
  { role: 'profiles', earlier: 'uss.csv', latest: 'categorized_user_stories.csv' },
  { role: 'story_criteria_links', earlier: 'usscas.csv', latest: 'user_stories_test_cases.csv' },
  { role: 'acceptance_criteria', earlier: 'cas2.csv', latest: 'acceptance_criteria_data.csv' },
  { role: 'test_associations', earlier: 'tcs.csv', latest: 'test_cases_for_user_stories.csv' }
] as const;
function inspect(name: string, bytes: Uint8Array) {
  const text = decode(bytes).replace(/^\uFEFF/, '');
  const headers = parseImportCsv(text.split(/\r\n|\r|\n/, 1)[0], ';').fields;
  let parse: { status: 'parseable' | 'invalid_rows' | 'blocked'; rows: number | null; invalidRows: number | null; firstError: { line: number; message: string } | null };
  try {
    const parsed = parseImportCsv(text, ';'), invalid = parsed.rows.filter(row => row.error);
    parse = { status: invalid.length ? 'invalid_rows' : 'parseable', rows: parsed.rows.length, invalidRows: invalid.length,
      firstError: invalid.length ? { line: invalid[0].line ?? 1, message: invalid[0].error! } : null };
  } catch (error) {
    if (!(error instanceof ImportFormatError)) throw error;
    parse = { status: 'blocked', rows: null, invalidRows: null, firstError: { line: error.line, message: error.message } };
  }
  return { name, sha256: sha(bytes), bytes: bytes.length, headers, parse };
}

/** Earlier versions are evidence to compare, never automatic replacements or authoritative repairs. */
export function compareE26Versions(earlier: Earlier, latest: Latest, selection: { flaggedPhysicalLines: number[]; locallyEncodedLines: number[];
  multilineGroups?: Array<{ startPhysicalLine: number; endPhysicalLine: number }> }) {
  const lines = selection.flaggedPhysicalLines, local = new Set(selection.locallyEncodedLines);
  if (!lines.length || lines.some(line => !Number.isSafeInteger(line) || line < 2) || new Set(lines).size !== lines.length ||
      local.size !== selection.locallyEncodedLines.length || [...local].some(line => !lines.includes(line))) throw new Error('Invalid review selection.');
  const files = roles.map(pair => {
    const old = inspect(pair.earlier, earlier[pair.earlier]), current = inspect(pair.latest, latest[pair.latest]);
    return { role: pair.role, earlier: old, latest: current,
      identicalBytes: old.sha256 === current.sha256 && old.bytes === current.bytes,
      sameTrimmedHeaders: JSON.stringify(old.headers.map(value => value.trim())) === JSON.stringify(current.headers.map(value => value.trim())) };
  });
  const oldSource = earlier['tcs.csv'], newSource = latest['test_cases_for_user_stories.csv'];
  const oldInspection = reviewAssociationLines(oldSource), newInspection = reviewAssociationLines(newSource);
  const span = (bytes: Uint8Array, inspection: typeof oldInspection, line: number) => {
    const unit = inspection.units.find(row => row.physicalLine === line);
    if (!unit) throw new Error('Review line is absent from one source version.');
    return { ...unit, rawText: decode(bytes.subarray(unit.startByte, unit.endByteExclusive)),
      adjacentContext: inspection.units.filter(row => Math.abs(row.physicalLine - line) === 1).map(row => ({ physicalLine: row.physicalLine,
        sha256: row.sha256, rawText: decode(bytes.subarray(row.startByte, row.endByteExclusive)) })) };
  };
  const comparisons = [...lines].sort((a, b) => a - b).map(line => {
    const old = span(oldSource, oldInspection, line), current = span(newSource, newInspection, line);
    const a = body(old.rawText).split(';'), b = body(current.rawText).split(';');
    const fiveSegments = a.length === 5 && b.length === 5;
    const numericIds = fiveSegments && /^[0-9]+$/.test(a[2]) && /^[0-9]+$/.test(b[2]);
    const sameIdentity = numericIds && a.slice(0, 3).every((value, index) => value === b[index]);
    const state = !numericIds ? 'ambiguous_boundaries' : sameIdentity ? 'aligned_literal_segments' : 'identity_differs';
    const changes = fiveSegments ? a.flatMap((value, index) => value === b[index] ? [] : [{ segment: index,
      header: newInspection.header.rawText.replace(/[\r\n]+$/, '').split(';')[index].trim(), earlier: value, latest: b[index],
      onlyRightPaddingDiffers: value.trimEnd() === b[index].trimEnd() }]) : [];
    const priorPlainIdCandidate = Boolean(sameIdentity && /^[0-9]+$/.test(a[4].trimEnd()) && !/^[0-9]+$/.test(b[4].trimEnd()));
    return { physicalLine: line, state, alreadyHasLocalEncodingView: local.has(line), earlier: old, latest: current,
      literalSegments: fiveSegments ? { earlier: a, latest: b } : null, changes,
      priorPlainIdCandidate, decision: 'pending_no_replacement_applied',
      evidenceLimit: 'Physical alignment and literal segments are comparison aids, not confirmed logical records or author intent.' };
  });
  const groupedLines = new Set<number>();
  const multilineComparisons = (selection.multilineGroups ?? []).map(group => {
    if (!Number.isSafeInteger(group.startPhysicalLine) || group.endPhysicalLine !== group.startPhysicalLine + 1 ||
        !lines.includes(group.startPhysicalLine) || !lines.includes(group.endPhysicalLine) ||
        groupedLines.has(group.startPhysicalLine) || groupedLines.has(group.endPhysicalLine)) throw new Error('Invalid or overlapping multiline review groups.');
    groupedLines.add(group.startPhysicalLine); groupedLines.add(group.endPhysicalLine);
    const parseGroup = (bytes: Uint8Array, inspection: typeof oldInspection, first: number, last: number) => {
      const a = span(bytes, inspection, first), b = span(bytes, inspection, last);
      const raw = bytes.subarray(a.startByte, b.endByteExclusive);
      let decoded: Record<string, string> | null = null, error: string | null = null;
      try {
        const parsed = parseImportCsv(inspection.header.rawText + decode(raw), ';');
        if (parsed.rows.length !== 1 || parsed.rows[0].error) error = parsed.rows[0]?.error ?? 'Group is not exactly one decoded record.';
        else decoded = parsed.rows[0].value as Record<string, string>;
      } catch (problem) {
        if (!(problem instanceof ImportFormatError)) throw problem;
        error = problem.message;
      }
      return { startByte: a.startByte, endByteExclusive: b.endByteExclusive, sha256: sha(raw), rawText: decode(raw), decoded, error };
    };
    const old = parseGroup(oldSource, oldInspection, group.startPhysicalLine, group.endPhysicalLine);
    const current = parseGroup(newSource, newInspection, group.startPhysicalLine, group.endPhysicalLine);
    const previous = parseGroup(oldSource, oldInspection, group.startPhysicalLine - 1, group.startPhysicalLine - 1);
    const next = parseGroup(oldSource, oldInspection, group.endPhysicalLine + 1, group.endPhysicalLine + 1);
    const ids = [previous.decoded?.ID, old.decoded?.ID, next.decoded?.ID];
    const anchorSequenceSupportsBoundary = ids.every(value => typeof value === 'string' && /^[0-9]+$/.test(value)) &&
      BigInt(ids[0]!) + 1n === BigInt(ids[1]!) && BigInt(ids[1]!) + 1n === BigInt(ids[2]!);
    return { ...group, earlier: old, latest: current, earlierContext: { previous, next }, anchorSequenceSupportsBoundary,
      decision: 'earlier_decoding_is_evidence_only_no_latest_replacement_applied' };
  });
  return snapshotContent({ schemaVersion: 1, version: E26_VERSION_COMPARISON, scope: 'separate_published_versions_comparison_only',
    scientificReproduction: false, readyForScientificExecution: false,
    sourceVersions: { conceptDoi: '10.5281/zenodo.16131516', earlierRecord: 16133229, latestRecord: 16133793 },
    files, associationUnits: { earlier: oldInspection.summary, latest: newInspection.summary }, comparisons, multilineComparisons,
    summary: { reviewedPhysicalPositions: comparisons.length, withLocalEncodingView: local.size,
      pendingPhysicalPositions: comparisons.length - local.size,
      states: Object.fromEntries(['aligned_literal_segments', 'identity_differs', 'ambiguous_boundaries'].map(state => [state, comparisons.filter(row => row.state === state).length])),
      earlierPlainIdCandidatesPending: comparisons.filter(row => row.priorPlainIdCandidate && !row.alreadyHasLocalEncodingView).length,
      earlierMultilineGroupsDecoded: multilineComparisons.filter(row => row.earlier.decoded !== null).length,
      earlierMultilineGroupsWithConsecutiveAnchors: multilineComparisons.filter(row => row.earlier.decoded !== null && row.anchorSequenceSupportsBoundary).length,
      appliedReplacements: 0, appliedAliases: 0, excludedRecords: 0, logicalRecordsRecovered: null },
    limits: ['earlier_version_is_not_automatically_authoritative', 'do_not_mix_versions_into_an_unnamed_dataset',
      'literal_segments_are_not_confirmed_decoded_cells', 'multiline_boundaries_and_identity_differences_unresolved',
      'source_code_folds_subset_and_Q01_Q02_Q03_unresolved'] });
}
