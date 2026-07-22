import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyPreview, parseImportedStories } from './classifier.js';

const taxonomy = {
  version: 'test',
  modules: { Authentication: ['Login with OAuth'] }
};

test('recognizes OAuth stories', () => {
  const result = classifyPreview(
    'As a user, I want to login with Google so that access is easier',
    taxonomy
  );
  assert.equal(result.operation, 'Login with OAuth');
  assert.equal(result.needsReview, false);
});

test('limits imported stories and removes invalid lines', () => {
  assert.deepEqual(parseImportedStories('short\nA valid imported user story'), ['A valid imported user story']);
});
