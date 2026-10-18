import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { recommendWithRnfPolicy } from './rnf-policy.js';
import { recommendNfr, type NfrProfile, type NfrResult } from './nfr-engine.js';
import { rankNeighbors, type KnnPolicy } from './knn.js';

const reference = JSON.parse(readFileSync(new URL('../../../../research/baselines/rnf-v2/reference.json', import.meta.url), 'utf8')) as {
  profiles: Record<string, NfrProfile>; cases: Array<{ id: string; targetId: string; historyIds: string[]; labelIndex: number; expected: NfrResult }>
};
test('extracted policy preserves every frozen result and explains real distances and exclusions', () => {
  for (const item of reference.cases) {
    const target = reference.profiles[item.targetId], history = item.historyIds.map(id => reference.profiles[id]);
    const before = structuredClone({ target, history });
    const execution = recommendWithRnfPolicy(target, history, item.labelIndex);
    assert.deepEqual(execution.result, item.expected, item.id);
    assert.deepEqual(recommendWithRnfPolicy(target, [...history].reverse(), item.labelIndex).result, item.expected);
    for (const candidate of execution.explanation.candidates) {
      if (candidate.eligible) assert.equal(candidate.similarity, 1 - candidate.distance! / execution.result.dimensions.length);
      else assert.ok(candidate.issues.length);
    }
    assert.deepEqual({ target, history }, before);
  }
});

test('extracted policy also matches legacy edge cases beyond the frozen reference', () => {
  const target = structuredClone(reference.profiles.fa);
  const candidate = structuredClone(reference.profiles.f4);
  const variants = [candidate,
    { ...candidate, nfrs: [] }, { ...candidate, taxonomyVersion: '' },
    { ...candidate, classificationId: '100000000000000000000000' },
    { ...candidate, projectProfile: { ...candidate.projectProfile, platforms: ['Unshared'], applicationDomains: ['Other'], architectures: ['Other'], technologies: { languages: [], frameworks: [], apis: [], dataPersistence: [] } }, tasks: [] },
    { ...candidate, nfrs: [...candidate.nfrs, ...candidate.nfrs, { type: 'Unknown', attribute: 'none', sentence: 'Not eligible' }] }
  ];
  for (const item of variants) for (const index of [0, -1, 100, 0.5]) {
    assert.deepEqual(recommendWithRnfPolicy(target, [item], index).result, recommendNfr(target, [item], index));
  }
  target.projectProfile.platforms = [' ']; target.projectProfile.applicationDomains = [' ']; target.projectProfile.architectures = [' '];
  target.projectProfile.technologies = { languages: [], frameworks: [], apis: [], dataPersistence: [] }; target.tasks = [];
  assert.equal(recommendWithRnfPolicy(target, [candidate], 0).result.status, 'blocked');
});

test('KNN kernel accepts independent eligibility, scoring, ties and k without inheriting RNF filters', () => {
  const policy: KnnPolicy<number> = { dimensions: () => ['value'], eligibility: () => [], vector: value => [value],
    measure: ([value]) => ({ distance: Math.abs(value), similarity: -Math.abs(value) }), compareTies: (a, b) => a - b };
  const result = rankNeighbors(0, [3, 1, -1], 2, policy);
  assert.deepEqual(result.neighbors.map(item => item.candidate), [-1, 1]);
  assert.throws(() => rankNeighbors(0, [], 0, policy));
  assert.throws(() => rankNeighbors(0, [1], 1, { ...policy, measure: () => ({ distance: NaN, similarity: 0 }) }));
});
