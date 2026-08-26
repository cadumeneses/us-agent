import { createHash, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { FallbackSuggestion, ProviderVote } from '../domain/models.js';
import { withTransaction } from '../database/pool.js';

export type PreviewResult = {
  id: string;
  text: string;
  module: string;
  operation: string;
  confidence: number;
  needsReview: boolean;
};

export type ClassificationInput = Omit<PreviewResult, 'id'> & {
  finalReason?: string;
  notesForHuman?: string;
  disagreementCause?: string;
  finalAction?: string;
  providerVotes?: ProviderVote[];
  fallbackSuggestions?: FallbackSuggestion[];
};

type PreviewInput = ClassificationInput;

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

async function upsertSprint(client: PoolClient, projectId: string, name: string) {
  const result = await client.query<{ id: string }>(`
    INSERT INTO project_sprints (project_id, name, status) VALUES ($1, $2, 'planning')
    ON CONFLICT (project_id, name) DO UPDATE SET name = EXCLUDED.name
    RETURNING id
  `, [projectId, name]);
  return result.rows[0].id;
}

async function saveProviderVotes(client: PoolClient, classificationId: string, votes: ProviderVote[] = []) {
  for (const [position, vote] of votes.entries()) {
    const inserted = await client.query<{ id: string }>(`
      INSERT INTO provider_votes (
        classification_id, provider, position, status, error, confidence, rationale, needs_review
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING id
    `, [
      classificationId,
      vote.provider,
      position,
      vote.status,
      vote.error ?? null,
      vote.confidence ?? null,
      vote.rationale ?? null,
      vote.needsReview
    ]);
    const voteId = inserted.rows[0].id;
    for (const [labelPosition, row] of vote.rows.entries()) {
      await client.query(
        'INSERT INTO provider_vote_labels (vote_id, module, operation, position) VALUES ($1,$2,$3,$4)',
        [voteId, row.module, row.operation, labelPosition]
      );
    }
    for (const [evidencePosition, evidence] of vote.evidence.entries()) {
      await client.query(
        'INSERT INTO provider_vote_evidence (vote_id, position, content) VALUES ($1,$2,$3)',
        [voteId, evidencePosition, evidence]
      );
    }
    for (const [issuePosition, issue] of vote.issues.entries()) {
      await client.query(
        'INSERT INTO provider_vote_issues (vote_id, position, content) VALUES ($1,$2,$3)',
        [voteId, issuePosition, issue]
      );
    }
    for (const [questionPosition, question] of vote.suggestedQuestions.entries()) {
      await client.query(
        'INSERT INTO provider_vote_questions (vote_id, position, content) VALUES ($1,$2,$3)',
        [voteId, questionPosition, question]
      );
    }
  }
}

async function saveFallbackSuggestions(client: PoolClient, classificationId: string, suggestions: FallbackSuggestion[] = []) {
  for (const [position, suggestion] of suggestions.entries()) {
    const inserted = await client.query<{ id: string }>(`
      INSERT INTO classification_fallback_suggestions (
        classification_id, source, suggestion_type, proposed_domain, target_domain,
        proposed_module, target_module, proposed_operation, reason, position
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING id
    `, [
      classificationId,
      suggestion.source,
      suggestion.type,
      suggestion.proposedDomain ?? null,
      suggestion.targetDomain ?? null,
      suggestion.proposedModule ?? null,
      suggestion.targetModule ?? null,
      suggestion.proposedOperation ?? null,
      suggestion.reason,
      position
    ]);
    for (const [evidencePosition, evidence] of (suggestion.evidence ?? []).entries()) {
      await client.query(
        'INSERT INTO classification_fallback_evidence (fallback_suggestion_id, position, content) VALUES ($1,$2,$3)',
        [inserted.rows[0].id, evidencePosition, evidence]
      );
    }
  }
}

export async function savePreviewClassifications(project: string, sprint: string, inputs: PreviewInput[], executionMode: 'preview' | 'committee' = 'preview') {
  const runId = `${executionMode}_${randomUUID().replaceAll('-', '')}`;
  const results = await withTransaction(async client => {
    await client.query(`
      INSERT INTO classification_runs (id, classification_mode, source, execution_mode_key)
      VALUES ($1, $2, 'web', $2)
    `, [runId, executionMode]);
    const projectId = await upsertProject(client, project.trim() || 'Web');
    const sprintId = await upsertSprint(client, projectId, sprint.trim() || 'Backlog');
    const persisted: PreviewResult[] = [];

    for (const input of inputs) {
      const story = await client.query<{ id: string }>(`
        INSERT INTO stories (project_id, sprint_id, external_id, content) VALUES ($1, $2, $3, $4)
        ON CONFLICT (project_id, external_id) DO UPDATE SET sprint_id = EXCLUDED.sprint_id, content = EXCLUDED.content, updated_at = NOW()
        RETURNING id
      `, [projectId, sprintId, storyExternalId(input.text), input.text]);
      const classification = await client.query<{ id: string }>(`
        INSERT INTO classifications (
          story_id, run_id, review_status, final_confidence, uncertainty_score,
          consensus_ratio, uncertainty_band, final_decision, disagreement_cause,
          final_action, final_reason, notes_for_human
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
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
        input.disagreementCause ?? (input.needsReview ? 'taxonomy_gap' : null),
        input.finalAction ?? (input.needsReview ? 'ask_human' : 'none'),
        input.finalReason ?? 'Pré-classificação persistida pela aplicação web.',
        input.notesForHuman ?? null
      ]);
      const classificationId = classification.rows[0].id;
      await client.query(`
        INSERT INTO classification_labels (classification_id, module, operation, position)
        VALUES ($1, $2, $3, 0)
      `, [classificationId, input.module, input.operation]);
      await saveProviderVotes(client, classificationId, input.providerVotes);
      await saveFallbackSuggestions(client, classificationId, input.fallbackSuggestions);
      persisted.push({
        id: classificationId,
        text: input.text,
        module: input.module,
        operation: input.operation,
        confidence: input.confidence,
        needsReview: input.needsReview
      });
    }
    return persisted;
  });
  return { runId, results };
}

export type TaxonomyFeedbackInput = {
  proposalType: 'new_domain' | 'new_module' | 'new_operation' | 'clarify_story';
  proposedDomain?: string;
  targetDomain?: string;
  proposedModule?: string;
  targetModule?: string;
  proposedOperation?: string;
  justification: string;
};

export type ReviewInput = {
  classificationId: string;
  action: 'approve' | 'taxonomy_gap';
  module?: string;
  operation?: string;
  notes?: string;
};

async function loadDefaultReviewer(client: PoolClient) {
  const user = await client.query<{ id: string; display_name: string }>(`
    SELECT user_account.id::text, user_account.display_name
    FROM application_settings settings
    JOIN app_users user_account ON user_account.id = settings.default_user_id
    WHERE settings.singleton
  `);
  if (!user.rows[0]) throw new Error('Usuário padrão não configurado.');
  return user.rows[0];
}

async function persistTaxonomyFeedback(
  client: PoolClient,
  classificationId: string,
  reviewer: string,
  feedback: TaxonomyFeedbackInput
) {
  const saved = await client.query<{ id: string; status: string }>(`
    INSERT INTO taxonomy_feedback (
      classification_id, reviewer, proposal_type, proposed_domain, target_domain,
      proposed_module, target_module, proposed_operation, justification, status
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending_taxonomy_board')
    RETURNING id::text, status
  `, [
    classificationId,
    reviewer,
    feedback.proposalType,
    feedback.proposedDomain?.trim() || null,
    feedback.targetDomain?.trim() || null,
    feedback.proposedModule?.trim() || null,
    feedback.targetModule?.trim() || null,
    feedback.proposedOperation?.trim() || null,
    feedback.justification.trim()
  ]);
  return saved.rows[0];
}

export async function saveTaxonomyFeedback(classificationId: string, feedback: TaxonomyFeedbackInput) {
  return withTransaction(async client => {
    const classification = await client.query('SELECT 1 FROM classifications WHERE id = $1 FOR UPDATE', [classificationId]);
    if (!classification.rowCount) return null;
    const user = await loadDefaultReviewer(client);
    return persistTaxonomyFeedback(client, classificationId, user.display_name, feedback);
  });
}

export async function saveReview(input: ReviewInput) {
  return withTransaction(async client => {
    const current = await client.query<{ id: string; review_status: string; has_not_covered_label: boolean }>(
      `SELECT classification.id::text, classification.review_status,
        EXISTS (
          SELECT 1 FROM classification_labels label
          WHERE label.classification_id = classification.id
            AND (label.module = 'n/a' OR label.operation = 'n/a')
        ) AS has_not_covered_label
      FROM classifications classification
      WHERE classification.id = $1 FOR UPDATE`,
      [input.classificationId]
    );
    if (!current.rows[0]) return null;
    const isRecoverableApproval = current.rows[0].review_status === 'reviewed' && current.rows[0].has_not_covered_label;
    if (!['pending_review', 'taxonomy_gap', 'needs_rewrite'].includes(current.rows[0].review_status) && !isRecoverableApproval) {
      return { id: input.classificationId, status: current.rows[0].review_status, notReviewable: true as const };
    }

    const user = await loadDefaultReviewer(client);

    if (input.action === 'approve') {
      const module = input.module?.trim() || 'n/a';
      const operation = input.operation?.trim() || 'n/a';
      if (module === 'n/a' || operation === 'n/a') throw new Error('Aprovação requer um módulo e uma operação da taxonomia ativa.');
      const valid = await client.query(`
        SELECT 1
        FROM taxonomy_versions version
        JOIN taxonomy_modules taxonomy_module ON taxonomy_module.taxonomy_version_id = version.id
        JOIN taxonomy_operations taxonomy_operation ON taxonomy_operation.module_id = taxonomy_module.id
        WHERE version.is_active AND taxonomy_operation.is_active
          AND taxonomy_module.name = $1 AND taxonomy_operation.name = $2
      `, [module, operation]);
      if (!valid.rowCount) throw new Error('Módulo e operação não pertencem à taxonomia ativa.');
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
      `, [input.classificationId, user.id, user.display_name, input.notes?.trim() || null]);
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
      `, [input.classificationId, user.id, user.display_name, input.notes?.trim() || null]);
    }
    return { id: input.classificationId, status: input.action === 'approve' ? 'reviewed' : 'taxonomy_gap' };
  });
}
