// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import template from '../../../../config/recommenders/rnf-v2.draft.json';
import baseline from '../../../../research/baselines/rnf-v2/reference.json';
import { snapshotContent } from '../../../api/src/domain/content-snapshot';
import { associationIdentity, bindRecommendationTargetSchema, inputAssociationScope, recommendationDecisionSchema } from '../../../api/src/domain/recommendation-review';
import { parseRecommenderDefinition } from '../../../api/src/domain/recommender-definition';
import { legacyNfrInput, RNF_ADAPTER_VERSION } from '../../../api/src/services/configured-nfr';
import { executePublishedRecommendation } from '../../../api/src/services/recommendation-execution';
import type { NfrProfile } from '../../../api/src/services/nfr-engine';
import { recommenderApi } from '../services/recommender-api';
import { api } from '../services/api';
import type { ClassificationDestination, ConfiguredRun, ItemDecision, RecommendationReview } from '../types/configurable-recommendations';
import { ConfiguredRunReview } from './ConfiguredRunReview';

vi.mock('../services/recommender-api', () => ({ recommenderApi: { review: vi.fn(), destination: vi.fn(), bindTarget: vi.fn(), decideItem: vi.fn(), saveNfrCopy: vi.fn() } }));
vi.mock('../services/api', () => ({ api: { stories: vi.fn() } }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
function fixture(): ConfiguredRun {
  const draft = parseRecommenderDefinition(template);
  const publication = { schemaVersion: 1, definition: { ...draft, state: 'published' }, taxonomies: [], implementation: { methodId: draft.method.id, adapterVersion: RNF_ADAPTER_VERSION } };
  const hash = snapshotContent(publication), ref = { id: draft.id, version: draft.version, format: hash.format, sha256: hash.sha256 };
  const profiles = baseline.profiles as Record<string, NfrProfile>;
  const history = legacyNfrInput(draft, profiles.f4, 'f4', 'synthetic');
  (history.values.nfrs as object[]).push({ type: 'Security', attribute: 'access_control', sentence: 'Second synthetic suggestion.' });
  const dataset = { schemaVersion: 1, importerVersion: 'structured-import-v1', id: 'review-ui', version: '1', definition: ref,
    source: { description: 'Synthetic UI fixture', authorization: { basis: 'synthetic', reference: 'Not an original dataset' } },
    import: { id: crypto.randomUUID(), previewSha256: '0'.repeat(64), fileSha256: '0'.repeat(64) }, mapping: { recordId: ['id'], attributes: {} }, selection: { includedOrdinals: [1], excludedOrdinals: [] }, records: [history] };
  const datasetHash = snapshotContent(dataset), id = crypto.randomUUID();
  const request = { id, definition: ref, dataset: { id: dataset.id, version: dataset.version, format: datasetHash.format, sha256: datasetHash.sha256 },
    input: legacyNfrInput(draft, profiles.fa, '1', 'external source'), selection: { labelIndex: 0 } };
  return { id, snapshot: snapshotContent(executePublishedRecommendation(request, publication, dataset)), createdBy: 'local-development', createdAt: '2026-10-17T12:00:00.000Z', durationMs: 10 };
}
const destination: ClassificationDestination = { classificationId: '27', storyId: '12', projectId: '4', project: 'Selected project', text: 'Explicitly chosen operational story',
  reviewStatus: 'reviewed', taxonomyVersion: 'wis-v1', latest: true, labels: [{ module: 'Registry', operation: 'Retrieve data' }], projectProfile: null, tasks: [] };
let run: ConfiguredRun, review: RecommendationReview, root: Root, container: HTMLDivElement;
beforeEach(() => {
  vi.resetAllMocks(); run = fixture(); review = { runId: run.id, runSha256: run.snapshot.sha256, target: null, decisions: [] };
  vi.mocked(recommenderApi.review).mockImplementation(async () => structuredClone(review));
  vi.mocked(recommenderApi.saveNfrCopy).mockImplementation(async (_id,input) => {
    const original=run.snapshot.content.result.content.items.find(item=>item.key===input.itemKey)!;
    const copy={id:input.id,createdBy:'reviewer',createdAt:run.createdAt,snapshot:snapshotContent({schemaVersion:1 as const,
      request:snapshotContent(input),revision:1,previous:null,artifact:{type:original.type,attribute:original.attribute,sentence:input.sentence},originalItem:snapshotContent(original)})};
    review.copies=[copy];return copy;
  });
  vi.mocked(api.stories).mockResolvedValue([{ id: '27', project: destination.project, text: destination.text, sprint: 'Backlog', labels: destination.labels, module: 'Registry', operation: 'Retrieve data', status: 'reviewed', taxonomyVersion: 'wis-v1', metricsSource: 'rules', confidence: 1, uncertainty: 0, consensus: 1 }]);
  vi.mocked(recommenderApi.destination).mockResolvedValue(snapshotContent(destination));
  vi.mocked(recommenderApi.bindTarget).mockImplementation(async (_id, raw) => {
    const request = bindRecommendationTargetSchema.parse(raw);
    review.target = { snapshot: snapshotContent({ schemaVersion: 1, run: { id: run.id, format: run.snapshot.format, sha256: run.snapshot.sha256 }, request, input: snapshotContent(run.snapshot.content.request.content.input),
      destination: request.target.kind === 'input' ? { kind: 'input', scopeSha256: inputAssociationScope(run.snapshot.content) } : { kind: 'classification', snapshot: snapshotContent(destination), justification: request.target.justification } }), createdBy: 'local-development', createdAt: run.createdAt };
    return review.target;
  });
  vi.mocked(recommenderApi.decideItem).mockImplementation(async (_id, raw) => {
    const request = recommendationDecisionSchema.parse(raw), target = review.target!;
    expect(request.targetSha256).toBe(target.snapshot.sha256);
    const dest = target.snapshot.content.destination;
    const identity = associationIdentity(dest.kind === 'input' ? dest : { kind: 'classification', classificationId: dest.snapshot.content.classificationId }, run.snapshot.content.result.content.method, request.itemKey);
    const decision: ItemDecision = { id: request.id, snapshot: snapshotContent({ schemaVersion: 1, run: target.snapshot.content.run, target: { format: target.snapshot.format, sha256: target.snapshot.sha256 }, request: snapshotContent(request),
      originalItem: run.snapshot.content.result.content.items.find(item => item.key === request.itemKey)!, association: request.decision === 'rejected' ? null : { identitySha256: identity.sha256, materialization: dest.kind === 'input' ? 'input_only' : 'created' } }), createdBy: 'local-development', createdAt: run.createdAt };
    review.decisions.push(decision); return decision;
  });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
async function render() { await act(async () => root.render(<ConfiguredRunReview run={run}/>)); }
const button = (text: string, scope: ParentNode = container) => { const target = [...scope.querySelectorAll('button')].find(item => item.textContent === text); if (!target) throw new Error(text); return target; };
const control = (name: string, scope: ParentNode = container) => { const label = [...scope.querySelectorAll('label')].find(item => item.firstChild?.textContent === name); if (!label) throw new Error(name); return label.querySelector('input,select,textarea') as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement; };
async function change(target: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string) { await act(async () => { const prototype = target instanceof HTMLSelectElement ? HTMLSelectElement.prototype : target instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(target, value); target.dispatchEvent(new Event(target instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true })); }); }
async function click(target: HTMLElement) { await act(async () => target.click()); }

test('acceptance/rejection require destination confirmation and preserve raw items and the execution hash', async () => {
  const before = JSON.stringify(run); await render(); expect(button("Accept and link").matches(':disabled')).toBe(true);
  await click(button("Confirm reviewed destination")); expect(recommenderApi.bindTarget).toHaveBeenCalledWith(run.id, { runSha256: run.snapshot.sha256, target: { kind: 'input' } });
  expect(recommenderApi.destination).not.toHaveBeenCalled(); expect(api.stories).not.toHaveBeenCalled();
  const cards = container.querySelectorAll('.nfr-item'); await change(control("Suggestion notes", cards[0]), 'Pertinente para a entrada.');
  await click(button("Accept and link", cards[0])); await click(button("Reject", cards[1]));
  expect(container.textContent).toContain("Accepted and linked to the preserved input."); expect(container.textContent).toContain("Rejected. This decision created no link.");
  expect(review.decisions[0].snapshot.content.request.content.notes).toBe('Pertinente para a entrada.'); expect(review.decisions[1].snapshot.content.association).toBeNull();
  await change(control('Adapted sentence',cards[0]),'Adapted to the destination.');
  await change(control('Reason for adaptation',cards[0]),'Context checked explicitly.');
  await click(button('Save NFR adaptation',cards[0]));
  expect(recommenderApi.saveNfrCopy).toHaveBeenCalledWith(run.id,expect.objectContaining({decisionId:review.decisions[0].id,
    targetSha256:review.target!.snapshot.sha256,previousCopy:null,sentence:'Adapted to the destination.'}));
  expect(cards[0].textContent).toContain('Revision 1');expect(cards[0].textContent).toContain('Adapted to the destination.');
  expect(review.copies?.[0].snapshot.content.originalItem.content.sentence).toBe(run.snapshot.content.result.content.items[0].sentence);
  expect(JSON.stringify(run)).toBe(before);
});

test('operational story selection is explicit, reviewed and justified before any association is requested', async () => {
  await render(); await change(control("Link suggestions to"), 'classification'); expect(control("Destination story").value).toBe('');
  expect(recommenderApi.destination).not.toHaveBeenCalled(); await change(control("Destination story"), '27'); await click(button("Review destination story"));
  expect(recommenderApi.destination).toHaveBeenCalledWith(run.id, '27'); expect(button("Confirm reviewed destination").disabled).toBe(true);
  await change(control("Reason for linking to this story"), 'Correspondência conferida manualmente.'); await click(button("Confirm reviewed destination"));
  expect(recommenderApi.bindTarget).toHaveBeenCalledWith(run.id, { runSha256: run.snapshot.sha256, target: { kind: 'classification', classificationId: '27', expectedSha256: snapshotContent(destination).sha256, justification: 'Correspondência conferida manualmente.' } });
  expect(container.textContent).toContain('Explicitly chosen operational story'); await click(button("Accept and link"));
  expect(review.decisions[0].snapshot.content.association?.materialization).toBe('created');
});

test('network failure keeps the observation and retries the same decision UUID without showing premature success', async () => {
  await render(); await click(button("Confirm reviewed destination")); vi.mocked(recommenderApi.decideItem).mockRejectedValue(new Error('Falha temporária'));
  const card = container.querySelector('.nfr-item')!; await change(control("Suggestion notes", card), 'Observação preservada');
  await click(button("Accept and link", card)); await click(button("Accept and link", card));
  const calls = vi.mocked(recommenderApi.decideItem).mock.calls; expect(calls[0][1]).toEqual(calls[1][1]);
  expect(control("Suggestion notes", card).value).toBe('Observação preservada'); expect(card.textContent).not.toContain("Accepted and linked to the preserved input.");
  await change(control("Suggestion notes", card), 'Observação alterada'); await click(button("Accept and link", card)); expect(calls[2][1].id).not.toBe(calls[0][1].id);
});

test('a review load error keeps the original suggestions visible and blocks decisions until retry succeeds', async () => {
  vi.mocked(recommenderApi.review).mockRejectedValueOnce(new Error('Avaliações indisponíveis')); await render();
  expect(container.querySelectorAll('.nfr-item')).toHaveLength(2); expect(button("Accept and link").matches(':disabled')).toBe(true);
  await click(button("Refresh assessments")); expect(button("Confirm reviewed destination")).toBeTruthy();
});

test('an acceptance conflict is displayed without recording premature success', async () => {
  await render(); await click(button("Confirm reviewed destination"));
  vi.mocked(recommenderApi.decideItem).mockRejectedValue(new Error('O destino mudou após a confirmação.'));
  await click(button("Accept and link")); expect(container.textContent).toContain('O destino mudou'); expect(review.decisions).toHaveLength(0);
});

test('a pending decision suppresses double submission and disables remaining actions', async () => {
  await render(); await click(button("Confirm reviewed destination")); let resolve!: (decision: ItemDecision) => void;
  vi.mocked(recommenderApi.decideItem).mockReturnValue(new Promise(value => { resolve = value; }));
  await click(button("Accept and link")); await click(button("Accept and link")); expect(recommenderApi.decideItem).toHaveBeenCalledTimes(1);
  expect(button("Refresh assessments").disabled).toBe(true); expect(button("Reject").matches(':disabled')).toBe(true);
  const request = vi.mocked(recommenderApi.decideItem).mock.calls[0][1];
  await act(async () => resolve({ id: request.id, snapshot: snapshotContent({ schemaVersion: 1, run: review.target!.snapshot.content.run, target: { format: 'us-agent-json-v1', sha256: review.target!.snapshot.sha256 }, request: snapshotContent(request), originalItem: run.snapshot.content.result.content.items[0], association: { identitySha256: '0'.repeat(64), materialization: 'input_only' } }), createdBy: 'local-development', createdAt: run.createdAt }));
});
