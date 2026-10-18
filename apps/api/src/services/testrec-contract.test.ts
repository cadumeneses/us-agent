import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { snapshotContent } from '../domain/content-snapshot.js';
import { snapshotTestCaseCatalog } from '../domain/test-case-catalog.js';
import { parseRecommenderDefinition } from '../domain/recommender-definition.js';
import { validateConfiguredNfrDefinition } from './configured-nfr.js';
import { inspectTestrecData } from './testrec-contract.js';

const root = new URL('../../../../', import.meta.url);
const read = (file: string) => JSON.parse(readFileSync(new URL(file, root), 'utf8'));
function fixture() {
  const definition = parseRecommenderDefinition(read('config/recommenders/testrec-e21.draft.json'));
  const source = read('research/examples/testrec-e21/table-4-5.json');
  const target = source.dataset.records.find((row: { id: string }) => row.id === source.targetId);
  const dataset = { ...source.dataset, records: source.dataset.records.filter((row: { id: string }) => source.candidateIds.includes(row.id)) };
  const catalog = read('research/examples/testrec-e21/synthetic-catalog.json');
  return { definition, source, target, dataset, catalog };
}

test('E21 data contract reuses configurable attributes and exactly reconstructs table 4.6 without applying RNF module/operation eligibility', () => {
  const { definition, source, target, dataset } = fixture();
  const before = snapshotContent({ definition, target, dataset }).sha256;
  const result = inspectTestrecData(definition, target, dataset).content;
  assert.equal(result.canRecommend, false); assert.equal(result.mode, 'data_contract_only');
  assert.deepEqual(result.representation.dimensions.map(item => item.label), source.expected.dimensions);
  assert.deepEqual(result.representation.targetVector, source.expected.targetVector);
  assert.equal(result.representation.candidates.length, 4);
  for (const row of result.representation.candidates) {
    assert.deepEqual(row.vector, source.expected.candidateVectors[row.recordId]);
    assert.deepEqual(row.tests, { state: 'not_provided', ids: null });
    assert.equal('similarity' in row, false);
  }
  assert.equal(snapshotContent({ definition, target, dataset }).sha256, before);
  assert.throws(() => validateConfiguredNfrDefinition(definition));
  assert.throws(() => inspectTestrecData({ ...definition, state: 'published' }, target, dataset), /rascunho/);
});

test('test-case catalog preserves Gherkin, source metadata and immutable content; IDs define identity independently from titles', () => {
  const { catalog } = fixture(); catalog.items[1].title = catalog.items[0].title;
  const snapshot = snapshotTestCaseCatalog(catalog), before = snapshot.content.items[0].gherkin;
  catalog.items[0].gherkin = 'Changed externally';
  assert.equal(snapshot.content.items[0].gherkin, before); assert.match(before, /\nQuando/);
  assert.equal(snapshot.content.items[1].metadata!.extraSourceField, 'Preserve without inventing scientific meaning');
  assert.equal(Object.isFrozen(snapshot.content.items[0]), true);
  assert.notEqual(snapshot.content.items[0].id, snapshot.content.items[1].id);
  catalog.items[1].id = catalog.items[0].id; assert.throws(() => snapshotTestCaseCatalog(catalog), /duplicado/);
});

test('missing associations remain unknown, explicit empty associations remain known, and nonempty associations require the exact source catalog', () => {
  const { definition, target, dataset, catalog } = fixture();
  dataset.source = 'Synthetic links over illustrative E21 profiles; not original test associations';
  dataset.records[0].provenance.source = 'Synthetic association fixture';
  dataset.records[0].values.test_case_ids = ['demo-create'];
  dataset.records[1].values.test_case_ids = [];
  assert.throws(() => inspectTestrecData(definition, target, dataset), /catálogo/);
  const result = inspectTestrecData(definition, target, dataset, catalog).content;
  assert.equal(result.catalog!.sha256, snapshotTestCaseCatalog(catalog).sha256);
  assert.deepEqual(result.representation.candidates[0].tests, { state: 'known', ids: ['demo-create'] });
  assert.deepEqual(result.representation.candidates[1].tests, { state: 'known', ids: [] });
  assert.deepEqual(result.representation.candidates[2].tests, { state: 'not_provided', ids: null });
  dataset.records[0].values.test_case_ids.push('demo-create');
  assert.throws(() => inspectTestrecData(definition, target, dataset, catalog), /duplicada/);
  dataset.records[0].values.test_case_ids = ['unknown']; assert.throws(() => inspectTestrecData(definition, target, dataset, catalog), /inexistente/);
});

test('bindings support renamed attributes and added context without code changes; extra candidate features do not alter target dimensions', () => {
  const { definition, target, dataset } = fixture();
  definition.attributes.find(item => item.id === 'acceptance_criteria')!.id = 'criteria';
  definition.method.bindings.acceptance_criteria = 'criteria';
  for (const input of [target, ...dataset.records]) { input.values.criteria = input.values.acceptance_criteria; delete input.values.acceptance_criteria; }
  definition.attributes.push({ id: 'review_note', name: 'Nota', valueType: { type: 'text' }, scope: 'artifact', cardinality: 'single', required: false, role: 'context', representation: 'none' });
  target.values.review_note = 'Manual context only'; dataset.records[0].values.platforms.push('Mobile');
  const result = inspectTestrecData(definition, target, dataset).content;
  assert.equal(result.representation.dimensions.length, 8);
  assert.deepEqual(result.representation.candidates[0].vector, [1, 0, 1, 0, 0, 0, 1, 1]);
  definition.attributes.find(item => item.id === 'module')!.role = 'filter';
  definition.attributes.find(item => item.id === 'module')!.representation = 'none';
  assert.throws(() => inspectTestrecData(definition, target, dataset), /incompatível/);
});

test('acceptance criteria can use an independently pinned taxonomy by ID without inventing the full original catalog', () => {
  const { definition, target, dataset } = fixture();
  const ids = [...new Set<string>([target, ...dataset.records].flatMap(row => row.values.acceptance_criteria))];
  const content = { schemaVersion: 1, id: 'illustrated-criteria-ids', version: '1', name: 'IDs ilustrados; catálogo parcial', kind: 'list', selection: 'any',
    source: 'E21 table 4.5 IDs only; labels below are technical placeholders, not original templates',
    nodes: ids.map(id => ({ id: `c${id}`, name: `ID ilustrativo ${id}`, description: 'Descrição original indisponível nesta amostra', parentId: null })) };
  const snapshot = snapshotContent(content), dependency = { state: 'published', snapshot };
  definition.attributes.find(item => item.id === 'acceptance_criteria')!.valueType = { type: 'taxonomy_node', taxonomy: { id: content.id, version: content.version, format: snapshot.format, sha256: snapshot.sha256 } };
  for (const input of [target, ...dataset.records]) input.values.acceptance_criteria = input.values.acceptance_criteria.map((id: string) => `c${id}`);
  const result = inspectTestrecData(definition, target, dataset, undefined, [dependency]).content;
  assert.deepEqual(result.representation.candidates[0].vector, [1, 0, 1, 0, 0, 0, 1, 1]);
  assert.equal(result.taxonomies.content[0].snapshot.sha256, snapshot.sha256);
  target.values.acceptance_criteria = ['c999']; assert.throws(() => inspectTestrecData(definition, target, dataset, undefined, [dependency]));
});
