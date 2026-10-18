import assert from 'node:assert/strict';
import test from 'node:test';
import { aggregateRecommendationMetrics, countsMetrics, recommendationMetrics } from './recommendation-metrics.js';

const a = { type: 'Performance', attribute: 'response_time', sentence: 'Synthetic A' };
const b = { type: 'Security', attribute: 'access_control', sentence: 'Synthetic B' };
const c = { ...a, sentence: 'Synthetic C' };

test('relevance uses normalized set identity, counts duplicates once and computes F1/F2 from TP/FP/FN', () => {
  const result = recommendationMetrics([a, b, { ...a, attribute: 'Response Time', sentence: ' Synthetic A ' }], [a, c, c]);
  assert.deepEqual(result, { tp: 1, fp: 1, fn: 1, precision: 0.5, recall: 0.5, f1: 0.5, f2: 0.5 });
  const asymmetric = countsMetrics(2, 1, 3);
  assert.equal(asymmetric.f2, 10 / 23);
  assert.equal(asymmetric.f1, 0.5);
  assert.throws(() => countsMetrics(1, -1, 0));
  assert.throws(() => countsMetrics(1, 0.5, 0));
});

test('zero denominators are null, while empty recommendations with known relevance keep false negatives', () => {
  assert.deepEqual(recommendationMetrics([], [a]), { tp: 0, fp: 0, fn: 1, precision: null, recall: 0, f1: 0, f2: 0 });
  assert.deepEqual(recommendationMetrics([a], []), { tp: 0, fp: 1, fn: 0, precision: 0, recall: null, f1: 0, f2: 0 });
  assert.deepEqual(recommendationMetrics([], []), { tp: 0, fp: 0, fn: 0, precision: null, recall: null, f1: null, f2: null });
});

test('micro sums counts and macro reports its defined denominators without turning missing truth into empty truth', () => {
  const result = aggregateRecommendationMetrics([countsMetrics(1, 1, 0), countsMetrics(0, 0, 2), countsMetrics(0, 1, 0)]);
  assert.deepEqual(result.micro, countsMetrics(1, 2, 2));
  assert.deepEqual(result.macro.precision, { value: 0.25, definedTargets: 2, undefinedTargets: 1 });
  assert.deepEqual(result.macro.recall, { value: 0.5, definedTargets: 2, undefinedTargets: 1 });
  assert.equal(aggregateRecommendationMetrics([]).micro, null);
});
