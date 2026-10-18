import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { snapshotContent } from './content-snapshot.js';
import { parseDefinitionPublication, snapshotDefinitionPublication } from './definition-publication.js';
import { parseRecommenderDefinition } from './recommender-definition.js';
import { parseRecommenderTaxonomy } from './recommender-taxonomy.js';
import { RNF_ADAPTER_VERSION, validateConfiguredNfrDefinition } from '../services/configured-nfr.js';

const root = new URL('../../../../', import.meta.url);
function publication() {
  const definition = parseRecommenderDefinition(JSON.parse(readFileSync(new URL('config/recommenders/rnf-v2.draft.json', root), 'utf8')));
  const taxonomy = parseRecommenderTaxonomy(JSON.parse(readFileSync(new URL('config/taxonomies/languages-demo.v1.json', root), 'utf8')));
  const snapshot = snapshotContent(taxonomy);
  definition.attributes.push({ id: 'additional_languages', name: 'Contexto', scope: 'project', cardinality: 'many', required: false,
    role: 'context', representation: 'none', valueType: { type: 'taxonomy_node', taxonomy: {
      id: taxonomy.id, version: taxonomy.version, format: snapshot.format, sha256: snapshot.sha256
    } } });
  definition.state = 'published';
  return { schemaVersion: 1 as const, definition, taxonomies: [{ state: 'published' as const, snapshot }],
    implementation: { methodId: definition.method.id, adapterVersion: RNF_ADAPTER_VERSION } };
}

test('publication freezes the complete definition, exact catalogs and method implementation without a reference dataset', () => {
  const source = publication();
  assert.deepEqual(validateConfiguredNfrDefinition(source.definition), source.definition);
  const snapshot = snapshotDefinitionPublication(source);
  assert.deepEqual(snapshot.content, source);
  source.definition.name = 'Changed'; source.taxonomies.length = 0;
  assert.notEqual(snapshot.content.definition.name, source.definition.name);
  assert.equal(snapshot.content.taxonomies.length, 1);
  assert.throws(() => { snapshot.content.definition.name = 'Tampered'; }, TypeError);
  assert.equal(snapshotContent(JSON.parse(JSON.stringify(snapshot.content))).sha256, snapshot.sha256);
});

test('publication integrity rejects draft content, unreferenced or missing catalogs, drift and mismatched method metadata', () => {
  const attempt = (change: (copy: ReturnType<typeof publication>) => void) => {
    const copy = publication(); change(copy); assert.throws(() => parseDefinitionPublication(copy));
  };
  attempt(copy => { copy.definition.state = 'draft'; });
  attempt(copy => { copy.taxonomies = []; });
  attempt(copy => { copy.definition.attributes.pop(); });
  attempt(copy => { copy.implementation.methodId = 'other-method'; });
  const source = publication(); const changed = structuredClone(source);
  changed.taxonomies[0].snapshot.content.name = 'Changed';
  assert.throws(() => parseDefinitionPublication(changed), /Hash inválido/);
});

test('historical package integrity does not depend on the installed adapter version while new method validation stays strict', () => {
  const historical = publication(); historical.implementation.adapterVersion = 'rnf-v2-profile-adapter-historical';
  assert.deepEqual(parseDefinitionPublication(historical), historical);
  const changedMethod = publication(); changedMethod.definition.method.parameters.k = 3;
  assert.throws(() => validateConfiguredNfrDefinition(changedMethod.definition));
  const unknown = publication(); unknown.definition.method.id = 'unimplemented-testrec';
  assert.throws(() => validateConfiguredNfrDefinition(unknown.definition));
});
