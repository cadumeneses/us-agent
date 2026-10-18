import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { snapshotContent } from '../domain/content-snapshot.js';
import { parseRecommenderDefinition } from '../domain/recommender-definition.js';
import { legacyNfrInput, prepareConfiguredNfr, RNF_ADAPTER_VERSION, validateConfiguredNfrDefinition } from './configured-nfr.js';
import { executePublishedRecommendation } from './recommendation-execution.js';
import type { NfrProfile } from './nfr-engine.js';

const root = new URL('../../../../', import.meta.url);
const loadDefinition = () => parseRecommenderDefinition(JSON.parse(readFileSync(new URL('config/recommenders/rnf-v2.draft.json', root), 'utf8')));
const profiles = JSON.parse(readFileSync(new URL('research/baselines/rnf-v2/reference.json', root), 'utf8')).profiles as Record<string, NfrProfile>;
function setup(adapter = RNF_ADAPTER_VERSION) {
  const draft = loadDefinition();
  const definition = { schemaVersion: 1, definition: { ...draft, state: 'published' }, taxonomies: [], implementation: { methodId: draft.method.id, adapterVersion: adapter } };
  const ds = snapshotContent(definition);
  const defRef = { id: draft.id, version: draft.version, format: ds.format, sha256: ds.sha256 };
  const dataset = { schemaVersion: 1, importerVersion: 'structured-import-v1', id: 'demo-base', version: '1', definition: defRef,
    source: { description: 'Synthetic demonstration', authorization: { basis: 'synthetic', reference: 'Not an author dataset' } },
    import: { id: randomUUID(), previewSha256: '0'.repeat(64), fileSha256: '0'.repeat(64) }, mapping: { recordId: ['id'], attributes: {} },
    selection: { excludedOrdinals: [], includedOrdinals: [1] }, records: [legacyNfrInput(draft, profiles.f4, 'f4', 'fixture')] };
  const base = snapshotContent(dataset);
  const request = { id: randomUUID(), definition: defRef, dataset: { id: dataset.id, version: dataset.version, format: base.format, sha256: base.sha256 },
    input: legacyNfrInput(draft, profiles.fa, 'fa', 'fixture'), selection: { labelIndex: 0 } };
  return { draft, definition, dataset, request };
}
test('published execution pins the exact dataset and supports original v2 publications without mutating state', () => {
  for (const adapter of ['rnf-v2-profile-adapter-v2', RNF_ADAPTER_VERSION]) {
    const { definition, dataset, request } = setup(adapter), before = structuredClone({ definition, dataset, request });
    const execution = executePublishedRecommendation(request, definition, dataset);
    assert.equal(execution.result.content.neighbor?.classificationId, profiles.f4.classificationId);
    assert.equal(execution.explanation.content.candidates[0].datasetRecordId, 'f4');
    assert.deepEqual({ definition, dataset, request }, before);
    assert.equal(execution.definition.content.definition.state, 'published');
  }
});
test('published execution rejects another definition, wrong content hash and unsupported implementation', () => {
  const { definition, dataset, request } = setup();
  assert.throws(() => executePublishedRecommendation({ ...request, dataset: { ...request.dataset, sha256: '0'.repeat(64) } }, definition, dataset));
  assert.throws(() => executePublishedRecommendation(request, definition, { ...dataset, definition: { ...dataset.definition, version: 'other' } }));
  const unsupported = setup('unknown-adapter');
  assert.throws(() => executePublishedRecommendation(unsupported.request, unsupported.definition, unsupported.dataset), /não é suportada/);
  const duplicate = structuredClone(dataset.records[0]); duplicate.id = 'numeric-alias'; duplicate.values.classification_id = '04'; duplicate.values.story_id = 'other-story';
  dataset.records.push(duplicate);
  const digest = snapshotContent(dataset);
  assert.throws(() => executePublishedRecommendation({ ...request, dataset: { ...request.dataset, sha256: digest.sha256 } }, definition, dataset), /ambíguos/);
});

test('scientific taxonomy IDs require complete, unambiguous explicit names and preserve namespace-separated legacy projection', () => {
  const draft = loadDefinition();
  const content = { schemaVersion: 1, id: 'platform-demo', version: '1', name: 'Plataformas', source: 'Synthetic', kind: 'list', selection: 'any',
    nodes: [{ id: 'browser', name: 'Nome de exibição alterável', description: '', parentId: null }] };
  const snapshot = snapshotContent(content), dependencies = [{ state: 'published', snapshot }];
  const attr = draft.attributes.find(attribute => attribute.id === 'platforms')!;
  attr.valueType = { type: 'taxonomy_node', taxonomy: { id: content.id, version: content.version, format: snapshot.format, sha256: snapshot.sha256 } };
  assert.throws(() => validateConfiguredNfrDefinition(draft), /legacy_names/);
  draft.method.parameters.legacy_names = { platforms: { browser: 'Web' } };
  assert.doesNotThrow(() => validateConfiguredNfrDefinition(draft, dependencies));
  const input = legacyNfrInput(draft, profiles.fa, 'fa', 'fixture', dependencies);
  assert.deepEqual(input.values.platforms, ['browser']);
  const prepared = prepareConfiguredNfr(draft, input, { id: 'demo', version: '1', source: 'fixture', records: [] }, dependencies);
  assert.deepEqual(prepared.target.projectProfile.platforms, profiles.fa.projectProfile.platforms);
  draft.method.parameters.legacy_names = { platforms: { browser: 'Web', extra: 'Other' } };
  assert.throws(() => validateConfiguredNfrDefinition(draft, dependencies), /exatamente/);
  draft.method.parameters.legacy_names = { platforms: { browser: 'Web', extra: 'Web' } };
  assert.throws(() => validateConfiguredNfrDefinition(draft, dependencies), /ambíguo/);
  draft.method.parameters.legacy_names = { languages: { browser: 'Web' } };
  assert.throws(() => validateConfiguredNfrDefinition(draft), /sem campo/);
});
