import { createHash, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { withTransaction } from '../database/pool.js';

export type PreviewResult = {
  id: string;
  text: string;
  module: string;
  operation: string;
  confidence: number;
  needsReview: boolean;
};

type PreviewInput = Omit<PreviewResult, 'id'>;

function storyExternalId(text: string) {
  const normalized = text.trim().replace(/\s+/g, ' ');
  return `us_${createHash('sha256').update(normalized).digest('hex').slice(0, 16)}`;
}

async function upsertProject(client: PoolClient, name: string) {
  const result = await client.query<{ id: string }>(`
    INSERT INTO projects (name) VALUES ($1)
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
    RETURNING id
  `, [name]);
  return result.rows[0].id;
}

export async function savePreviewClassifications(project: string, inputs: PreviewInput[]) {
  const runId = `preview_${randomUUID().replaceAll('-', '')}`;
  const results = await withTransaction(async client => {
    await client.query(`
      INSERT INTO classification_runs (id, classification_mode, source, execution_mode_key)
      VALUES ($1, 'preview', 'web', 'preview')
    `, [runId]);
    const projectId = await upsertProject(client, project.trim() || 'Web');
    const persisted: PreviewResult[] = [];

    for (const input of inputs) {
      const story = await client.query<{ id: string }>(`
        INSERT INTO stories (project_id, external_id, content) VALUES ($1, $2, $3)
        ON CONFLICT (project_id, external_id) DO UPDATE SET content = EXCLUDED.content, updated_at = NOW()
        RETURNING id
      `, [projectId, storyExternalId(input.text), input.text]);
      const classification = await client.query<{ id: string }>(`
        INSERT INTO classifications (
          story_id, run_id, review_status, final_confidence, uncertainty_score,
          consensus_ratio, uncertainty_band, final_decision, disagreement_cause,
          final_action, final_reason
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        RETURNING id
      `, [
        story.rows[0].id,
        runId,
        input.needsReview ? 'pending_review' : 'accepted_auto',
        input.confidence,
        1 - input.confidence,
        input.needsReview ? 0 : 1,
        input.needsReview ? 'high' : 'low',
        input.needsReview ? 'needs_human_review' : 'accept',
        input.needsReview ? 'taxonomy_gap' : null,
        input.needsReview ? 'ask_human' : 'none',
        'Pré-classificação persistida pela aplicação web.'
      ]);
      await client.query(`
        INSERT INTO classification_labels (classification_id, module, operation, position)
        VALUES ($1, $2, $3, 0)
      `, [classification.rows[0].id, input.module, input.operation]);
      persisted.push({ ...input, id: classification.rows[0].id });
    }
    return persisted;
  });
  return { runId, results };
}

export type ReviewInput = {
  classificationId: string;
  action: 'approve' | 'taxonomy_gap';
  module?: string;
  operation?: string;
  notes?: string;
};

export async function saveReview(input: ReviewInput) {
  return withTransaction(async client => {
    const current = await client.query<{ id: string; review_status: string }>(
      'SELECT id::text, review_status FROM classifications WHERE id = $1 FOR UPDATE',
      [input.classificationId]
    );
    if (!current.rows[0]) return null;
    if (!['pending_review', 'taxonomy_gap', 'needs_rewrite'].includes(current.rows[0].review_status)) {
      return { id: input.classificationId, status: current.rows[0].review_status, notReviewable: true as const };
    }

    const user = await client.query<{ id: string; display_name: string }>(`
      SELECT user_account.id::text, user_account.display_name
      FROM application_settings settings
      JOIN app_users user_account ON user_account.id = settings.default_user_id
      WHERE settings.singleton
    `);
    if (!user.rows[0]) throw new Error('Usuário padrão não configurado.');

    if (input.action === 'approve') {
      const module = input.module?.trim() || 'n/a';
      const operation = input.operation?.trim() || 'n/a';
      if (module !== 'n/a' || operation !== 'n/a') {
        const valid = await client.query(`
          SELECT 1
          FROM taxonomy_versions version
          JOIN taxonomy_modules taxonomy_module ON taxonomy_module.taxonomy_version_id = version.id
          JOIN taxonomy_operations taxonomy_operation ON taxonomy_operation.module_id = taxonomy_module.id
          WHERE version.is_active AND taxonomy_operation.is_active
            AND taxonomy_module.name = $1 AND taxonomy_operation.name = $2
        `, [module, operation]);
        if (!valid.rowCount) throw new Error('Módulo e operação não pertencem à taxonomia ativa.');
      }
      await client.query(`
        UPDATE classifications SET
          review_status = 'reviewed', final_decision = 'accept', final_action = 'none',
          disagreement_cause = 'annotation_error_suspected',
          final_reason = 'Decisão final definida pela revisão humana na aplicação web.',
          notes_for_human = NULL, updated_at = NOW()
        WHERE id = $1
      `, [input.classificationId]);
      await client.query('DELETE FROM classification_labels WHERE classification_id = $1', [input.classificationId]);
      await client.query(`
        INSERT INTO classification_labels (classification_id, module, operation, position)
        VALUES ($1, $2, $3, 0)
      `, [input.classificationId, module, operation]);
      await client.query(`
        INSERT INTO review_decisions (
          classification_id, user_id, reviewer, action, outcome, notes
        ) VALUES ($1, $2, $3, 'approve', 'manual_classification_applied', $4)
      `, [input.classificationId, user.rows[0].id, user.rows[0].display_name, input.notes?.trim() || null]);
    } else {
      await client.query(`
        UPDATE classifications SET
          review_status = 'taxonomy_gap', final_decision = 'needs_human_review',
          final_action = 'extend_taxonomy', disagreement_cause = 'taxonomy_gap',
          updated_at = NOW()
        WHERE id = $1
      `, [input.classificationId]);
      await client.query(`
        INSERT INTO review_decisions (
          classification_id, user_id, reviewer, action, outcome, queue_status, notes
        ) VALUES ($1, $2, $3, 'taxonomy_gap', 'kept_for_human_queue', 'taxonomy_gap', $4)
      `, [input.classificationId, user.rows[0].id, user.rows[0].display_name, input.notes?.trim() || null]);
    }
    return { id: input.classificationId, status: input.action === 'approve' ? 'reviewed' : 'taxonomy_gap' };
  });
}
