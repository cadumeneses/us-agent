// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { RecommenderSetupPage } from './RecommenderSetupPage';
import { NewRecommenderPage } from './NewRecommenderPage';
import { ConfiguredRecommendationsPage } from './ConfiguredRecommendationsPage';
import { RecommendersPage } from './RecommendersPage';
import { WorkspaceProvider } from '../services/workspace';
import { api } from '../services/api';
import { recommenderApi } from '../services/recommender-api';
import { snapshotContent } from '../../../api/src/domain/content-snapshot';
import { parseDefinitionPublication } from '../../../api/src/domain/definition-publication';
import { buildImportPreview, selectImportRecords } from '../../../api/src/domain/dataset-import';
import { validateConfigurableDefinition, executeConfigurableRecommendation, CONFIGURABLE_KNN_ADAPTER } from '../../../api/src/services/configurable-knn';
import { newCustomRecommender } from '../services/custom-recommender';
import type { ConfiguredDefinition, DatasetRecord, DatasetSummary, DefinitionRecord, DefinitionSummary, ImportRecord } from '../types/configurable-recommendations';
import type { ProjectRecommendationRun } from '../types/project-recommendations';

vi.mock('../services/api', () => ({ api: { projects: vi.fn(), stories: vi.fn() } }));
vi.mock('../services/recommender-api', async original => ({ ...await original<typeof import('../services/recommender-api')>(), recommenderApi: {
  pageSize: 50, definitions: vi.fn(), definitionVersions: vi.fn(), definition: vi.fn(), saveDefinition: vi.fn(), publishDefinition: vi.fn(), taxonomyVersions: vi.fn(),
  datasets: vi.fn(), testCaseCatalogs: vi.fn(), projectProfile: vi.fn(), previewDataset: vi.fn(), publishDataset: vi.fn(), runs: vi.fn(), executeProject: vi.fn(), publishedRun: vi.fn(), replay: vi.fn()
} }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root, container: HTMLDivElement;
let draft: ConfiguredDefinition, published: DefinitionRecord | undefined, preview: ImportRecord, dataset: DatasetRecord | undefined, run: ProjectRecommendationRun;
const summary = (record: DefinitionRecord): DefinitionSummary => ({ id: record.definition.id, version: record.definition.version, name: record.definition.name, method: record.definition.method.id, state: record.state, attributeCount: record.definition.attributes.length, snapshot: record.snapshot });
const datasetSummary = (record: DatasetRecord): DatasetSummary => ({ id: record.snapshot.content.id, version: record.snapshot.content.version, definition: record.snapshot.content.definition, state: record.state, snapshot: record.snapshot, recordCount: record.snapshot.content.records.length, publishedBy: 'test', publishedAt: '2026-10-21T12:00:00Z' });
beforeEach(() => {
  vi.resetAllMocks(); draft = newCustomRecommender(); published = undefined; dataset = undefined;
  vi.mocked(api.projects).mockResolvedValue(['Alpha', 'Beta']); vi.mocked(api.stories).mockResolvedValue([]);
  vi.mocked(recommenderApi.definitions).mockImplementation(async () => published ? [summary(published)] : []);
  vi.mocked(recommenderApi.definitionVersions).mockImplementation(async () => published ? [summary(published)] : []);
  vi.mocked(recommenderApi.definition).mockImplementation(async () => published!);
  vi.mocked(recommenderApi.taxonomyVersions).mockResolvedValue([]); vi.mocked(recommenderApi.testCaseCatalogs).mockResolvedValue([]);
  vi.mocked(recommenderApi.datasets).mockImplementation(async () => dataset ? [datasetSummary(dataset)] : []);
  vi.mocked(recommenderApi.runs).mockResolvedValue([]);
  vi.mocked(recommenderApi.saveDefinition).mockImplementation(async value => { draft = structuredClone(value); validateConfigurableDefinition(draft); return { state: 'draft', definition: draft, snapshot: null, draftSha256: snapshotContent(draft).sha256 }; });
  vi.mocked(recommenderApi.publishDefinition).mockImplementation(async (_id, _version, hash) => {
    expect(hash).toBe(snapshotContent(draft).sha256);
    const definition = { ...draft, state: 'published' as const };
    published = { state: 'published', definition, snapshot: snapshotContent({ schemaVersion: 1, definition, taxonomies: [], implementation: { methodId: definition.method.id, adapterVersion: CONFIGURABLE_KNN_ADAPTER } }) }; return published;
  });
  vi.mocked(recommenderApi.projectProfile).mockImplementation(async project => ({ projectId: project.toLowerCase(), revision: 0, values: { characteristics: [project === 'Alpha' ? 'Web' : 'Mobile'], recommendations: [] } }));
  vi.mocked(recommenderApi.previewDataset).mockImplementation(async (spec, file) => {
    const contents = await new Promise<ArrayBuffer>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result as ArrayBuffer); reader.onerror = reject; reader.readAsArrayBuffer(file); });
    const content = buildImportPreview(spec, Buffer.from(contents), file.name, published!.snapshot!.content);
    preview = { id: crypto.randomUUID(), createdBy: 'test', createdAt: '2026-10-21T12:00:00Z', snapshot: snapshotContent({ ...content, definition: { ...content.definition, content: parseDefinitionPublication(content.definition.content) } }) }; return preview;
  });
  vi.mocked(recommenderApi.publishDataset).mockImplementation(async (id, version, importId, hash, excluded) => {
    const selected = selectImportRecords(preview.snapshot.content, excluded);
    dataset = { state: 'published', snapshot: snapshotContent({ schemaVersion: 1, importerVersion: 'structured-import-v1', id, version, definition: preview.snapshot.content.spec.definition, source: preview.snapshot.content.spec.source,
      import: { id: importId, previewSha256: hash, fileSha256: preview.snapshot.content.file.sha256 }, mapping: preview.snapshot.content.spec.mapping, selection: { includedOrdinals: selected.includedOrdinals, excludedOrdinals: excluded }, records: selected.records }) }; return dataset;
  });
  vi.mocked(recommenderApi.executeProject).mockImplementation(async request => {
    run = { id: request.id, createdBy: 'test', createdAt: '2026-10-21T12:00:00Z', durationMs: 1, snapshot: snapshotContent(executeConfigurableRecommendation(request, published!.snapshot!.content, dataset!.snapshot.content)) as ProjectRecommendationRun['snapshot'] }; return run;
  });
  vi.mocked(recommenderApi.publishedRun).mockImplementation(async () => run);
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
async function render(path = '/recommenders/new') {
  await act(async () => root.render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/recommenders/new" element={<NewRecommenderPage/>}/><Route path="/recommender-setup" element={<RecommenderSetupPage/>}/><Route path="/configured-recommendations" element={<ConfiguredRecommendationsPage/>}/><Route path="/recommendations" element={<WorkspaceProvider><RecommendersPage/></WorkspaceProvider>}/></Routes></MemoryRouter>));
}
function button(name: string, scope: ParentNode = container) {
  const found = [...scope.querySelectorAll('button')].find(item => item.textContent === name); if (!found) throw new Error(`Missing button ${name}`); return found;
}
function control(name: string, scope: ParentNode = container) {
  const found = [...scope.querySelectorAll('label')].find(item => item.firstChild?.textContent === name)?.querySelector('input,textarea,select'); if (!found) throw new Error(`Missing control ${name}`); return found as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
}
async function change(target: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  await act(async () => { const prototype = target instanceof HTMLSelectElement ? HTMLSelectElement.prototype : target instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(target, value); target.dispatchEvent(new Event(target instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true })); });
}
async function click(target: HTMLElement) { await act(async () => { target.click(); const result = vi.mocked(recommenderApi.previewDataset).mock.results.at(-1); if (result?.type === 'return') await result.value; }); }
async function create() {
  await render(); await click(button('Continue')); expect(container.textContent).toContain('Enter a recommender name'); expect(document.activeElement?.getAttribute('role')).toBe('alert');
  await change(control('ID'), 'architectures'); await change(control('Recommender name'), 'Architecture recommender'); await click(button('Continue'));
  await change(control('Input name'), 'Characteristics'); await change(control('Fill from an existing project'), 'platforms'); await click(button('Continue'));
  await change(control('Recommendation name'), 'Architectures'); await click(button('Continue'));
  await change(control('Number of neighbors (k)'), '1'); await click(button('Continue'));
  expect(recommenderApi.saveDefinition).not.toHaveBeenCalled(); await click(button('Create recommender'));
}
async function addData() { await click([...container.querySelectorAll('a')].find(item => item.textContent === 'Add reference data')!); }

test('creates a named KNN instance, builds a reviewed dataset from projects and executes it through the generated form', async () => {
  await create(); expect(published!.definition.method.parameters.profile_sources).toEqual({ characteristics: 'platforms' });
  await addData(); expect(control('Import definition').value).toBe(JSON.stringify(['architectures', '1']));
  await change(control('Dataset ID'), 'architecture-projects'); await change(control('Dataset version'), '1');
  await change(control('Source description'), 'Project profiles with reviewed architecture choices'); await change(control('Use declaration'), 'owned'); await change(control('Authorization reference'), 'Organization reference data');
  await change(control('Reference data source'), 'projects'); await click(button('Load registered projects'));
  await change(control('Reference project'), 'Alpha'); await click(button('Add reference project')); await change(control('Reference project'), 'Beta'); await click(button('Add reference project'));
  await click(button('Use selected project records')); expect(container.textContent).toContain('Review the associated outputs.'); expect(recommenderApi.previewDataset).not.toHaveBeenCalled();
  await change(control('Output for project names'), 'recommendations'); await click(button('Use project names as recommendations'));
  for (const checkbox of container.querySelectorAll('[aria-label="Registered project dataset"] input[type="checkbox"]')) await click(checkbox as HTMLElement);
  await click(button('Use selected project records')); await click(button('Generate import preview'));
  expect(preview.snapshot.content.report.valid).toBe(2); expect(preview.snapshot.content.report.rows[0].input!.id).toBe('project:alpha');
  await click(button('Publish reviewed dataset'));
  const link = [...container.querySelectorAll('a')].find(item => item.textContent === 'Run this recommender with this dataset')!; await click(link);
  expect(control('Definition and version').value).toBe(JSON.stringify(['architectures', '1']));
  expect(control('Reference dataset').value).toBe(JSON.stringify(['architecture-projects', '1']));
  await change(control('Profile identifier'), 'new-project'); await click(button('Add Characteristics')); await change(control('Characteristics 1'), 'Web'); await click(button('Recommend'));
  expect(recommenderApi.executeProject).toHaveBeenCalledTimes(1);
  await vi.mocked(recommenderApi.executeProject).mock.results[0].value;
  expect(run.snapshot.content.result.content.items.map(item => item.text)).toEqual(['Alpha']);
  expect(container.textContent).toContain('Architecture recommender'); expect(container.textContent).toContain('Alpha');
}, 20000);

test('each published instance appears on the main page and opens its own generated fields without a story', async () => {
  draft = { ...newCustomRecommender(), id: 'architectures', name: 'Architecture recommender' };
  await recommenderApi.publishDefinition(draft.id, draft.version, snapshotContent(draft).sha256);
  const secondDefinition = { ...structuredClone(published!.definition), id: 'practices', name: 'Practice recommender' };
  secondDefinition.attributes[0] = { ...secondDefinition.attributes[0], id: 'tooling', name: 'Tooling' };
  secondDefinition.method.parameters.weights = { tooling: 1 };
  const second: DefinitionRecord = { state: 'published', definition: secondDefinition, snapshot: snapshotContent({ ...published!.snapshot!.content, definition: secondDefinition }) };
  vi.mocked(recommenderApi.definitions).mockResolvedValue([summary(published!), summary(second)]);
  vi.mocked(recommenderApi.definition).mockImplementation(async id => id === second.definition.id ? second : published!);
  await render('/recommendations?project=');
  const cards = container.querySelector('[aria-label="Your published recommenders"]')!;
  expect(cards.textContent).toContain('Architecture recommender'); expect(cards.textContent).toContain('Practice recommender');
  await click([...cards.querySelectorAll('button')].find(item => item.textContent?.startsWith('Architecture recommender'))!);
  expect(container.querySelectorAll('label').length).toBeGreaterThan(0); expect(control('Profile identifier')).toBeTruthy(); expect(container.textContent).not.toContain('Classified story');
  await click([...cards.querySelectorAll('button')].find(item => item.textContent?.startsWith('Practice recommender'))!);
  expect(button('Add Tooling')).toBeTruthy(); expect([...container.querySelectorAll('button')].some(item => item.textContent === 'Add Characteristics')).toBe(false);
});

test('editing selected reference values invalidates the prepared file and requires another explicit review', async () => {
  await create(); await addData(); await change(control('Reference data source'), 'projects'); await click(button('Load registered projects'));
  await change(control('Reference project'), 'Alpha'); await click(button('Add reference project'));
  const checkbox = container.querySelector('[aria-label="Registered project dataset"] input[type="checkbox"]') as HTMLElement; await click(checkbox); await click(button('Use selected project records'));
  expect(button('Generate import preview').disabled).toBe(false);
  await change(control('Characteristics 1'), 'Desktop');
  expect(button('Generate import preview').disabled).toBe(true); expect((checkbox as HTMLInputElement).checked).toBe(false);
});

test('wizard keeps answers when going back and only shows the controls for the current step', async () => {
  await render(); expect(container.textContent).toContain('Step 1 of 5'); expect(container.querySelector('form select')).toBeNull();
  expect(container.textContent).not.toContain('Scope'); expect(container.textContent).not.toContain('Representation');
  await change(control('Recommender name'), 'Architecture recommender'); await click(button('Continue'));
  await change(control('Input name'), 'Technology'); await click(button('Continue'));
  await change(control('Recommendation name'), 'Architectures'); await click(button('Back'));
  expect(control('Input name').value).toBe('Technology'); await click(button('Continue'));
  expect(control('Recommendation name').value).toBe('Architectures'); expect(recommenderApi.saveDefinition).not.toHaveBeenCalled();
});

test('invalid matching settings stay in the current step with inline errors and recover without losing answers', async () => {
  await render(); await change(control('Recommender name'), 'My recommender'); await click(button('Continue'));
  await change(control('Input name'), 'Technology'); await click(button('Continue')); await change(control('Recommendation name'), 'Architectures'); await click(button('Continue'));
  await change(control('Number of neighbors (k)'), '0'); await click(button('Continue'));
  expect(control('Number of neighbors (k)').getAttribute('aria-invalid')).toBe('true'); expect(document.activeElement?.getAttribute('role')).toBe('alert');
  expect(container.textContent).toContain('Step 4 of 5'); expect(recommenderApi.saveDefinition).not.toHaveBeenCalled();
  await change(control('Number of neighbors (k)'), '2'); await click(button('Continue')); expect(container.textContent).toContain('Review your recommender'); expect(container.textContent).toContain('Technology');
});

test('retrying an uncertain publication reuses the saved draft and preserves the reviewed configuration', async () => {
  const publish = vi.mocked(recommenderApi.publishDefinition).getMockImplementation()!;
  let first = true;
  vi.mocked(recommenderApi.publishDefinition).mockImplementation(async (...args) => {
    const result = await publish(...args);
    if (first) { first = false; throw new Error('Connection interrupted'); }
    return result;
  });
  await create();
  expect(container.textContent).toContain('Connection interrupted'); expect(container.textContent).toContain('Architecture recommender');
  await click(button('Create recommender'));
  expect(recommenderApi.saveDefinition).toHaveBeenCalledTimes(1); expect(recommenderApi.publishDefinition).toHaveBeenCalledTimes(2);
  expect(container.textContent).toContain('Architecture recommender is created');
});
