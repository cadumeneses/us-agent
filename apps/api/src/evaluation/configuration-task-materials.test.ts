import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildConfigurationTaskPack, type ConfigurationTaskSeeds } from './configuration-task-materials.js';
const root = new URL('../../../../', import.meta.url);
const json = (path: string) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const seeds = (): ConfigurationTaskSeeds => ({ rnfDefinition: json('config/recommenders/rnf-v2.draft.json'),
  testDefinition: json('config/recommenders/testrec-equations.draft.json'), baseline: json('research/baselines/rnf-v2/reference.json'),
  equations: json('research/examples/testrec-e21/equations-synthetic.json'), catalog: json('research/examples/testrec-e21/synthetic-catalog.json') });

test('task materials pass the production importers and executors with known outputs, without publishing or altering source seeds', () => {
  const input = seeds(), before = structuredClone(input), pack = buildConfigurationTaskPack('task-check', input);
  assert.deepEqual(input, before); assert.deepEqual(pack, buildConfigurationTaskPack('task-check', input));
  assert.equal(pack.verification.content.rnf.validRows, 1); assert.equal(pack.verification.content.tests.validRows, 4);
  assert.equal(pack.verification.content.rnf.extraContextDoesNotChangeResult, true);
  assert.deepEqual(pack.verification.content.tests.neighbors, ['candidate-a', 'candidate-c', 'candidate-d']);
  assert.equal(pack.verification.content.participantStudyPerformed, false);
  assert.equal(pack.verification.content.excludedRows, 0);
  assert.equal(JSON.parse(pack.files['participant/rnf/target.json']).values.nfrs.length, 0);
  assert.equal(JSON.parse(pack.files['participant/tests/target.json']).values.test_case_ids, undefined);
});

test('participant datasets are importable arrays and the facilitator oracle is separate from participant files', () => {
  const pack = buildConfigurationTaskPack('task-check', seeds());
  assert.equal(Array.isArray(JSON.parse(pack.files['participant/rnf/dataset.json'])), true);
  assert.equal(Array.isArray(JSON.parse(pack.files['participant/tests/dataset.json'])), true);
  assert.ok(JSON.parse(pack.files['participant/tests/dataset.json']).every((row: any) => Array.isArray(row.values.test_case_ids)));
  assert.ok(!Object.keys(pack.files).filter(path => path.startsWith('participant/')).some(path => /answer|result|oracle/.test(path)));
  const answer = JSON.parse(pack.files['facilitator/answer-key.json']);
  assert.equal(answer.tests.result.content.scientificReproduction, false);
  assert.equal(pack.files['facilitator/checkpoints.csv'].split('\r\n').length, 13);
  assert.equal(pack.files['facilitator/attempt-register.csv'].split('\r\n').length, 2);
});

test('namespaces change publication identities but preserve method parameters and recommendation results', () => {
  const first = buildConfigurationTaskPack('task-one', seeds()), second = buildConfigurationTaskPack('task-two', seeds());
  assert.notEqual(JSON.parse(first.files['participant/tests/catalog.json']).id, JSON.parse(second.files['participant/tests/catalog.json']).id);
  assert.deepEqual(first.verification.content.rnf.result, second.verification.content.rnf.result);
  assert.deepEqual(first.verification.content.tests.result.content.items.map(row => row.score), second.verification.content.tests.result.content.items.map(row => row.score));
  const a = JSON.parse(first.files['facilitator/answer-key.json']), b = JSON.parse(second.files['facilitator/answer-key.json']);
  assert.deepEqual(a.rnf.definition.method, b.rnf.definition.method);
  assert.deepEqual(a.tests.definition.method, b.tests.definition.method);
});

test('unknown test answers, inconsistent oracle associations and unsafe namespaces cannot become task materials', () => {
  for (const namespace of ['../outside', 'Uppercase', 'a'.repeat(25), '']) assert.throws(() => buildConfigurationTaskPack(namespace, seeds()), /namespace/);
  const supplied = seeds(); supplied.equations.target.values.test_case_ids = ['demo-create'];
  assert.throws(() => buildConfigurationTaskPack('task-check', supplied), /withhold/);
  const changed = seeds(); changed.equations.dataset.records[0].values.test_case_ids = ['unknown-test'];
  assert.throws(() => buildConfigurationTaskPack('task-check', changed));
});
