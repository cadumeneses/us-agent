import type { PoolClient } from 'pg';
import { pool, withTransaction } from '../database/pool.js';
import { emptyProjectResearchProfile, projectResearchProfileSchema, type ProjectResearchProfile } from './research-inputs.js';
import { nfrKey, normalizeNfr, profileIssues, recommendNfr, usableClassification, type Nfr, type NfrProfile, type NfrResult } from './nfr-engine.js';

export class NfrRequestError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
type Task = { category: string; technologies: ProjectResearchProfile['technologies'] };
type ProfileRow = Omit<NfrProfile, 'tasks' | 'projectProfile'> & { tasks: Task[]; projectProfile: unknown };
export type NfrRun = NfrResult & {
  id: string; classificationId: string | null; createdAt: string;
  target: { text: string; project: string; taxonomyVersion: string };
  decisions: Record<string, 'accepted' | 'rejected'>;
};

async function loadProfiles(client: Pick<PoolClient, 'query'>): Promise<NfrProfile[]> {
  const result = await client.query<ProfileRow>(`
    WITH latest AS (
      SELECT DISTINCT ON (story_id) * FROM classifications
      ORDER BY story_id, created_at DESC, id DESC
    )
    SELECT c.id::text AS "classificationId", s.id::text AS "storyId", s.content AS text,
      p.name AS project, COALESCE(c.taxonomy_version, '') AS "taxonomyVersion", c.review_status AS "reviewStatus",
      profile.content AS "projectProfile",
      COALESCE((SELECT jsonb_agg(jsonb_build_object('module', module, 'operation', operation) ORDER BY position)
        FROM classification_labels WHERE classification_id = c.id), '[]'::jsonb) AS labels,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('category', category, 'technologies', technologies) ORDER BY position, id)
        FROM story_tasks WHERE classification_id = c.id), '[]'::jsonb) AS tasks,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('type', nfr_type, 'attribute', metric, 'sentence', description) ORDER BY position, id)
        FROM story_non_functional_requirements WHERE classification_id = c.id), '[]'::jsonb) AS nfrs
    FROM latest c JOIN stories s ON s.id = c.story_id JOIN projects p ON p.id = s.project_id
    LEFT JOIN project_research_profiles profile ON profile.project_id = p.id
    ORDER BY c.id
  `);
  const profiles = result.rows.map(row => ({ ...row, projectProfile: projectResearchProfileSchema.parse(row.projectProfile ?? emptyProjectResearchProfile()) }));
  // The project's technology profile evolves with the structured tasks (section 5.2.2).
  // Recompute this union so deleting/changing a task does not leave stale automatic tags.
  const technologyByProject = new Map<string, ProjectResearchProfile['technologies']>();
  for (const profile of profiles) {
    const tech = technologyByProject.get(profile.project) ?? structuredClone(profile.projectProfile.technologies);
    for (const task of profile.tasks) for (const key of Object.keys(tech) as Array<keyof typeof tech>) {
      tech[key] = [...new Set([...tech[key], ...(task.technologies[key] ?? [])])];
    }
    technologyByProject.set(profile.project, tech);
  }
  return profiles.map(profile => ({ ...profile, projectProfile: { ...profile.projectProfile, technologies: technologyByProject.get(profile.project)! } }));
}

async function requireTarget(client: Pick<PoolClient, 'query'>, profiles: NfrProfile[], id: string) {
  const target = profiles.find(profile => profile.classificationId === id);
  if (target) return target;
  const exists = await client.query('SELECT 1 FROM classifications WHERE id = $1', [id]);
  throw new NfrRequestError(exists.rowCount ? 409 : 404, exists.rowCount ? 'Selecione a classificação mais recente desta US para recomendar RNFs.' : 'Classificação não encontrada.');
}

export async function nfrContext(classificationId: string) {
  const target = await requireTarget(pool, await loadProfiles(pool), classificationId);
  return { target, issues: profileIssues(target) };
}

export async function createNfrRun(classificationId: string, labelIndex: number): Promise<NfrRun> {
  return withTransaction(async client => {
    await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    const profiles = await loadProfiles(client);
    const target = await requireTarget(client, profiles, classificationId);
    const history = profiles.filter(profile => profile.storyId !== target.storyId);
    const result = recommendNfr(target, history, labelIndex);
    const saved = await client.query<{ id: string; createdAt: string }>(`
      INSERT INTO nfr_recommendation_runs (classification_id, method, input_snapshot, result)
      VALUES ($1, $2, $3::jsonb, $4::jsonb) RETURNING id::text, created_at::text AS "createdAt"
    `, [classificationId, result.method, JSON.stringify({ target, history, labelIndex }), JSON.stringify(result)]);
    return { ...result, ...saved.rows[0], classificationId, target: { text: target.text, project: target.project, taxonomyVersion: target.taxonomyVersion }, decisions: {} };
  });
}

export async function listNfrRuns(classificationId: string): Promise<NfrRun[]> {
  const result = await pool.query<{ id: string; classificationId: string; createdAt: string; result: NfrResult; target: NfrRun['target']; decisions: NfrRun['decisions'] }>(`
    SELECT run.id::text, run.classification_id::text AS "classificationId", run.created_at::text AS "createdAt", run.result,
      jsonb_build_object('text', input_snapshot->'target'->>'text', 'project', input_snapshot->'target'->>'project',
        'taxonomyVersion', input_snapshot->'target'->>'taxonomyVersion') AS target,
      COALESCE((SELECT jsonb_object_agg(item_key, decision) FROM nfr_recommendation_decisions WHERE run_id = run.id), '{}'::jsonb) AS decisions
    FROM nfr_recommendation_runs run WHERE classification_id = $1 ORDER BY run.id DESC LIMIT 50
  `, [classificationId]);
  return result.rows.map(({ result, ...row }) => ({ ...result, ...row }));
}

export async function decideNfr(runId: string, itemKey: string, decision: 'accepted' | 'rejected') {
  return withTransaction(async client => {
    const runs = await client.query<{ classification_id: string | null; result: NfrResult; input_snapshot: { target: NfrProfile } }>(
      'SELECT classification_id::text, result, input_snapshot FROM nfr_recommendation_runs WHERE id = $1 FOR UPDATE', [runId]);
    const run = runs.rows[0];
    if (!run) throw new NfrRequestError(404, 'Execução não encontrada.');
    const item = run.result.items.find(value => value.key === itemKey);
    if (!item) throw new NfrRequestError(404, 'RNF não encontrado nesta execução.');
    const previous = await client.query<{ decision: string }>('SELECT decision FROM nfr_recommendation_decisions WHERE run_id = $1 AND item_key = $2', [runId, itemKey]);
    if (previous.rows[0]) {
      if (previous.rows[0].decision !== decision) throw new NfrRequestError(409, 'Este RNF já foi avaliado. Uma nova execução permite nova avaliação.');
      return { decision, alreadyRecorded: true };
    }
    if (decision === 'accepted') {
      if (!run.classification_id) throw new NfrRequestError(409, 'A classificação de origem foi removida.');
      // Same lock as manual detail editing: parallel acceptance cannot duplicate a link.
      const current = await client.query<{ taxonomy_version: string; review_status: string; latest: boolean }>(`
        SELECT c.taxonomy_version, c.review_status,
          c.id = (SELECT id FROM classifications WHERE story_id = c.story_id ORDER BY created_at DESC, id DESC LIMIT 1) AS latest
        FROM classifications c WHERE c.id = $1 FOR UPDATE
      `, [run.classification_id]);
      const c = current.rows[0];
      const labels = await client.query<{ module: string; operation: string }>('SELECT module, operation FROM classification_labels WHERE classification_id = $1', [run.classification_id]);
      if (!c || !c.latest || c.taxonomy_version !== run.input_snapshot.target.taxonomyVersion ||
          !usableClassification({ ...run.input_snapshot.target, reviewStatus: c.review_status }) ||
          !labels.rows.some(label => label.module === run.result.label?.module && label.operation === run.result.label?.operation)) {
        throw new NfrRequestError(409, 'A classificação mudou. Gere uma nova recomendação antes de vincular este RNF.');
      }
      const existing = await client.query<Nfr>('SELECT nfr_type AS type, metric AS attribute, description AS sentence FROM story_non_functional_requirements WHERE classification_id = $1', [run.classification_id]);
      if (!existing.rows.some(nfr => nfrKey(nfr) === itemKey)) {
        const nfr = normalizeNfr(item);
        await client.query(`
          INSERT INTO story_non_functional_requirements (classification_id, nfr_type, metric, description, position)
          SELECT $1, $2, $3, $4, COALESCE(MAX(position), -1) + 1 FROM story_non_functional_requirements WHERE classification_id = $1
        `, [run.classification_id, nfr.type, nfr.attribute, nfr.sentence]);
      }
    }
    await client.query('INSERT INTO nfr_recommendation_decisions (run_id, item_key, decision) VALUES ($1, $2, $3)', [runId, itemKey, decision]);
    return { decision, alreadyRecorded: false };
  });
}
