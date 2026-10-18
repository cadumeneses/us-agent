import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { snapshotContent } from '../domain/content-snapshot.js';
import { parseRecommenderDefinition, type AttributeDefinition, type MemoryDataset } from '../domain/recommender-definition.js';
import { checkNfrBaseline } from '../evaluation/nfr-baseline.js';
import type { RecommenderTaxonomy } from '../domain/recommender-taxonomy.js';
import { legacyNfrInput, simulateConfiguredNfr } from './configured-nfr.js';
import type { NfrProfile, NfrResult } from './nfr-engine.js';

const root = new URL('../../../../', import.meta.url);
const text = readFileSync(new URL('research/baselines/rnf-v2/reference.json', root), 'utf8');
const manifest = readFileSync(new URL('research/baselines/rnf-v2/manifest.json', root), 'utf8');
const reference = JSON.parse(text) as { profiles: Record<string, NfrProfile>; cases: Array<{ id: string; targetId: string; historyIds: string[]; labelIndex: number; expected: NfrResult }> };
const loadDefinition = () => parseRecommenderDefinition(JSON.parse(readFileSync(new URL('config/recommenders/rnf-v2.draft.json', root), 'utf8')));
function scenario(index = 0, definition = loadDefinition()) {
  const item = reference.cases[index];
  const input = legacyNfrInput(definition, reference.profiles[item.targetId], item.targetId, 'frozen demonstration');
  const dataset: MemoryDataset = { id: 'frozen-demo', version: '1', source: 'reconstructed_demonstration',
    records: item.historyIds.map(id => legacyNfrInput(definition, reference.profiles[id], id, 'frozen demonstration')) };
  return { definition, input, dataset, item };
}
const contextAttribute = (id: string, required = false): AttributeDefinition => ({
  id, name: 'Campo configurado', valueType: { type: 'number' }, scope: 'project', cardinality: 'single', required, role: 'context', representation: 'none'
});

test('configured RNF exactly replays all eight frozen results, preserving inputs and reversed-base parity', () => {
  assert.equal(checkNfrBaseline(text, manifest).length, 8);
  for (let index = 0; index < reference.cases.length; index++) {
    const { definition, input, dataset, item } = scenario(index);
    const before = structuredClone({ definition, input, dataset });
    const execution = simulateConfiguredNfr(definition, input, dataset, item.labelIndex);
    assert.deepEqual(execution.result.content, item.expected, item.id);
    assert.deepEqual(simulateConfiguredNfr(definition, input, { ...dataset, records: [...dataset.records].reverse() }, item.labelIndex).result.content, item.expected, item.id);
    assert.deepEqual({ definition, input, dataset }, before);
    for (const snapshot of [execution.definition, execution.input, execution.dataset, execution.selection, execution.result]) {
      assert.equal(snapshotContent(snapshot.content).sha256, snapshot.sha256);
    }
    assert.ok(execution.durationMs >= 0);
  }
});

test('attribute IDs and names can change through configuration while bindings preserve the scientific meaning', () => {
  const config = loadDefinition();
  const platform = config.attributes.find(attribute => attribute.id === 'platforms')!;
  platform.id = 'execution_environments'; platform.name = 'Ambientes de execução';
  config.method.bindings.platforms = platform.id;
  const { definition, input, dataset, item } = scenario(0, config);
  assert.ok('execution_environments' in input.values);
  assert.ok(!('platforms' in input.values));
  assert.deepEqual(simulateConfiguredNfr(definition, input, dataset, item.labelIndex).result.content, item.expected);
});

test('new context attributes are configured and validated without code changes and do not silently enter distance', () => {
  const { definition, input, dataset, item } = scenario();
  definition.attributes.push(contextAttribute('budget'));
  input.values.budget = 5000;
  const run = simulateConfiguredNfr(definition, input, dataset, item.labelIndex);
  assert.equal(run.input.content.values.budget, 5000);
  assert.deepEqual(run.result.content, item.expected);
  input.values.budget = '5000';
  assert.throws(() => simulateConfiguredNfr(definition, input, dataset, item.labelIndex));
  input.values.budget = 5000;
  definition.attributes.find(attribute => attribute.id === 'budget')!.required = true;
  assert.throws(() => simulateConfiguredNfr(definition, input, dataset, item.labelIndex)); // validate the entire base too
  for (const record of dataset.records) record.values.budget = 5000;
  assert.deepEqual(simulateConfiguredNfr(definition, input, dataset, item.labelIndex).result.content, item.expected);
});

test('changing scientific parameters, semantic roles or adding a feature requires a different implemented method', () => {
  const { definition, input, dataset, item } = scenario();
  const attempt = (change: (copy: typeof definition) => void) => {
    const copy = structuredClone(definition); change(copy);
    assert.throws(() => simulateConfiguredNfr(copy, input, dataset, item.labelIndex));
  };
  attempt(copy => { copy.method.parameters.k = 3; });
  attempt(copy => { copy.method.parameters.threshold = 0.5; });
  attempt(copy => { copy.method.id = 'ednaldo_unconfirmed'; });
  attempt(copy => { copy.method.version = 'latest'; });
  attempt(copy => { copy.method.bindings.apis = 'frameworks'; });
  attempt(copy => { copy.attributes.find(attribute => attribute.id === 'platforms')!.scope = 'artifact'; });
  attempt(copy => { copy.attributes.find(attribute => attribute.id === 'labels')!.role = 'feature'; });
  attempt(copy => { copy.attributes.push({ ...contextAttribute('new_dimension'), valueType: { type: 'category' }, role: 'feature', representation: 'presence' }); });
  attempt(copy => { copy.state = 'published'; });
  attempt(copy => { copy.state = 'retired'; });
});

test('invalid records and ambiguous bases fail before producing a recommendation', () => {
  const { definition, input, dataset, item } = scenario();
  const run = (base: unknown) => simulateConfiguredNfr(definition, input, base, item.labelIndex);
  assert.throws(() => run({ ...dataset, records: [...dataset.records, dataset.records[0]] }), /duplicados/);
  const repeatedStory = structuredClone(dataset.records[0]); repeatedStory.id = 'other-record'; repeatedStory.values.classification_id = '900';
  assert.throws(() => run({ ...dataset, records: [...dataset.records, repeatedStory] }), /única classificação/);
  const malformed = structuredClone(dataset); malformed.records[0].values.tasks = [{ category: 123 }];
  assert.throws(() => run(malformed));
  const unknown = structuredClone(dataset); unknown.records[0].values.unmapped = true;
  assert.throws(() => run(unknown));
  const extraField = structuredClone(dataset); extraField.records[0].values.labels = [{ module: 'Registry', operation: 'Retrieve data', extra: true }];
  assert.throws(() => run(extraField));
  assert.equal(run({ ...dataset, records: [] }).result.content.status, 'no_candidates');
});

test('simulation evidence remains detached and immutable, with changes detectable by content hashes', () => {
  const { definition, input, dataset, item } = scenario();
  const execution = simulateConfiguredNfr(definition, input, dataset, item.labelIndex);
  const originalHash = execution.input.sha256;
  input.values.text = 'Altered later'; dataset.records[0].values.text = 'Altered candidate'; definition.name = 'Altered config';
  assert.notEqual(snapshotContent(input).sha256, originalHash);
  assert.notEqual(execution.input.content.values.text, input.values.text);
  assert.notEqual(execution.dataset.content.records[0].values.text, dataset.records[0].values.text);
  assert.notEqual(execution.definition.content.name, definition.name);
  assert.throws(() => { execution.result.content.items.length = 0; }, TypeError);
  assert.throws(() => { execution.input.content.values.text = 'Tampered'; }, TypeError);
  assert.equal(snapshotContent(execution.input.content).sha256, originalHash);
});

test('invalid finite pair selections preserve blocked behavior; non-JSON selections are rejected', () => {
  const { definition, input, dataset } = scenario();
  for (const index of [-1, 0.5, 100]) assert.equal(simulateConfiguredNfr(definition, input, dataset, index).result.content.status, 'blocked');
  for (const index of [NaN, Infinity]) assert.throws(() => simulateConfiguredNfr(definition, input, dataset, index));
});

test('published taxonomies validate configured context fields and are frozen with the RNF evidence', () => {
  const { definition, input, dataset, item } = scenario();
  const content: RecommenderTaxonomy = { schemaVersion: 1, id: 'delivery-context', version: '1', name: 'Contexto sintético',
    kind: 'list', selection: 'any', source: 'Synthetic demonstration only',
    nodes: [{ id: 'academic', name: 'Acadêmico', description: '', parentId: null }] };
  const publication = { state: 'published' as const, snapshot: snapshotContent(content) };
  const { format, sha256 } = publication.snapshot;
  definition.attributes.push({ ...contextAttribute('delivery_context'), cardinality: 'many',
    valueType: { type: 'taxonomy_node', taxonomy: { id: content.id, version: content.version, format, sha256 } } });
  input.values.delivery_context = ['academic'];
  const run = simulateConfiguredNfr(definition, input, dataset, item.labelIndex, [publication]);
  assert.deepEqual(run.result.content, item.expected);
  assert.equal(run.taxonomies.content[0].snapshot.sha256, sha256);
  content.nodes[0].name = 'Alterado depois';
  assert.equal(run.taxonomies.content[0].snapshot.content.nodes[0].name, 'Acadêmico');
  assert.throws(() => { run.taxonomies.content[0].snapshot.content.nodes.length = 0; }, TypeError);
  input.values.delivery_context = ['Acadêmico'];
  assert.throws(() => simulateConfiguredNfr(definition, input, dataset, item.labelIndex, [publication]));
  input.values.delivery_context = ['academic'];
  dataset.records[0].values.delivery_context = ['unknown'];
  assert.throws(() => simulateConfiguredNfr(definition, input, dataset, item.labelIndex, [publication]));
});
