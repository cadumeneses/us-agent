// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { api } from '../services/api';
import type { ReviewContext, Story, Taxonomy } from '../types/models';
import { ReviewPage } from './ReviewPage';

vi.mock('../services/api', () => ({ api: { stories: vi.fn(), taxonomy: vi.fn(), reviewContext: vi.fn(), review: vi.fn() } }));
vi.mock('../services/workspace', () => ({ useWorkspace: () => ({ refreshStories: async () => undefined }) }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const labels = [{ module: 'Authentication', operation: 'Login' }, { module: 'Registry', operation: 'Retrieve data' }];
const story: Story = { id: '1', text: 'Entrar e consultar dados', project: 'P', sprint: 'S', labels,
  module: labels[0].module, operation: labels[0].operation, confidence: 0.9, consensus: 1, uncertainty: 0.175,
  metricsSource: 'committee', status: 'pending_review', taxonomyVersion: 'test' };
const taxonomy: Taxonomy = { version: 'test', modules: { Authentication: ['Login'], Registry: ['Retrieve data'] },
  domains: { General: { description: '', modules: { Authentication: ['Login'], Registry: ['Retrieve data'] } } },
  moduleDomains: { Authentication: 'General', Registry: 'General' }, descriptions: {}, taxonomies: [] };
const context: ReviewContext = { labels, final: { reason: 'Revisão solicitada' }, suggestions: [], taxonomyFeedbacks: [], reviews: [],
  provenance: { engine: 'web_committee_v2', policyVersion: 'web_committee_multilabel_v1', promptVersion: 'prompt-v2',
    taxonomy: { version: 'test', sha256: 'example-hash' }, execution: { arbitration: false, reruns: 0 },
    decision: { labels, confidence: 0.9, needsReview: true, consensusRatio: 1, uncertainty: { score: 0.175, band: 'low' },
      reviewReasons: ['provider_requested_review'], reason: 'Revisão solicitada', providerHealth: { total: 2, successful: 2, failed: 0 } } },
  votes: [{ provider: 'p1', requestedModel: 'model-alias', model: 'resolved-model', status: 'success', confidence: 0.9,
    needsReview: true, rows: labels, evidence: ['Trecho da história'], issues: [], suggestedQuestions: [] }] };
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.stories).mockResolvedValue([structuredClone(story)]);
  vi.mocked(api.taxonomy).mockResolvedValue(structuredClone(taxonomy));
  vi.mocked(api.reviewContext).mockResolvedValue(structuredClone(context));
  vi.mocked(api.review).mockResolvedValue({ id: '1', status: 'reviewed' });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
async function render() { await act(async () => root.render(<MemoryRouter><ReviewPage/></MemoryRouter>)); }
function button(text: string) {
  const result = [...container.querySelectorAll('button')].find(item => item.textContent === text);
  if (!result) throw new Error(`Botão ausente: ${text}`);
  return result;
}
async function click(target: HTMLElement) { await act(async () => target.click()); }

test('confirmation sends the complete list and presents actual model/evidence information', async () => {
  await render();
  expect(container.textContent).toContain('Pairs to confirm (2/8)');
  expect(container.textContent).toContain('resolved-model');
  expect(container.textContent).toContain('Trecho da história');
  await click(button("Confirm classification"));
  expect(api.review).toHaveBeenCalledWith('1', { action: 'approve', labels, notes: undefined });
});

test('removing a pair is explicit and the other pair survives confirmation', async () => {
  await render();
  await click(container.querySelector("[aria-label=\"Remove Authentication / Login\"]") as HTMLElement);
  await click(button("Confirm classification"));
  expect(api.review).toHaveBeenCalledWith('1', { action: 'approve', labels: [labels[1]], notes: undefined });
});

test('empty confirmation is blocked and a complete provider set can be restored', async () => {
  await render();
  for (const item of [...container.querySelectorAll("[aria-label^=\"Remove \"]")]) await click(item as HTMLElement);
  expect(button("Confirm classification").disabled).toBe(true);
  await click(button('Use set from p1'));
  expect(button("Confirm classification").disabled).toBe(false);
  await click(button("Confirm classification"));
  expect(api.review).toHaveBeenCalledWith('1', { action: 'approve', labels, notes: undefined });
});

test('a manual addition preserves the remaining pair and does not duplicate it', async () => {
  await render();
  await click(container.querySelector("[aria-label=\"Remove Authentication / Login\"]") as HTMLElement);
  await click(button("Add pair"));
  expect(button("Add pair").disabled).toBe(true);
  await click(button("Confirm classification"));
  expect(api.review).toHaveBeenCalledWith('1', { action: 'approve', labels: [labels[1], labels[0]], notes: undefined });
});

test('a failed review keeps edited labels available for retry', async () => {
  vi.mocked(api.review).mockRejectedValue(new Error('Falha temporária'));
  await render(); await click(button("Confirm classification"));
  expect(container.textContent).toContain('Falha temporária');
  expect(container.textContent).toContain('Pairs to confirm (2/8)');
  expect(button("Confirm classification").disabled).toBe(false);
});

test('local rules never present storage placeholders as committee metrics', async () => {
  vi.mocked(api.stories).mockResolvedValue([{ ...story, metricsSource: 'rules' }]);
  await render();
  expect(container.querySelector('.score-row')?.textContent?.match(/Not applicable/g)).toHaveLength(2);
});

test('confirmation waits until the selected execution context has loaded', async () => {
  let resolve!: (value: ReviewContext) => void;
  vi.mocked(api.reviewContext).mockReturnValue(new Promise(value => { resolve = value; }));
  await render();
  expect(button("Confirm classification").disabled).toBe(true);
  await act(async () => resolve(structuredClone(context)));
  expect(button("Confirm classification").disabled).toBe(false);
});
