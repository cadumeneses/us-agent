import assert from 'node:assert/strict';
import test from 'node:test';
import { chatRequestBody, classifyWithAi, type AiProvider } from './ai-classifier.js';
import { classifyPreview } from './classifier.js';
import type { Taxonomy } from '../domain/models.js';

const A = { module: 'Authentication', operation: 'Login with OAuth' };
test('does not override temperature for OpenAI models', () => {
  assert.equal('temperature' in chatRequestBody('openai', 'gpt-5', 'system', 'user'), false);
});
test('keeps deterministic temperature for compatible chat providers', () => {
  assert.equal(chatRequestBody('groq', 'model', 'system', 'user').temperature, 0);
});
const B = { module: 'Registry', operation: 'Retrieve data' };
const taxonomy: Taxonomy = { version: 'test-v1', modules: { Authentication: [A.operation], Registry: [B.operation] } };
const story = 'Como pessoa, quero entrar e consultar meus dados';
function provider(name: string, rows = [A, B], needsReview = false): AiProvider {
  return { name, model: `${name}-requested`, call: async (system, user) => {
    assert.match(system, /every module\/operation pair/);
    assert.match(system, /preserve taxonomy labels exactly/);
    assert.ok(user.includes(story));
    return { model: `${name}-resolved`, content: JSON.stringify({ rows, confidence: 0.9, needs_review: needsReview, evidence: [story] }) };
  } };
}

test('AI classification preserves complete labels, actual metrics and requested/resolved model provenance', async () => {
  const result = await classifyWithAi(story, taxonomy, [provider('p1'), provider('p2', [B, A])]);
  assert.deepEqual(result.labels, [A, B]);
  assert.equal(result.needsReview, false);
  assert.equal(result.provenance.decision.consensusRatio, 1);
  assert.equal(result.provenance.decision.uncertainty?.score, 0.025);
  assert.equal(result.provenance.providers[0].requestedModel, 'p1-requested');
  assert.equal(result.provenance.providers[0].model, 'p1-resolved');
  assert.equal(result.provenance.promptVersion, 'web_wis_multilabel_v3_en');
  assert.deepEqual(result.provenance.execution, { arbitration: false, reruns: 0 });
  assert.ok(result.provenance.prompt?.user.includes(story));
  taxonomy.modules.Registry.push('temporary');
  assert.deepEqual(result.provenance.taxonomy.snapshot.modules.Registry, [B.operation]);
  taxonomy.modules.Registry.pop();
});

test('ties and provider review requests preserve actual consensus instead of encoding status as a metric', async () => {
  const tie = await classifyWithAi(story, taxonomy, [provider('p1', [A]), provider('p2', [B])]);
  assert.equal(tie.needsReview, true);
  assert.equal(tie.provenance.decision.consensusRatio, 0.5);
  assert.equal(tie.provenance.decision.uncertainty?.score, 0.35);
  const flagged = await classifyWithAi(story, taxonomy, [provider('p1', [A, B], true), provider('p2')]);
  assert.equal(flagged.needsReview, true);
  assert.equal(flagged.provenance.decision.consensusRatio, 1);
  assert.equal(flagged.provenance.decision.uncertainty?.score, 0.175);
});

test('a partially invalid or mixed n/a vote is rejected as a whole and counts against quorum', async () => {
  for (const invalid of [{ module: 'Unknown', operation: 'Invented' }, { module: 'n/a', operation: 'n/a' }]) {
    const result = await classifyWithAi(story, taxonomy, [provider('p1'), provider('p2', [A, invalid])]);
    assert.deepEqual(result.labels, [A, B]);
    assert.equal(result.providerVotes[1].status, 'error');
    assert.deepEqual(result.providerVotes[1].rows, []);
    assert.equal(result.needsReview, true);
    assert.ok(result.provenance.decision.reviewReasons.includes('insufficient_quorum'));
  }
});

test('total provider failure remains auditable and does not invent a taxonomy gap', async () => {
  const fail: AiProvider = { name: 'offline', model: 'requested', call: async () => { throw new Error('Simulated unavailability'); } };
  const result = await classifyWithAi(story, taxonomy, [fail]);
  assert.equal(result.disagreementCause, 'provider_failure');
  assert.equal(result.finalAction, 'ask_human');
  assert.equal(result.needsReview, true);
  assert.equal(result.provenance.decision.consensusRatio, 0);
  assert.equal(result.provenance.decision.providerHealth.failed, 1);
  assert.ok(result.provenance.decision.reviewReasons.includes('no_valid_votes'));
  assert.equal(result.provenance.decision.reviewReasons.includes('taxonomy_gap'), false);
  assert.deepEqual(result.fallbackSuggestions, []);
});

test('local rules have no committee metrics and equivalent taxonomy objects have the same hash', () => {
  const original = classifyPreview('Como pessoa, quero entrar com Google', taxonomy);
  const reordered = classifyPreview('Como pessoa, quero entrar com Google', { modules: { Registry: [B.operation], Authentication: [A.operation] }, version: taxonomy.version });
  assert.equal(original.provenance.decision.consensusRatio, null);
  assert.equal(original.provenance.decision.uncertainty, null);
  assert.equal(original.provenance.prompt, null);
  assert.equal(original.provenance.taxonomy.sha256, reordered.provenance.taxonomy.sha256);
});
