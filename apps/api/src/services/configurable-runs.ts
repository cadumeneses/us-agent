import { query, withTransaction } from '../database/pool.js';
import { canonicalJson, snapshotContent } from '../domain/content-snapshot.js';
import { lockPublishedDataset, lockPublishedDefinition } from './recommender-datasets.js';
import { CONFIGURABLE_KNN_ADAPTER, configurableRequestSchema, executeConfigurableRecommendation, type ConfigurableRecommendationContent } from './configurable-knn.js';
import { ConfigurableRequestError } from './configurable-project-profiles.js';
import { KNN_KERNEL_VERSION } from './knn.js';

type Row = { id: string; definition_id: string; definition_version: string; dataset_id: string; dataset_version: string;
  request_sha256: string; content: ConfigurableRecommendationContent; hash_format: string; content_sha256: string;
  status: string; duration_ms: number; created_by: string; created_at: Date };
function record(row: Row) {
  const snapshot = snapshotContent(row.content), content = snapshot.content;
  if (content.schemaVersion !== 3 || snapshot.format !== row.hash_format || snapshot.sha256 !== row.content_sha256 ||
      content.request.content.id !== row.id || content.request.sha256 !== row.request_sha256 || content.result.content.status !== row.status ||
      content.request.content.definition.id !== row.definition_id || content.request.content.definition.version !== row.definition_version ||
      content.request.content.dataset.id !== row.dataset_id || content.request.content.dataset.version !== row.dataset_version) throw new Error('Stored run integrity mismatch.');
  for (const child of [content.request, content.definition, content.dataset, content.projection, content.result, content.explanation]) {
    if (child.format !== snapshot.format || snapshotContent(child.content).sha256 !== child.sha256) throw new Error('Stored run snapshot integrity mismatch.');
  }
  return { id: row.id, snapshot, durationMs: row.duration_ms, createdBy: row.created_by, createdAt: row.created_at.toISOString() };
}
export async function loadConfigurableRun(id: string) {
  const selected = await query<Row>('SELECT * FROM recommender_runs WHERE id=$1', [id]);
  if (!selected.rows[0] || selected.rows[0].content.schemaVersion !== 3) return null;
  return record(selected.rows[0]);
}
export async function createConfigurableRun(raw: unknown, actor: string) {
  canonicalJson(raw);
  const request = configurableRequestSchema.parse(raw), requestSnapshot = snapshotContent(request);
  return withTransaction(async client => {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [JSON.stringify(['recommendation-run', request.id])]);
    const previous = await client.query<Row>('SELECT * FROM recommender_runs WHERE id=$1', [request.id]);
    if (previous.rows[0]) {
      if (previous.rows[0].request_sha256 !== requestSnapshot.sha256 || previous.rows[0].content.schemaVersion !== 3) throw new ConfigurableRequestError(409, 'This run ID is already used by a different request.');
      return record(previous.rows[0]);
    }
    const started = performance.now();
    const definition = await lockPublishedDefinition(client, request.definition);
    const dataset = await lockPublishedDataset(client, request.dataset);
    const content = executeConfigurableRecommendation(request, definition.content, dataset.content);
    const snapshot = snapshotContent(content);
    const saved = await client.query<Row>(`INSERT INTO recommender_runs
      (id,definition_id,definition_version,dataset_id,dataset_version,request_sha256,content,hash_format,content_sha256,status,duration_ms,created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12) RETURNING *`,
      [request.id, request.definition.id, request.definition.version, request.dataset.id, request.dataset.version, requestSnapshot.sha256,
        JSON.stringify(content), snapshot.format, snapshot.sha256, content.result.content.status, performance.now() - started, actor]);
    return record(saved.rows[0]);
  });
}
export async function replayConfigurableRun(id: string) {
  const run = await loadConfigurableRun(id);
  if (!run) throw new ConfigurableRequestError(404, 'Run not found.');
  const content = run.snapshot.content;
  if (content.software.adapterVersion !== CONFIGURABLE_KNN_ADAPTER || content.software.policyVersion !== 'weighted-presence-union-v1' || content.software.kernelVersion !== KNN_KERNEL_VERSION) throw new ConfigurableRequestError(409, 'The recorded implementation is not installed.');
  const replay = executeConfigurableRecommendation(content.request.content, content.definition.content, content.dataset.content);
  const resultMatches = replay.result.sha256 === content.result.sha256;
  const explanationMatches = replay.explanation.sha256 === content.explanation.sha256;
  const projectionMatches = replay.projection.sha256 === content.projection.sha256;
  return { id, originalSha256: run.snapshot.sha256, verified: resultMatches && explanationMatches && projectionMatches,
    resultMatches, explanationMatches, projectionMatches };
}
