import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { snapshotContent } from '../domain/content-snapshot.js';
import { aggregateE21Equation43, measureE21Equation42, runTestrecEquationDemo } from './testrec-equations.js';

const root = new URL('../../../../', import.meta.url);
const read = (file: string) => JSON.parse(readFileSync(new URL(file, root), 'utf8'));
function fixture() {
  return { definition: read('config/recommenders/testrec-e21.draft.json'),
    source: read('research/examples/testrec-e21/equations-synthetic.json'), catalog: read('research/examples/testrec-e21/synthetic-catalog.json') };
}

test('equation 4.2 computes raw Manhattan distance and normalized similarity with binary boundary validation', () => {
  assert.deepEqual(measureE21Equation42([1, 0, 1, 0, 0, 0, 1, 1]), { distance: 4, similarity: 0.5 });
  assert.deepEqual(measureE21Equation42([1, 1]), { distance: 0, similarity: 1 });
  assert.deepEqual(measureE21Equation42([0, 0]), { distance: 2, similarity: 0 });
  for (const vector of [[], [NaN], [Infinity], [0.5], [-1], [2]]) assert.throws(() => measureE21Equation42(vector));
});

test('equation 4.3 agrees with CT03 and CT04 arithmetic while exposing the CT01 text discrepancy', () => {
  const rows = aggregateE21Equation43([
    { recordId: 'e1', similarity: 0.5, testCaseIds: ['CT03'] },
    { recordId: 'e5', similarity: 0.87, testCaseIds: ['CT03', 'CT04'] },
    { recordId: 'e6', similarity: 0.75, testCaseIds: ['CT03', 'CT04', 'CT01'] }
  ]);
  assert.deepEqual(rows.map(row => row.testCaseId), ['CT03', 'CT04', 'CT01']);
  assert.ok(Math.abs(rows[0].score - 0.7066666666666667) < 1e-12);
  assert.equal(rows[1].score, 0.54);
  assert.equal(rows[2].score, 0.25); assert.notEqual(rows[2].score, 0.42);
  assert.equal(rows[0].support, 3); assert.equal(rows[1].denominator, 3);
  assert.deepEqual(rows[2].contributions, [{ recordId: 'e6', similarity: 0.75 }]);
  assert.throws(() => aggregateE21Equation43([]), /três/);
  assert.throws(() => aggregateE21Equation43(Array(3).fill({ recordId: 'same', similarity: 1, testCaseIds: [] })), /distintos/);
  const bad = [{ recordId: 'a', similarity: 1, testCaseIds: ['x', 'x'] }, { recordId: 'b', similarity: 0, testCaseIds: [] }, { recordId: 'c', similarity: 0, testCaseIds: [] }];
  assert.throws(() => aggregateE21Equation43(bad), /duplicados/);
  bad[0].testCaseIds = []; bad[0].similarity = NaN; assert.throws(() => aggregateE21Equation43(bad), /inválido/);
});

test('offline demo uses shared KNN, heuristic and explicit residual ties, preserving input, artifact text and provenance', () => {
  const { definition, source, catalog } = fixture();
  const before = snapshotContent({ definition, source, catalog }).sha256;
  const result = runTestrecEquationDemo(definition, source.target, source.dataset, catalog);
  const data = result.content;
  assert.equal(data.status, 'completed'); assert.equal(data.scientificReproduction, false);
  assert.deepEqual(data.ranked.map(row => row.recordId), source.expected.rankedIds);
  assert.deepEqual(data.neighbors.map(row => row.recordId), source.expected.neighborIds);
  assert.deepEqual(data.excluded, [{ recordId: 'target-alias', code: 'target_identity' }]);
  for (const item of data.items) {
    assert.equal(item.score, source.expected.scores[item.testCaseId]);
    assert.deepEqual(item.artifact, catalog.items.find((row: { id: string }) => row.id === item.testCaseId));
    assert.equal(Object.isFrozen(item.artifact), true);
  }
  assert.equal(snapshotContent({ definition, source, catalog }).sha256, before);
  source.dataset.records.reverse();
  const reordered = runTestrecEquationDemo(definition, source.target, source.dataset, catalog).content;
  assert.deepEqual(reordered.neighbors, data.neighbors); assert.deepEqual(reordered.items, data.items);
});

test('unknown eligible associations block ranking; known empty lists and zero similarity remain explicit', () => {
  const { definition, source, catalog } = fixture();
  delete source.dataset.records[1].values.test_case_ids;
  const blocked = runTestrecEquationDemo(definition, source.target, source.dataset, catalog).content;
  assert.equal(blocked.status, 'blocked'); assert.deepEqual(blocked.neighbors, []);
  assert.deepEqual(blocked.issues, [{ code: 'unknown_test_associations', recordIds: ['candidate-b'] }]);
  for (const row of source.dataset.records.filter((row: { id: string }) => row.id !== 'target-alias')) {
    row.values.test_case_ids = []; row.values.module = 'Other'; row.values.operation = 'Other'; row.values.platforms = ['Mobile'];
    row.values.application_domain = 'Other'; row.values.acceptance_criteria = []; row.values.nfrs = [];
  }
  const empty = runTestrecEquationDemo(definition, source.target, source.dataset, catalog).content;
  assert.equal(empty.status, 'no_test_cases'); assert.equal(empty.neighbors.length, 3);
  assert.ok(empty.neighbors.every(row => row.similarity === 0)); assert.deepEqual(empty.items, []);
});

test('insufficient candidates and supplied target answers block the demo; table 4.5 cannot yield an invented recommendation', () => {
  const { definition, source, catalog } = fixture();
  source.dataset.records = source.dataset.records.slice(0, 2);
  assert.equal(runTestrecEquationDemo(definition, source.target, source.dataset, catalog).content.issues[0].code, 'fewer_than_three_candidates');
  source.target.values.test_case_ids = ['demo-create'];
  assert.ok(runTestrecEquationDemo(definition, source.target, source.dataset, catalog).content.issues.some(row => row.code === 'target_output_must_be_withheld'));
  const table = read('research/examples/testrec-e21/table-4-5.json');
  const target = table.dataset.records.find((row: { id: string }) => row.id === table.targetId);
  table.dataset.records = table.dataset.records.filter((row: { id: string }) => table.candidateIds.includes(row.id));
  const result = runTestrecEquationDemo(definition, target, table.dataset).content;
  assert.equal(result.status, 'blocked'); assert.equal(result.items.length, 0);
  assert.equal(result.issues[0].code, 'unknown_test_associations');
});
