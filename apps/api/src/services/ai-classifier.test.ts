import assert from 'node:assert/strict';
import test from 'node:test';
import { chatRequestBody } from './ai-classifier.js';

test('does not override temperature for OpenAI models', () => {
  const body = chatRequestBody('openai', 'gpt-5', 'system', 'user');
  assert.equal('temperature' in body, false);
});

test('keeps deterministic temperature for compatible chat providers', () => {
  const body = chatRequestBody('groq', 'model', 'system', 'user');
  assert.equal(body.temperature, 0);
});
