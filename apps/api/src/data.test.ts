import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyPreview } from './data.js';

test('recognizes OAuth stories', () => {
  const result = classifyPreview('As a user, I want to login with Google so that access is easier');
  assert.equal(result.operation, 'Login with OAuth');
  assert.equal(result.needsReview, false);
});
