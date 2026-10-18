import type { PoolClient } from 'pg';
import { withTransaction } from '../database/pool.js';
import { canonicalJson, snapshotContent, type ContentSnapshot } from '../domain/content-snapshot.js';
import { buildTestTarget, buildTestDecision, buildTestCopy, testCaseItem, testTargetRequestSchema, testDecisionRequestSchema, testCopyRequestSchema,
  type TestReviewRun, type TestTargetContent, type TestDecisionContent, type TestCopyContent } from '../domain/test-case-review.js';
import { loadRecommendationRun } from './recommendation-runs.js';
import { E21_EQUATIONS_DEMO } from './testrec-equations.js';

export class TestReviewError extends Error { constructor(public status: number, message: string) { super(message); } }
type Row<T> = { run_id: string; content: T; hash_format: 'us-agent-json-v1'; content_sha256: string; created_by: string; created_at: Date };
type TargetRow = Row<TestTargetContent>;
type DecisionRow = Row<TestDecisionContent> & { id: string; item_key: string; decision: string; request_sha256: string };
type CopyRow = Row<TestCopyContent> & { id: string; item_key: string; decision_id: string; revision: number; previous_copy_id: string | null; request_sha256: string;
  previous_content?: TestCopyContent | null; previous_format?: 'us-agent-json-v1'; previous_sha256?: string };
function record<T>(row: Row<T>) {
  const snapshot = snapshotContent(row.content);
  if (snapshot.format !== row.hash_format || snapshot.sha256 !== row.content_sha256) throw new Error('Test assessment differs from its persisted hash.');
  return { snapshot, createdBy: row.created_by, createdAt: row.created_at.toISOString() };
}
function checked<T>(operation: () => T): T {
  try { return operation(); } catch (error) { throw new TestReviewError(422, error instanceof Error ? error.message : 'Invalid test assessment.'); }
}
async function testRun(client: PoolClient, id: string) {
  const run = await loadRecommendationRun(id, client), content = run.snapshot.content;
  if (content.schemaVersion !== 2 || content.result.content.method !== E21_EQUATIONS_DEMO) throw new TestReviewError(422, 'Use the assessment appropriate to this run method.');
  return { ...run, snapshot: { ...run.snapshot, content } };
}
async function targetFor(client: PoolClient, run: TestReviewRun, required = true) {
  const row = (await client.query<TargetRow>('SELECT * FROM test_case_run_targets WHERE run_id = $1', [run.id])).rows[0];
  if (!row) { if (required) throw new TestReviewError(409, 'Confirm the preserved input as destination before assessing tests.'); return null; }
  const result = record(row);
  if (buildTestTarget(run, row.content.request.content).sha256 !== result.snapshot.sha256) throw new Error('Test destination differs from the preserved run.');
  return result;
}
function decisionRecord(row: DecisionRow, run: TestReviewRun, target: ContentSnapshot<TestTargetContent>) {
  const result = record(row), request = result.snapshot.content.request;
  if (row.run_id !== run.id || row.id !== request.content.id || row.item_key !== request.content.itemKey || row.decision !== request.content.decision ||
      row.request_sha256 !== request.sha256 || buildTestDecision(run, target, request.content).sha256 !== result.snapshot.sha256) throw new Error('Test decision differs from its original item or destination.');
  return { id: row.id, ...result };
}
const copySelect = `SELECT c.*, p.content AS previous_content, p.hash_format AS previous_format, p.content_sha256 AS previous_sha256
  FROM test_case_adapted_copies c LEFT JOIN test_case_adapted_copies p ON p.id = c.previous_copy_id`;
function copyRecord(row: CopyRow, run: TestReviewRun, target: ContentSnapshot<TestTargetContent>, decision: ContentSnapshot<TestDecisionContent>) {
  const result = record(row), content = result.snapshot.content;
  const previous = row.previous_copy_id ? { format: row.previous_format!, sha256: row.previous_sha256!, content: row.previous_content! } : null;
  if (row.run_id !== run.id || row.id !== content.request.content.id || row.item_key !== content.request.content.itemKey || row.decision_id !== content.decision.id ||
      row.revision !== content.revision || row.previous_copy_id !== (content.previous?.id ?? null) || row.request_sha256 !== content.request.sha256 ||
      buildTestCopy(run, target, decision, previous, content.request.content).sha256 !== result.snapshot.sha256) throw new Error('Adapted copy differs from its preserved provenance or revision.');
  return { id: row.id, ...result };
}
async function lock(client: PoolClient, family: string, ...keys: string[]) {
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [JSON.stringify([family, ...keys])]);
}
export async function testReview(id: string) {
  return withTransaction(async client => {
    await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const run = await testRun(client, id);
    return { runId: run.id, runSha256: run.snapshot.sha256, target: await targetFor(client, run, false) };
  });
}
export async function confirmTestTarget(id: string, raw: unknown, actor: string) {
  canonicalJson(raw); const request = testTargetRequestSchema.parse(raw);
  return withTransaction(async client => {
    await lock(client, 'test-target', id); const run = await testRun(client, id);
    const snapshot = checked(() => buildTestTarget(run, request)), previous = await targetFor(client, run, false);
    if (previous) { if (previous.snapshot.sha256 !== snapshot.sha256) throw new TestReviewError(409, 'This run already has a different destination.'); return previous; }
    const saved = await client.query<TargetRow>(`INSERT INTO test_case_run_targets (run_id, content, hash_format, content_sha256, created_by)
      VALUES ($1,$2::jsonb,$3,$4,$5) RETURNING *`, [id, JSON.stringify(snapshot.content), snapshot.format, snapshot.sha256, actor]);
    return record(saved.rows[0]);
  });
}
export async function decideTestItem(id: string, raw: unknown, actor: string) {
  canonicalJson(raw); const request = testDecisionRequestSchema.parse(raw);
  return withTransaction(async client => {
    await lock(client, 'test-decision-id', request.id); await lock(client, 'test-decision-item', id, request.itemKey);
    const run = await testRun(client, id), target = (await targetFor(client, run))!;
    const snapshot = checked(() => buildTestDecision(run, target.snapshot, request));
    const previous = await client.query<DecisionRow>('SELECT * FROM test_case_item_decisions WHERE id = $1 OR (run_id = $2 AND item_key = $3)', [request.id, id, request.itemKey]);
    if (previous.rows.length) {
      if (previous.rows.length !== 1 || previous.rows[0].run_id !== id) throw new TestReviewError(409, 'Decision ID already belongs to another item or run.');
      const saved = decisionRecord(previous.rows[0], run, target.snapshot);
      if (snapshotContent({ ...request, id: saved.id }).sha256 !== saved.snapshot.content.request.sha256) throw new TestReviewError(409, 'This test already has a different immutable decision. Start another run to reassess it.');
      return saved;
    }
    const saved = await client.query<DecisionRow>(`INSERT INTO test_case_item_decisions
      (id, run_id, item_key, decision, request_sha256, content, hash_format, content_sha256, created_by)
      VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9) RETURNING *`, [request.id, id, request.itemKey, request.decision, snapshot.content.request.sha256, JSON.stringify(snapshot.content), snapshot.format, snapshot.sha256, actor]);
    return decisionRecord(saved.rows[0], run, target.snapshot);
  });
}
export async function createTestCopy(id: string, raw: unknown, actor: string) {
  canonicalJson(raw); const request = testCopyRequestSchema.parse(raw);
  return withTransaction(async client => {
    await lock(client, 'test-copy-id', request.id); await lock(client, 'test-copy-decision', request.decisionId);
    const run = await testRun(client, id), target = (await targetFor(client, run))!;
    const decisionRow = (await client.query<DecisionRow>('SELECT * FROM test_case_item_decisions WHERE id = $1 AND run_id = $2 AND item_key = $3', [request.decisionId, id, request.itemKey])).rows[0];
    if (!decisionRow) throw new TestReviewError(422, 'Select the preserved decision for this test.');
    const decision = decisionRecord(decisionRow, run, target.snapshot);
    const existing = (await client.query<CopyRow>(copySelect + ' WHERE c.id = $1', [request.id])).rows[0];
    if (existing) {
      if (existing.request_sha256 !== snapshotContent(request).sha256 || existing.run_id !== id) throw new TestReviewError(409, 'Copy ID already belongs to a different request.');
      return copyRecord(existing, run, target.snapshot, decision.snapshot);
    }
    const latest = (await client.query<CopyRow>(copySelect + ' WHERE c.decision_id = $1 ORDER BY c.revision DESC LIMIT 1', [request.decisionId])).rows[0];
    const previous = latest ? copyRecord(latest, run, target.snapshot, decision.snapshot) : null;
    if ((previous?.id ?? null) !== (request.previousCopy?.id ?? null) || previous && previous.snapshot.sha256 !== request.previousCopy?.sha256) throw new TestReviewError(409, 'The latest copy changed. Reload its history before saving a new revision.');
    const snapshot = checked(() => buildTestCopy(run, target.snapshot, decision.snapshot, previous?.snapshot ?? null, request));
    await client.query(`INSERT INTO test_case_adapted_copies
      (id, decision_id, run_id, item_key, revision, previous_copy_id, request_sha256, content, hash_format, content_sha256, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11)`, [request.id, request.decisionId, id, request.itemKey, snapshot.content.revision, previous?.id ?? null,
        snapshot.content.request.sha256, JSON.stringify(snapshot.content), snapshot.format, snapshot.sha256, actor]);
    return copyRecord((await client.query<CopyRow>(copySelect + ' WHERE c.id = $1', [request.id])).rows[0], run, target.snapshot, decision.snapshot);
  });
}
export async function testItemReview(id: string, itemKey: string, limit: number, offset: number) {
  return withTransaction(async client => {
    await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const run = await testRun(client, id); checked(() => testCaseItem(run, itemKey));
    const target = await targetFor(client, run, false);
    const row = (await client.query<DecisionRow>('SELECT * FROM test_case_item_decisions WHERE run_id = $1 AND item_key = $2', [id, itemKey])).rows[0];
    const decision = row ? decisionRecord(row, run, target!.snapshot) : null;
    const copies = decision ? await client.query<CopyRow>(copySelect + ' WHERE c.decision_id = $1 ORDER BY c.revision DESC LIMIT $2 OFFSET $3', [decision.id, limit, offset]) : { rows: [] };
    const total = decision ? (await client.query<{ total: number }>('SELECT count(*)::int AS total FROM test_case_adapted_copies WHERE decision_id = $1', [decision.id])).rows[0].total : 0;
    return { runId: id, runSha256: run.snapshot.sha256, itemKey, decision, copies: copies.rows.map(copy => copyRecord(copy, run, target!.snapshot, decision!.snapshot)), page: { limit, offset, total } };
  });
}
