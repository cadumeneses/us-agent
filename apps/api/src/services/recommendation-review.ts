import type { PoolClient } from 'pg';
import { withTransaction } from '../database/pool.js';
import { canonicalJson, snapshotContent, type ContentSnapshot } from '../domain/content-snapshot.js';
import { associationIdentity, bindRecommendationTargetSchema, classificationIdentity, decisionItem, inputAssociationScope, recommendationDecisionSchema } from '../domain/recommendation-review.js';
import type { RecommendationContent } from './recommendation-execution.js';
import { loadRnfRecommendationRun as loadRecommendationRun, RecommendationRequestError } from './recommendation-runs.js';
import { nfrKey, normalizeNfr, type Label, type Nfr } from './nfr-engine.js';

type Reader = Pick<PoolClient, 'query'>;
export type ClassificationDestination = {
  classificationId: string; storyId: string; projectId: string; project: string; text: string; reviewStatus: string;
  taxonomyVersion: string; latest: boolean; labels: Label[]; projectProfile: unknown; tasks: unknown[];
};
type TargetContent = {
  schemaVersion: 1; run: { id: string; format: 'us-agent-json-v1'; sha256: string };
  request: ReturnType<typeof bindRecommendationTargetSchema.parse>; input: ContentSnapshot<RecommendationContent['request']['content']['input']>;
  destination: { kind: 'input'; scopeSha256: string } | { kind: 'classification'; snapshot: ContentSnapshot<ClassificationDestination>; justification: string };
};
type DecisionContent = { schemaVersion: 1; run: TargetContent['run']; target: { format: 'us-agent-json-v1'; sha256: string };
  request: ContentSnapshot<ReturnType<typeof recommendationDecisionSchema.parse>>;
  originalItem: ReturnType<typeof decisionItem>; association: null | { identitySha256: string; materialization: 'input_only' | 'created' | 'already_present' } };
type Row<T> = { content: T; hash_format: string; content_sha256: string; created_by: string; created_at: Date };
type TargetRow = Row<TargetContent> & { run_id: string; kind: string };
type DecisionRow = Row<DecisionContent> & { id: string; run_id: string; item_key: string; decision: string; request_sha256: string; link_identity_sha256: string | null };
type LinkContent = { schemaVersion: 1; identity: ReturnType<typeof associationIdentity>; item: Nfr };
type LinkRow = Row<LinkContent> & { identity_sha256: string; item_key: string };

function validateReviewJson(raw: unknown) {
  try { canonicalJson(raw); }
  catch (error) { throw new RecommendationRequestError(422, error instanceof Error ? error.message : 'Requisição de revisão inválida.'); }
}

function envelope<T>(row: Row<T>) {
  const snapshot = snapshotContent(row.content);
  if (row.hash_format !== snapshot.format || row.content_sha256 !== snapshot.sha256) throw new Error('Evidência de revisão diverge do hash persistido.');
  return { snapshot, createdBy: row.created_by, createdAt: row.created_at.toISOString() };
}
function targetRecord(row: TargetRow) {
  const record = envelope(row), content = record.snapshot.content;
  if (content.run.id !== row.run_id || content.destination.kind !== row.kind || content.request.runSha256 !== content.run.sha256 ||
      snapshotContent(content.input.content).sha256 !== content.input.sha256) throw new Error('Destino diverge da evidência persistida.');
  if (content.destination.kind === 'classification' && snapshotContent(content.destination.snapshot.content).sha256 !== content.destination.snapshot.sha256) throw new Error('Snapshot do destino inválido.');
  return record;
}
function decisionRecord(row: DecisionRow) {
  const record = envelope(row), content = record.snapshot.content, request = content.request;
  if (content.run.id !== row.run_id || request.content.id !== row.id || request.content.itemKey !== row.item_key || request.content.decision !== row.decision ||
      request.content.runSha256 !== content.run.sha256 || request.content.targetSha256 !== content.target.sha256 ||
      request.sha256 !== row.request_sha256 || snapshotContent(request.content).sha256 !== request.sha256 ||
      (content.association?.identitySha256 ?? null) !== row.link_identity_sha256 || content.originalItem.key !== row.item_key) throw new Error('Decisão diverge da evidência persistida.');
  return { id: row.id, ...record };
}
async function classificationSnapshot(reader: Reader, id: string, lock = false) {
  const result = await reader.query<ClassificationDestination>(`
    SELECT c.id::text AS "classificationId", s.id::text AS "storyId", p.id::text AS "projectId", p.name AS project,
      s.content AS text, c.review_status AS "reviewStatus", COALESCE(c.taxonomy_version, '') AS "taxonomyVersion",
      c.id = (SELECT id FROM classifications WHERE story_id = c.story_id ORDER BY created_at DESC, id DESC LIMIT 1) AS latest,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('module', module, 'operation', operation) ORDER BY position, id)
        FROM classification_labels WHERE classification_id = c.id), '[]'::jsonb) AS labels,
      (SELECT content FROM project_research_profiles WHERE project_id = p.id) AS "projectProfile",
      COALESCE((SELECT jsonb_agg(to_jsonb(task) - 'id' - 'classification_id' ORDER BY position, id)
        FROM story_tasks task WHERE classification_id = c.id), '[]'::jsonb) AS tasks
    FROM classifications c JOIN stories s ON s.id = c.story_id JOIN projects p ON p.id = s.project_id
    WHERE c.id = $1 ${lock ? 'FOR UPDATE OF c FOR SHARE OF s, p' : ''}`, [id]);
  const row = result.rows[0];
  if (!row) throw new RecommendationRequestError(404, 'História/classificação de destino não encontrada.');
  return snapshotContent(row);
}
function assertDestination(content: RecommendationContent, target: ClassificationDestination) {
  const label = content.result.content.label;
  if (!target.latest || !['accepted_auto', 'reviewed', 'reclassified'].includes(target.reviewStatus) ||
      !label || !target.labels.some(item => item.module === label.module && item.operation === label.operation)) {
    throw new RecommendationRequestError(409, 'Escolha a classificação atual, aceita/revisada e com o par módulo/operação da execução.');
  }
}
async function lockedRun(client: PoolClient, id: string, sha256: string) {
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [JSON.stringify(['recommendation-review', id])]);
  const run = await loadRecommendationRun(id, client);
  if (run.snapshot.sha256 !== sha256) throw new RecommendationRequestError(409, 'A referência da execução não corresponde ao resultado preservado.');
  return run;
}
export async function previewRecommendationDestination(runId: string, classificationId: string) {
  classificationIdentity.parse(classificationId);
  return withTransaction(async client => {
    await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    const run = await loadRecommendationRun(runId, client), snapshot = await classificationSnapshot(client, classificationId);
    assertDestination(run.snapshot.content, snapshot.content);
    return snapshot;
  });
}
export async function bindRecommendationTarget(runId: string, raw: unknown, actor: string) {
  validateReviewJson(raw); const request = bindRecommendationTargetSchema.parse(raw);
  return withTransaction(async client => {
    const run = await lockedRun(client, runId, request.runSha256);
    const previous = await client.query<TargetRow>('SELECT * FROM recommender_run_targets WHERE run_id = $1', [runId]);
    if (previous.rows[0]) {
      const target = targetRecord(previous.rows[0]);
      if (snapshotContent(target.snapshot.content.request).sha256 !== snapshotContent(request).sha256) throw new RecommendationRequestError(409, 'Esta execução já tem destino confirmado. Faça outra execução para mudar o destino.');
      return target;
    }
    if (run.snapshot.content.result.content.status !== 'completed') throw new RecommendationRequestError(409, 'A execução não contém sugestões para avaliar.');
    let destination: TargetContent['destination'];
    if (request.target.kind === 'input') destination = { kind: 'input', scopeSha256: inputAssociationScope(run.snapshot.content) };
    else {
      const snapshot = await classificationSnapshot(client, request.target.classificationId, true);
      assertDestination(run.snapshot.content, snapshot.content);
      if (snapshot.sha256 !== request.target.expectedSha256) throw new RecommendationRequestError(409, 'O destino mudou desde a revisão. Carregue o destino atual e revise novamente.');
      destination = { kind: 'classification', snapshot, justification: request.target.justification };
    }
    const snapshot = snapshotContent<TargetContent>({ schemaVersion: 1, run: { id: run.id, format: run.snapshot.format, sha256: run.snapshot.sha256 },
      request, input: snapshotContent(run.snapshot.content.request.content.input), destination });
    const saved = await client.query<TargetRow>(`INSERT INTO recommender_run_targets (run_id, kind, content, hash_format, content_sha256, created_by)
      VALUES ($1,$2,$3::jsonb,$4,$5,$6) RETURNING *`, [runId, destination.kind, JSON.stringify(snapshot.content), snapshot.format, snapshot.sha256, actor]);
    return targetRecord(saved.rows[0]);
  });
}
export async function recommendationReview(runId: string) {
  return withTransaction(async client => {
    await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const run = await loadRecommendationRun(runId, client);
    const targets = await client.query<TargetRow>('SELECT * FROM recommender_run_targets WHERE run_id = $1', [runId]);
    const decisions = await client.query<DecisionRow>('SELECT * FROM recommender_item_decisions WHERE run_id = $1 ORDER BY created_at, id', [runId]);
    const target = targets.rows[0] ? targetRecord(targets.rows[0]) : null;
    const records = decisions.rows.map(decisionRecord);
    if (target && target.snapshot.content.run.sha256 !== run.snapshot.sha256 || records.some(decision => decision.snapshot.content.run.sha256 !== run.snapshot.sha256 || decision.snapshot.content.target.sha256 !== target?.snapshot.sha256)) throw new Error('Revisão diverge da execução ou do destino preservado.');
    return { runId, runSha256: run.snapshot.sha256, target, decisions: records };
  });
}
export async function decideRecommendationItem(runId: string, raw: unknown, actor: string) {
  validateReviewJson(raw); const request = recommendationDecisionSchema.parse(raw), requestSnapshot = snapshotContent(request);
  return withTransaction(async client => {
    // READ COMMITTED takes a fresh view after the advisory lock: concurrent identical retries find the first write.
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [JSON.stringify(['recommendation-decision', request.id])]);
    const run = await lockedRun(client, runId, request.runSha256);
    const previous = await client.query<DecisionRow>('SELECT * FROM recommender_item_decisions WHERE id = $1 OR (run_id = $2 AND item_key = $3)', [request.id, runId, request.itemKey]);
    if (previous.rows.length) {
      if (previous.rows.length !== 1 || previous.rows[0].run_id !== runId) throw new RecommendationRequestError(409, 'Identificador de decisão já utilizado.');
      const decision = decisionRecord(previous.rows[0]);
      if (snapshotContent({ ...request, id: decision.id }).sha256 !== decision.snapshot.content.request.sha256) throw new RecommendationRequestError(409, 'O item já foi avaliado com outra decisão, destino ou observação. Faça outra execução para reavaliar.');
      return decision;
    }
    const targets = await client.query<TargetRow>('SELECT * FROM recommender_run_targets WHERE run_id = $1', [runId]);
    if (!targets.rows[0]) throw new RecommendationRequestError(409, 'Confirme o destino antes de avaliar os itens.');
    const target = targetRecord(targets.rows[0]);
    if (target.snapshot.sha256 !== request.targetSha256) throw new RecommendationRequestError(409, 'O destino informado diverge do destino confirmado.');
    let item: ReturnType<typeof decisionItem>;
    try { item = decisionItem(run.snapshot.content, request.itemKey); }
    catch (error) { throw new RecommendationRequestError(422, (error as Error).message); }
    let association: DecisionContent['association'] = null;
    if (request.decision === 'accepted') {
      const destination = target.snapshot.content.destination;
      let materialization: NonNullable<DecisionContent['association']>['materialization'] = 'input_only';
      if (destination.kind === 'classification') {
        const current = await classificationSnapshot(client, destination.snapshot.content.classificationId, true);
        assertDestination(run.snapshot.content, current.content);
        if (current.sha256 !== destination.snapshot.sha256) throw new RecommendationRequestError(409, 'O destino mudou após a confirmação. Faça outra execução e confirme o destino atual.');
        const existing = await client.query<Nfr>('SELECT nfr_type AS type, metric AS attribute, description AS sentence FROM story_non_functional_requirements WHERE classification_id = $1', [current.content.classificationId]);
        materialization = existing.rows.some(nfr => nfrKey(nfr) === item.key) ? 'already_present' : 'created';
        if (materialization === 'created') {
          const nfr = normalizeNfr(item);
          await client.query(`INSERT INTO story_non_functional_requirements (classification_id, nfr_type, metric, description, position)
            SELECT $1,$2,$3,$4,COALESCE(MAX(position), -1) + 1 FROM story_non_functional_requirements WHERE classification_id = $1`, [current.content.classificationId, nfr.type, nfr.attribute, nfr.sentence]);
        }
      }
      const identity = associationIdentity(destination.kind === 'input' ? destination : { kind: 'classification', classificationId: destination.snapshot.content.classificationId }, run.snapshot.content.result.content.method, item.key);
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [JSON.stringify(['recommendation-link', identity.sha256])]);
      const links = await client.query<LinkRow>('SELECT * FROM recommender_item_links WHERE identity_sha256 = $1', [identity.sha256]);
      if (links.rows[0]) {
        const link = envelope(links.rows[0]);
        if (link.snapshot.content.identity.sha256 !== identity.sha256 || snapshotContent(link.snapshot.content.identity.content).sha256 !== identity.sha256 ||
            links.rows[0].item_key !== item.key || nfrKey(link.snapshot.content.item) !== item.key) throw new Error('Vínculo diverge da evidência persistida.');
      } else {
        const link = snapshotContent<LinkContent>({ schemaVersion: 1, identity, item: normalizeNfr(item) });
        await client.query(`INSERT INTO recommender_item_links (identity_sha256, source_run_id, item_key, content, hash_format, content_sha256, created_by)
          VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7)`, [identity.sha256, runId, item.key, JSON.stringify(link.content), link.format, link.sha256, actor]);
      }
      association = { identitySha256: identity.sha256, materialization };
    }
    const snapshot = snapshotContent<DecisionContent>({ schemaVersion: 1, run: target.snapshot.content.run,
      target: { format: target.snapshot.format, sha256: target.snapshot.sha256 }, request: requestSnapshot, originalItem: item, association });
    const saved = await client.query<DecisionRow>(`INSERT INTO recommender_item_decisions
      (id, run_id, item_key, decision, request_sha256, link_identity_sha256, content, hash_format, content_sha256, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10) RETURNING *`, [request.id, runId, item.key, request.decision, requestSnapshot.sha256,
      association?.identitySha256 ?? null, JSON.stringify(snapshot.content), snapshot.format, snapshot.sha256, actor]);
    return decisionRecord(saved.rows[0]);
  });
}
