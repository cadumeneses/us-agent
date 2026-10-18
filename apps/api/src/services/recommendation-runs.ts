import { pool, query, withTransaction } from '../database/pool.js';
import { canonicalJson, snapshotContent } from '../domain/content-snapshot.js';
import { lockPublishedDataset, lockPublishedDefinition } from './recommender-datasets.js';
import { executeMethodRecommendation, methodRecommendationRequestSchema, canReplayMethod, type MethodRecommendationContent } from './method-execution.js';
import { lockPublishedTestCaseCatalog } from './test-case-catalogs.js';
import type { PoolClient } from 'pg';

export class RecommendationRequestError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
type Row = { id: string; definition_id: string; definition_version: string; dataset_id: string; dataset_version: string;
  request_sha256: string; content: MethodRecommendationContent; hash_format: string; content_sha256: string; status: string;
  duration_ms: number; created_by: string; created_at: Date };
function record(row: Row) {
  const snapshot = snapshotContent(row.content), content = snapshot.content;
  if (snapshot.format !== row.hash_format || snapshot.sha256 !== row.content_sha256 || content.request.sha256 !== row.request_sha256 ||
      content.request.content.id !== row.id || content.request.content.definition.id !== row.definition_id || content.request.content.definition.version !== row.definition_version ||
      content.request.content.dataset.id !== row.dataset_id || content.request.content.dataset.version !== row.dataset_version || content.result.content.status !== row.status) throw new Error('Execução diverge da evidência persistida.');
  for (const child of [content.request, content.definition, content.dataset, content.projection, content.result, content.explanation, ...(content.schemaVersion === 2 ? [content.catalog] : [])]) {
    if (child.format !== snapshot.format || snapshotContent(child.content).sha256 !== child.sha256) throw new Error('Snapshot interno da execução inválido.');
  }
  return { id: row.id, snapshot, durationMs: row.duration_ms, createdBy: row.created_by, createdAt: row.created_at.toISOString() };
}

export async function createRecommendationRun(raw: unknown, actor: string) {
  canonicalJson(raw);
  const request = methodRecommendationRequestSchema.parse(raw), requestSnapshot = snapshotContent(request);
  return withTransaction(async client => {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [JSON.stringify(['recommendation-run', request.id])]);
    const previous = await client.query<Row>('SELECT * FROM recommender_runs WHERE id = $1', [request.id]);
    if (previous.rows[0]) {
      if (previous.rows[0].request_sha256 !== requestSnapshot.sha256) throw new RecommendationRequestError(409, 'ID de execução já utilizado com outra entrada ou dependência.');
      return record(previous.rows[0]);
    }
    const started = performance.now();
    const definition = await lockPublishedDefinition(client, request.definition);
    const dataset = await lockPublishedDataset(client, request.dataset);
    const catalog = 'catalog' in request ? await lockPublishedTestCaseCatalog(client, request.catalog) : undefined;
    let content: MethodRecommendationContent;
    try { content = executeMethodRecommendation(request, definition.content, dataset.content, catalog?.content); }
    catch (error) { throw new RecommendationRequestError(422, error instanceof Error ? error.message : 'Configuração ou entrada inválida.'); }
    const snapshot = snapshotContent(content);
    const durationMs = performance.now() - started;
    const saved = await client.query<Row>(`INSERT INTO recommender_runs
      (id, definition_id, definition_version, dataset_id, dataset_version, request_sha256, content, hash_format, content_sha256, status, duration_ms, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12) RETURNING *`,
      [request.id, request.definition.id, request.definition.version, request.dataset.id, request.dataset.version, requestSnapshot.sha256,
        JSON.stringify(content), snapshot.format, snapshot.sha256, content.result.content.status, durationMs, actor]);
    return record(saved.rows[0]);
  });
}

export async function loadRecommendationRun(id: string, reader: Pick<PoolClient, 'query'> = pool) {
  const result = await reader.query<Row>('SELECT * FROM recommender_runs WHERE id = $1', [id]);
  if (!result.rows[0]) throw new RecommendationRequestError(404, 'Execução não encontrada.');
  return record(result.rows[0]);
}
export async function loadRnfRecommendationRun(id: string, reader: Pick<PoolClient, 'query'> = pool) {
  const run = await loadRecommendationRun(id, reader);
  if (run.snapshot.content.schemaVersion !== 1) throw new RecommendationRequestError(422, 'Test-case assessment is not implemented yet; the original execution remains available.');
  return { ...run, snapshot: { ...run.snapshot, content: run.snapshot.content } };
}
export async function listRecommendationRuns(options: { definitionId?: string; datasetId?: string; limit: number; offset: number }) {
  const result = await query<{ id: string; definition_id: string; definition_version: string; dataset_id: string; dataset_version: string;
    status: string; duration_ms: number; hash_format: string; content_sha256: string; created_by: string; created_at: Date }>(
    `SELECT id, definition_id, definition_version, dataset_id, dataset_version, status, duration_ms, hash_format, content_sha256, created_by, created_at FROM recommender_runs
      WHERE ($1::text IS NULL OR definition_id = $1) AND ($2::text IS NULL OR dataset_id = $2)
      ORDER BY created_at DESC, id DESC LIMIT $3 OFFSET $4`, [options.definitionId ?? null, options.datasetId ?? null, options.limit, options.offset]);
  return result.rows.map(row => ({ id: row.id, definition: { id: row.definition_id, version: row.definition_version }, dataset: { id: row.dataset_id, version: row.dataset_version },
    status: row.status, durationMs: row.duration_ms, snapshot: { format: row.hash_format, sha256: row.content_sha256 }, createdBy: row.created_by, createdAt: row.created_at.toISOString() }));
}

export async function replayRecommendationRun(id: string) {
  const original = await loadRecommendationRun(id), content = original.snapshot.content;
  if (!canReplayMethod(content)) {
    throw new RecommendationRequestError(409, 'A implementação registrada não está disponível para replay neste executor.');
  }
  const replay = executeMethodRecommendation(content.request.content, content.definition.content, content.dataset.content, content.schemaVersion === 2 ? content.catalog.content : undefined);
  const resultMatches = replay.result.sha256 === content.result.sha256;
  const explanationMatches = replay.explanation.sha256 === content.explanation.sha256;
  const projectionMatches = replay.projection.sha256 === content.projection.sha256;
  return { id, originalSha256: original.snapshot.sha256, verified: resultMatches && explanationMatches && projectionMatches,
    resultMatches, explanationMatches, projectionMatches };
}
