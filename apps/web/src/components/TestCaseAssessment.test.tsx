// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, test, vi } from 'vitest';
import { TestCaseAssessment } from './TestCaseAssessment';
import { testCaseFixture } from '../test-fixtures/test-case';
import { recommenderApi } from '../services/recommender-api';
import { buildTestTarget, buildTestDecision, buildTestCopy, type TestReviewRun } from '../../../api/src/domain/test-case-review';
import type { TestTargetRecord, TestDecisionRecord, TestCopyRecord } from '../types/test-case-assessments';
vi.mock('../services/recommender-api', () => ({ recommenderApi: { testReview: vi.fn(), testItemReview: vi.fn(), confirmTestTarget: vi.fn(), decideTest: vi.fn(), saveTestCopy: vi.fn() } }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root, container: HTMLDivElement, t: ReturnType<typeof testCaseFixture>, target: TestTargetRecord | null;
let decisions: Map<string, TestDecisionRecord>, copies: TestCopyRecord[];
const meta = { createdBy: 'local-development', createdAt: '2026-10-18T12:00:00.000Z' };
beforeEach(() => {
  vi.resetAllMocks(); t = testCaseFixture(); target = null; decisions = new Map(); copies = [];
  const run = t.original as unknown as TestReviewRun;
  vi.mocked(recommenderApi.testReview).mockImplementation(async id => ({ runId: id, runSha256: t.original.snapshot.sha256, target }));
  vi.mocked(recommenderApi.confirmTestTarget).mockImplementation(async (_id, sha) => { target = { ...meta, snapshot: buildTestTarget(run, { runSha256: sha, target: { kind: 'input' } }) }; return target; });
  vi.mocked(recommenderApi.testItemReview).mockImplementation(async (id, key, offset = 0) => ({ runId: id, runSha256: t.original.snapshot.sha256, itemKey: key,
    decision: decisions.get(key) ?? null, copies: copies.filter(copy => copy.snapshot.content.request.content.itemKey === key).reverse().slice(offset, offset + 5),
    page: { limit: 5, offset, total: copies.filter(copy => copy.snapshot.content.request.content.itemKey === key).length } }));
  vi.mocked(recommenderApi.decideTest).mockImplementation(async (_id, request) => { const value = { id: request.id, ...meta, snapshot: buildTestDecision(run, target!.snapshot, request) }; decisions.set(request.itemKey, value); return value; });
  vi.mocked(recommenderApi.saveTestCopy).mockImplementation(async (_id, request) => { const value = { id: request.id, ...meta,
    snapshot: buildTestCopy(run, target!.snapshot, decisions.get(request.itemKey)!.snapshot, copies.find(copy => copy.id === request.previousCopy?.id)?.snapshot ?? null, request) }; copies.push(value); return value; });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
async function render() { await act(async () => root.render(<TestCaseAssessment run={t.original} items={t.original.snapshot.content.result.content.items}/>)); }
const scope = (index = 0) => container.querySelectorAll('section[aria-label^="Assess test "]')[index] as HTMLElement;
function button(name: string, parent: ParentNode = container) { const value = [...parent.querySelectorAll('button')].find(row => row.textContent === name); if (!value) throw new Error(`Missing button: ${name}`); return value; }
async function click(name: string, parent: ParentNode = container) { await act(async () => button(name, parent).click()); }
async function edit(name: string, value: string, parent = scope()) { await act(async () => {
  const input = [...parent.querySelectorAll('label')].find(row => row.firstChild?.textContent === name)!.querySelector('input,textarea') as HTMLInputElement | HTMLTextAreaElement;
  const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true }));
}); }
async function confirmed() { await render(); await click('Confirm preserved input as test destination'); }
test('confirming input enables immutable accept/reject and two adapted revisions while preserving the original evidence', async () => {
  const original = JSON.stringify(t.original); await confirmed();
  await edit('Assessment notes', 'Useful for this target'); await click('Accept test', scope()); await click('Reject test', scope(1));
  expect(scope(1).textContent).toContain('Rejected. No adapted copy'); expect(scope(1).textContent).not.toContain('Copy or adapt accepted test');
  await click('Copy or adapt accepted test', scope()); await edit('Copy title', 'Adapted title'); await edit('Copy reason', 'Explicit target adaptation'); await click('Save immutable copy revision', scope());
  expect(scope().textContent).toContain('Copy revision 1');
  await click('New copy revision', scope()); await edit('Copy Gherkin', 'Given a synthetic target\nWhen I inspect it\nThen I see its result'); await edit('Copy reason', 'Second explicit revision'); await click('Save immutable copy revision', scope());
  expect(copies).toHaveLength(2); expect(copies[1].snapshot.content.previous?.sha256).toBe(copies[0].snapshot.sha256);
  expect(copies[1].snapshot.content.originalItem.content.artifact).toEqual(t.original.snapshot.content.result.content.items[0].artifact);
  expect(JSON.stringify(t.original)).toBe(original); expect(scope().textContent).toContain('Copy revision 2');
});
test('failed decisions and stale copy submissions preserve UUIDs and draft edits for retry', async () => {
  await confirmed(); vi.mocked(recommenderApi.decideTest).mockRejectedValueOnce(new Error('Network failure'));
  await click('Accept test', scope()); await click('Accept test', scope());
  expect(vi.mocked(recommenderApi.decideTest).mock.calls[1][1]).toEqual(vi.mocked(recommenderApi.decideTest).mock.calls[0][1]);
  await click('Copy or adapt accepted test', scope()); await edit('Copy title', 'Preserved draft'); await edit('Copy reason', 'Reason kept after conflict');
  vi.mocked(recommenderApi.saveTestCopy).mockRejectedValue(new Error('The latest copy changed. Reload its history.'));
  await click('Save immutable copy revision', scope()); await click('Save immutable copy revision', scope());
  const calls = vi.mocked(recommenderApi.saveTestCopy).mock.calls; expect(calls[1][1]).toEqual(calls[0][1]);
  expect(scope().querySelector('input')?.value).toBe('Preserved draft');
  await edit('Copy reason', 'Changed reason for another request'); await click('Save immutable copy revision', scope());
  expect(vi.mocked(recommenderApi.saveTestCopy).mock.calls[2][1].id).not.toBe(calls[0][1].id); expect(copies).toHaveLength(0);
});
test('a review for another preserved hash is rejected and cannot enable mutation', async () => {
  vi.mocked(recommenderApi.testReview).mockResolvedValue({ runId: t.original.id, runSha256: '0'.repeat(64), target: null });
  await render(); expect(container.textContent).toContain('Assessment does not match');
  expect(recommenderApi.confirmTestTarget).not.toHaveBeenCalled(); expect(container.textContent).not.toContain('Confirm preserved input as test destination');
});
