import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import type { ProviderVote } from '../domain/models.js';
import { canonicalLabels, evaluateClassificationPolicy } from './classification-policy.js';

const A = { module: 'Registry', operation: 'Retrieve data' };
const B = { module: 'Authentication', operation: 'Login' };
const NA = { module: 'n/a', operation: 'n/a' };
function vote(provider: string, rows = [A], overrides: Partial<ProviderVote> = {}): ProviderVote {
  return { provider, status: 'success', confidence: 0.9, rows, needsReview: false,
    evidence: [], issues: [], suggestedQuestions: [], ...overrides };
}
const failure = (provider: string) => vote(provider, [], { status: 'error', confidence: undefined, needsReview: true });

test('agrees on complete multi-label sets without multiplying duplicate rows or mutating votes', () => {
  const votes = [vote('p1', [A, B, A]), vote('p2', [B, A])];
  const original = structuredClone(votes);
  const result = evaluateClassificationPolicy(votes);
  assert.deepEqual(result.rows, [B, A]);
  assert.equal(result.consensusRatio, 1);
  assert.equal(result.confidence, 0.9);
  assert.equal(result.uncertainty.score, 0.025);
  assert.equal(result.uncertainty.band, 'low');
  assert.equal(result.needsReview, false);
  assert.deepEqual(votes, original);
});

test('a tie is provisional, reproducible and always reviewed, even at high confidence', () => {
  const votes = [vote('p1', [A]), vote('p2', [B])];
  const result = evaluateClassificationPolicy(votes);
  assert.equal(result.consensusRatio, 0.5);
  assert.equal(result.uncertainty.normalizedEntropy, 1);
  assert.equal(result.uncertainty.labelOverlap, 0);
  assert.equal(result.uncertainty.score, 0.35);
  assert.equal(result.uncertainty.band, 'medium');
  assert.ok(result.reviewReasons.includes('no_strict_majority'));
  assert.equal(result.needsReview, true);
  assert.deepEqual(result, evaluateClassificationPolicy([...votes].reverse()));
});

test('shared individual labels do not invent consensus between different hypotheses', () => {
  const result = evaluateClassificationPolicy([vote('p1', [A, B]), vote('p2', [A])]);
  assert.equal(result.consensusRatio, 0.5);
  assert.equal(result.uncertainty.labelOverlap, 0.5);
  assert.equal(result.needsReview, true);
});

test('a strict majority preserves its complete set and reports light disagreement metrics', () => {
  const result = evaluateClassificationPolicy([vote('p1', [A, B]), vote('p2', [B, A]), vote('p3', [A])]);
  assert.deepEqual(result.rows, [B, A]);
  assert.equal(result.consensusRatio, 0.6667);
  assert.equal(result.uncertainty.labelOverlap, 0.6667);
  assert.equal(result.uncertainty.disagreementLevel, 'light');
  assert.equal(result.uncertainty.normalizedEntropy, 0.9183);
  assert.equal(result.uncertainty.score, 0.2545);
  assert.equal(result.needsReview, false);
});

test('partial failure is recorded and accepted only with a valid quorum', () => {
  const valid = evaluateClassificationPolicy([vote('p1'), vote('p2'), failure('p3')]);
  assert.deepEqual(valid.providerHealth, { total: 3, successful: 2, failed: 1 });
  assert.equal(valid.consensusRatio, 1);
  assert.equal(valid.needsReview, false);
  for (const votes of [[vote('p1'), failure('p2')], [vote('p1')], [vote('p1'), vote('p2'), failure('p3'), failure('p4')]]) {
    const decision = evaluateClassificationPolicy(votes);
    assert.equal(decision.needsReview, true);
    assert.ok(decision.reviewReasons.includes('insufficient_quorum'));
  }
  const multiple = evaluateClassificationPolicy([vote('p1'), vote('p2'), vote('p3'), failure('p4'), failure('p5')]);
  assert.ok(multiple.reviewReasons.includes('multiple_provider_failures'));
});

test('total failure produces explicit review reasons and no invented classification', () => {
  const result = evaluateClassificationPolicy([failure('p1'), failure('p2')]);
  assert.deepEqual(result.rows, [NA]);
  assert.equal(result.consensusRatio, 0);
  assert.equal(result.confidence, 0);
  assert.ok(result.reviewReasons.includes('no_valid_votes'));
  assert.equal(result.needsReview, true);
});

test('taxonomy gaps and provider review requests always escalate independently of the score band', () => {
  for (const overrides of [{ needsReview: true }, { issues: ['taxonomy_gap'] }, { issues: ['Lacuna na taxonomia'] }]) {
    assert.equal(evaluateClassificationPolicy([vote('p1', [A], overrides), vote('p2')]).needsReview, true);
  }
  const uncovered = evaluateClassificationPolicy([vote('p1', [NA]), vote('p2', [NA])]);
  assert.ok(uncovered.reviewReasons.includes('taxonomy_gap'));
  assert.equal(uncovered.needsReview, true);
});

test('high uncertainty escalates even with a strict majority and sufficient quorum', () => {
  const result = evaluateClassificationPolicy([
    vote('p1', [NA], { confidence: 0, needsReview: true }),
    vote('p2', [NA], { confidence: 0, needsReview: true }),
    vote('p3', [A], { confidence: 0, needsReview: true })
  ]);
  assert.equal(result.uncertainty.band, 'high');
  assert.ok(result.reviewReasons.includes('high_uncertainty'));
});

test('unanimity cannot approve low-confidence votes just because the composite score is low', () => {
  const result = evaluateClassificationPolicy([vote('p1', [A], { confidence: 0.2 }), vote('p2', [A], { confidence: 0.2 })]);
  assert.equal(result.consensusRatio, 1);
  assert.equal(result.uncertainty.band, 'low');
  assert.ok(result.reviewReasons.includes('low_confidence'));
  assert.equal(result.needsReview, true);
});

test('rejects malformed successful votes instead of discarding invalid portions', () => {
  for (const confidence of [undefined, NaN, Infinity, -0.1, 1.1]) {
    assert.throws(() => evaluateClassificationPolicy([vote('p1', [A], { confidence })]), /Confiança/);
  }
  for (const rows of [[], [NA, A], [{ module: 'n/a', operation: 'Login' }], [{ module: '', operation: 'Login' }]]) {
    assert.throws(() => evaluateClassificationPolicy([vote('p1', rows)]));
  }
  assert.throws(() => evaluateClassificationPolicy([]));
  assert.throws(() => evaluateClassificationPolicy([vote('p1'), vote(' p1 ')]));
  assert.throws(() => evaluateClassificationPolicy([vote(' ')]));
  assert.deepEqual(canonicalLabels([{ module: ' Registry ', operation: 'Retrieve data ' }, A]), [A]);
});

test('uncertainty metrics match frozen references calculated by the Python implementation', async () => {
  const fixture = JSON.parse(await readFile(new URL('../../../../research/baselines/classification-policy/python-metrics.json', import.meta.url), 'utf8')) as {
    cases: Array<{ id: string; votes: ProviderVote[]; consensusRatio: number;
      uncertainty: ReturnType<typeof evaluateClassificationPolicy>['uncertainty'] }>;
  };
  assert.equal(fixture.cases.length, 7);
  for (const item of fixture.cases) {
    const decision = evaluateClassificationPolicy(item.votes);
    assert.equal(decision.consensusRatio, item.consensusRatio, item.id);
    assert.deepEqual(decision.uncertainty, item.uncertainty, item.id);
  }
});
