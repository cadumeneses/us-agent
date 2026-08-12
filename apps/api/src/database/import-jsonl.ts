import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { createInterface } from 'node:readline';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { PoolClient } from 'pg';
import { pool } from './pool.js';

type Label = { module?: string; operation?: string };
type ProviderStatus = { provider?: string; status?: string; error?: string | null };
type Vote = {
  provider?: string;
  rows?: Label[];
  confidence?: number;
  rationale?: string;
  evidence?: string[];
  needs_review?: boolean;
  issues?: string[];
  suggested_questions?: string[];
  fallback_suggestions?: FallbackSuggestion[];
};
type FallbackSuggestion = {
  source?: string;
  type?: 'new_domain' | 'new_operation' | 'clarify_story' | 'classification';
  proposed_domain?: string | null;
  target_module?: string | null;
  proposed_operation?: string | null;
  reason?: string;
  evidence?: string[];
};
type Attempt = {
  attempt?: number;
  reason?: string;
  aggregate?: { avg_confidence?: number; any_needs_review?: boolean };
  provider_health?: { total?: number; successful?: number; failed?: number };
  uncertainty?: {
    uncertainty_score?: number;
    band?: string;
    consensus_ratio?: number;
    disagreement_rate?: number;
    normalized_entropy?: number;
  };
};
type TaxonomyFeedback = {
  proposal_type?: string;
  proposed_domain?: string | null;
  target_module?: string | null;
  proposed_operation?: string | null;
  justification?: string;
  status?: string;
};
export type HistoricalResult = {
  story_id?: string;
  run_id?: string;
  user_story?: string;
  project?: string;
  review_status?: string;
  taxonomy_version?: string;
  prompt_version?: string;
  policy_version?: string;
  classification_mode?: string;
  votes?: Vote[];
  provider_statuses?: ProviderStatus[];
  attempts?: Attempt[];
  aggregate?: { avg_confidence?: number };
  final?: {
    final_rows?: Label[];
    final_confidence?: number;
    decision?: string;
    disagreement_cause?: string;
    why?: string;
    action?: string;
    notes_for_human?: string | null;
  };
  uncertainty?: { uncertainty_score?: number; consensus_ratio?: number; band?: string };
  auto_resolution?: { kind?: string; reason?: string; resolved_at?: string };
  fallback_suggestions?: FallbackSuggestion[];
  human_review?: {
    reviewer?: string;
    action?: string;
    outcome?: string;
    queue_status?: string;
    notes?: string | null;
    reviewed_at?: string;
    taxonomy_feedback?: TaxonomyFeedback;
  };
};

const defaultInput = fileURLToPath(new URL('../../../../runs/results.jsonl', import.meta.url));
const input = process.argv[2] ?? defaultInput;

function stableStoryId(content: string) {
  return `us_${createHash('sha256').update(content.trim().replace(/\s+/g, ' ')).digest('hex').slice(0, 16)}`;
}

async function replaceList(client: PoolClient, table: string, parentColumn: string, parentId: string, values: string[]) {
  for (const [position, content] of values.entries()) {
    await client.query(
      `INSERT INTO ${table} (${parentColumn}, position, content) VALUES ($1, $2, $3)`,
      [parentId, position, content]
    );
  }
}

async function saveFallbackSuggestions(
  client: PoolClient,
  classificationId: string,
  suggestions: Array<FallbackSuggestion & { source: string }>
) {
  await client.query('DELETE FROM classification_fallback_suggestions WHERE classification_id = $1', [classificationId]);
  for (const [position, suggestion] of suggestions.entries()) {
    if (!suggestion.type || !suggestion.reason?.trim()) continue;
    const inserted = await client.query<{ id: string }>(`
      INSERT INTO classification_fallback_suggestions (
        classification_id, source, suggestion_type, proposed_domain, target_module,
        proposed_operation, reason, position
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING id
    `, [
      classificationId,
      suggestion.source,
      suggestion.type,
      suggestion.proposed_domain ?? null,
      suggestion.target_module ?? null,
      suggestion.proposed_operation ?? null,
      suggestion.reason.trim(),
      position
    ]);
    await replaceList(client, 'classification_fallback_evidence', 'fallback_suggestion_id', inserted.rows[0].id, suggestion.evidence ?? []);
  }
}

export async function importRecord(client: PoolClient, item: HistoricalResult, index: number) {
  const projectName = item.project?.trim() || 'Unassigned';
  const content = item.user_story?.trim() || '';
  const externalStoryId = item.story_id ?? stableStoryId(content || `legacy-${index}`);
  const runId = item.run_id ?? `legacy-${externalStoryId}-${index}`;

  const project = await client.query<{ id: string }>(`
    INSERT INTO projects (name) VALUES ($1)
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
    RETURNING id
  `, [projectName]);

  await client.query(`
    INSERT INTO classification_runs (id, classification_mode, taxonomy_version, prompt_version, policy_version)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (id) DO UPDATE SET
      classification_mode = COALESCE(EXCLUDED.classification_mode, classification_runs.classification_mode),
      taxonomy_version = COALESCE(EXCLUDED.taxonomy_version, classification_runs.taxonomy_version),
      prompt_version = COALESCE(EXCLUDED.prompt_version, classification_runs.prompt_version),
      policy_version = COALESCE(EXCLUDED.policy_version, classification_runs.policy_version)
  `, [runId, item.classification_mode ?? null, item.taxonomy_version ?? null, item.prompt_version ?? null, item.policy_version ?? null]);

  const story = await client.query<{ id: string }>(`
    INSERT INTO stories (project_id, external_id, content) VALUES ($1, $2, $3)
    ON CONFLICT (project_id, external_id) DO UPDATE SET content = EXCLUDED.content, updated_at = NOW()
    RETURNING id
  `, [project.rows[0].id, externalStoryId, content]);

  const final = item.final ?? {};
  const uncertainty = item.uncertainty ?? {};
  const classification = await client.query<{ id: string }>(`
    INSERT INTO classifications (
      story_id, run_id, review_status, final_confidence, uncertainty_score, consensus_ratio,
      uncertainty_band, final_decision, disagreement_cause, final_action, final_reason,
      notes_for_human, taxonomy_version, prompt_version, policy_version,
      auto_resolution_kind, auto_resolution_reason, auto_resolved_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
    ON CONFLICT (story_id, run_id) DO UPDATE SET
      review_status = EXCLUDED.review_status,
      final_confidence = EXCLUDED.final_confidence,
      uncertainty_score = EXCLUDED.uncertainty_score,
      consensus_ratio = EXCLUDED.consensus_ratio,
      uncertainty_band = EXCLUDED.uncertainty_band,
      final_decision = EXCLUDED.final_decision,
      disagreement_cause = EXCLUDED.disagreement_cause,
      final_action = EXCLUDED.final_action,
      final_reason = EXCLUDED.final_reason,
      notes_for_human = EXCLUDED.notes_for_human,
      taxonomy_version = EXCLUDED.taxonomy_version,
      prompt_version = EXCLUDED.prompt_version,
      policy_version = EXCLUDED.policy_version,
      auto_resolution_kind = EXCLUDED.auto_resolution_kind,
      auto_resolution_reason = EXCLUDED.auto_resolution_reason,
      auto_resolved_at = EXCLUDED.auto_resolved_at,
      updated_at = NOW()
    RETURNING id
  `, [
    story.rows[0].id, runId, item.review_status ?? 'pending_review',
    final.final_confidence ?? item.aggregate?.avg_confidence ?? 0,
    uncertainty.uncertainty_score ?? 0, uncertainty.consensus_ratio ?? 0,
    uncertainty.band ?? null, final.decision ?? null, final.disagreement_cause ?? null,
    final.action ?? null, final.why ?? null, final.notes_for_human ?? null,
    item.taxonomy_version ?? null, item.prompt_version ?? null, item.policy_version ?? null,
    item.auto_resolution?.kind ?? null, item.auto_resolution?.reason ?? null,
    item.auto_resolution?.resolved_at ?? null
  ]);
  const classificationId = classification.rows[0].id;

  await client.query('DELETE FROM classification_labels WHERE classification_id = $1', [classificationId]);
  for (const [position, label] of (final.final_rows ?? []).entries()) {
    await client.query(
      'INSERT INTO classification_labels (classification_id, module, operation, position) VALUES ($1, $2, $3, $4)',
      [classificationId, label.module ?? 'n/a', label.operation ?? 'n/a', position]
    );
  }

  await client.query('DELETE FROM provider_votes WHERE classification_id = $1', [classificationId]);
  const statuses = new Map((item.provider_statuses ?? []).map(status => [status.provider, status]));
  const importedProviders = new Set<string>();
  for (const [position, vote] of (item.votes ?? []).entries()) {
    const provider = vote.provider ?? `unknown-${position}`;
    importedProviders.add(provider);
    const status = statuses.get(provider);
    const insertedVote = await client.query<{ id: string }>(`
      INSERT INTO provider_votes (classification_id, provider, position, status, error, confidence, rationale, needs_review)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id
    `, [classificationId, provider, position, status?.status ?? 'success', status?.error ?? null, vote.confidence ?? null, vote.rationale ?? null, vote.needs_review ?? false]);
    const voteId = insertedVote.rows[0].id;
    for (const [labelPosition, label] of (vote.rows ?? []).entries()) {
      await client.query(
        'INSERT INTO provider_vote_labels (vote_id, module, operation, position) VALUES ($1, $2, $3, $4)',
        [voteId, label.module ?? 'n/a', label.operation ?? 'n/a', labelPosition]
      );
    }
    await replaceList(client, 'provider_vote_evidence', 'vote_id', voteId, vote.evidence ?? []);
    await replaceList(client, 'provider_vote_issues', 'vote_id', voteId, vote.issues ?? []);
    await replaceList(client, 'provider_vote_questions', 'vote_id', voteId, vote.suggested_questions ?? []);
  }
  for (const [position, status] of (item.provider_statuses ?? []).entries()) {
    if (!status.provider || importedProviders.has(status.provider)) continue;
    await client.query(`
      INSERT INTO provider_votes (classification_id, provider, position, status, error)
      VALUES ($1, $2, $3, $4, $5)
    `, [classificationId, status.provider, position, status.status ?? 'error', status.error ?? null]);
  }

  const fallbackSuggestions: Array<FallbackSuggestion & { source: string }> = [
    ...(item.fallback_suggestions ?? []).map(suggestion => ({ ...suggestion, source: suggestion.source ?? 'arbiter' })),
    ...(item.votes ?? []).flatMap((vote, position) =>
      (vote.fallback_suggestions ?? []).map(suggestion => ({ ...suggestion, source: suggestion.source ?? vote.provider ?? `unknown-${position}` }))
    )
  ];
  await saveFallbackSuggestions(client, classificationId, fallbackSuggestions);

  await client.query('DELETE FROM classification_attempts WHERE classification_id = $1', [classificationId]);
  for (const [position, attempt] of (item.attempts ?? []).entries()) {
    await client.query(`
      INSERT INTO classification_attempts (
        classification_id, attempt, reason, average_confidence, any_needs_review,
        providers_total, providers_successful, providers_failed, uncertainty_score,
        uncertainty_band, consensus_ratio, disagreement_rate, normalized_entropy
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
    `, [
      classificationId, attempt.attempt ?? position + 1, attempt.reason ?? null,
      attempt.aggregate?.avg_confidence ?? null, attempt.aggregate?.any_needs_review ?? false,
      attempt.provider_health?.total ?? 0, attempt.provider_health?.successful ?? 0,
      attempt.provider_health?.failed ?? 0, attempt.uncertainty?.uncertainty_score ?? null,
      attempt.uncertainty?.band ?? null, attempt.uncertainty?.consensus_ratio ?? null,
      attempt.uncertainty?.disagreement_rate ?? null, attempt.uncertainty?.normalized_entropy ?? null
    ]);
  }

  await client.query('DELETE FROM review_decisions WHERE classification_id = $1', [classificationId]);
  await client.query('DELETE FROM taxonomy_feedback WHERE classification_id = $1', [classificationId]);
  const review = item.human_review;
  if (review?.reviewer && review.action) {
    await client.query(`
      INSERT INTO review_decisions (classification_id, reviewer, action, outcome, queue_status, notes, reviewed_at)
      VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7, NOW()))
    `, [classificationId, review.reviewer, review.action, review.outcome ?? null, review.queue_status ?? null, review.notes ?? null, review.reviewed_at ?? null]);
  }
  if (review?.taxonomy_feedback?.proposal_type) {
    const feedback = review.taxonomy_feedback;
    await client.query(`
      INSERT INTO taxonomy_feedback (
          classification_id, reviewer, proposal_type, target_module, proposed_operation,
        proposed_domain, justification, status, created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9, NOW()))
    `, [classificationId, review.reviewer ?? null, feedback.proposal_type, feedback.target_module ?? null, feedback.proposed_operation ?? null, feedback.proposed_domain ?? null, feedback.justification ?? '', feedback.status ?? 'pending_taxonomy_board', review.reviewed_at ?? null]);
  }
  return classificationId;
}

async function run() {
  const client = await pool.connect();
  let imported = 0;
  let skipped = 0;
  try {
    const lines = createInterface({ input: createReadStream(input, 'utf8'), crlfDelay: Infinity });
    for await (const line of lines) {
      if (!line.trim()) continue;
      try {
        const item = JSON.parse(line) as HistoricalResult;
        await client.query('BEGIN');
        await importRecord(client, item, imported + skipped);
        await client.query('COMMIT');
        imported += 1;
      } catch (error) {
        await client.query('ROLLBACK');
        skipped += 1;
        console.error(`Skipped line ${imported + skipped}:`, error);
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
  console.log(`Import complete: ${imported} imported, ${skipped} skipped from ${input}`);
  if (skipped) process.exitCode = 1;
}

const isDirectExecution = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  run().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
