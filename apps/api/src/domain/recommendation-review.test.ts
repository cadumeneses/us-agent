import assert from 'node:assert/strict';
import test from 'node:test';
import { associationIdentity, bindRecommendationTargetSchema, classificationIdentity, inputAssociationScope, recommendationDecisionSchema } from './recommendation-review.js';

test('review requires explicit destination and immutable references, with canonical database IDs and no replacement item text', () => {
  const hash = 'a'.repeat(64), request = { runSha256: hash, target: { kind: 'input' } };
  assert.deepEqual(bindRecommendationTargetSchema.parse(request), request);
  assert.throws(() => bindRecommendationTargetSchema.parse({ runSha256: hash, target: { kind: 'classification', classificationId: '1' } }));
  for (const id of ['01', '0', '-1', '9223372036854775808', '1.0']) assert.throws(() => classificationIdentity.parse(id));
  assert.equal(classificationIdentity.parse('9223372036854775807'), '9223372036854775807');
  const decision = { id: '40000000-0000-4000-8000-000000000000', runSha256: hash, targetSha256: hash, itemKey: hash, decision: 'accepted' };
  assert.equal(recommendationDecisionSchema.parse(decision).notes, '');
  assert.throws(() => recommendationDecisionSchema.parse({ ...decision, sentence: 'Invented replacement' }));
  assert.throws(() => recommendationDecisionSchema.parse({ ...decision, decision: 'adapted' }));
});

test('input links are scoped to definition and exact input content while operational destinations are explicit', () => {
  const content = { definition: { sha256: 'a'.repeat(64) }, request: { content: { input: { id: '1', values: { text: 'Original' }, provenance: { source: 'external' } } } } };
  const scope = inputAssociationScope(content);
  const changed = structuredClone(content); changed.request.content.input.values.text = 'Edited';
  assert.notEqual(inputAssociationScope(changed), scope);
  const otherDefinition = structuredClone(content); otherDefinition.definition.sha256 = 'b'.repeat(64);
  assert.notEqual(inputAssociationScope(otherDefinition), scope);
  const input = associationIdentity({ kind: 'input', scopeSha256: scope }, 'method', 'key');
  const operational = associationIdentity({ kind: 'classification', classificationId: '1' }, 'method', 'key');
  assert.notEqual(input.sha256, operational.sha256);
  assert.equal(associationIdentity({ kind: 'input', scopeSha256: scope }, 'method', 'key').sha256, input.sha256);
  assert.notEqual(associationIdentity({ kind: 'input', scopeSha256: scope }, 'another-method', 'key').sha256, input.sha256);
});
