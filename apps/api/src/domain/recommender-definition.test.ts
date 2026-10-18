import assert from 'node:assert/strict';
import test from 'node:test';
import { parseRecommenderDefinition, validateRecommendationInput } from './recommender-definition.js';

function definition() {
  return parseRecommenderDefinition({
    schemaVersion: 1, id: 'independent-profile', version: 'draft.1', name: 'Perfil independente', state: 'draft',
    attributes: [
      { id: 'budget', name: 'Orçamento', valueType: { type: 'number' }, scope: 'project', cardinality: 'single', required: true, role: 'context', representation: 'none' },
      { id: 'consent', name: 'Autorização', valueType: { type: 'boolean' }, scope: 'project', cardinality: 'single', required: true, role: 'context', representation: 'none' },
      { id: 'notes', name: 'Observações', valueType: { type: 'text' }, scope: 'project', cardinality: 'many', required: false, role: 'context', representation: 'none' },
      { id: 'domain', name: 'Domínio', valueType: { type: 'enum', values: ['Education', 'Health'] }, scope: 'project', cardinality: 'single', required: true, role: 'feature', representation: 'presence' }
    ],
    method: { id: 'future-method', version: '1', parameters: {}, bindings: {} }
  });
}
const input = () => ({ id: 'profile-1', values: { budget: 100, consent: false, domain: 'Education' }, provenance: { source: 'manual demonstration' } });

test('definition drives validation of numeric, boolean, enum and optional repeated text without a story', () => {
  const config = definition();
  const values = { ...input(), values: { ...input().values, notes: ['Preservar essência', 'Revisar referências'] } };
  assert.deepEqual(validateRecommendationInput(config, values), values);
  assert.deepEqual(validateRecommendationInput(config, input()), input());
  assert.throws(() => validateRecommendationInput(config, { ...input(), values: { ...input().values, budget: '100' } }));
  assert.throws(() => validateRecommendationInput(config, { ...input(), values: { ...input().values, consent: 'false' } }));
  assert.throws(() => validateRecommendationInput(config, { ...input(), values: { ...input().values, domain: 'Unknown' } }));
  assert.throws(() => validateRecommendationInput(config, { ...input(), values: { ...input().values, notes: 'not an array' } }));
});

test('rejects undeclared, missing and non-JSON values without coercion or silent stripping', () => {
  const config = definition();
  assert.throws(() => validateRecommendationInput(config, { ...input(), values: { consent: true, domain: 'Health' } }));
  assert.throws(() => validateRecommendationInput(config, { ...input(), values: { ...input().values, surprise: 1 } }));
  assert.throws(() => validateRecommendationInput(config, { ...input(), values: { ...input().values, budget: Infinity } }));
  assert.throws(() => validateRecommendationInput(config, { ...input(), values: { ...input().values, notes: undefined } }));
  assert.throws(() => validateRecommendationInput(config, { ...input(), extra: true }));
});

test('rejects duplicate attributes, dangling bindings and unsupported free-text or numeric features', () => {
  const duplicate = definition(); duplicate.attributes.push(duplicate.attributes[0]);
  assert.throws(() => parseRecommenderDefinition(duplicate), /duplicado/);
  const dangling = definition(); dangling.method.bindings.profile = 'absent';
  assert.throws(() => parseRecommenderDefinition(dangling), /inexistente/);
  const numeric = definition(); numeric.attributes[0].role = 'feature'; numeric.attributes[0].representation = 'presence';
  assert.throws(() => parseRecommenderDefinition(numeric), /codificação/);
  const freeText = definition(); freeText.attributes[2].role = 'feature'; freeText.attributes[2].representation = 'presence';
  assert.throws(() => parseRecommenderDefinition(freeText), /codificação/);
  const enumDuplicate = definition(); enumDuplicate.attributes[3].valueType = { type: 'enum', values: ['A', 'A'] };
  assert.throws(() => parseRecommenderDefinition(enumDuplicate), /duplicadas/);
  assert.throws(() => parseRecommenderDefinition({ ...definition(), latest: true }));
});
