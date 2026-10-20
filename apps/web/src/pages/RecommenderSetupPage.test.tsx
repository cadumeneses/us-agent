// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import template from '../../../../config/recommenders/rnf-v2.draft.json';
import baseline from '../../../../research/baselines/rnf-v2/reference.json';
import { snapshotContent } from '../../../api/src/domain/content-snapshot';
import { parseDefinitionPublication } from '../../../api/src/domain/definition-publication';
import { buildImportPreview, selectImportRecords } from '../../../api/src/domain/dataset-import';
import { parseRecommenderDefinition } from '../../../api/src/domain/recommender-definition';
import { parseRecommenderTaxonomy } from '../../../api/src/domain/recommender-taxonomy';
import { legacyNfrInput, RNF_ADAPTER_VERSION, validateConfiguredNfrDefinition } from '../../../api/src/services/configured-nfr';
import type { NfrProfile } from '../../../api/src/services/nfr-engine';
import { recommenderApi } from '../services/recommender-api';
import type { ConfiguredDefinition, DefinitionRecord, DefinitionSummary, ImportRecord } from '../types/configurable-recommendations';
import { RecommenderSetupPage } from './RecommenderSetupPage';
import { TaxonomyPage } from './TaxonomyPage';
import { testCaseFixture } from '../test-fixtures/test-case';
import { buildTestCaseImportPreview } from '../../../api/src/domain/test-case-dataset';
import { validateImplementedDefinition } from '../../../api/src/services/recommender-methods';

vi.mock('../services/recommender-api', async importOriginal => ({ ...await importOriginal<typeof import('../services/recommender-api')>(), recommenderApi: { pageSize: 50, definitions: vi.fn(), definitionVersions: vi.fn(), definition: vi.fn(), saveDefinition: vi.fn(), publishDefinition: vi.fn(), taxonomyVersions: vi.fn(), taxonomyVersion: vi.fn(), saveTaxonomy: vi.fn(), publishTaxonomy: vi.fn(), previewDataset: vi.fn(), publishDataset: vi.fn(), datasetImport: vi.fn(), testCaseCatalogs: vi.fn(), testCaseCatalog: vi.fn(), publishTestCaseCatalog: vi.fn() } }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const draft = () => parseRecommenderDefinition({ ...structuredClone(template), version: 'ui-setup' });
function publication(definition = draft()): DefinitionRecord {
  const value = { schemaVersion: 1 as const, definition: { ...definition, state: 'published' as const }, taxonomies: [], implementation: { methodId: definition.method.id, adapterVersion: RNF_ADAPTER_VERSION } };
  return { state: 'published', definition: value.definition, snapshot: snapshotContent(value), draftSha256: snapshotContent(definition).sha256 };
}
const published = publication();
const profiles = baseline.profiles as Record<string, NfrProfile>;
const summary: DefinitionSummary = { id: published.definition.id, version: published.definition.version, name: published.definition.name, state: 'published', method: published.definition.method.id, attributeCount: published.definition.attributes.length, snapshot: published.snapshot! };
let root: Root, container: HTMLDivElement;
let currentDefinition: ConfiguredDefinition;
let preview: ImportRecord;
beforeEach(() => {
  vi.resetAllMocks(); currentDefinition = draft();
  vi.mocked(recommenderApi.definitions).mockResolvedValue([summary]);
  vi.mocked(recommenderApi.definitionVersions).mockResolvedValue([summary]);
  vi.mocked(recommenderApi.taxonomyVersions).mockResolvedValue([]);
  vi.mocked(recommenderApi.testCaseCatalogs).mockResolvedValue([]);
  vi.mocked(recommenderApi.definition).mockResolvedValue(published);
  vi.mocked(recommenderApi.saveDefinition).mockImplementation(async value => {
    currentDefinition = parseRecommenderDefinition(value);
    return { state: 'draft', definition: currentDefinition, snapshot: null, draftSha256: snapshotContent(currentDefinition).sha256 };
  });
  vi.mocked(recommenderApi.publishDefinition).mockImplementation(async (_id, _version, hash) => {
    expect(hash).toBe(snapshotContent(currentDefinition).sha256); validateConfiguredNfrDefinition(currentDefinition); return publication(currentDefinition);
  });
  vi.mocked(recommenderApi.saveTaxonomy).mockImplementation(async value => ({ state: 'draft', snapshot: snapshotContent(parseRecommenderTaxonomy(value)) }));
  vi.mocked(recommenderApi.previewDataset).mockImplementation(async (spec, file) => {
    const bytes = await new Promise<ArrayBuffer>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result as ArrayBuffer); reader.onerror = reject; reader.readAsArrayBuffer(file); });
    const content = buildImportPreview(spec, Buffer.from(bytes), file.name, published.snapshot!.content);
    preview = { id: crypto.randomUUID(), snapshot: snapshotContent({ ...content, definition: { ...content.definition, content: parseDefinitionPublication(content.definition.content) } }), createdBy: 'local-development', createdAt: '2026-10-17T12:00:00.000Z' };
    return preview;
  });
  vi.mocked(recommenderApi.publishDataset).mockImplementation(async (id, version, importId, hash, excluded) => {
    expect(importId).toBe(preview.id); expect(hash).toBe(preview.snapshot.sha256);
    const selection = selectImportRecords(preview.snapshot.content, excluded);
    return { state: 'published', snapshot: snapshotContent({ id, version, definition: preview.snapshot.content.spec.definition,
      source: preview.snapshot.content.spec.source, import: { id: importId, previewSha256: hash, fileSha256: preview.snapshot.content.file.sha256 }, records: selection.records }) };
  });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
async function render() { await act(async () => root.render(<MemoryRouter><Routes><Route path="/" element={<RecommenderSetupPage/>}/><Route path="/taxonomy" element={<TaxonomyPage/>}/></Routes></MemoryRouter>)); }
const editor = (name: string) => container.querySelector(`[aria-label="${name}"]`)!;
function button(text: string, scope: ParentNode = container) {
  const target = [...scope.querySelectorAll('button')].find(item => item.textContent === text); if (!target) throw new Error(`Botão ausente: ${text}`); return target;
}
function control(name: string, scope: ParentNode = container) {
  const label = [...scope.querySelectorAll('label')].find(item => [...item.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent).join('') === name);
  const target = label?.querySelector('input,select,textarea'); if (!target) throw new Error(`Campo ausente: ${name}`); return target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
}
async function change(target: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string) {
  await act(async () => { const prototype = target instanceof HTMLSelectElement ? HTMLSelectElement.prototype : target instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(target, value); target.dispatchEvent(new Event(target instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true })); });
}
async function click(target: HTMLElement) {
  await act(async () => {
    target.click();
    if (target.textContent === "Generate import preview") {
      const result = vi.mocked(recommenderApi.previewDataset).mock.results.at(-1);
      if (result?.type === 'return') await result.value.catch(() => undefined);
    }
  });
}
async function upload(contents: string, name = 'base.json') {
  const input = control("CSV or JSON file (up to 5 MB)") as HTMLInputElement;
  await act(async () => { Object.defineProperty(input, 'files', { value: [new File([contents], name)], configurable: true }); input.dispatchEvent(new Event('change', { bubbles: true })); });
}
async function importReady() {
  await render(); await click(button("Import dataset")); await change(control("Import definition"), JSON.stringify([summary.id, summary.version])); await click(button("Load dataset schema"));
  await change(control("Dataset ID"), 'ui-base'); await change(control("Dataset version"), '1'); await change(control("Source description"), "Synthetic demonstration"); await change(control("Use declaration"), 'synthetic'); await change(control("Authorization reference"), 'Reconstrução; não é dataset dos autores');
  await click(button("Use US-Agent record mapping"));
}

test('definition editor saves a configurable context, publishes only saved content and sends the reviewed hash', async () => {
  await render(); const scope = editor("Definition editor"); await click(button("New NFR from template")); await change(control("Version", scope), 'ui-new');
  await click(button("Add attribute")); const last = [...scope.querySelectorAll('.configured-subeditor')].filter(item => item.querySelector('summary'))[18];
  await change(control("Attribute ID", last), 'new_context'); await change(control("Attribute name", last), 'Contexto adicional');
  expect(button("Publish reviewed definition").disabled).toBe(true);
  await click(button("Save definition draft")); expect(currentDefinition.attributes.at(-1)?.id).toBe('new_context');
  expect(button("Publish reviewed definition").disabled).toBe(false);
  await change(control("Name", scope), 'RNF revisado'); expect(button("Publish reviewed definition").disabled).toBe(true);
  await click(button("Save definition draft")); await click(button("Publish reviewed definition"));
  expect(recommenderApi.publishDefinition).toHaveBeenCalledWith('nfr-recommender', 'ui-new', snapshotContent(currentDefinition).sha256);
  expect(scope.textContent).toContain("Definition published with immutable dependencies."); expect(control("Name", scope).matches(':disabled')).toBe(true);
}, 15000);

test('published definitions are read-only and cloning requires an explicitly entered new version', async () => {
  await render(); const scope = editor("Definition editor");
  await change(control("Definition version"), JSON.stringify([summary.id, summary.version])); await click(button("Load definition"));
  expect(control('ID', scope).matches(':disabled')).toBe(true); expect(button("Save definition draft").disabled).toBe(true);
  await click(button("Create a new definition version")); expect(control("Version", scope).value).toBe('');
  await change(control("Version", scope), 'ui-clone'); await click(button("Save definition draft"));
  expect(currentDefinition.version).toBe('ui-clone'); expect(published.definition.version).toBe('ui-setup');
  expect(recommenderApi.publishDefinition).not.toHaveBeenCalled();
});

test('test-case template publishes the explicit synthetic method with its own adapter and no RNF mappings', async () => {
  vi.mocked(recommenderApi.publishDefinition).mockImplementation(async (_id, _version, hash) => {
    expect(hash).toBe(snapshotContent(currentDefinition).sha256);
    const implementation = validateImplementedDefinition(currentDefinition);
    const definition = { ...currentDefinition, state: 'published' as const };
    return { state: 'published', definition, snapshot: snapshotContent({ schemaVersion: 1, definition, taxonomies: [], implementation: { methodId: definition.method.id, adapterVersion: implementation.adapterVersion } }) };
  });
  await render(); const scope = editor('Definition editor'); await click(button('New test-case demonstration'));
  expect(scope.textContent).toContain('Demonstration using synthetic test associations.'); expect(scope.textContent).not.toContain('Map IDs to scientific names');
  await change(control('Version', scope), 'web-demo'); await click(button('Save definition draft')); await click(button('Publish reviewed definition'));
  expect(currentDefinition.method.id).toBe('us_agent_e21_equations_demo_v1'); expect(currentDefinition.method.parameters.scientific_reproduction).toBe(false);
  expect(currentDefinition.attributes).toHaveLength(8); expect(scope.textContent).toContain('Definition published with immutable dependencies');
});

test('test import fixes the catalog, requires explicit missing-association exclusion and invalidates preview on catalog change', async () => {
  const t = testCaseFixture();
  vi.mocked(recommenderApi.definitions).mockResolvedValue([t.summary]); vi.mocked(recommenderApi.definition).mockResolvedValue(t.definition);
  vi.mocked(recommenderApi.testCaseCatalogs).mockResolvedValue([t.catalogSummary, { ...t.catalogSummary, version: '2', snapshot: { ...t.catalogSummary.snapshot, sha256: 'f'.repeat(64) } }]);
  let imported!: Awaited<ReturnType<typeof recommenderApi.previewDataset>>;
  vi.mocked(recommenderApi.previewDataset).mockImplementation(async (spec, file) => {
    expect(spec.schemaVersion).toBe(2); expect('catalog' in spec && spec.catalog).toEqual(t.request.catalog);
    const bytes = await new Promise<ArrayBuffer>(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result as ArrayBuffer); reader.readAsArrayBuffer(file); });
    const content = buildTestCaseImportPreview(spec, Buffer.from(bytes), file.name, t.definition.snapshot!.content, t.catalog.snapshot.content);
    imported = { id: crypto.randomUUID(), snapshot: snapshotContent({ ...content, definition: { ...content.definition, content: parseDefinitionPublication(content.definition.content) }, catalog: t.catalog.snapshot }), createdBy: 'local-development', createdAt: t.original.createdAt };
    return imported;
  });
  vi.mocked(recommenderApi.publishDataset).mockResolvedValue({ state: 'published', snapshot: t.original.snapshot.content.dataset });
  await render(); await click(button('Import dataset')); await change(control('Import definition'), JSON.stringify([t.summary.id, t.summary.version])); await click(button('Load dataset schema'));
  await change(control('Dataset ID'), 'web-tests'); await change(control('Dataset version'), '1'); await change(control('Source description'), 'Synthetic profiles');
  await change(control('Use declaration'), 'synthetic'); await change(control('Authorization reference'), 'Authored fixture');
  await click(button('Use US-Agent record mapping'));
  const valid = t.original.snapshot.content.dataset.content.records[0], missing = structuredClone(valid); missing.id = 'unknown-output'; missing.values.story_id = 'unknown-output-story'; delete missing.values.test_case_ids;
  await upload(JSON.stringify([valid, missing])); await click(button('Generate import preview'));
  expect(recommenderApi.previewDataset).not.toHaveBeenCalled(); expect(container.textContent).toContain('Choose a published synthetic catalog');
  await change(control('Catalog and version'), JSON.stringify([t.catalogSummary.id, t.catalogSummary.version])); await click(button('Generate import preview'));
  expect(imported.snapshot.content.report.invalid).toBe(1); expect(button('Publish reviewed dataset').disabled).toBe(true);
  expect(container.textContent).toContain('Catalog preserved in preview');
  await click(container.querySelector('[aria-label="Exclude record 2"]') as HTMLElement); await click(button('Publish reviewed dataset'));
  expect(recommenderApi.publishDataset).toHaveBeenCalledWith('web-tests', '1', imported.id, imported.snapshot.sha256, [2]);
  await change(control('Catalog and version'), JSON.stringify([t.catalogSummary.id, '2'])); expect(container.querySelector('.configured-import-preview')).toBeNull();
  vi.mocked(recommenderApi.datasetImport).mockResolvedValue(imported);
  await change(control('Preview ID'), imported.id); await click(button('Load preview'));
  expect(container.textContent).toContain('Catalog preserved in preview');
});

test('a publication conflict keeps the reviewed draft and reports that it must be reloaded', async () => {
  await render(); await click(button("New NFR from template")); await change(control("Version", editor("Definition editor")), 'conflict');
  await click(button("Save definition draft"));
  vi.mocked(recommenderApi.publishDefinition).mockRejectedValue(new Error('O rascunho foi alterado desde a revisão.'));
  await click(button("Publish reviewed definition"));
  expect(container.textContent).toContain('O rascunho foi alterado'); expect(control("Version", editor("Definition editor")).value).toBe('conflict');
});

test('scientific taxonomy configuration sends stable IDs and an explicit complete legacy-name mapping', async () => {
  const taxonomy = { schemaVersion: 1 as const, id: 'platform-ui', version: '1', name: 'Plataformas UI', source: 'Synthetic', kind: 'list' as const, selection: 'any' as const,
    nodes: [{ id: 'browser', name: 'Navegador (apresentação)', description: '', parentId: null }] };
  const snapshot = snapshotContent(taxonomy), dependency = { state: 'published' as const, snapshot };
  vi.mocked(recommenderApi.taxonomyVersions).mockResolvedValue([{ id: taxonomy.id, version: taxonomy.version, name: taxonomy.name, state: 'published', kind: 'list', nodeCount: 1, snapshot }]);
  await render(); await click(button("New NFR from template")); const scope = editor("Definition editor"); await change(control("Version", scope), 'mapped');
  const attribute = [...scope.querySelectorAll('details')].find(item => item.querySelector('summary')?.textContent?.startsWith('Platforms'))!;
  await click(attribute.querySelector('summary')!); await change(control("Type", attribute), 'taxonomy_node'); await change(control("Published taxonomy", attribute), JSON.stringify(['platform-ui', '1']));
  await change(control("Attribute path"), 'platforms'); await change(control("Node ID", scope), 'browser'); await click(button("Add mapping entry"));
  await change(control('Comparison value for browser'), 'Web'); await click(button("Save definition draft"));
  expect(currentDefinition.method.parameters.legacy_names).toEqual({ platforms: { browser: 'Web' } });
  vi.mocked(recommenderApi.publishDefinition).mockImplementation(async () => {
    validateConfiguredNfrDefinition(currentDefinition, [dependency]);
    const content = parseDefinitionPublication({ ...published.snapshot!.content, definition: { ...currentDefinition, state: 'published' }, taxonomies: [dependency] });
    return { state: 'published', definition: content.definition, snapshot: snapshotContent(content) };
  });
  await click(button("Publish reviewed definition")); expect(scope.textContent).toContain("Definition published with immutable dependencies.");
}, 15000);

test('taxonomy editor validates tree structure, preserves a failed draft and publishes its exact saved hash', async () => {
  await render(); await click(button("Taxonomies")); await click(button("New taxonomy")); const scope = editor("Taxonomy editor");
  await change(control('ID', scope), 'ui-areas'); await change(control("Version", scope), '1'); await change(control("Name", scope), 'Áreas'); await change(control("Taxonomy source"), "Synthetic demonstration"); await change(control('Structure'), 'tree'); await change(control("Selectable nodes"), 'leaf');
  await change(control("Node ID", scope), 'root'); await change(control("Node name", scope), 'Raiz'); await change(control("Parent ID (empty for root)", scope), 'missing');
  await click(button("Save taxonomy draft")); expect(scope.textContent).toContain('Pai inexistente'); expect(control("Node ID", scope).value).toBe('root'); expect(button("Publish reviewed taxonomy").disabled).toBe(true);
  await change(control("Parent ID (empty for root)", scope), ''); await click(button("Save taxonomy draft"));
  const saved = vi.mocked(recommenderApi.saveTaxonomy).mock.calls.at(-1)![0];
  vi.mocked(recommenderApi.publishTaxonomy).mockResolvedValue({ state: 'published', snapshot: snapshotContent(saved) });
  await click(button("Publish reviewed taxonomy")); expect(recommenderApi.publishTaxonomy).toHaveBeenCalledWith('ui-areas', '1', snapshotContent(saved).sha256);
  expect(control('ID', scope).matches(':disabled')).toBe(true);
});

test('JSON import preserves labels and source values, and publishes the exact preview with explicit invalid-row exclusion', async () => {
  await importReady(); const original = legacyNfrInput(draft(), profiles.multi, 'multi', 'fixture');
  await upload(JSON.stringify([original, { id: 'invalid', values: {} }])); await click(button("Generate import preview"));
  expect(preview.snapshot.content.report.invalid).toBe(1); expect(button("Publish reviewed dataset").disabled).toBe(true);
  await click(container.querySelector("[aria-label=\"Exclude record 2\"]") as HTMLElement); expect(button("Publish reviewed dataset").disabled).toBe(false);
  await click(button("Publish reviewed dataset"));
  expect(recommenderApi.publishDataset).toHaveBeenCalledWith('ui-base', '1', preview.id, preview.snapshot.sha256, [2]);
  expect(preview.snapshot.content.report.rows[0].input?.values.labels).toEqual(baseline.profiles.multi.labels);
  expect(container.textContent).toContain("Dataset published. The version and selection were preserved.");
});

test('duplicate identities can be resolved by excluding one occurrence rather than discarding the entire group', async () => {
  await importReady(); const original = legacyNfrInput(draft(), profiles.f4, 'f4', 'fixture'); await upload(JSON.stringify([original, original])); await click(button("Generate import preview"));
  expect(preview.snapshot.content.report.duplicate).toBe(2); expect(button("Publish reviewed dataset").disabled).toBe(true);
  await click(container.querySelector("[aria-label=\"Exclude record 2\"]") as HTMLElement); expect(button("Publish reviewed dataset").disabled).toBe(false);
  await click(button("Publish reviewed dataset")); expect(recommenderApi.publishDataset).toHaveBeenCalledWith('ui-base', '1', preview.id, preview.snapshot.sha256, [2]);
});

test('CSV mapping retains complete JSON arrays and short text with an explicitly chosen delimiter', async () => {
  await importReady(); await change(control("File format"), 'csv'); await change(control("CSV delimiter"), ';'); await click(button("Use US-Agent record mapping"));
  const input = legacyNfrInput(draft(), profiles.multi, 'multi', 'fixture'); input.values.text = 'x';
  const names = ['id', ...Object.keys(input.values)];
  const values = [input.id, ...Object.values(input.values)].map(value => typeof value === 'string' ? value : JSON.stringify(value));
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
  await upload(`${names.map(quote).join(';')}\n${values.map(quote).join(';')}`, 'base.csv'); await click(button("Generate import preview"));
  expect(preview.snapshot.content.report.valid).toBe(1); expect(preview.snapshot.content.report.rows[0].input?.values).toEqual(input.values);
  expect(preview.snapshot.content.spec.delimiter).toBe(';'); await click(button("Publish reviewed dataset"));
  expect(recommenderApi.publishDataset).toHaveBeenCalledWith('ui-base', '1', preview.id, preview.snapshot.sha256, []);
});

test('changing the file, mapping or metadata invalidates the prior preview and cannot publish stale data', async () => {
  await importReady(); const input = legacyNfrInput(draft(), profiles.f4, 'f4', 'fixture'); await upload(JSON.stringify([input])); await click(button("Generate import preview"));
  expect(button("Publish reviewed dataset").disabled).toBe(false);
  await upload(JSON.stringify([input]), 'novo-arquivo.json'); expect(container.querySelector('.configured-import-preview')).toBeNull();
  await click(button("Generate import preview")); expect(preview.snapshot.content.file.name).toBe('novo-arquivo.json');
  await change(control("Source description"), 'Outra origem'); expect(container.querySelector('.configured-import-preview')).toBeNull();
  await click(button("Generate import preview")); expect(preview.snapshot.content.spec.source.description).toBe('Outra origem');
  await change(control('Path for Plataformas'), 'outra_coluna'); expect(container.querySelector('.configured-import-preview')).toBeNull();
  expect(recommenderApi.publishDataset).not.toHaveBeenCalled();
});

test('fatal file errors remain visible and are never publishable through row exclusion', async () => {
  await importReady(); await upload('{ invalid json'); await click(button("Generate import preview"));
  expect(preview.snapshot.content.report.fatal.length).toBeGreaterThan(0); expect(button("Publish reviewed dataset").disabled).toBe(true);
  expect(container.textContent).toContain(preview.snapshot.content.report.fatal[0].message);
});

test('recovering a preview publishes its preserved identity even when the current form has different metadata', async () => {
  await importReady(); await upload(JSON.stringify([legacyNfrInput(draft(), profiles.f4, 'f4', 'fixture')])); await click(button("Generate import preview"));
  const preserved = preview; vi.mocked(recommenderApi.datasetImport).mockResolvedValue(preserved);
  await change(control("Dataset ID"), 'different-form-id'); await change(control("Preview ID"), preserved.id); await click(button("Load preview")); await click(button("Publish reviewed dataset"));
  expect(recommenderApi.publishDataset).toHaveBeenCalledWith('ui-base', '1', preserved.id, preserved.snapshot.sha256, []);
});

test('a pending write disables navigation and suppresses duplicate save calls', async () => {
  await render(); await click(button("New NFR from template")); await change(control("Version", editor("Definition editor")), 'pending');
  let resolve!: (value: DefinitionRecord) => void; vi.mocked(recommenderApi.saveDefinition).mockReturnValue(new Promise(value => { resolve = value; }));
  await click(button("Save definition draft")); await click(button("Save definition draft"));
  expect(recommenderApi.saveDefinition).toHaveBeenCalledTimes(1); expect(button("Import dataset").disabled).toBe(true); expect(button("Go to runs").disabled).toBe(true);
  await act(async () => resolve({ state: 'draft', definition: draft(), snapshot: null, draftSha256: snapshotContent(draft()).sha256 }));
});
