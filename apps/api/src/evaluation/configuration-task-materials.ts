import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { snapshotContent } from '../domain/content-snapshot.js';
import { buildImportPreview, selectImportRecords } from '../domain/dataset-import.js';
import { snapshotDefinitionPublication } from '../domain/definition-publication.js';
import { parseRecommenderDefinition, type RecommendationInput } from '../domain/recommender-definition.js';
import { parseRecommenderTaxonomy } from '../domain/recommender-taxonomy.js';
import { buildTestCaseImportPreview, selectMethodImportRecords } from '../domain/test-case-dataset.js';
import { buildTestCasePublication } from '../domain/test-case-publication.js';
import { legacyNfrInput, simulateConfiguredNfr } from '../services/configured-nfr.js';
import type { NfrProfile } from '../services/nfr-engine.js';
import { executeMethodRecommendation } from '../services/method-execution.js';
import { validateImplementedDefinition } from '../services/recommender-methods.js';

export const CONFIGURATION_TASK_PACK_VERSION = 'configuration-task-pack-v1';
export type ConfigurationTaskSeeds = {
  rnfDefinition: unknown; testDefinition: unknown;
  baseline: { profiles: Record<string, NfrProfile> };
  equations: { target: RecommendationInput; dataset: { records: RecommendationInput[] }; expected: { rankedIds: string[]; neighborIds: string[]; scores: Record<string, number> } };
  catalog: Record<string, unknown>;
};
const sha = (value: Uint8Array | string) => createHash('sha256').update(value).digest('hex');
const json = (value: unknown) => JSON.stringify(value, null, 2) + '\n';
const offlineId = '00000000-0000-4000-8000-000000000001';
const useReference = 'US-Agent configuration task pack; technical demonstration, not original empirical data.';

/** Creates reviewable exercises and checks their imports/runs offline; it does not publish or observe participant work. */
export function buildConfigurationTaskPack(namespace: string, seeds: ConfigurationTaskSeeds) {
  if (!/^[a-z][a-z0-9_-]{0,23}$/.test(namespace)) throw new Error('Task namespace requires 1–24 lowercase identifier characters.');
  const files: Record<string, string> = {};
  const makeTaxonomy = (suffix: string, nodes: Array<{ id: string; name: string }>) => parseRecommenderTaxonomy({
    schemaVersion: 1, id: `${namespace}-${suffix}`, version: '1', name: `Configuration exercise — ${suffix}`,
    source: 'US-Agent technical exercise; synthetic context/criteria only.', kind: 'list', selection: 'any',
    nodes: nodes.map(node => ({ ...node, description: node.name, parentId: null }))
  });
  const rnfTax = makeTaxonomy('context', [{ id: 'pilot', name: 'Pilot context' }]);
  const testTax = makeTaxonomy('criteria', [{ id: 'required', name: 'Required' }, { id: 'unique', name: 'Unique' }]);
  const taxReference = (tax: typeof rnfTax) => { const snapshot = snapshotContent(tax); return { id: tax.id, version: tax.version, format: snapshot.format, sha256: snapshot.sha256 }; };
  const rnfDefinition = parseRecommenderDefinition({ ...parseRecommenderDefinition(seeds.rnfDefinition), id: `${namespace}-rnf`, version: '1' });
  rnfDefinition.attributes.push({ id: 'study_context', name: 'Study context', valueType: { type: 'taxonomy_node', taxonomy: taxReference(rnfTax) },
    scope: 'artifact', cardinality: 'single', required: true, role: 'context', representation: 'none' });
  const testDefinition = parseRecommenderDefinition({ ...parseRecommenderDefinition(seeds.testDefinition), id: `${namespace}-tests`, version: '1' });
  testDefinition.attributes.find(row => row.id === 'acceptance_criteria')!.valueType = { type: 'taxonomy_node', taxonomy: taxReference(testTax) };
  const publication = (draft: typeof rnfDefinition, tax: typeof rnfTax) => {
    const taxonomies = [{ state: 'published' as const, snapshot: snapshotContent(tax) }];
    const implemented = validateImplementedDefinition(draft, taxonomies);
    return snapshotDefinitionPublication({ schemaVersion: 1, definition: { ...draft, state: 'published' }, taxonomies,
      implementation: { methodId: draft.method.id, adapterVersion: implemented.adapterVersion } });
  };
  const rnfPublication = publication(rnfDefinition, rnfTax), testPublication = publication(testDefinition, testTax);
  const ref = (id: string, version: string, snapshot: { format: string; sha256: string }) => ({ id, version, format: snapshot.format, sha256: snapshot.sha256 });
  const rnfRef = ref(rnfDefinition.id, '1', rnfPublication), testRef = ref(testDefinition.id, '1', testPublication);
  // Reconstructed compatibility profiles retain their scientific values; only exercise context and transport IDs are added.
  const baseRnf = parseRecommenderDefinition(seeds.rnfDefinition);
  const rnfTarget = legacyNfrInput(baseRnf, seeds.baseline.profiles.fa, 'exercise-rnf-target', useReference);
  rnfTarget.values.nfrs = [];
  const rnfHistory = legacyNfrInput(baseRnf, seeds.baseline.profiles.f4, 'exercise-rnf-neighbor', useReference);
  const baselineResult = simulateConfiguredNfr(baseRnf, rnfTarget, { id: 'exercise-rnf-base', version: '1', source: useReference, records: [rnfHistory] }, 0).result;
  rnfTarget.values.study_context = 'pilot'; rnfHistory.values.study_context = 'pilot';
  const testTarget = structuredClone(seeds.equations.target);
  if (testTarget.values.test_case_ids !== undefined) throw new Error('Task target must withhold test answers.');
  const testRecords = seeds.equations.dataset.records.filter(row => seeds.equations.expected.rankedIds.includes(row.id)).map(row => structuredClone(row));
  if (testRecords.length !== seeds.equations.expected.rankedIds.length) throw new Error('Task history differs from the declared technical fixture selection.');
  const catalog = { ...structuredClone(seeds.catalog), id: `${namespace}-catalog`, version: '1' };
  const catalogText = json(catalog);
  const catalogPublication = buildTestCasePublication(Buffer.from(catalogText), 'catalog.json', { expectedFileSha256: sha(catalogText),
    authorization: { basis: 'synthetic', reference: useReference } });
  const catalogRef = ref(catalog.id, '1', catalogPublication);
  const source = { description: useReference, authorization: { basis: 'synthetic' as const, reference: useReference } };
  const mapping = (definition: typeof rnfDefinition) => ({ recordId: ['id'], attributes: Object.fromEntries(definition.attributes.map(attribute =>
    [attribute.id, { path: ['values', attribute.id], encoding: 'value' as const }])) });
  const rnfSpec = { schemaVersion: 1 as const, id: `${namespace}-rnf-base`, version: '1', definition: rnfRef, format: 'json' as const, source, mapping: mapping(rnfDefinition) };
  const testSpec = { schemaVersion: 2 as const, id: `${namespace}-test-base`, version: '1', definition: testRef, catalog: catalogRef, format: 'json' as const, source, mapping: mapping(testDefinition) };
  const rnfPreview = buildImportPreview(rnfSpec, Buffer.from(json([rnfHistory])), 'dataset.json', rnfPublication.content);
  const testPreview = buildTestCaseImportPreview(testSpec, Buffer.from(json(testRecords)), 'dataset.json', testPublication.content, catalogPublication.content);
  const publishedData = (preview: typeof rnfPreview | typeof testPreview, records: RecommendationInput[]) => ({
    schemaVersion: preview.schemaVersion, importerVersion: preview.importerVersion, id: preview.spec.id, version: '1', definition: preview.spec.definition,
    source: preview.spec.source, import: { id: offlineId, previewSha256: snapshotContent(preview).sha256, fileSha256: preview.file.sha256 },
    mapping: preview.spec.mapping, selection: { excludedOrdinals: [], includedOrdinals: preview.report.rows.map(row => row.ordinal) }, records,
    ...(preview.schemaVersion === 2 ? { catalog: preview.spec.catalog } : {})
  });
  const rnfDataset = publishedData(rnfPreview, selectImportRecords(rnfPreview, []).records);
  const testDataset = publishedData(testPreview, selectMethodImportRecords(testPreview, []).records);
  const rnfRun = executeMethodRecommendation({ id: offlineId, definition: rnfRef, dataset: ref(rnfSpec.id, '1', snapshotContent(rnfDataset)),
    input: rnfTarget, selection: { labelIndex: 0 } }, rnfPublication.content, rnfDataset);
  const testRun = executeMethodRecommendation({ id: offlineId, definition: testRef, dataset: ref(testSpec.id, '1', snapshotContent(testDataset)),
    catalog: catalogRef, input: testTarget }, testPublication.content, testDataset, catalogPublication.content);
  assert.deepEqual(rnfRun.result, baselineResult, 'Adding context changed the RNF method result.');
  if (testRun.schemaVersion !== 2) throw new Error('Wrong method selected for test task.');
  assert.deepEqual(testRun.result.content.neighbors.map(row => row.recordId), seeds.equations.expected.neighborIds);
  for (const item of testRun.result.content.items) assert.equal(item.score, seeds.equations.expected.scores[item.testCaseId]);
  for (const [name, value] of Object.entries({
    'participant/rnf/dataset.json': [rnfHistory], 'participant/rnf/target.json': rnfTarget,
    'participant/rnf/settings.json': { definitionId: rnfDefinition.id, version: '1', datasetId: rnfSpec.id, taxonomy: rnfTax,
      additionalAttribute: rnfDefinition.attributes.at(-1), labelIndex: 0, source },
    'participant/tests/dataset.json': testRecords, 'participant/tests/target.json': testTarget,
    'participant/tests/settings.json': { definitionId: testDefinition.id, version: '1', datasetId: testSpec.id, taxonomy: testTax,
      attributeId: 'acceptance_criteria', attributeType: 'taxonomy_node', catalogId: catalog.id, source },
    'facilitator/answer-key.json': { schemaVersion: 1, version: CONFIGURATION_TASK_PACK_VERSION, namespace, scope: 'offline_technical_oracle_not_participant_or_empirical_evidence',
      rnf: { definition: rnfDefinition, definitionSnapshot: rnfPublication, importSpec: rnfSpec, expectedValidRows: 1, expectedExcludedOrdinals: [], result: rnfRun.result },
      tests: { definition: testDefinition, definitionSnapshot: testPublication, importSpec: testSpec, expectedValidRows: testRecords.length,
        expectedExcludedOrdinals: [], result: testRun.result },
      limits: ['offline_import_UUID_is_not_a_database_publication', 'dataset_and_run_hashes_must_be_taken_from_actual_participant_artifacts',
        'no_original_empirical_dataset', 'no_participant_observation', 'third_no_US_example_not_available'] }
  })) files[name] = json(value);
  files['participant/tests/catalog.json'] = catalogText;
  files['facilitator/checkpoints.csv'] = 'task,criterion,actual_id,actual_version,actual_sha256,evidence_file,review_status\r\n' +
    [['rnf', ['definition','taxonomy','dataset','run','replay']], ['tests', ['definition','taxonomy','catalog','dataset','run','replay']]].flatMap(([task, criteria]) =>
      (criteria as string[]).map(criterion => `${task},${criterion},,,,,pending\r\n`)).join('');
  files['facilitator/attempt-register.csv'] = 'participant_code,planned_order,task,attempt,session_id,status,reason_code\r\n';
  return { files, verification: snapshotContent({ version: CONFIGURATION_TASK_PACK_VERSION, namespace, offlineOnly: true, participantStudyPerformed: false,
    rnf: { validRows: rnfPreview.report.valid, result: rnfRun.result, extraContextDoesNotChangeResult: true },
    tests: { validRows: testPreview.report.valid, neighbors: testRun.result.content.neighbors.map(row => row.recordId), result: testRun.result },
    excludedRows: 0, sourceRecordValuesPreservedExceptDeclaredContextAndTargetAnswerWithholding: true }) };
}
