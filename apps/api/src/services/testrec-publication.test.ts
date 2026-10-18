import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { snapshotContent } from '../domain/content-snapshot.js';
import { snapshotDefinitionPublication } from '../domain/definition-publication.js';
import { buildTestCasePublication } from '../domain/test-case-publication.js';
import { buildTestCaseImportPreview, selectMethodImportRecords } from '../domain/test-case-dataset.js';
import { executeMethodRecommendation, executeTestCaseRecommendation, canReplayMethod } from './method-execution.js';
import { validateImplementedDefinition } from './recommender-methods.js';
import { validateTestrecDefinition } from './testrec-method.js';
import { legacyNfrInput } from './configured-nfr.js';
import { executePublishedRecommendation } from './recommendation-execution.js';

const root = new URL('../../../../', import.meta.url);
const read = (file: string) => JSON.parse(readFileSync(new URL(file, root), 'utf8'));
const ref = (snapshot: { format: string; sha256: string }, id: string, version: string) => ({ id, version, format: snapshot.format, sha256: snapshot.sha256 });
function fixture() {
  const draft = read('config/recommenders/testrec-equations.draft.json');
  const source = read('research/examples/testrec-e21/equations-synthetic.json');
  const catalogBytes = Buffer.from(JSON.stringify(read('research/examples/testrec-e21/synthetic-catalog.json')));
  const catalog = buildTestCasePublication(catalogBytes, 'synthetic.json', { expectedFileSha256: createHash('sha256').update(catalogBytes).digest('hex'),
    authorization: { basis: 'synthetic', reference: 'US-Agent test fixture' } });
  const definition = snapshotDefinitionPublication({ schemaVersion: 1, definition: { ...draft, state: 'published' }, taxonomies: [],
    implementation: { methodId: draft.method.id, adapterVersion: validateImplementedDefinition(draft).adapterVersion } });
  const spec = { schemaVersion: 2, id: source.dataset.id, version: '1', format: 'json', definition: ref(definition, draft.id, draft.version),
    catalog: ref(catalog, catalog.content.id, catalog.content.version), source: { description: 'Synthetic profiles and associations', authorization: { basis: 'synthetic', reference: 'Authored fixture' } },
    mapping: { recordId: ['id'], attributes: Object.fromEntries(draft.attributes.map((attribute: { id: string }) => [attribute.id, { path: ['values', attribute.id], encoding: 'value' }])) } };
  const bytes = Buffer.from(JSON.stringify(source.dataset.records));
  const preview = buildTestCaseImportPreview(spec, bytes, 'profiles.json', definition.content, catalog.content);
  const selected = selectMethodImportRecords(preview, [5]);
  const { records, ...selection } = selected;
  const dataset = snapshotContent({ schemaVersion: 2, importerVersion: preview.importerVersion, id: spec.id, version: spec.version,
    definition: spec.definition, catalog: spec.catalog, source: spec.source,
    import: { id: 'f9530b0b-4b89-4fb5-a19d-a591d9e6d4ca', previewSha256: snapshotContent(preview).sha256, fileSha256: preview.file.sha256 }, mapping: spec.mapping, selection, records });
  const request = { id: '9c0cc598-5464-4369-bca9-4ab7bf82c155', definition: spec.definition,
    dataset: ref(dataset, spec.id, spec.version), catalog: spec.catalog, input: source.target };
  return { draft, definition, catalog, spec, source, bytes, preview, dataset, request };
}

test('E21 demonstration has its own publishable identity and refuses scientific parameter drift or unimplemented methods', () => {
  const { draft } = fixture();
  assert.equal(validateImplementedDefinition(draft).definition.method.id, 'us_agent_e21_equations_demo_v1');
  for (const change of [{ k: 2 }, { similarity: 'euclidean' }, { scientific_reproduction: true }, { sources: 'original_dataset' }]) {
    assert.throws(() => validateTestrecDefinition({ ...draft, method: { ...draft.method, parameters: { ...draft.method.parameters, ...change } } }));
  }
  assert.throws(() => validateImplementedDefinition(read('config/recommenders/testrec-e21.draft.json')));
  draft.attributes.find((row: { id: string }) => row.id === 'module').role = 'filter';
  draft.attributes.find((row: { id: string }) => row.id === 'module').representation = 'none';
  assert.throws(() => validateTestrecDefinition(draft), /binding/);
});

test('test dataset import pins the catalog, preserves unknown versus empty outputs and requires explicit invalid-row exclusions', () => {
  const { spec, bytes, definition, catalog, preview } = fixture();
  assert.equal(preview.report.valid, 4); assert.equal(preview.report.invalid, 1);
  assert.match(preview.report.rows[4].issues[0].message, /unknown/);
  assert.throws(() => selectMethodImportRecords(preview, []));
  assert.equal(selectMethodImportRecords(preview, [5]).records.length, 4);
  const rows = JSON.parse(bytes.toString('utf8')); rows[0].values.test_case_ids = [];
  const empty = buildTestCaseImportPreview(spec, Buffer.from(JSON.stringify(rows)), 'profiles.json', definition.content, catalog.content);
  assert.deepEqual(empty.report.rows[0].input!.values.test_case_ids, []);
  rows[0].values.test_case_ids = ['missing'];
  const invalid = buildTestCaseImportPreview(spec, Buffer.from(JSON.stringify(rows)), 'profiles.json', definition.content, catalog.content);
  assert.equal(invalid.report.rows[0].status, 'invalid');
  for (const [field, value] of [['platforms', []], ['module', ' outer space'], ['test_case_ids', ['demo-create', 'demo-create']]] as const) {
    const malformed = JSON.parse(bytes.toString('utf8')); malformed[0].values[field] = value;
    const rejected = buildTestCaseImportPreview(spec, Buffer.from(JSON.stringify(malformed)), 'profiles.json', definition.content, catalog.content);
    assert.equal(rejected.report.rows[0].status, 'invalid');
    assert.deepEqual(rejected.report.rows[0].issues.at(-1)!.path, [field]);
  }
  assert.throws(() => buildTestCaseImportPreview({ ...spec, catalog: { ...spec.catalog, sha256: '0'.repeat(64) } }, bytes, 'x.json', definition.content, catalog.content), /Catalog/);
  assert.throws(() => buildTestCaseImportPreview({ ...spec, source: { ...spec.source, authorization: { basis: 'permission', reference: 'Declared' } } }, bytes, 'x.json', definition.content, catalog.content), /synthetic/);
});

test('published E21 execution reuses the frozen equations and preserves full catalog/provenance without output mutation', () => {
  const { definition, dataset, catalog, request, source } = fixture();
  const before = snapshotContent({ definition, dataset, catalog, request }).sha256;
  const result = executeTestCaseRecommendation(request, definition.content, dataset.content, catalog.content);
  assert.equal(result.schemaVersion, 2); assert.equal(result.result.content.status, 'completed');
  assert.equal(result.result.content.scientificReproduction, false);
  assert.deepEqual(result.result.content.neighbors.map(row => row.recordId), source.expected.neighborIds);
  for (const item of result.result.content.items) {
    assert.equal(item.score, source.expected.scores[item.testCaseId]);
    assert.deepEqual(item.artifact, catalog.content.catalog.content.items.find(row => row.id === item.testCaseId));
  }
  assert.equal(result.catalog.sha256, catalog.sha256); assert.equal(canReplayMethod(result), true);
  assert.equal(snapshotContent(executeMethodRecommendation(request, definition.content, dataset.content, catalog.content)).sha256, snapshotContent(result).sha256);
  assert.equal(snapshotContent({ definition, dataset, catalog, request }).sha256, before);
  assert.ok(Object.isFrozen(result.catalog.content.catalog.content.items[0]));
});

test('execution rejects wrong catalog/base/adapter, unknown associations and an invented label selection; blocking and empty are distinct', () => {
  const { definition, dataset, catalog, request } = fixture();
  const run = (body: unknown, data: unknown = dataset.content, pub: unknown = definition.content, cat: unknown = catalog.content) => executeTestCaseRecommendation(body, pub, data, cat);
  assert.throws(() => run({ ...request, catalog: { ...request.catalog, sha256: '0'.repeat(64) } }));
  assert.throws(() => run({ ...request, selection: { labelIndex: 0 } }));
  assert.throws(() => run(request, dataset.content, { ...definition.content, implementation: { ...definition.content.implementation, adapterVersion: 'unknown' } }));
  const changed = structuredClone(dataset.content); delete changed.records[0].values.test_case_ids;
  assert.throws(() => run({ ...request, dataset: { ...request.dataset, sha256: snapshotContent(changed).sha256 } }, changed), /known/);
  changed.records.forEach(row => { row.values.test_case_ids = []; });
  assert.equal(run({ ...request, dataset: { ...request.dataset, sha256: snapshotContent(changed).sha256 } }, changed).result.content.status, 'no_items');
  changed.records = changed.records.slice(0, 2);
  assert.equal(run({ ...request, dataset: { ...request.dataset, sha256: snapshotContent(changed).sha256 } }, changed).result.content.status, 'blocked');
  assert.equal(run({ ...request, input: { ...request.input, values: { ...request.input.values, test_case_ids: ['demo-create'] } } }).result.content.status, 'blocked');
});

test('RNF dispatcher keeps every legacy result and envelope unchanged', () => {
  const template = read('config/recommenders/rnf-v2.draft.json'), baseline = read('research/baselines/rnf-v2/reference.json');
  const definition = snapshotDefinitionPublication({ schemaVersion: 1, definition: { ...template, state: 'published' }, taxonomies: [],
    implementation: { methodId: template.method.id, adapterVersion: validateImplementedDefinition(template).adapterVersion } });
  const definitionRef = ref(definition, template.id, template.version);
  const input = (id: string) => legacyNfrInput(template, baseline.profiles[id], id, 'frozen demonstration');
  for (const scenario of baseline.cases) {
    const dataset = snapshotContent({ schemaVersion: 1, importerVersion: 'structured-import-v1', id: 'legacy-base', version: '1', definition: definitionRef,
      source: { description: 'Synthetic regression', authorization: { basis: 'synthetic', reference: 'Frozen demonstration' } },
      import: { id: 'f9530b0b-4b89-4fb5-a19d-a591d9e6d4ca', previewSha256: '0'.repeat(64), fileSha256: '0'.repeat(64) },
      mapping: { recordId: ['id'], attributes: {} }, selection: { excludedOrdinals: [], includedOrdinals: scenario.historyIds.map((_: string, i: number) => i + 1) },
      records: scenario.historyIds.map(input) });
    const request = { id: '9c0cc598-5464-4369-bca9-4ab7bf82c155', definition: definitionRef, dataset: ref(dataset, 'legacy-base', '1'),
      input: input(scenario.targetId), selection: { labelIndex: scenario.labelIndex } };
    const result = executeMethodRecommendation(request, definition.content, dataset.content);
    assert.deepEqual(result, executePublishedRecommendation(request, definition.content, dataset.content), scenario.id);
    assert.deepEqual(result.result.content, scenario.expected, scenario.id);
  }
});
