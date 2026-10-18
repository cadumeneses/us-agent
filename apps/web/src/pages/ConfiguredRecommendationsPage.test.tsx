// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import template from '../../../../config/recommenders/rnf-v2.draft.json';
import baseline from '../../../../research/baselines/rnf-v2/reference.json';
import { snapshotContent } from '../../../api/src/domain/content-snapshot';
import { parseRecommenderDefinition } from '../../../api/src/domain/recommender-definition';
import { legacyNfrInput, RNF_ADAPTER_VERSION } from '../../../api/src/services/configured-nfr';
import { executePublishedRecommendation } from '../../../api/src/services/recommendation-execution';
import type { NfrProfile } from '../../../api/src/services/nfr-engine';
import { recommenderApi } from '../services/recommender-api';
import type { ConfiguredDefinition, ConfiguredInput, ConfiguredRun, DatasetSummary, DefinitionRecord, DefinitionSummary, JsonValue, RecommendationRequest, RunSummary } from '../types/configurable-recommendations';
import { ConfiguredRecommendationsPage } from './ConfiguredRecommendationsPage';
import { testCaseFixture } from '../test-fixtures/test-case';

vi.mock('../services/recommender-api', async importOriginal => ({ ...await importOriginal<typeof import('../services/recommender-api')>(), recommenderApi: { pageSize: 50, definitions: vi.fn(), definition: vi.fn(), datasets: vi.fn(), runs: vi.fn(), run: vi.fn(), publishedRun: vi.fn(), execute: vi.fn(), executeTestCases: vi.fn(), testCaseCatalogs: vi.fn(), replay: vi.fn(), review: vi.fn(), testReview: vi.fn() } }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Use the actual published executor to check the web/API boundary, rather than inventing a result shape.
function fixture(version = 'ui-test') {
  const draft = parseRecommenderDefinition({ ...structuredClone(template), version });
  const publication = { schemaVersion: 1 as const, definition: { ...draft, state: 'published' as const }, taxonomies: [],
    implementation: { methodId: draft.method.id, adapterVersion: RNF_ADAPTER_VERSION } };
  const snapshot = snapshotContent(publication);
  const reference = { id: draft.id, version, format: snapshot.format, sha256: snapshot.sha256 };
  const definition: DefinitionRecord = { state: 'published', definition: publication.definition, snapshot };
  const summary: DefinitionSummary = { id: draft.id, version, state: 'published', name: draft.name, method: draft.method.id, attributeCount: draft.attributes.length, snapshot: { format: snapshot.format, sha256: snapshot.sha256 } };
  const input = legacyNfrInput(draft, baseline.profiles.multi as NfrProfile, 'ui-target', "Manual input");
  const dataset = { schemaVersion: 1, importerVersion: 'structured-import-v1', id: 'ui-base', version: '1', definition: reference,
    source: { description: 'Demonstração sintética da interface', authorization: { basis: 'synthetic', reference: 'Não é a base dos autores' } },
    import: { id: crypto.randomUUID(), previewSha256: 'a'.repeat(64), fileSha256: 'b'.repeat(64) }, mapping: { recordId: ['id'], attributes: {} },
    selection: { excludedOrdinals: [], includedOrdinals: [1, 2] }, records: ['f4', 'login'].map(id => legacyNfrInput(draft, baseline.profiles[id as keyof typeof baseline.profiles] as NfrProfile, id, 'fixture')) };
  const base = snapshotContent(dataset);
  const datasetSummary: DatasetSummary = { id: dataset.id, version: dataset.version, state: 'published', definition: reference, recordCount: dataset.records.length,
    snapshot: { format: base.format, sha256: base.sha256 }, publishedBy: 'local-development', publishedAt: '2026-10-17T12:00:00.000Z' };
  const request: RecommendationRequest = { id: crypto.randomUUID(), definition: reference, dataset: { id: dataset.id, version: dataset.version, ...datasetSummary.snapshot }, input, selection: { labelIndex: 1 } };
  const run = (body = request): ConfiguredRun => ({ id: body.id, snapshot: snapshotContent(executePublishedRecommendation(body, publication, dataset)), durationMs: 12.5, createdBy: 'local-development', createdAt: '2026-10-17T12:01:00.000Z' });
  return { draft, definition, summary, input, dataset, datasetSummary, request, run };
}
let f: ReturnType<typeof fixture>;
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.resetAllMocks(); f = fixture();
  vi.mocked(recommenderApi.definitions).mockResolvedValue([f.summary]);
  vi.mocked(recommenderApi.datasets).mockResolvedValue([f.datasetSummary]);
  vi.mocked(recommenderApi.definition).mockResolvedValue(f.definition);
  vi.mocked(recommenderApi.runs).mockResolvedValue([]);
  vi.mocked(recommenderApi.execute).mockImplementation(async body => f.run(body));
  vi.mocked(recommenderApi.run).mockImplementation(async () => f.run());
  vi.mocked(recommenderApi.publishedRun).mockImplementation((id, signal) => recommenderApi.run(id, signal));
  vi.mocked(recommenderApi.testCaseCatalogs).mockResolvedValue([]);
  vi.mocked(recommenderApi.testReview).mockImplementation(async id => ({ runId: id, runSha256: (await recommenderApi.publishedRun(id)).snapshot.sha256, target: null }));
  vi.mocked(recommenderApi.review).mockImplementation(async id => ({ runId: id, runSha256: (await recommenderApi.run(id)).snapshot.sha256, target: null, decisions: [] }));
  vi.mocked(recommenderApi.replay).mockResolvedValue({ id: f.request.id, originalSha256: f.run().snapshot.sha256, verified: true, resultMatches: true, explanationMatches: true, projectionMatches: true });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
async function render(path = '/configured-recommendations') { await act(async () => root.render(<MemoryRouter initialEntries={[path]}><ConfiguredRecommendationsPage/></MemoryRouter>)); }
function button(text: string, scope: ParentNode = container) {
  const target = [...scope.querySelectorAll('button')].find(item => item.textContent === text);
  if (!target) throw new Error(`Botão ausente: ${text}`);
  return target;
}
function control(text: string, scope: ParentNode = container): HTMLInputElement | HTMLSelectElement {
  const label = [...scope.querySelectorAll('label')].find(item => item.firstChild?.textContent === text);
  const target = label?.querySelector('input,select');
  if (!target) throw new Error(`Campo ausente: ${text}`);
  return target as HTMLInputElement | HTMLSelectElement;
}
async function change(target: HTMLInputElement | HTMLSelectElement, value: string) {
  await act(async () => {
    const prototype = target instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(target, value);
    target.dispatchEvent(new Event(target instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
}
async function click(target: HTMLElement) { await act(async () => target.click()); }
async function chooseDefinition(summary = f.summary) { await change(control("Definition and version"), JSON.stringify([summary.id, summary.version])); }
test('unimplemented methods remain visible as API-only without entering a supported form', async () => {
  vi.mocked(recommenderApi.definitions).mockResolvedValue([f.summary, { ...f.summary, id: 'testrec', name: 'Unimplemented method', method: 'testrec_e21_data_contract_v1' }]);
  await render();
  const option = [...container.querySelectorAll('option')].find(item => item.textContent?.includes('Unimplemented method'))!;
  expect(option.disabled).toBe(true); expect(option.textContent).toContain('API only');
  expect(recommenderApi.definition).not.toHaveBeenCalled();
});

async function testReady() {
  const t = testCaseFixture();
  vi.mocked(recommenderApi.definitions).mockResolvedValue([f.summary, t.summary]);
  vi.mocked(recommenderApi.definition).mockResolvedValue(t.definition);
  vi.mocked(recommenderApi.datasets).mockResolvedValue([t.datasetSummary, { ...t.datasetSummary, id: 'wrong-hash', definition: { ...t.datasetSummary.definition, sha256: '0'.repeat(64) } }]);
  vi.mocked(recommenderApi.testCaseCatalogs).mockResolvedValue([t.catalogSummary, { ...t.catalogSummary, version: 'other', snapshot: { ...t.catalogSummary.snapshot, sha256: '0'.repeat(64) } }]);
  vi.mocked(recommenderApi.executeTestCases).mockImplementation(async body => t.run(body));
  vi.mocked(recommenderApi.publishedRun).mockImplementation(async () => t.run(vi.mocked(recommenderApi.executeTestCases).mock.calls.at(-1)![0]));
  await render(); await chooseDefinition(t.summary);
  await change(control('Dataset and version'), JSON.stringify([t.datasetSummary.id, t.datasetSummary.version]));
  expect(button('Run recommendation').disabled).toBe(true);
  await change(control('Catalog and version'), JSON.stringify([t.catalogSummary.id, t.catalogSummary.version]));
  await fillInput(t.request.input, t.draft);
  return t;
}
test('test-case execution pins the dataset catalog, withholds outputs and shows actual equations/artifacts without RNF review', async () => {
  const t = await testReady();
  expect(container.querySelector('[aria-label="Test-case execution"]')).not.toBeNull();
  expect([...container.querySelectorAll('option')].some(option => option.textContent?.includes('wrong-hash'))).toBe(false);
  expect([...container.querySelectorAll('option')].some(option => option.textContent?.includes(' · other'))).toBe(false);
  expect([...container.querySelectorAll('label')].some(label => label.textContent?.includes('pair for this run'))).toBe(false);
  expect(container.querySelector('[aria-label="Test-case execution"]')?.textContent).not.toContain('Enter Associated test IDs');
  await click(button('Run recommendation'));
  const body = vi.mocked(recommenderApi.executeTestCases).mock.calls[0][0];
  expect(body.catalog).toEqual(t.request.catalog); expect(body).not.toHaveProperty('selection');
  expect(body.input.values).not.toHaveProperty(t.draft.method.bindings.test_case_ids);
  expect(container.textContent).toContain('Test suggestions found');
  expect(container.textContent).toContain('0.9166666666666666');
  expect(container.textContent).toContain(t.original.snapshot.content.result.content.items[0].artifact.gherkin);
  expect(container.textContent).toContain('Q01/Q02 remain open');
  expect(recommenderApi.review).not.toHaveBeenCalled(); expect(recommenderApi.execute).not.toHaveBeenCalled();
});
test('test-case network retry preserves its UUID and changing the input uses another UUID', async () => {
  await testReady(); vi.mocked(recommenderApi.executeTestCases).mockRejectedValue(new Error('Network unavailable'));
  await click(button('Run recommendation')); await click(button('Run recommendation'));
  const calls = vi.mocked(recommenderApi.executeTestCases).mock.calls;
  expect(calls[1][0]).toEqual(calls[0][0]);
  await change(control('Input identifier'), 'new-target'); await click(button('Run recommendation'));
  expect(vi.mocked(recommenderApi.executeTestCases).mock.calls[2][0].id).not.toBe(calls[0][0].id);
});
test.each([0, 2, 3])('historical test run %s opens and replays without active dependencies', async index => {
  const published = await import('../../../../docs/evidencias/b16b/published-runs.json');
  const run = published.default.content.runs[index] as import('../types/test-case-recommendations').TestCaseRun;
  vi.mocked(recommenderApi.definitions).mockResolvedValue([]); vi.mocked(recommenderApi.datasets).mockResolvedValue([]);
  vi.mocked(recommenderApi.publishedRun).mockResolvedValue(run);
  await render(`/configured-recommendations?runId=${run.id}`); await click(button('Verify replay'));
  expect(container.textContent).toContain('Replay verified'); expect(container.textContent).toContain('Synthetic E21 equation demonstration');
  if (index === 2) expect(container.textContent).toContain('Selected neighbors have no associated tests');
  if (index === 3) expect(container.textContent).toContain('At least three eligible candidates are required');
  expect(recommenderApi.review).not.toHaveBeenCalled();
});
async function fillInput(input: ConfiguredInput = f.input, definition: ConfiguredDefinition = f.draft) {
  await change(control("Input identifier"), input.id);
  for (const attribute of definition.attributes) {
    const value = input.values[attribute.id];
    if (value === undefined) continue;
    const scalar = async (name: string, current: JsonValue, scope: ParentNode) => {
      if (typeof current === 'object' && current !== null && !Array.isArray(current)) {
        for (const [field, fieldValue] of Object.entries(current)) await change(control(field, scope), String(fieldValue));
      } else await change(control(name, scope), String(current));
    };
    const section = [...container.querySelectorAll('.configured-attribute')].find(item => item.querySelector('legend')?.textContent === attribute.name || item.querySelector('label')?.firstChild?.textContent === attribute.name);
    if (!section) throw new Error(`Atributo ausente: ${attribute.id}`);
    if (attribute.cardinality === 'many') {
      for (const [index, item] of (value as JsonValue[]).entries()) {
        await click(button(`Add ${attribute.name}`, section));
        const row = section.querySelectorAll('.configured-list-item')[index];
        await scalar(`${attribute.name} ${index + 1}`, item, row);
      }
    } else await scalar(attribute.name, value, section);
  }
  if (definition.method.bindings.labels) await change(control("Module/operation pair for this run"), '1');
}
async function ready() { await render(); await chooseDefinition(); await change(control("Dataset and version"), JSON.stringify([f.datasetSummary.id, f.datasetSummary.version])); await fillInput(); }

test('requires explicit versions and excludes bases with different definition versions or hashes', async () => {
  const otherVersion = { ...f.datasetSummary, id: 'other-version', definition: { ...f.datasetSummary.definition, version: 'other' } };
  const wrongHash = { ...f.datasetSummary, id: 'wrong-hash', definition: { ...f.datasetSummary.definition, sha256: '0'.repeat(64) } };
  vi.mocked(recommenderApi.datasets).mockResolvedValue([otherVersion, wrongHash, f.datasetSummary]);
  await render(); expect(container.querySelector('form')).toBeNull(); await chooseDefinition();
  const choices = control("Dataset and version") as HTMLSelectElement;
  expect([...choices.options].map(item => item.value)).toEqual(['', JSON.stringify(['ui-base', '1'])]);
  expect(button("Run recommendation").disabled).toBe(true);
  await change(choices, JSON.stringify(['ui-base', '1'])); expect(button("Run recommendation").disabled).toBe(false);
});

test('dynamic form preserves both labels and sends the selected pair with exact references to the real executor', async () => {
  await ready();
  let saved!: ConfiguredRun;
  vi.mocked(recommenderApi.execute).mockImplementation(async body => { saved = f.run(body); return saved; });
  vi.mocked(recommenderApi.run).mockImplementation(async () => saved);
  await click(button("Run recommendation"));
  const body = vi.mocked(recommenderApi.execute).mock.calls[0][0];
  expect(body.input).toEqual(f.input); expect(body.definition).toEqual(f.request.definition); expect(body.dataset).toEqual(f.request.dataset); expect(body.selection).toEqual({ labelIndex: 1 });
  expect(container.textContent).toContain('Authentication / Login');
  expect(container.textContent).toContain('Não é a base dos autores');
  expect(container.textContent).toContain(saved.snapshot.sha256);
  expect(saved.snapshot.content.result.content.neighbor?.classificationId).toBe(baseline.profiles.login.classificationId);
  expect(container.querySelector("[aria-label=\"Run result\"]")?.textContent).toContain("Suggestions found");
});

test('an uncertain network failure keeps the input and reuses the UUID on retry; changed input gets another UUID', async () => {
  await ready();
  vi.mocked(recommenderApi.execute).mockRejectedValue(new Error('Falha temporária'));
  await click(button("Run recommendation")); await click(button("Run recommendation"));
  const calls = vi.mocked(recommenderApi.execute).mock.calls;
  expect(calls[0][0]).toEqual(calls[1][0]);
  expect(control("Input identifier").value).toBe(f.input.id);
  expect(container.textContent).toContain("Your input was preserved for another attempt.");
  await change(control('Texto da história'), 'Nova entrada após a falha'); await click(button("Run recommendation"));
  expect(calls[2][0].id).not.toBe(calls[0][0].id);
});

test('double submission is locked while awaiting the run and navigation cannot discard the input', async () => {
  await ready(); let resolve!: (run: ConfiguredRun) => void;
  vi.mocked(recommenderApi.execute).mockReturnValue(new Promise(value => { resolve = value; }));
  await click(button("Run recommendation"));
  expect(button('Executando…').disabled).toBe(true); expect(button("Run history").disabled).toBe(true);
  expect(control("Definition and version").disabled).toBe(true);
  expect(recommenderApi.execute).toHaveBeenCalledTimes(1);
  vi.mocked(recommenderApi.run).mockResolvedValue(f.run());
  await act(async () => resolve(f.run()));
  expect(button("Run history").disabled).toBe(false);
});

test('late definition responses cannot replace a more recently selected publication', async () => {
  const second = fixture('second');
  vi.mocked(recommenderApi.definitions).mockResolvedValue([f.summary, second.summary]);
  let resolve!: (record: DefinitionRecord) => void;
  vi.mocked(recommenderApi.definition).mockImplementation((_id, version) => version === 'second' ? Promise.resolve(second.definition) : new Promise(value => { resolve = value; }));
  await render(); await chooseDefinition(); await chooseDefinition(second.summary);
  expect(container.textContent).toContain(second.summary.snapshot!.sha256);
  await act(async () => resolve(f.definition));
  expect(container.querySelector('.configured-reference')?.textContent).toContain('second');
  expect(container.querySelector('.configured-reference')?.textContent).not.toContain(f.summary.snapshot!.sha256);
});

test('client validation blocks missing identifiers and pair selection without discarding values', async () => {
  await render(); await chooseDefinition(); await change(control("Dataset and version"), JSON.stringify(['ui-base', '1']));
  await click(button("Run recommendation"));
  expect(recommenderApi.execute).not.toHaveBeenCalled();
  expect(container.textContent).toContain("Enter the input identifier.");
  expect(container.textContent).toContain("Choose the module/operation pair for this run.");
});

test('replay divergence preserves the original result and shows the individual comparisons', async () => {
  vi.mocked(recommenderApi.replay).mockResolvedValue({ id: f.request.id, originalSha256: f.run().snapshot.sha256, verified: false, resultMatches: true, explanationMatches: false, projectionMatches: true });
  await render(`/configured-recommendations?runId=${f.request.id}`);
  const original = container.querySelector('.nfr-item')?.textContent;
  await click(button("Verify replay"));
  expect(container.textContent).toContain("Replay differs: the original evidence was preserved."); expect(container.textContent).toContain('Explanation: differs');
  expect(container.querySelector('.nfr-item')?.textContent).toBe(original);
});

test('a historical run opens directly even if there are no active definitions or bases', async () => {
  vi.mocked(recommenderApi.definitions).mockResolvedValue([]); vi.mocked(recommenderApi.datasets).mockResolvedValue([]);
  await render(`/configured-recommendations?runId=${f.request.id}`); await click(button("Verify replay"));
  expect(container.textContent).toContain("Replay verified: result, explanation, and projection match the preserved run."); expect(recommenderApi.run).toHaveBeenCalledWith(f.request.id, expect.any(AbortSignal));
  expect(container.querySelectorAll('.nfr-item').length).toBeGreaterThan(0);
});

test.each(['blocked', 'no_candidates', 'no_items'] as const)('historical %s state remains distinct from a completed recommendation', async status => {
  const request = structuredClone(f.request), dataset = structuredClone(f.dataset);
  if (status === 'blocked') request.input.values.platforms = [];
  if (status === 'no_candidates') dataset.records = [dataset.records[0]];
  if (status === 'no_items') dataset.records.forEach(record => { record.values.nfrs = []; });
  request.dataset.sha256 = snapshotContent(dataset).sha256;
  const run = { ...f.run(), snapshot: snapshotContent(executePublishedRecommendation(request, f.definition.snapshot!.content, dataset)) };
  expect(run.snapshot.content.result.content.status).toBe(status);
  vi.mocked(recommenderApi.run).mockResolvedValue(run);
  await render(`/configured-recommendations?runId=${run.id}`);
  const english = { blocked: 'Enter the project platform.', no_candidates: 'No compatible historical story was found.', no_items: 'The nearest neighbor has no eligible NFRs.' };
  expect(container.textContent).toContain(english[status]); expect(container.querySelector('.nfr-item')).toBeNull();
  expect(container.querySelector("[aria-label=\"Run result\"] h3")?.textContent).not.toBe("Suggestions found");
});

test('history pagination and retry retain the first page, and refreshing history preserves the form draft', async () => {
  const run = f.run();
  const row: RunSummary = { id: run.id, definition: f.request.definition, dataset: f.request.dataset, status: 'completed', durationMs: 12, snapshot: run.snapshot, createdAt: run.createdAt, createdBy: run.createdBy };
  vi.mocked(recommenderApi.runs).mockImplementation(async offset => {
    if (offset === 50) throw new Error('Falha na segunda página');
    return Array.from({ length: 50 }, (_, index) => ({ ...row, id: `${run.id}-${index}` }));
  });
  await ready(); await click(button("Run history")); await click(button('Load more runs'));
  expect(container.textContent).toContain('Falha na segunda página'); expect(container.querySelectorAll('tbody tr')).toHaveLength(50);
  vi.mocked(recommenderApi.runs).mockImplementation(async offset => offset === 50 ? [{ ...row, id: 'last-page' }] : [row]);
  await click(button('Retry loading runs')); expect(container.querySelectorAll('tbody tr')).toHaveLength(51);
  await click(button("Refresh history")); expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
  await click(button("New run")); expect(control("Input identifier").value).toBe(f.input.id);
});

test('catalog failures are recoverable and never enable execution without a published base', async () => {
  vi.mocked(recommenderApi.datasets).mockRejectedValueOnce(new Error('Sem acesso às bases'));
  await render(); await chooseDefinition(); expect(button("Run recommendation").disabled).toBe(true);
  expect(container.textContent).toContain('Sem acesso às bases');
  await click(button('Retry loading datasets')); await change(control("Dataset and version"), JSON.stringify(['ui-base', '1']));
  expect(button("Run recommendation").disabled).toBe(false);
});

test('loading additional bases never submits the recommendation form', async () => {
  const first = [f.datasetSummary, ...Array.from({ length: 49 }, (_, index) => ({ ...f.datasetSummary, id: `other-${index}` }))];
  vi.mocked(recommenderApi.datasets).mockImplementation(async offset => offset === 0 ? first : []);
  await ready(); await click(button('Load more datasets'));
  expect(recommenderApi.execute).not.toHaveBeenCalled();
  expect(control("Input identifier").value).toBe(f.input.id);
});
