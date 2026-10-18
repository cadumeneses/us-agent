import { z } from 'zod';
import { canonicalJson, snapshotContent, type ContentSnapshot } from './content-snapshot.js';
import { inputAssociationScope } from './recommendation-review.js';
import type { TestCaseRecommendationContent } from '../services/method-execution.js';

const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const text = (max: number) => z.string().min(1).max(max).refine(value => value.trim().length > 0, 'Enter nonempty text.');
export const testTargetRequestSchema = z.strictObject({ runSha256: sha256, target: z.strictObject({ kind: z.literal('input') }) });
export const testDecisionRequestSchema = z.strictObject({ id: z.uuid(), runSha256: sha256, targetSha256: sha256,
  itemKey: sha256, decision: z.enum(['accepted', 'rejected']), notes: z.string().max(2000) });
export const testCopyRequestSchema = z.strictObject({ id: z.uuid(), runSha256: sha256, targetSha256: sha256, decisionId: z.uuid(), itemKey: sha256,
  previousCopy: z.strictObject({ id: z.uuid(), sha256 }).nullable(), title: text(1000), gherkin: text(20000),
  reason: z.string().max(2000).refine(value => value.trim().length >= 5, 'Explain the copy or adaptation in at least five characters.') });
export type TestReviewRun = { id: string; snapshot: ContentSnapshot<TestCaseRecommendationContent> };
const runRef = (run: TestReviewRun) => ({ id: run.id, format: run.snapshot.format, sha256: run.snapshot.sha256 });
function intact(snapshot: ContentSnapshot<unknown>) {
  if (snapshot.format !== 'us-agent-json-v1' || snapshotContent(snapshot.content).sha256 !== snapshot.sha256) throw new Error('Assessment snapshot integrity failed.');
}
export function testCaseItem(run: TestReviewRun, itemKey: string) {
  const content = run.snapshot.content;
  if (content.schemaVersion !== 2 || content.result.content.status !== 'completed') throw new Error('This run has no test suggestions to assess.');
  const item = content.result.content.items.find(row => row.key === itemKey);
  if (!item) throw new Error('The test is not part of the preserved result.');
  const artifact = content.catalog.content.catalog.content.items.find(row => row.id === item.testCaseId);
  if (!artifact || canonicalJson(artifact) !== canonicalJson(item.artifact) ||
      snapshotContent({ catalog: content.request.content.catalog, testCaseId: item.testCaseId }).sha256 !== item.key) throw new Error('Test artifact differs from the preserved catalog.');
  return item;
}
export function buildTestTarget(run: TestReviewRun, raw: unknown) {
  canonicalJson(raw); const request = testTargetRequestSchema.parse(raw);
  if (request.runSha256 !== run.snapshot.sha256 || run.snapshot.content.result.content.status !== 'completed') throw new Error('Confirm the preserved completed run as the destination.');
  return snapshotContent({ schemaVersion: 1 as const, run: runRef(run), request: snapshotContent(request),
    input: snapshotContent(run.snapshot.content.request.content.input), scopeSha256: inputAssociationScope(run.snapshot.content) });
}
export type TestTargetContent = ReturnType<typeof buildTestTarget>['content'];
export function buildTestDecision(run: TestReviewRun, target: ContentSnapshot<TestTargetContent>, raw: unknown) {
  canonicalJson(raw); const request = testDecisionRequestSchema.parse(raw); intact(target);
  if (buildTestTarget(run, target.content.request.content).sha256 !== target.sha256) throw new Error('Destination does not preserve the original run input.');
  if (request.runSha256 !== run.snapshot.sha256 || target.content.run.id !== run.id || target.content.run.sha256 !== run.snapshot.sha256 || request.targetSha256 !== target.sha256) throw new Error('Run or destination differs from the preserved assessment.');
  const originalItem = testCaseItem(run, request.itemKey);
  return snapshotContent({ schemaVersion: 1 as const, run: runRef(run), target: { format: target.format, sha256: target.sha256 },
    request: snapshotContent(request), originalItem: snapshotContent(originalItem) });
}
export type TestDecisionContent = ReturnType<typeof buildTestDecision>['content'];
export function buildTestCopy(run: TestReviewRun, target: ContentSnapshot<TestTargetContent>, decision: ContentSnapshot<TestDecisionContent>,
  previous: ContentSnapshot<TestCopyContent> | null, raw: unknown): ContentSnapshot<TestCopyContent> {
  canonicalJson(raw); const request = testCopyRequestSchema.parse(raw); intact(decision);
  const checked = buildTestDecision(run, target, decision.content.request.content);
  if (checked.sha256 !== decision.sha256 || request.runSha256 !== run.snapshot.sha256 || request.targetSha256 !== target.sha256 ||
      request.decisionId !== decision.content.request.content.id || request.itemKey !== decision.content.request.content.itemKey || decision.content.request.content.decision !== 'accepted') throw new Error('Only an accepted test at the confirmed destination can be copied.');
  if (previous) {
    intact(previous); intact(previous.content.artifact);
    if (previous.content.decision.id !== request.decisionId || previous.content.decision.sha256 !== decision.sha256 || previous.content.run.sha256 !== run.snapshot.sha256 ||
        previous.content.originalItem.sha256 !== decision.content.originalItem.sha256 || previous.content.target.sha256 !== target.sha256 ||
        canonicalJson(previous.content.catalog) !== canonicalJson(run.snapshot.content.request.content.catalog) ||
        request.previousCopy?.id !== previous.content.request.content.id || request.previousCopy.sha256 !== previous.sha256) throw new Error('Previous copy does not belong to this accepted test.');
  } else if (request.previousCopy !== null) throw new Error('Previous copy is unavailable.');
  const original = decision.content.originalItem, before = previous?.content.artifact.content ?? original.content.artifact;
  const artifact = { ...original.content.artifact, title: request.title, gherkin: request.gherkin };
  return snapshotContent({ schemaVersion: 1, run: runRef(run), target: decision.content.target,
    decision: { id: request.decisionId, format: decision.format, sha256: decision.sha256 }, catalog: run.snapshot.content.request.content.catalog,
    originalItem: original, request: snapshotContent(request), revision: previous ? previous.content.revision + 1 : 1,
    previous: previous ? { id: previous.content.request.content.id, format: previous.format, sha256: previous.sha256 } : null,
    artifact: snapshotContent(artifact), changes: (['title', 'gherkin'] as const).filter(field => before[field] !== artifact[field])
      .map(field => ({ field, before: before[field], after: artifact[field] })) });
}
export type TestCopyContent = {
  schemaVersion: 1; run: TestTargetContent['run']; target: TestDecisionContent['target'];
  decision: { id: string; format: 'us-agent-json-v1'; sha256: string }; catalog: TestCaseRecommendationContent['request']['content']['catalog'];
  originalItem: TestDecisionContent['originalItem']; request: ContentSnapshot<z.infer<typeof testCopyRequestSchema>>; revision: number;
  previous: { id: string; format: 'us-agent-json-v1'; sha256: string } | null;
  artifact: ContentSnapshot<TestDecisionContent['originalItem']['content']['artifact']>;
  changes: Array<{ field: 'title' | 'gherkin'; before: string; after: string }>;
};
