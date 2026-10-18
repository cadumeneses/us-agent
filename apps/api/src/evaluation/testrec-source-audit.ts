import { ImportFormatError, parseImportCsv } from '../domain/import-formats.js';
import { snapshotContent } from '../domain/content-snapshot.js';

export const E26_SOURCE_AUDIT_VERSION = 'e26-source-audit-v1';
export const E26_SOURCE_FILES = ['acceptance_criteria_data.csv', 'categorized_user_stories.csv',
  'test_cases_for_user_stories.csv', 'user_stories_test_cases.csv'] as const;
const required: Record<typeof E26_SOURCE_FILES[number], string[]> = {
  'acceptance_criteria_data.csv': ['ID', 'Descrição'],
  'categorized_user_stories.csv': ['Projeto', 'ID_US', 'Módulo', 'Operação', 'Plataforma'],
  'test_cases_for_user_stories.csv': ['Projeto', 'ID_US', 'ID', 'ID_TC', 'ID_STD_TC'],
  'user_stories_test_cases.csv': ['Projeto', 'ID_US', 'ID_TC', 'CA', 'RNFs', 'ID_STD_AC']
};
type Row = Record<string, string>;
const text = (row: Row, key: string) => row[key]?.trim() ?? '';
// Conservative comparison key only; raw source values/bytes are never rewritten.
function storyKey(row: Row) {
  const project = text(row, 'Projeto'), identity = text(row, 'ID_US').replace(/^#/, '').trim();
  return project && identity ? JSON.stringify([project, identity]) : null;
}
function parse(name: typeof E26_SOURCE_FILES[number], source: string) {
  const parsed = parseImportCsv(source.replace(/^\uFEFF/, ''), ';');
  const headers = parsed.fields.map(value => value.trim());
  if (new Set(headers).size !== headers.length) throw new Error('Header trimming would merge distinct columns.');
  const missingColumns = required[name].filter(key => !headers.includes(key));
  if (missingColumns.length) throw new Error(`Missing columns: ${missingColumns.join(', ')}.`);
  const valid = parsed.rows.filter(row => !row.error).map(row => {
    const raw = row.value as Row;
    return { ordinal: row.ordinal, line: row.line, value: Object.fromEntries(parsed.fields.map((key, index) => [headers[index], raw[key]])) };
  });
  const identities = new Set(valid.map(row => storyKey(row.value)).filter((key): key is string => key !== null));
  return { name, formatError: null, headers: parsed.fields, comparisonHeaders: headers, rows: parsed.rows.length, validRows: valid.length,
    malformedRows: parsed.rows.filter(row => row.error).map(row => ({ ordinal: row.ordinal, line: row.line, error: row.error! })),
    blankValues: Object.fromEntries(headers.map(key => [key, valid.filter(row => !text(row.value, key)).length])),
    uniqueStoryKeys: identities.size, uniqueProjects: new Set(valid.map(row => text(row.value, 'Projeto')).filter(Boolean)).size,
    missingIdentityRows: name === 'acceptance_criteria_data.csv' ? null : valid.filter(row => storyKey(row.value) === null).length,
    valid, identities };
}

function inspect(name: typeof E26_SOURCE_FILES[number], source: string) {
  try { return parse(name, source); }
  catch (error) {
    if (!(error instanceof ImportFormatError)) throw error;
    // Syntax errors prevent reliable row boundaries; unknown counts must never become zero observations.
    let headers: string[] = [];
    try { headers = parseImportCsv(source.replace(/^\uFEFF/, '').split(/\r\n|\n|\r/, 1)[0], ';').fields; }
    catch { /* A malformed header is unknown, independently of body counts. */ }
    return { name, formatError: { message: error.message, line: error.line }, headers, comparisonHeaders: headers.map(key => key.trim()),
      rows: null, validRows: null, malformedRows: [], blankValues: null, uniqueStoryKeys: null, uniqueProjects: null,
      missingIdentityRows: null, valid: [] as Array<{ ordinal: number; line: number | null; value: Row }>, identities: new Set<string>() };
  }
}

/** Source inventory and diagnostics, never a cleaning/import policy or evaluation of recommendation quality. */
export function auditE26Sources(sources: Record<typeof E26_SOURCE_FILES[number], string>) {
  const parsed = E26_SOURCE_FILES.map(name => inspect(name, sources[name]));
  const categorized = parsed.find(row => row.name === 'categorized_user_stories.csv')!;
  const groups = new Map<string, Row[]>();
  for (const row of categorized.valid) {
    const key = storyKey(row.value);
    if (key) groups.set(key, [...(groups.get(key) ?? []), row.value]);
  }
  const slots = ['Módulo', 'Operação', 'Plataforma'];
  const incompleteStories = [...groups].filter(([, rows]) => slots.some(slot => rows.every(row => !text(row, slot))));
  const conflictingStories = [...groups].filter(([, rows]) => slots.some(slot => new Set(rows.map(row => text(row, slot)).filter(Boolean)).size > 1));
  const storiesWithAllRequiredProfileColumns = [...groups].filter(([, rows]) => slots.every(slot => rows.some(row => text(row, slot)))).length;
  const overlaps = parsed.filter(row => row.name !== 'acceptance_criteria_data.csv').map(row => ({ file: row.name,
    matchingCategorizedStoryKeys: row.formatError || categorized.formatError ? null : [...row.identities].filter(key => categorized.identities.has(key)).length,
    absentFromCategorized: row.formatError || categorized.formatError ? null : [...row.identities].filter(key => !categorized.identities.has(key)).length,
    categorizedAbsentFromFile: row.formatError || categorized.formatError ? null : [...categorized.identities].filter(key => !row.identities.has(key)).length }));
  const associations = parsed.find(row => row.name === 'test_cases_for_user_stories.csv')!;
  const standardTestIds = new Set(associations.valid.map(row => text(row.value, 'ID_STD_TC')).filter(Boolean));
  const criteria = parsed.find(row => row.name === 'acceptance_criteria_data.csv')!;
  const criteriaIds = criteria.valid.map(row => text(row.value, 'ID'));
  return snapshotContent({ version: E26_SOURCE_AUDIT_VERSION, scientificReproduction: false, imported: false,
    comparisonPolicy: 'trim_headers_and_values_remove_single_leading_hash_for_story_identity_no_other_alias_resolution',
    files: parsed.map(({ valid: _rows, identities: _identities, ...report }) => report),
    profile: { uniqueStoryKeys: categorized.formatError ? null : groups.size, storiesWithAllRequiredProfileColumns: categorized.formatError ? null : storiesWithAllRequiredProfileColumns,
      incompleteStories: categorized.formatError ? null : incompleteStories.length, conflictingStories: categorized.formatError ? null : conflictingStories.length,
      applicationDomainColumnPresent: categorized.comparisonHeaders.length ? categorized.comparisonHeaders.includes('Domínio') : null,
      // No Gherkin/catalog is fabricated from a test title or standard ID.
      gherkinColumnPresent: parsed.some(row => row.comparisonHeaders.some(key => /gherkin/i.test(key))) ? true : parsed.some(row => !row.comparisonHeaders.length) ? null : false },
    joins: overlaps,
    catalog: { acceptanceCriteria: criteria.formatError ? null : criteriaIds.length, distinctAcceptanceCriterionIds: criteria.formatError ? null : new Set(criteriaIds).size,
      nonemptyStandardTestIds: associations.formatError ? null : standardTestIds.size, standardTestIdsAreCatalogContents: false },
    paperComparison: { reportedOffline: { projects: 13, stories: 217, distinctTestCases: 1077 },
      sourceSubsetConfirmed: false, reason: 'Source files include different row granularities and populations; no selection manifest/folds/code located in this record.' },
    readiness: { readyForScientificExecution: false, blockers: ['confirm_exact_experimental_subset_and_folds',
      'review_malformed_rows_and_missing_fields_without_silent_exclusions', 'resolve_profile_conflicts_and_cross_file_identities',
      'obtain_domain_values_and_complete_test_artifacts', 'confirm_Euclidean_similarity_and_item_associations',
      'confirm_per_target_counts_and_metric_aggregation'] } });
}
