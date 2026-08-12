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
  assert.match(result.finalReason, /Authentication/);
  assert.deepEqual(result.fallbackSuggestions, []);
});

test('records an explainable fallback when no local rule covers the story', () => {
  const result = classifyPreview(
    'As a user, I want to reconcile a bank payment so that I can close the month',
    taxonomy
  );
  assert.equal(result.module, 'n/a');
  assert.equal(result.needsReview, true);
  assert.equal(result.fallbackSuggestions[0].type, 'clarify_story');
  assert.match(result.fallbackSuggestions[0].reason, /cobertura/i);
});

test('limits imported stories and removes invalid lines', () => {
  assert.deepEqual(parseImportedStories('short\nA valid imported user story'), ['A valid imported user story']);
});
