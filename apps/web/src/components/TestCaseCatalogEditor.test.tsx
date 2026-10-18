// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createHash, webcrypto } from 'node:crypto';
import { beforeEach, afterEach, expect, test, vi } from 'vitest';
import { TestCaseCatalogEditor, reviewTestCaseFile } from './TestCaseCatalogEditor';
import { recommenderApi } from '../services/recommender-api';
import { testCaseFixture } from '../test-fixtures/test-case';
import { buildTestCasePublication } from '../../../api/src/domain/test-case-publication';
vi.mock('../services/recommender-api', () => ({ recommenderApi: { pageSize: 50, testCaseCatalogs: vi.fn(), testCaseCatalog: vi.fn(), publishTestCaseCatalog: vi.fn() } }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root, container: HTMLDivElement;
let completed: (() => void) | undefined;
beforeEach(() => { vi.resetAllMocks(); vi.stubGlobal('crypto', webcrypto); vi.mocked(recommenderApi.testCaseCatalogs).mockResolvedValue([]);
  container = document.createElement('div'); document.body.append(container); root = createRoot(container); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
function fileFrom(bytes: Uint8Array, name = 'catalog.json') {
  const file = new File([Uint8Array.from(bytes).buffer], name); Object.defineProperty(file, 'arrayBuffer', { value: async () => Uint8Array.from(bytes).buffer }); return file;
}
const button = (name: string) => [...container.querySelectorAll('button')].find(row => row.textContent === name)!;
async function click(name: string) { await act(async () => { const done = new Promise<void>(resolve => { completed = resolve; }); button(name).click(); await done; }); }
async function upload(file: File) { await act(async () => { const input = container.querySelector('input[type="file"]')!;
  Object.defineProperty(input, 'files', { value: [file], configurable: true }); input.dispatchEvent(new Event('change', { bubbles: true })); }); }
async function render() { await act(async () => root.render(<TestCaseCatalogEditor refresh={0} changed={() => {}} busy={false} setBusy={value => { if (!value) completed?.(); }}/>)); }

test('catalog publication pins reviewed BOM/CRLF bytes, preserves artifacts and requires a new review after file change', async () => {
  const t = testCaseFixture(), source = t.catalog.snapshot.content.catalog.content;
  const bytes = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(JSON.stringify(source, null, 2).replaceAll('\n', '\r\n'))]);
  const file = fileFrom(bytes);
  vi.mocked(recommenderApi.publishTestCaseCatalog).mockImplementation(async (_id, _version, original, sha256, reference) => {
    const snapshot = buildTestCasePublication(Buffer.from(await original.arrayBuffer()), original.name, { expectedFileSha256: sha256, authorization: { basis: 'synthetic', reference } });
    return { ...t.catalog, snapshot: { ...snapshot, content: { ...snapshot.content, schemaVersion: 1 as const, file: { ...snapshot.content.file, encoding: 'utf-8' as const } } } };
  });
  await render(); await upload(file); expect(button('Publish reviewed catalog').disabled).toBe(true);
  await click('Review catalog file');
  expect(container.textContent).toContain(source.items[0].gherkin); expect(button('Publish reviewed catalog').disabled).toBe(true);
  await act(async () => { const textarea = container.querySelector('textarea')!; Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, 'Authored fixture'); textarea.dispatchEvent(new Event('input', { bubbles: true })); });
  await click('Publish reviewed catalog');
  expect(recommenderApi.publishTestCaseCatalog).toHaveBeenCalledWith(source.id, source.version, file, createHash('sha256').update(bytes).digest('hex'), 'Authored fixture');
  expect(container.textContent).toContain('Catalog published with its original file');
  await upload(fileFrom(Buffer.from(JSON.stringify({ ...source, version: '2' }))));
  expect(button('Publish reviewed catalog').disabled).toBe(true); expect(container.textContent).not.toContain('Reviewed file SHA-256');
});
test('review refuses malformed bytes, non-synthetic origin and duplicate test identities', async () => {
  const source = testCaseFixture().catalog.snapshot.content.catalog.content;
  for (const bytes of [Buffer.from([0xff]), Buffer.from('{bad JSON'), Buffer.from('{"id":"first","id":"second"}'), Buffer.from(JSON.stringify({ ...source, source: { ...source.source, kind: 'source_example' } })), Buffer.from(JSON.stringify({ ...source, items: [source.items[0], source.items[0]] }))]) {
    await expect(reviewTestCaseFile(fileFrom(bytes))).rejects.toThrow();
  }
});
test('inspection rejects a stale catalog summary rather than displaying a different publication', async () => {
  const t = testCaseFixture(); vi.mocked(recommenderApi.testCaseCatalogs).mockResolvedValue([t.catalogSummary]);
  vi.mocked(recommenderApi.testCaseCatalog).mockResolvedValue({ ...t.catalog, snapshot: { ...t.catalog.snapshot, sha256: '0'.repeat(64) } });
  await render(); await act(async () => { const select = container.querySelector('select')!; select.value = JSON.stringify([t.catalogSummary.id, t.catalogSummary.version]); select.dispatchEvent(new Event('change', { bubbles: true })); });
  await click('Inspect catalog version'); expect(container.textContent).toContain('Catalog changed. Refresh the versions.');
  expect(container.textContent).not.toContain(t.catalog.snapshot.content.catalog.content.items[0].gherkin);
});
