import assert from 'node:assert/strict';
import test from 'node:test';
import { recommendNfr, nfrKey, type NfrProfile } from './nfr-engine.js';

// Reconstructed profiles from thesis table 5.7, not the original dataset.
function profile(id: string): NfrProfile {
  return {
    classificationId: id, storyId: id, project: `P${id}`, text: 'Retrieve data', taxonomyVersion: 'wis-v1', reviewStatus: 'reviewed',
    labels: [{ module: 'Registry', operation: 'Retrieve data' }],
    projectProfile: { platforms: ['Web'], architectures: ['Client-server'], applicationDomains: ['Education'], objective: 'product',
      technologies: { languages: ['TypeScript'], frameworks: ['Angular'], apis: ['Mongoose'], dataPersistence: ['MongoDB'] } },
    tasks: [{ category: 't6' }, { category: 't7' }],
    nfrs: [{ type: 'Performance', attribute: 'response_time', sentence: 'Response within five seconds.' }]
  };
}

test('reproduces table 5.7: nine target dimensions, distance six, similarity one third', () => {
  const target = profile('1');
  const neighbor = profile('5');
  neighbor.projectProfile = { ...neighbor.projectProfile, architectures: ['Layers'], applicationDomains: ['Information retrieval'],
    technologies: { languages: ['Python'], frameworks: ['Django'], apis: ['Firebase'], dataPersistence: ['MySQL'] } };
  const result = recommendNfr(target, [neighbor], 0);
  assert.equal(result.dimensions.length, 9);
  assert.ok(Math.abs(result.neighbor!.similarity - 1 / 3) < 1e-12);
  assert.equal(result.neighbor!.matched.length, 3);
  assert.equal(result.neighbor!.missing.length, 6);
  assert.equal(result.items[0].score, result.neighbor!.similarity);
});

test('uses target dimensions only and keeps k=1', () => {
  const target = profile('1'); target.nfrs = [];
  const best = profile('4');
  best.projectProfile.technologies.languages.push('Java', 'Rust');
  const result = recommendNfr(target, [profile('5'), best], 0);
  assert.equal(result.neighbor!.classificationId, '4');
  assert.equal(result.neighbor!.similarity, 1);
  assert.equal(result.k, 1);
  assert.equal(result.dimensions.length, 9);
  assert.equal(result.items[0].alreadyLinked, false);
});

test('excludes prototypes, self, other versions, pending classifications and other operations', () => {
  const target = profile('1');
  const prototype = profile('2'); prototype.projectProfile.objective = 'prototype';
  const self = profile('3'); self.storyId = '1';
  const version = profile('4'); version.taxonomyVersion = 'another-version';
  const pending = profile('5'); pending.reviewStatus = 'pending_review';
  const operation = profile('6'); operation.labels[0].operation = 'Insert data';
  const result = recommendNfr(target, [prototype, self, version, pending, operation], 0);
  assert.equal(result.status, 'no_candidates');
  assert.equal(result.excludedCount, 5);
  assert.deepEqual(result.items, []);
});

test('does not replace the nearest neighbor when it has no eligible NFR', () => {
  const nearest = profile('2'); nearest.nfrs = [{ type: 'Maintainability', attribute: 'testability', sentence: 'Legacy NFR.' }];
  const farther = profile('3'); farther.projectProfile.architectures = ['Layers'];
  const result = recommendNfr(profile('1'), [farther, nearest], 0);
  assert.equal(result.status, 'no_items');
  assert.equal(result.neighbor!.classificationId, '2');
});

test('uses binary co-occurrence and recognizes existing equivalent attribute spelling', () => {
  const neighbor = profile('2');
  neighbor.nfrs.push({ ...neighbor.nfrs[0], attribute: 'response time' });
  const result = recommendNfr(profile('1'), [neighbor], 0);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].score, 1);
  assert.equal(result.items[0].alreadyLinked, true);
  assert.equal(nfrKey(neighbor.nfrs[0]), nfrKey(neighbor.nfrs[1]));
});

test('multi-label selection does not replace or merge classification labels', () => {
  const target = profile('1'); target.labels.push({ module: 'Authentication', operation: 'Login' });
  const neighbor = profile('2'); neighbor.labels = [target.labels[1]];
  assert.equal(recommendNfr(target, [neighbor], 0).status, 'no_candidates');
  assert.equal(recommendNfr(target, [neighbor], 1).status, 'completed');
  assert.equal(target.labels.length, 2);
});

test('rejects missing data and invalid label selection without producing recommendations', () => {
  for (const index of [-1, 1, 0.5]) assert.equal(recommendNfr(profile('1'), [profile('2')], index).status, 'blocked');
  const target = profile('1'); target.projectProfile.platforms = []; target.tasks[0].category = '';
  const result = recommendNfr(target, [profile('2')], 0);
  assert.equal(result.status, 'blocked');
  assert.equal(result.messages.length, 2);
});

test('numeric tie-breaking is deterministic and independent of input order', () => {
  for (const history of [[profile('10'), profile('2')], [profile('2'), profile('10')]]) {
    const result = recommendNfr(profile('1'), history, 0);
    assert.equal(result.neighbor!.classificationId, '2');
    assert.match(result.messages.join(' '), /Empate/);
  }
});

test('a language cannot match a framework and duplicate tags do not add weight', () => {
  const target = profile('1'); target.projectProfile.technologies.languages.push('TypeScript');
  const neighbor = profile('2'); neighbor.projectProfile.technologies.languages = [];
  neighbor.projectProfile.technologies.frameworks.push('TypeScript');
  const result = recommendNfr(target, [neighbor], 0);
  assert.equal(result.dimensions.length, 9);
  assert.ok(Math.abs(result.neighbor!.similarity - 8 / 9) < 1e-12);
});
