import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { reviewTestrecFigures } from './testrec-figure-review.js';
const fixture = () => JSON.parse(readFileSync(new URL('../../../../research/examples/testrec-figures-v1/associations.json', import.meta.url), 'utf8'));

test('visual edges reconcile CT01/TC01 and distinguish heuristic changes from a supposed version ID swap', () => {
  const result = reviewTestrecFigures(fixture());
  assert.deepEqual(result, reviewTestrecFigures(fixture()));
  for (const example of result.content.cases) {
    const item = example.items.find(row => /[CT]{2}01/.test(row.testCaseId))!;
    assert.equal(item.support, 2);
    assert.equal(item.numerator, 1.25);
    assert.equal(item.roundedScore, 0.42);
    assert.equal(item.matchesAtReportedPrecision, true);
  }
  assert.deepEqual(result.content.cases[0].neighbors.map(row => row.recordId), ['e5', 'e6', 'e1']);
  assert.deepEqual(result.content.cases[1].neighbors.map(row => row.recordId), ['e5', 'e6', 'e3']);
  assert.equal(result.content.cases[2].items.every(row => row.matchesAtReportedPrecision), true);
  assert.deepEqual(result.content.mismatches, [{ caseId: 'e21-figure-4-8', testCaseId: 'CT05', reported: 0.25, calculatedRounded: 0.29 }]);
  assert.equal(result.content.distanceMethodConfirmed, false);
});

test('missing source edges and altered selections cannot pass as a source-consistent figure reconstruction', () => {
  const changed = fixture(); changed.cases[2].candidates[2].testCaseIds = ['TC02', 'TC04'];
  assert.throws(() => reviewTestrecFigures(changed), /selection does not match/);
  const wrong = fixture(); wrong.cases[2].selectedSourceIds = ['u1', 'u5', 'u6'];
  assert.throws(() => reviewTestrecFigures(wrong), /selection does not match/);
});
