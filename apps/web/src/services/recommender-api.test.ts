import { afterEach, expect, test, vi } from 'vitest';
import { recommenderApi, supportsWebMethod } from './recommender-api';
import type { ImportSpec } from '../types/configurable-recommendations';
afterEach(() => vi.unstubAllGlobals());

test('requests use same-origin access, encoded identities and explicit pagination without injecting an internal credential', async () => {
  const fetch = vi.fn().mockImplementation(async (path: string) => new Response(JSON.stringify(path.includes('/versions/') ? { definition: { method: { id: 'ramos_2019_manhattan_k1_v2' } } } : []), { status: 200, headers: { 'Content-Type': 'application/json' } })); vi.stubGlobal('fetch', fetch);
  await recommenderApi.definitions(50); await recommenderApi.definition('rnf-ramos', '2/test'); await recommenderApi.datasets(100); await recommenderApi.runs(50);
  expect(fetch.mock.calls[0][0]).toBe('/api/internal/recommender-definitions?state=published&limit=50&offset=50');
  expect(fetch.mock.calls[1][0]).toContain('/rnf-ramos/versions/2%2Ftest');
  expect(fetch.mock.calls[2][0]).toContain('limit=50&offset=100'); expect(fetch.mock.calls[3][0]).toContain('offset=50');
  for (const [, options] of fetch.mock.calls) { expect(options.credentials).toBe('same-origin'); expect(options.headers).toBeUndefined(); }
});

test('unimplemented methods stay unavailable and the RNF-only reader rejects test runs', async () => {
  expect(supportsWebMethod('ramos_2019_manhattan_k1_v2')).toBe(true);
  expect(supportsWebMethod('us_agent_e21_equations_demo_v1')).toBe(true);
  expect(supportsWebMethod('testrec_e21_data_contract_v1')).toBe(false);
  const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ definition: { method: { id: 'testrec_e21_data_contract_v1' } } })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ snapshot: { content: { schemaVersion: 2 } } })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ snapshot: { content: { schemaVersion: 2, definition: { content: { definition: { method: { id: 'testrec_e21_data_contract_v1' } } } } } } })));
  vi.stubGlobal('fetch', fetch);
  await expect(recommenderApi.definition('testrec', '1')).rejects.toMatchObject({ status: 422, message: expect.stringContaining('web interface is pending') });
  await expect(recommenderApi.run('test-run')).rejects.toMatchObject({ status: 422, message: expect.stringContaining('web interface is pending') });
  await expect(recommenderApi.datasetImport('test-import')).rejects.toMatchObject({ status: 422, message: expect.stringContaining('web interface is pending') });
});

test('test-case requests use the common run endpoint and catalog publication pins original bytes and declaration', async () => {
  const fetch = vi.fn().mockImplementation(async () => new Response('{}')); vi.stubGlobal('fetch', fetch);
  const t = (await import('../test-fixtures/test-case')).testCaseFixture();
  await recommenderApi.executeTestCases(t.request);
  expect(fetch.mock.calls[0][0]).toBe('/api/internal/recommendation-runs');
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(t.request);
  const file = new File(['{}'], 'catalog.json');
  await recommenderApi.publishTestCaseCatalog('catalog', '2/test', file, 'f'.repeat(64), 'Authored fixture');
  expect(fetch.mock.calls[1][0]).toContain('/catalog/versions/2%2Ftest/publish');
  const body = fetch.mock.calls[1][1].body as FormData;
  expect(JSON.parse(body.get('spec') as string)).toEqual({ expectedFileSha256: 'f'.repeat(64), authorization: { basis: 'synthetic', reference: 'Authored fixture' } });
  expect(body.get('file')).toBe(file); expect(fetch.mock.calls[1][1].headers).toBeUndefined();
});

test('HTTP validation paths reach the form and authorization failures remain explicit', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Entrada inválida', issues: [{ path: ['input', 'values', 'platforms'], message: 'Esperada uma lista' }] }), { status: 422 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Credencial inválida' }), { status: 401 }))
    .mockResolvedValueOnce(new Response('Unavailable', { status: 503 }));
  vi.stubGlobal('fetch', fetch);
  await expect(recommenderApi.run('id')).rejects.toMatchObject({ status: 422, message: 'Entrada inválida\ninput.values.platforms: Esperada uma lista' });
  await expect(recommenderApi.runs()).rejects.toMatchObject({ status: 401, message: expect.stringContaining('Restricted access') });
  await expect(recommenderApi.runs()).rejects.toMatchObject({ status: 503, message: 'Could not communicate with the recommenders.' });
});

test('publication pins reviewed hashes and multipart preview preserves the selected file and explicit mapping', async () => {
  const fetch = vi.fn().mockImplementation(async () => new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })); vi.stubGlobal('fetch', fetch);
  const hash = 'f'.repeat(64);
  await recommenderApi.publishDefinition('rnf-ramos', '2/test', hash);
  await recommenderApi.publishTaxonomy('areas', '1', hash);
  const spec: ImportSpec = { schemaVersion: 1, id: 'base', version: '1', format: 'json', definition: { id: 'rnf-ramos', version: '2/test', format: 'us-agent-json-v1', sha256: hash },
    source: { description: 'Synthetic', authorization: { basis: 'synthetic', reference: 'Demonstration' } }, mapping: { recordId: ['id'], attributes: {} } };
  const file = new File(['[]'], 'base.json'); await recommenderApi.previewDataset(spec, file);
  await recommenderApi.publishDataset('base', '1', 'import-id', hash, [2]);
  expect(fetch.mock.calls[0][0]).toContain('/2%2Ftest/publish');
  for (const index of [0, 1]) expect(JSON.parse(fetch.mock.calls[index][1].body)).toEqual({ expectedDraftSha256: hash });
  const upload = fetch.mock.calls[2][1]; expect(upload.headers).toBeUndefined(); expect(JSON.parse(upload.body.get('spec'))).toEqual(spec); expect(upload.body.get('file').name).toBe('base.json');
  expect(JSON.parse(fetch.mock.calls[3][1].body)).toEqual({ importId: 'import-id', previewSha256: hash, excludedOrdinals: [2] });
});
