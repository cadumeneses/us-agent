import { createHash } from 'node:crypto';
import { snapshotContent } from '../domain/content-snapshot.js';
import { ImportFormatError, parseImportCsv } from '../domain/import-formats.js';
import { parseRecommenderTaxonomy } from '../domain/recommender-taxonomy.js';
import { E26_SOURCE_FILES } from './testrec-source-audit.js';

export const E26_PREPARATION_VERSION = 'e26-source-preparation-v1';
type SourceName = typeof E26_SOURCE_FILES[number];
type Sources = Record<SourceName, Uint8Array>;
type Row = Record<string, string>;
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const decode = (bytes: Uint8Array) => new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
const identity = (row: Row) => ({ project: row.Projeto.trim(), storyId: row.ID_US.trim().replace(/^#/, '').trim() });
const key = (row: Row) => JSON.stringify(identity(row));

function parsedRows(bytes: Uint8Array, expected: string[]) {
  const parsed = parseImportCsv(decode(bytes).replace(/^\uFEFF/, ''), ';');
  if (parsed.fields.length !== expected.length || parsed.fields.some((field, index) => field !== expected[index])) throw new Error('Source headers differ from the reviewed contract.');
  if (parsed.rows.some(row => row.error)) throw new Error('Malformed structured source requires review before preparation.');
  return parsed.rows.map(row => ({ ordinal: row.ordinal, line: row.line!, value: row.value as Row }));
}

/** Physical byte spans are review units only. Never treat standalone parses as recovered records. */
export function reviewAssociationLines(bytes: Uint8Array) {
  decode(bytes); // Reject invalid UTF-8 before interpreting byte spans.
  const spans: Array<{ physicalLine: number; startByte: number; endByteExclusive: number; sha256: string; rawText: string }> = [];
  let start = 0;
  for (let index = 0; index < bytes.length; index++) {
    if (bytes[index] !== 10 && bytes[index] !== 13) continue;
    if (bytes[index] === 13 && bytes[index + 1] === 10) index++;
    const end = index + 1, raw = bytes.subarray(start, end);
    spans.push({ physicalLine: spans.length + 1, startByte: start, endByteExclusive: end, sha256: sha(raw), rawText: decode(raw) });
    start = end;
  }
  if (start < bytes.length) {
    const raw = bytes.subarray(start);
    spans.push({ physicalLine: spans.length + 1, startByte: start, endByteExclusive: bytes.length, sha256: sha(raw), rawText: decode(raw) });
  }
  const header = spans[0];
  if (!header) throw new Error('Association source is empty.');
  const headerText = header.rawText.replace(/^\uFEFF/, '').replace(/[\r\n]+$/, '');
  const fields = parseImportCsv(headerText, ';').fields;
  if (JSON.stringify(fields.map(field => field.trim())) !== JSON.stringify(['Projeto', 'ID_US', 'ID', 'ID_TC', 'ID_STD_TC'])) throw new Error('Association headers differ from the reviewed contract.');
  let wholeFile: { state: 'parseable' | 'blocked'; error: { line: number; message: string } | null };
  try {
    const parsed = parseImportCsv(decode(bytes).replace(/^\uFEFF/, ''), ';');
    const invalid = parsed.rows.find(row => row.error);
    if (invalid) throw new ImportFormatError(invalid.error!, invalid.line ?? 1);
    wholeFile = { state: 'parseable', error: null };
  }
  catch (error) {
    if (!(error instanceof ImportFormatError)) throw error;
    wholeFile = { state: 'blocked', error: { line: error.line, message: error.message } };
  }
  const units = spans.slice(1).map(span => {
    let diagnostic: string | null = null;
    try {
      const parsed = parseImportCsv(headerText + '\n' + span.rawText, ';');
      if (parsed.rows.length !== 1 || parsed.rows[0].error) diagnostic = parsed.rows[0]?.error ?? 'Physical unit is not exactly one record in isolation.';
    } catch (error) {
      if (!(error instanceof ImportFormatError)) throw error;
      diagnostic = error.message;
    }
    const { rawText: _text, ...location } = span;
    return { ...location, status: diagnostic ? 'requires_review' as const : 'parseable_in_isolation' as const, diagnostic };
  });
  const review = units.filter(unit => unit.status === 'requires_review').map(unit => ({ ...unit,
    rawText: spans[unit.physicalLine - 1].rawText,
    context: spans.filter(span => Math.abs(span.physicalLine - unit.physicalLine) === 1).map(span => ({ physicalLine: span.physicalLine, rawText: span.rawText })) }));
  return { sourceSha256: sha(bytes), byteLength: bytes.length, header, wholeFile,
    recordBoundariesConfirmed: false, unit: 'physical_line_not_logical_record', units,
    summary: { physicalUnits: units.length, parseableInIsolation: units.length - review.length, requiringReview: review.length,
      recoveredRecords: null, acceptedRecords: null, excludedRecords: 0, repairedCells: 0 }, review };
}

export function prepareE26Sources(sources: Sources) {
  const inputHashes = Object.fromEntries(E26_SOURCE_FILES.map(name => [name, sha(sources[name])]));
  const criteria = parsedRows(sources['acceptance_criteria_data.csv'], ['ID', 'Descrição']);
  const criterionIds = criteria.map(row => row.value.ID);
  if (new Set(criterionIds).size !== criterionIds.length || criterionIds.some(id => !/^[0-9]+$/.test(id))) throw new Error('Acceptance IDs must be unique literal numeric strings; do not infer replacements.');
  const taxonomy = parseRecommenderTaxonomy({ schemaVersion: 1, id: 'ednaldo-acceptance-criteria', version: 'zenodo-16133793.1',
    name: 'E26 — Acceptance criteria, Zenodo 16133793', kind: 'list', selection: 'any',
    source: `Zenodo 10.5281/zenodo.16133793; acceptance_criteria_data.csv; SHA-256 ${inputHashes['acceptance_criteria_data.csv']}; CC BY 4.0; local node IDs ca_<literal source ID>; unchanged descriptions; draft, not published.`,
    nodes: criteria.map(row => ({ id: `ca_${row.value.ID}`, name: row.value['Descrição'], description: row.value['Descrição'], parentId: null })) });
  const criterionMapping = criteria.map(row => ({ sourceFile: 'acceptance_criteria_data.csv', ordinal: row.ordinal, line: row.line,
    sourceId: row.value.ID, nodeId: `ca_${row.value.ID}`, description: row.value['Descrição'] }));
  const profiles = parsedRows(sources['categorized_user_stories.csv'], ['Módulo', 'Operação', 'Tarefa', 'ID (mapeamento)', 'Projeto', 'ID_US', 'DESC_US', 'Plataforma', 'ID_Task', 'DESC_Task', 'Tipo', 'Mapeado? (SIM ou NAO)', 'Origem']);
  const links = parsedRows(sources['user_stories_test_cases.csv'], ['Projeto', 'ID_US', 'ID_TC', 'CA', 'RNFs', 'ID_STD_AC']);
  if ([...profiles, ...links].some(row => !identity(row.value).project || !identity(row.value).storyId)) throw new Error('Missing story/project identity requires explicit review.');
  const groups = new Map<string, typeof profiles>();
  for (const row of profiles) groups.set(key(row.value), [...(groups.get(key(row.value)) ?? []), row]);
  const fields = ['Módulo', 'Operação', 'Plataforma'];
  const profileReview = [...groups].flatMap(([, rows]) => {
    const missingFields = fields.filter(field => rows.every(row => !row.value[field].trim()));
    const multipleValues = fields.flatMap(field => {
      const values = [...new Set(rows.map(row => row.value[field].trim()).filter(Boolean))];
      return values.length > 1 ? [{ field, values: values.map(value => ({ value, lines: rows.filter(row => row.value[field].trim() === value).map(row => row.line) })) }] : [];
    });
    if (!missingFields.length && !multipleValues.length) return [];
    // Preserve observed pairs and their co-occurrence. No Cartesian product or choice of a winner.
    const pairs = new Map<string, { module: string; operation: string; lines: number[] }>();
    for (const row of rows) {
      const module = row.value['Módulo'], operation = row.value['Operação'], pairKey = JSON.stringify([module, operation]);
      const pair = pairs.get(pairKey) ?? { module, operation, lines: [] }; pair.lines.push(row.line); pairs.set(pairKey, pair);
    }
    return [{ comparisonIdentity: identity(rows[0].value), missingFields, multipleValues,
      reason: 'Missing or multiple values require source/method review; multiple labels are not automatically data errors.',
      observedClassificationPairs: [...pairs.values()],
      sourceRows: rows.map(row => ({ ordinal: row.ordinal, line: row.line, rawProject: row.value.Projeto, rawStoryId: row.value.ID_US,
        module: row.value['Módulo'], operation: row.value['Operação'], platform: row.value.Plataforma })) }];
  });
  const unmatchedLinks = links.filter(row => !groups.has(key(row.value))).map(row => ({ ordinal: row.ordinal, line: row.line,
    rawProject: row.value.Projeto, rawStoryId: row.value.ID_US, comparisonIdentity: identity(row.value) }));
  return { taxonomy, report: snapshotContent({ schemaVersion: 1, version: E26_PREPARATION_VERSION,
    scope: 'source_review_preparation_only', scientificReproduction: false, readyForScientificExecution: false,
    inputHashes, transformation: { originalBytesChanged: false, correctedCells: 0, excludedRecords: 0,
      taxonomy: { state: 'draft_not_published', idRule: 'ca_<literal_source_ID>', textRule: 'exact_source_description_in_name_and_description',
        hierarchy: 'none_list', sha256: snapshotContent(taxonomy).sha256, mapping: criterionMapping } },
    associations: reviewAssociationLines(sources['test_cases_for_user_stories.csv']),
    profiles: { comparisonPolicy: 'trim_project_and_story_remove_single_leading_hash_no_other_aliases',
      uniqueComparisonIdentities: groups.size, missingFields: profileReview.filter(row => row.missingFields.length).length,
      multipleValues: profileReview.filter(row => row.multipleValues.length).length, review: profileReview },
    links: { unmatchedPhysicalRows: unmatchedLinks.length, unmatchedComparisonIdentities: new Set(unmatchedLinks.map(row => JSON.stringify(row.comparisonIdentity))).size,
      unmatchedRows: unmatchedLinks },
    limits: ['physical_lines_are_not_recovered_records', 'no_automatic_repairs_or_exclusions', 'no_complete_test_catalog_or_domain_inferred',
      'no_experimental_subset_or_fold_inferred', 'Q01_Q02_Q03_open', 'no_operational_import'] }) };
}
