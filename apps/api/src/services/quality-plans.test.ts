import assert from 'node:assert/strict';
import test from 'node:test';
import type { Story } from '../domain/models.js';
import { buildQualityPlan, buildQualityPlanScope, normalizeQualityPlanContent } from './quality-plans.js';

function story(input: Partial<Story> = {}): Story {
  return {
    id: '1',
    text: 'Como usuário, quero recuperar minha senha para acessar o sistema',
    project: 'Portal',
    sprint: 'Sprint 14',
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
  assert.ok(plan.testCases.every(testCase => testCase.id && testCase.steps.length > 0 && testCase.expectedResult));
  assert.ok(plan.testCases.every(testCase => testCase.linkedCriteria.every(id => plan.acceptanceCriteria.some(criterion => criterion.id === id))));
});

test('asks for clarification instead of inventing tests for uncovered stories', () => {
  const plan = buildQualityPlan(story({ module: 'n/a', operation: 'n/a', confidence: 0.3 }));
  assert.equal(plan.health, 'needs_clarification');
  assert.equal(plan.testCases.length, 0);
  assert.ok(plan.questions.length > 0);
  assert.equal(plan.questions[0].source, 'taxonomy_heuristic');
});

test('upgrades legacy saved plans into executable and traceable test cases', () => {
  const content = normalizeQualityPlanContent({
    questions: [{ text: 'Qual é a regra?', source: 'user' }],
    acceptanceCriteria: [{ text: 'O usuário recebe uma confirmação.', source: 'user' }],
    testCases: [{ title: 'Concluir a operação', type: 'positive', priority: 'high', source: 'user', assumption: false }]
  } as never);

  assert.equal(content.acceptanceCriteria[0].id, 'AC-001');
  assert.equal(content.testCases[0].id, 'TC-001');
  assert.equal(content.testCases[0].expectedResult, 'O usuário recebe uma confirmação.');
  assert.equal(content.testCases[0].linkedCriteria[0], 'AC-001');
});

test('consolidates selected stories into one project and sprint quality plan', () => {
  const plan = buildQualityPlanScope({
    id: '42',
    project: 'Portal',
    sprint: 'Sprint 14',
    stories: [story(), story({ id: '2', text: 'Como usuário, quero entrar com OAuth', operation: 'Login with OAuth' })]
  });

  assert.equal(plan.project, 'Portal');
  assert.equal(plan.sprint, 'Sprint 14');
  assert.equal(plan.stories.length, 2);
  assert.ok(plan.testCases.every(testCase => testCase.id.startsWith('US-')));
  assert.ok(plan.acceptanceCriteria.every(criterion => plan.testCases.some(testCase => testCase.linkedCriteria.includes(criterion.id))));
});
