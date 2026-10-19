import { createHash, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { FallbackSuggestion, ProviderVote } from '../domain/models.js';
import { withTransaction } from '../database/pool.js';
import { applyTaxonomyExpansion } from '../repositories/data-repository.js';
import { emptyProjectResearchProfile } from './research-inputs.js';
import type { ClassificationLabel, ClassificationProvenance } from '../domain/classification.js';
import { canonicalLabels } from './classification-policy.js';
import { copyPreparedStoryDetails, lockPreparedStory, type SavedStoryTarget } from './story-preparation.js';

export type PreviewResult = {
  id: string;
  text: string;
  module: string;
  operation: string;
  labels: ClassificationLabel[];
  confidence: number;
  needsReview: boolean;
};

export type ClassificationInput = Omit<PreviewResult, 'id'> & {
  provenance: ClassificationProvenance;
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
        classification_id, provider, position, status, error, confidence, rationale, needs_review, requested_model, model
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING id
    `, [
      classificationId,
      vote.provider,
      position,
      vote.status,
      vote.error ?? null,
      vote.confidence ?? null,
      vote.rationale ?? null,
      vote.needsReview,
      vote.requestedModel ?? null,
      vote.model ?? null
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

export async function savePreviewClassifications(project: string, sprint: string, inputs: PreviewInput[], taxonomyVersion: string, executionMode: 'preview' | 'committee' = 'preview', savedTarget?: SavedStoryTarget) {
  if (savedTarget && inputs.length !== 1) throw new Error('A saved-story classification requires exactly one input.');
  if (!inputs.length || inputs.some(input => input.provenance.input.text !== input.text || input.provenance.taxonomy.version !== taxonomyVersion
    || input.provenance.engine !== inputs[0].provenance.engine || input.provenance.policyVersion !== inputs[0].provenance.policyVersion
    || input.provenance.promptVersion !== inputs[0].provenance.promptVersion)) {
    throw new Error('A execução requer entradas e proveniência compatíveis com o mesmo motor, política, prompt e taxonomia.');
  }
  const runId = `${executionMode}_${randomUUID().replaceAll('-', '')}`;
  const results = await withTransaction(async client => {
    await client.query(`
      INSERT INTO classification_runs (id, classification_mode, source, execution_mode_key, taxonomy_version, prompt_version, policy_version)
      VALUES ($1, $2, 'web', $2, $3, $4, $5)
    `, [runId, executionMode, taxonomyVersion, inputs[0]?.provenance.promptVersion ?? null, inputs[0]?.provenance.policyVersion ?? null]);
    const projectId = await upsertProject(client, project.trim() || 'Web');
    await client.query(`
      INSERT INTO project_research_profiles (project_id, content) VALUES ($1, $2::jsonb)
      ON CONFLICT (project_id) DO UPDATE SET
        content = jsonb_set(project_research_profiles.content, '{taxonomyVersion}', to_jsonb($3::text), true),
        updated_at = NOW()
    `, [projectId, JSON.stringify({ ...emptyProjectResearchProfile(), taxonomyVersion }), taxonomyVersion]);
    const sprintId = await upsertSprint(client, projectId, sprint.trim() || 'Backlog');
    const persisted: PreviewResult[] = [];

    for (const input of inputs) {
      const decision = input.provenance.decision;
      const story = savedTarget ? { rows: [await lockPreparedStory(client, savedTarget, input.text, projectId)] } : await client.query<{ id: string }>(`
        INSERT INTO stories (project_id, sprint_id, external_id, content) VALUES ($1, $2, $3, $4)
        ON CONFLICT (project_id, external_id) DO UPDATE SET sprint_id = EXCLUDED.sprint_id, content = EXCLUDED.content, updated_at = NOW()
        RETURNING id
      `, [projectId, sprintId, storyExternalId(input.text), input.text]);
      const previous = await client.query<{ id: string }>(
        'SELECT id::text FROM classifications WHERE story_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1',
        [story.rows[0].id]
      );
      const classification = await client.query<{ id: string }>(`
        INSERT INTO classifications (
          story_id, run_id, review_status, final_confidence, uncertainty_score,
          consensus_ratio, uncertainty_band, final_decision, disagreement_cause,
          final_action, final_reason, notes_for_human, taxonomy_version, prompt_version, policy_version
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        RETURNING id
      `, [
        story.rows[0].id,
        runId,
        decision.needsReview ? 'pending_review' : 'accepted_auto',
        decision.confidence,
        decision.uncertainty?.score ?? 0,
        decision.consensusRatio ?? 0,
        decision.uncertainty?.band ?? null,
        decision.needsReview ? 'needs_human_review' : 'accept',
        input.disagreementCause ?? null,
        input.finalAction ?? (decision.needsReview ? 'ask_human' : 'none'),
        decision.reason,
        input.notesForHuman ?? null,
        taxonomyVersion,
        input.provenance.promptVersion,
        input.provenance.policyVersion
      ]);
      const classificationId = classification.rows[0].id;
      if (previous.rows[0]) {
        const previousId = previous.rows[0].id;
        await client.query(`INSERT INTO story_tasks (classification_id, title, is_done, position, category, technologies)
          SELECT $1, title, is_done, position, category, technologies FROM story_tasks WHERE classification_id = $2`, [classificationId, previousId]);
        await client.query(`INSERT INTO story_functional_requirements (classification_id, description, position)
          SELECT $1, description, position FROM story_functional_requirements WHERE classification_id = $2`, [classificationId, previousId]);
        await client.query(`INSERT INTO story_non_functional_requirements (classification_id, description, nfr_type, metric, position)
          SELECT $1, description, nfr_type, metric, position FROM story_non_functional_requirements WHERE classification_id = $2`, [classificationId, previousId]);
      } else if (savedTarget) {
        await copyPreparedStoryDetails(client, story.rows[0].id, classificationId);
      }
      for (const [position, label] of decision.labels.entries()) {
        await client.query(`INSERT INTO classification_labels (classification_id, module, operation, position)
          VALUES ($1, $2, $3, $4)`, [classificationId, label.module, label.operation, position]);
      }
      await client.query('INSERT INTO classification_provenance (classification_id, payload) VALUES ($1, $2::jsonb)',
        [classificationId, JSON.stringify(input.provenance)]);
      await saveProviderVotes(client, classificationId, input.providerVotes);
      await saveFallbackSuggestions(client, classificationId, input.fallbackSuggestions);
      persisted.push({
        id: classificationId,
        text: input.text,
        module: decision.labels[0].module,
        operation: decision.labels[0].operation,
        labels: decision.labels,
        confidence: decision.confidence,
        needsReview: decision.needsReview
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
  labels?: ClassificationLabel[];
  notes?: string;
};

export class ReviewValidationError extends Error {}

async function loadDefaultReviewer(client: PoolClient) {
  const user = await client.query<{ id: string; display_name: string }>(`
    SELECT user_account.id::text, user_account.display_name
    FROM application_settings settings
    JOIN app_users user_account ON user_account.id = settings.default_user_id
    WHERE settings.singleton
  `);
  if (!user.rows[0]) throw new Error('No default user is configured.');
  return user.rows[0];
}

async function persistTaxonomyFeedback(
  client: PoolClient,
  classificationId: string,
  reviewer: string,
  feedback: TaxonomyFeedbackInput,
  status: 'applied' | 'needs_clarification'
) {
  const saved = await client.query<{ id: string; status: string }>(`
    INSERT INTO taxonomy_feedback (
      classification_id, reviewer, proposal_type, proposed_domain, target_domain,
      proposed_module, target_module, proposed_operation, justification, status
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
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
    feedback.justification.trim(),
    status
  ]);
  return saved.rows[0];
}

export async function saveTaxonomyFeedback(classificationId: string, feedback: TaxonomyFeedbackInput) {
  return withTransaction(async client => {
    const classification = await client.query('SELECT 1 FROM classifications WHERE id = $1 FOR UPDATE', [classificationId]);
    if (!classification.rowCount) return null;
    const user = await loadDefaultReviewer(client);
    const status = await applyTaxonomyExpansion(client, feedback);
    return persistTaxonomyFeedback(client, classificationId, user.display_name, feedback, status);
  });
}

export async function applySavedTaxonomyFeedback(feedbackId: string) {
  return withTransaction(async client => {
    const feedback = await client.query<{
      proposal_type: TaxonomyFeedbackInput['proposalType'];
      proposed_domain: string | null;
      target_domain: string | null;
      proposed_module: string | null;
      target_module: string | null;
      proposed_operation: string | null;
      justification: string;
      status: string;
    }>(`
      SELECT proposal_type, proposed_domain, target_domain, proposed_module, target_module,
        proposed_operation, justification, status
      FROM taxonomy_feedback
      WHERE id = $1 FOR UPDATE
    `, [feedbackId]);
    const item = feedback.rows[0];
    if (!item) return null;
    if (item.status === 'applied') return { status: 'already_applied' as const };
    if (item.proposal_type === 'clarify_story') return { status: 'not_actionable' as const };
    await applyTaxonomyExpansion(client, {
      proposalType: item.proposal_type,
      proposedDomain: item.proposed_domain ?? undefined,
      targetDomain: item.target_domain ?? undefined,
      proposedModule: item.proposed_module ?? undefined,
      targetModule: item.target_module ?? undefined,
      proposedOperation: item.proposed_operation ?? undefined,
      justification: item.justification
    });
    await client.query("UPDATE taxonomy_feedback SET status = 'applied' WHERE id = $1", [feedbackId]);
    return { status: 'applied' as const };
  });
}

export async function saveReview(input: ReviewInput) {
  return withTransaction(async client => {
    const current = await client.query<{ id: string; review_status: string; taxonomy_version: string; has_not_covered_label: boolean; snapshot: Record<string, unknown> }>(
      `SELECT classification.id::text, classification.review_status, COALESCE(classification.taxonomy_version, '') AS taxonomy_version,
        EXISTS (
          SELECT 1 FROM classification_labels label
          WHERE label.classification_id = classification.id
            AND (label.module = 'n/a' OR label.operation = 'n/a')
        ) AS has_not_covered_label, to_jsonb(classification) || jsonb_build_object('id', classification.id::text, 'story_id', classification.story_id::text) AS snapshot
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
    const previous = await client.query<ClassificationLabel>('SELECT module, operation FROM classification_labels WHERE classification_id = $1 ORDER BY position', [input.classificationId]);
    const before = { ...current.rows[0].snapshot, labels: previous.rows };

    if (input.action === 'approve') {
      if (!input.labels && previous.rows.length > 1) throw new ReviewValidationError('Envie a lista completa de pares para revisar uma classificação multi-label.');
      const labels = canonicalLabels(input.labels ?? [{ module: input.module ?? '', operation: input.operation ?? '' }]);
      if (labels.length > 8 || labels.some(label => label.module === 'n/a' || label.operation === 'n/a')) {
        throw new ReviewValidationError('Aprovação requer de um a oito pares válidos da taxonomia.');
      }
      for (const { module, operation } of labels) {
        const valid = await client.query(`
        SELECT 1
        FROM taxonomy_versions version
        JOIN taxonomy_modules taxonomy_module ON taxonomy_module.taxonomy_version_id = version.id
        JOIN taxonomy_operations taxonomy_operation ON taxonomy_operation.module_id = taxonomy_module.id
        WHERE version.is_active AND taxonomy_operation.is_active
          AND ($3 = '' OR version.version = $3)
          AND taxonomy_module.name = $1 AND taxonomy_operation.name = $2
      `, [module, operation, current.rows[0].taxonomy_version]);
        if (!valid.rowCount) throw new ReviewValidationError('The module and operation do not belong to the active taxonomy.');
      }
      await client.query(`
        UPDATE classifications SET
          review_status = 'reviewed', final_decision = 'accept', final_action = 'none',
          disagreement_cause = 'annotation_error_suspected',
          final_reason = 'Final decision set through human review in the web application.',
          notes_for_human = NULL, updated_at = NOW()
        WHERE id = $1
      `, [input.classificationId]);
      await client.query('DELETE FROM classification_labels WHERE classification_id = $1', [input.classificationId]);
      for (const [position, label] of labels.entries()) {
        await client.query(`INSERT INTO classification_labels (classification_id, module, operation, position)
          VALUES ($1, $2, $3, $4)`, [input.classificationId, label.module, label.operation, position]);
      }
    } else {
      await client.query(`
        UPDATE classifications SET
          review_status = 'taxonomy_gap', final_decision = 'needs_human_review',
          final_action = 'extend_taxonomy', disagreement_cause = 'taxonomy_gap',
          updated_at = NOW()
        WHERE id = $1
      `, [input.classificationId]);
    }
    const after = await client.query<{ snapshot: Record<string, unknown> }>(`SELECT to_jsonb(classification) || jsonb_build_object('id', classification.id::text, 'story_id', classification.story_id::text) AS snapshot
      FROM classifications classification WHERE id = $1`, [input.classificationId]);
    const afterLabels = await client.query<ClassificationLabel>('SELECT module, operation FROM classification_labels WHERE classification_id = $1 ORDER BY position', [input.classificationId]);
    await client.query(`INSERT INTO review_decisions
      (classification_id, user_id, reviewer, action, outcome, queue_status, notes, before_snapshot, after_snapshot)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb)`, [input.classificationId, user.id, user.display_name,
      input.action, input.action === 'approve' ? 'manual_classification_applied' : 'kept_for_human_queue',
      input.action === 'taxonomy_gap' ? 'taxonomy_gap' : null, input.notes?.trim() || null,
      JSON.stringify(before), JSON.stringify({ ...after.rows[0].snapshot, labels: afterLabels.rows })]);
    return { id: input.classificationId, status: input.action === 'approve' ? 'reviewed' : 'taxonomy_gap' };
  });
}
