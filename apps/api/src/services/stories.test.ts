import assert from 'node:assert/strict';
import test from 'node:test';
import type { Story } from '../domain/models.js';
import { buildDashboard, filterStories } from './stories.js';

const stories: Story[] = [
  { id: '1', text: 'Login', project: 'A', module: 'Auth', operation: 'Login', confidence: 0.8, uncertainty: 0.2, consensus: 0.9, status: 'reviewed' },
  { id: '2', text: 'Reset password', project: 'A', module: 'Auth', operation: 'Reset', confidence: 0.6, uncertainty: 0.4, consensus: 0.5, status: 'pending_review' }
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
