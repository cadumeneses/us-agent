import type { FallbackSuggestion, ProviderVote, ReviewContext, Story, Taxonomy } from '../domain/models.js';
import type { PoolClient } from 'pg';
import { query, withTransaction } from '../database/pool.js';

type StoryRow = {
  id: string;
  text: string;
  project: string;
  module: string;
  operation: string;
  confidence: number;
  uncertainty: number;
  consensus: number;
  status: string;
};

export async function loadStories(): Promise<Story[]> {
  const result = await query<StoryRow>(`
    SELECT
      classification.id::text AS id,
      story.content AS text,
      project.name AS project,
      COALESCE(label.module, 'n/a') AS module,
      COALESCE(label.operation, 'n/a') AS operation,
      classification.final_confidence AS confidence,
      classification.uncertainty_score AS uncertainty,
      classification.consensus_ratio AS consensus,
      classification.review_status AS status
    FROM classifications classification
    JOIN stories story ON story.id = classification.story_id
    JOIN projects project ON project.id = story.project_id
    LEFT JOIN LATERAL (
      SELECT module, operation
      FROM classification_labels
      WHERE classification_id = classification.id
      ORDER BY position
      LIMIT 1
    ) label ON TRUE
    ORDER BY classification.created_at DESC, classification.id DESC
  `);
  return result.rows.map(row => ({ ...row, confidence: Number(row.confidence), uncertainty: Number(row.uncertainty), consensus: Number(row.consensus) }));
}

export async function loadReviewContext(classificationId: string): Promise<ReviewContext | null> {
  const classification = await query<{
    final_reason: string | null;
    notes_for_human: string | null;
    disagreement_cause: string | null;
    final_action: string | null;
  }>(`
    SELECT final_reason, notes_for_human, disagreement_cause, final_action
    FROM classifications WHERE id = $1
  `, [classificationId]);
  if (!classification.rows[0]) return null;

  const voteResult = await query<{
    id: string;
    provider: string;
    status: string;
    error: string | null;
    confidence: number | null;
    rationale: string | null;
    needs_review: boolean;
  }>(`
    SELECT id::text, provider, status, error, confidence, rationale, needs_review
    FROM provider_votes WHERE classification_id = $1 ORDER BY position, id
  `, [classificationId]);
  const voteIds = voteResult.rows.map(row => row.id);
  const votesById = new Map<string, ProviderVote>(voteResult.rows.map(row => [row.id, {
    provider: row.provider,
    status: row.status,
    error: row.error ?? undefined,
    confidence: row.confidence === null ? undefined : Number(row.confidence),
    rationale: row.rationale ?? undefined,
    needsReview: row.needs_review,
    rows: [],
    evidence: [],
    issues: [],
    suggestedQuestions: []
  }]));

  if (voteIds.length) {
    const [labels, evidence, issues, questions] = await Promise.all([
      query<{ vote_id: string; module: string; operation: string }>(`
        SELECT vote_id::text, module, operation FROM provider_vote_labels
        WHERE vote_id = ANY($1::bigint[]) ORDER BY position
      `, [voteIds]),
      query<{ vote_id: string; content: string }>(`
        SELECT vote_id::text, content FROM provider_vote_evidence
        WHERE vote_id = ANY($1::bigint[]) ORDER BY position
      `, [voteIds]),
      query<{ vote_id: string; content: string }>(`
        SELECT vote_id::text, content FROM provider_vote_issues
        WHERE vote_id = ANY($1::bigint[]) ORDER BY position
      `, [voteIds]),
      query<{ vote_id: string; content: string }>(`
        SELECT vote_id::text, content FROM provider_vote_questions
        WHERE vote_id = ANY($1::bigint[]) ORDER BY position
      `, [voteIds])
    ]);
    labels.rows.forEach(row => votesById.get(row.vote_id)?.rows.push({ module: row.module, operation: row.operation }));
    evidence.rows.forEach(row => votesById.get(row.vote_id)?.evidence.push(row.content));
    issues.rows.forEach(row => votesById.get(row.vote_id)?.issues.push(row.content));
    questions.rows.forEach(row => votesById.get(row.vote_id)?.suggestedQuestions.push(row.content));
  }

  const suggestionResult = await query<{
    id: string;
    source: string;
    suggestion_type: FallbackSuggestion['type'];
    proposed_domain: string | null;
    target_domain: string | null;
    proposed_module: string | null;
    target_module: string | null;
    proposed_operation: string | null;
    reason: string;
    applied_at: string | null;
  }>(`
    SELECT id::text, source, suggestion_type, proposed_domain, target_domain, proposed_module, target_module, proposed_operation, reason, applied_at
    FROM classification_fallback_suggestions
    WHERE classification_id = $1 ORDER BY position, id
  `, [classificationId]);
  const suggestionIds = suggestionResult.rows.map(row => row.id);
  const evidenceBySuggestion = new Map<string, string[]>();
  if (suggestionIds.length) {
    const evidence = await query<{ fallback_suggestion_id: string; content: string }>(`
      SELECT fallback_suggestion_id::text, content FROM classification_fallback_evidence
      WHERE fallback_suggestion_id = ANY($1::bigint[]) ORDER BY position
    `, [suggestionIds]);
    evidence.rows.forEach(row => {
      const items = evidenceBySuggestion.get(row.fallback_suggestion_id) ?? [];
      items.push(row.content);
      evidenceBySuggestion.set(row.fallback_suggestion_id, items);
    });
  }

  return {
    final: {
      reason: classification.rows[0].final_reason ?? undefined,
      notesForHuman: classification.rows[0].notes_for_human ?? undefined,
      disagreementCause: classification.rows[0].disagreement_cause ?? undefined,
      action: classification.rows[0].final_action ?? undefined
    },
    suggestions: suggestionResult.rows.map(row => ({
      id: row.id,
      source: row.source,
      type: row.suggestion_type,
      proposedDomain: row.proposed_domain ?? undefined,
      targetDomain: row.target_domain ?? undefined,
      proposedModule: row.proposed_module ?? undefined,
      targetModule: row.target_module ?? undefined,
      proposedOperation: row.proposed_operation ?? undefined,
      reason: row.reason,
      evidence: evidenceBySuggestion.get(row.id) ?? [],
      appliedAt: row.applied_at ?? undefined
    })),
    votes: voteResult.rows.map(row => votesById.get(row.id)!).filter(Boolean)
  };
}

export async function loadTaxonomy(versionFilter?: string): Promise<Taxonomy> {
  const versions = await query<{ version: string; active: boolean; modules: number; operations: number }>(`
    SELECT version, is_active AS active,
      (SELECT COUNT(*)::int FROM taxonomy_modules WHERE taxonomy_version_id = taxonomy_versions.id) AS modules,
      (SELECT COUNT(*)::int FROM taxonomy_operations operation JOIN taxonomy_modules module ON module.id = operation.module_id WHERE module.taxonomy_version_id = taxonomy_versions.id) AS operations
    FROM taxonomy_versions ORDER BY created_at
  `);
  const result = await query<{
    version: string;
    domain: string;
    domain_description: string;
    module: string | null;
    operation: string | null;
    description: string | null;
  }>(`
    SELECT version.version, domain.name AS domain, domain.description AS domain_description,
      module.name AS module, operation.name AS operation, operation.description
    FROM taxonomy_versions version
    JOIN taxonomy_domains domain ON domain.taxonomy_version_id = version.id
    LEFT JOIN taxonomy_modules module ON module.domain_id = domain.id
    LEFT JOIN taxonomy_operations operation ON operation.module_id = module.id AND operation.is_active
    WHERE version.is_active ${versionFilter ? 'AND version.version = $1' : ''}
    ORDER BY domain.position, module.position, operation.position
  `, versionFilter ? [versionFilter] : []);

  if (!result.rows.length) return { version: '', modules: {}, descriptions: {}, domains: {}, moduleDomains: {}, taxonomies: versions.rows };
  const modules: Record<string, string[]> = {};
  const descriptions: Record<string, Record<string, string>> = {};
  const domains: NonNullable<Taxonomy['domains']> = {};
  const moduleDomains: Record<string, string> = {};
  for (const row of result.rows) {
    const domain = (domains[row.domain] ??= { description: row.domain_description, modules: {} });
    if (!row.module) continue;
    const operations = (modules[row.module] ??= []);
    const domainOperations = (domain.modules[row.module] ??= []);
    moduleDomains[row.module] = row.domain;
    if (!row.operation) continue;
    operations.push(row.operation);
    domainOperations.push(row.operation);
    (descriptions[row.module] ??= {})[row.operation] = row.description ?? '';
  }
  return {
    version: [...new Set(result.rows.map(row => row.version))].join(' + '),
    modules,
    descriptions,
    domains,
    moduleDomains,
    taxonomies: versions.rows
  };
}

async function ensureDomain(client: PoolClient, versionId: string, name: string, description: string) {
  const result = await client.query<{ id: string }>(`
    INSERT INTO taxonomy_domains (taxonomy_version_id, name, description, position)
    VALUES ($1, $2, $3, COALESCE((SELECT MAX(position) + 1 FROM taxonomy_domains WHERE taxonomy_version_id = $1), 1))
    ON CONFLICT (taxonomy_version_id, name) DO UPDATE SET
      description = CASE WHEN taxonomy_domains.description = '' THEN EXCLUDED.description ELSE taxonomy_domains.description END
    RETURNING id::text
  `, [versionId, name, description]);
  return result.rows[0].id;
}

async function ensureModule(client: PoolClient, versionId: string, domainId: string, name: string, description: string) {
  const result = await client.query<{ id: string }>(`
    INSERT INTO taxonomy_modules (taxonomy_version_id, domain_id, name, description, position)
    VALUES ($1, $2, $3, $4, COALESCE((SELECT MAX(position) + 1 FROM taxonomy_modules WHERE taxonomy_version_id = $1), 1))
    ON CONFLICT (taxonomy_version_id, name) DO UPDATE SET
      description = CASE WHEN taxonomy_modules.description = '' THEN EXCLUDED.description ELSE taxonomy_modules.description END
    RETURNING id::text
  `, [versionId, domainId, name, description]);
  return result.rows[0].id;
}

async function ensureOperation(client: PoolClient, moduleId: string, name: string, description: string) {
  await client.query(`
    INSERT INTO taxonomy_operations (module_id, name, description, position, is_active)
    VALUES ($1, $2, $3, COALESCE((SELECT MAX(position) + 1 FROM taxonomy_operations WHERE module_id = $1), 1), TRUE)
    ON CONFLICT (module_id, name) DO UPDATE SET
      description = CASE WHEN taxonomy_operations.description = '' THEN EXCLUDED.description ELSE taxonomy_operations.description END,
      is_active = TRUE
  `, [moduleId, name, description]);
}

export async function addTaxonomyOperation(input: { domain?: string; module: string; operation: string; description: string; version?: string }) {
  await withTransaction(async client => {
    const version = await client.query<{ id: string }>(`SELECT id::text FROM taxonomy_versions WHERE is_active ${input.version ? 'AND version = $1' : ''} ORDER BY created_at LIMIT 1`, input.version ? [input.version] : []);
    if (!version.rows[0]) throw new Error('Nenhuma taxonomia ativa foi encontrada.');
    const domainId = await ensureDomain(client, version.rows[0].id, input.domain?.trim() || 'General', 'Domínio base para módulos sem área definida.');
    const moduleId = await ensureModule(client, version.rows[0].id, domainId, input.module, '');
    const operations = input.operation.split(/[\n;,]+/).map(value => value.trim()).filter(Boolean);
    for (const operation of operations) await ensureOperation(client, moduleId, operation, input.description);
  });
}

export async function addTaxonomyDomain(input: { domain: string; description: string; version?: string }) {
  await withTransaction(async client => {
    const version = await client.query<{ id: string }>(`SELECT id::text FROM taxonomy_versions WHERE is_active ${input.version ? 'AND version = $1' : ''} ORDER BY created_at LIMIT 1`, input.version ? [input.version] : []);
    if (!version.rows[0]) throw new Error('Nenhuma taxonomia ativa foi encontrada.');
    await ensureDomain(client, version.rows[0].id, input.domain, input.description);
  });
}

export async function createTaxonomyVersion(version: string) {
  await query('INSERT INTO taxonomy_versions (version, is_active) VALUES ($1, TRUE)', [version]);
}

export type ApplyFallbackSuggestionResult =
  | { status: 'applied' | 'already_applied' }
  | { status: 'not_actionable' | 'target_domain_not_found' | 'target_module_not_found' | 'no_active_taxonomy' };

export async function applyFallbackSuggestion(suggestionId: string): Promise<ApplyFallbackSuggestionResult | null> {
  return withTransaction(async client => {
    const suggestion = await client.query<{
      suggestion_type: FallbackSuggestion['type'];
      proposed_domain: string | null;
      target_domain: string | null;
      proposed_module: string | null;
      target_module: string | null;
      proposed_operation: string | null;
      reason: string;
      applied_at: string | null;
    }>(`
      SELECT suggestion_type, proposed_domain, target_domain, proposed_module, target_module, proposed_operation, reason, applied_at
      FROM classification_fallback_suggestions
      WHERE id = $1 FOR UPDATE
    `, [suggestionId]);
    const item = suggestion.rows[0];
    if (!item) return null;
    if (item.applied_at) return { status: 'already_applied' };
    if (!['new_domain', 'new_module', 'new_operation'].includes(item.suggestion_type)) return { status: 'not_actionable' };

    const version = await client.query<{ id: string }>(`
      SELECT id::text FROM taxonomy_versions WHERE is_active ORDER BY created_at LIMIT 1
    `);
    if (!version.rows[0]) return { status: 'no_active_taxonomy' };
    const versionId = version.rows[0].id;

    if (item.suggestion_type === 'new_domain') {
      if (!item.proposed_domain) return { status: 'not_actionable' };
      const domainId = await ensureDomain(client, versionId, item.proposed_domain, item.reason);
      if (item.proposed_module) {
        const moduleId = await ensureModule(client, versionId, domainId, item.proposed_module, item.reason);
        if (item.proposed_operation) await ensureOperation(client, moduleId, item.proposed_operation, item.reason);
      }
    }

    if (item.suggestion_type === 'new_module') {
      if (!item.target_domain || !item.proposed_module) return { status: 'not_actionable' };
      const domain = await client.query<{ id: string }>(`
        SELECT id::text FROM taxonomy_domains WHERE taxonomy_version_id = $1 AND name = $2
      `, [versionId, item.target_domain]);
      if (!domain.rows[0]) return { status: 'target_domain_not_found' };
      const moduleId = await ensureModule(client, versionId, domain.rows[0].id, item.proposed_module, item.reason);
      if (item.proposed_operation) await ensureOperation(client, moduleId, item.proposed_operation, item.reason);
    }

    if (item.suggestion_type === 'new_operation') {
      if (!item.target_module || !item.proposed_operation) return { status: 'not_actionable' };
      const module = await client.query<{ id: string }>(`
        SELECT module.id::text
        FROM taxonomy_modules module
        JOIN taxonomy_domains domain ON domain.id = module.domain_id
        WHERE module.taxonomy_version_id = $1 AND module.name = $2
          AND ($3::varchar IS NULL OR domain.name = $3)
      `, [versionId, item.target_module, item.target_domain]);
      if (!module.rows[0]) return item.target_domain ? { status: 'target_domain_not_found' } : { status: 'target_module_not_found' };
      await ensureOperation(client, module.rows[0].id, item.proposed_operation, item.reason);
    }

    await client.query('UPDATE classification_fallback_suggestions SET applied_at = NOW() WHERE id = $1', [suggestionId]);
    return { status: 'applied' };
  });
}
