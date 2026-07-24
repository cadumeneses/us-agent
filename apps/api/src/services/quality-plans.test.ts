import assert from 'node:assert/strict';
import test from 'node:test';
import type { Story } from '../domain/models.js';
import { buildQualityPlan } from './quality-plans.js';

function story(input: Partial<Story> = {}): Story {
  return {
    id: '1',
    text: 'Como usuário, quero recuperar minha senha para acessar o sistema',
    project: 'Portal',
    module: 'Authentication',
    operation: 'Password recovery',
    confidence: 0.9,
    uncertainty: 0.1,
    consensus: 1,
    status: 'accepted_auto',
    ...input
  };
}

test('generates operation-specific quality recommendations', () => {
  const plan = buildQualityPlan(story());
  assert.equal(plan.health, 'ready');
  assert.ok(plan.testCases.some(testCase => testCase.title.includes('token expirado')));
  assert.ok(plan.acceptanceCriteria.length > 0);
});

test('asks for clarification instead of inventing tests for uncovered stories', () => {
  const plan = buildQualityPlan(story({ module: 'n/a', operation: 'n/a', confidence: 0.3 }));
  assert.equal(plan.health, 'needs_clarification');
  assert.equal(plan.testCases.length, 0);
  assert.ok(plan.questions.length > 0);
  assert.equal(plan.questions[0].source, 'taxonomy_heuristic');
});
