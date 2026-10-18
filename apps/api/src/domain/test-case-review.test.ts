import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { snapshotContent } from './content-snapshot.js';
import { buildTestTarget, buildTestDecision, buildTestCopy, type TestReviewRun } from './test-case-review.js';
const evidence = JSON.parse(readFileSync(new URL('../../../../docs/evidencias/b16b/published-runs.json', import.meta.url), 'utf8'));
function fixture() {
  const run = structuredClone(evidence.content.runs[0]) as TestReviewRun, item = run.snapshot.content.result.content.items[0];
  const target = buildTestTarget(run, { runSha256: run.snapshot.sha256, target: { kind: 'input' } });
  const request = { id: randomUUID(), runSha256: run.snapshot.sha256, targetSha256: target.sha256, itemKey: item.key, decision: 'accepted', notes: 'Manual relevance judgment' };
  const decision = buildTestDecision(run, target, request);
  const copyRequest = { id: randomUUID(), runSha256: run.snapshot.sha256, targetSha256: target.sha256, decisionId: request.id,
    itemKey: item.key, previousCopy: null, title: item.artifact.title, gherkin: item.artifact.gherkin, reason: 'Copy for the preserved target' };
  return { run, item, target, request, decision, copyRequest };
}
test('test assessment requires the exact preserved input and item, without accepting operational classification IDs or edited source artifacts', () => {
  const { run, target, request } = fixture();
  assert.throws(() => buildTestTarget(run, { runSha256: run.snapshot.sha256, target: { kind: 'classification', classificationId: '1' } }));
  assert.throws(() => buildTestTarget(run, { runSha256: '0'.repeat(64), target: { kind: 'input' } }));
  assert.throws(() => buildTestDecision(run, target, { ...request, itemKey: '0'.repeat(64) }));
  assert.throws(() => buildTestDecision(run, target, { ...request, artifact: { title: 'replacement' } }));
  const forged = structuredClone(target.content); forged.input = snapshotContent({ ...forged.input.content, id: 'another-target' });
  assert.throws(() => buildTestDecision(run, snapshotContent(forged), request), /original run input/);
  const blocked = structuredClone(evidence.content.runs[3]) as TestReviewRun;
  assert.throws(() => buildTestTarget(blocked, { runSha256: blocked.snapshot.sha256, target: { kind: 'input' } }));
});
test('copy revisions preserve original metadata, title/Gherkin changes, reasons and parent hashes without mutating the run', () => {
  const { run, item, target, decision, copyRequest } = fixture(), before = snapshotContent({ run, target, decision }).sha256;
  const first = buildTestCopy(run, target, decision, null, copyRequest);
  assert.equal(first.content.revision, 1); assert.deepEqual(first.content.changes, []);
  const next = buildTestCopy(run, target, decision, first, { ...copyRequest, id: randomUUID(), previousCopy: { id: copyRequest.id, sha256: first.sha256 },
    title: 'Target-specific title', gherkin: item.artifact.gherkin + '\nE verifico o alvo sintético', reason: 'Adapted explicitly for the target' });
  assert.equal(next.content.revision, 2); assert.equal(next.content.previous?.sha256, first.sha256);
  assert.deepEqual(next.content.changes.map(row => row.field), ['title', 'gherkin']);
  assert.deepEqual(next.content.originalItem.content, item); assert.deepEqual(next.content.artifact.content.metadata, item.artifact.metadata);
  assert.equal(snapshotContent({ run, target, decision }).sha256, before); assert.ok(Object.isFrozen(next.content.artifact.content));
});
test('rejected, foreign or malformed copy requests cannot become adapted artifacts', () => {
  const { run, target, request, decision, copyRequest } = fixture();
  const rejected = buildTestDecision(run, target, { ...request, decision: 'rejected' });
  assert.throws(() => buildTestCopy(run, target, rejected, null, copyRequest), /accepted/);
  for (const change of [{ decisionId: randomUUID() }, { targetSha256: '0'.repeat(64) }, { title: ' ' }, { gherkin: '' }, { reason: 'x' }, { metadata: { arbitrary: true } }]) {
    assert.throws(() => buildTestCopy(run, target, decision, null, { ...copyRequest, ...change }));
  }
  const first = buildTestCopy(run, target, decision, null, copyRequest);
  assert.throws(() => buildTestCopy(run, target, decision, first, { ...copyRequest, previousCopy: { id: copyRequest.id, sha256: '0'.repeat(64) } }));
});
