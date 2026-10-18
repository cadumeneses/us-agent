import assert from 'node:assert/strict';
import test from 'node:test';
import type { Story } from '../domain/models.js';
import { buildDashboard, filterStories } from './stories.js';

const stories: Story[] = [
  { id: '1', text: 'Login', project: 'A', sprint: 'Sprint 1', module: 'Auth', operation: 'Login', labels: [{ module: 'Auth', operation: 'Login' }], metricsSource: 'legacy', confidence: 0.8, uncertainty: 0.2, consensus: 0.9, status: 'reviewed', taxonomyVersion: 'v1' },
  { id: '2', text: 'Reset password', project: 'A', sprint: 'Sprint 1', module: 'Auth', operation: 'Reset', labels: [{ module: 'Auth', operation: 'Reset' }], metricsSource: 'legacy', confidence: 0.6, uncertainty: 0.4, consensus: 0.5, status: 'pending_review', taxonomyVersion: 'v1' }
];

test('builds dashboard totals', () => {
  assert.deepEqual(buildDashboard(stories), {
    total: 2,
    pending: 1,
    accepted: 1,
    confidence: 0.7,
    modules: [{ name: 'Auth', count: 2 }]
  });
});

test('filters stories by status and search term', () => {
  assert.deepEqual(filterStories(stories, 'pending_review', 'password').map(story => story.id), ['2']);
});

test('secondary labels are searchable and each story counts once per module', () => {
  const multi = { ...stories[0], labels: [...stories[0].labels, { module: 'Reports', operation: 'Export PDF' }, { module: 'Auth', operation: 'Reset' }] };
  assert.equal(filterStories([multi], '', 'export pdf').length, 1);
  assert.deepEqual(buildDashboard([multi]).modules, [{ name: 'Auth', count: 1 }, { name: 'Reports', count: 1 }]);
});
