import { createHash } from 'node:crypto';
import { z } from 'zod';
import { snapshotContent } from '../domain/content-snapshot.js';
import { buildTestCaseImportPreview, selectMethodImportRecords } from '../domain/test-case-dataset.js';
import { executeTestCaseRecommendation } from '../services/method-execution.js';
import { TESTREC_EVALUATION_VERSION, testrecEvaluationBundleSchema } from './testrec-evaluation.js';

const annotationsSchema = z.strictObject({ schemaVersion: z.literal(1), kind: z.literal('authored_synthetic_judgment'), source: z.string().min(1),
  cases: z.array(z.strictObject({ id: z.string(), variant: z.enum(['standard', 'empty-associations', 'two-neighbors', 'invalid-platform']),
    expectedStatus: z.enum(['completed', 'no_items', 'blocked', 'technical_failure']), testCaseIds: z.array(z.string()).nullable() })) });
function uuid(value: string) {
  const hex = createHash('sha256').update(value).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/** Reuse a preserved synthetic publication as input, never its ranking as relevance. No database or provider. */
export function buildTestrecPilot(evidenceText: string, annotationText: string) {
  const evidence = JSON.parse(evidenceText);
  if (snapshotContent(evidence.content).sha256 !== evidence.sha256) throw new Error('Invalid source evidence hash.');
  const original = evidence.content.runs[0].snapshot;
  if (snapshotContent(original.content).sha256 !== original.sha256) throw new Error('Invalid preserved run hash.');
  const seed = original.content as ReturnType<typeof executeTestCaseRecommendation>;
  const annotations = annotationsSchema.parse(JSON.parse(annotationText));
  const definition = seed.definition.content, catalog = seed.catalog.content;
  const bindings = definition.definition.method.bindings;
  const ref = (id: string, version: string, value: { format: 'us-agent-json-v1'; sha256: string }) => ({ id, version, format: value.format, sha256: value.sha256 });
  const defRef = ref(definition.definition.id, definition.definition.version, snapshotContent(definition));
  const catRef = ref(catalog.id, catalog.version, snapshotContent(catalog));
  const cases = annotations.cases.map(item => {
    const input = structuredClone(seed.request.content.input);
    input.id = `pilot-${item.id}`;
    input.values[bindings.story_id] = `held-out-${item.id}`;
    input.values[bindings.test_case_ids] = [];
    const records = structuredClone(seed.dataset.content.records).slice(0, item.variant === 'two-neighbors' ? 2 : undefined);
    if (item.variant === 'empty-associations') records.forEach(row => { row.values[bindings.test_case_ids] = []; });
    const spec = { schemaVersion: 2 as const, id: `testrec-pilot-${item.id}`, version: '1', format: 'json' as const,
      definition: defRef, catalog: catRef, source: { description: 'Synthetic offline evaluator verification, not an author dataset',
        authorization: { basis: 'synthetic' as const, reference: 'research/pilots/testrec-v1/protocol.md' } },
      mapping: { recordId: ['id'], attributes: Object.fromEntries(definition.definition.attributes.map(attribute => [attribute.id, { path: ['values', attribute.id], encoding: 'value' as const }])) } };
    const preview = snapshotContent(buildTestCaseImportPreview(spec, Buffer.from(JSON.stringify(records)), 'synthetic.json', definition, catalog));
    const selection = selectMethodImportRecords(preview.content, []);
    const dataset = { schemaVersion: 2, importerVersion: 'test-case-dataset-import-v1', id: spec.id, version: spec.version,
      definition: defRef, catalog: catRef, source: spec.source,
      import: { id: uuid(`import:${item.id}`), previewSha256: preview.sha256, fileSha256: preview.content.file.sha256 },
      mapping: spec.mapping, selection: { includedOrdinals: selection.includedOrdinals, excludedOrdinals: [] }, records: selection.records };
    if (item.variant === 'invalid-platform') input.values[bindings.platforms] = 'invalid-array';
    return { id: item.id, definition, dataset, catalog,
      request: { id: uuid(`request:${item.id}`), definition: defRef, dataset: ref(dataset.id, dataset.version, snapshotContent(dataset)), catalog: catRef, input },
      partition: { source: 'Authored synthetic identities/groups; no claim of project independence inferred from feature equality.',
        targetGroup: 'held-out-target', history: records.map(row => ({ recordId: row.id, group: 'synthetic-history' })) },
      expectedStatus: item.expectedStatus, relevance: item.testCaseIds === null ? null : {
        kind: annotations.kind, source: annotations.source, catalog: catRef, testCaseIds: item.testCaseIds } };
  });
  return testrecEvaluationBundleSchema.parse({ schemaVersion: 1, id: 'testrec-synthetic-pilot-v1', kind: 'synthetic_technical_pilot',
    protocol: { version: TESTREC_EVALUATION_VERSION, method: 'us_agent_e21_equations_demo_v1', repetitions: 2,
      partition: 'declared_group_holdout', matching: 'exact_test_id_within_catalog_publication', undefinedRatio: 'null',
      failurePolicy: 'empty_prediction_with_failure_status', returnedSet: 'all_method_items', tuning: 'none', configurationStudy: 'not_performed', scientificReproduction: false }, cases });
}
