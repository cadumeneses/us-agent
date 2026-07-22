import type { Story, Taxonomy } from '../domain/models.js';
import { query } from '../database/pool.js';

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

export async function loadTaxonomy(): Promise<Taxonomy> {
  const result = await query<{ version: string; module: string; operation: string }>(`
    SELECT version.version, module.name AS module, operation.name AS operation
    FROM taxonomy_versions version
    JOIN taxonomy_modules module ON module.taxonomy_version_id = version.id
    JOIN taxonomy_operations operation ON operation.module_id = module.id
    WHERE version.is_active AND operation.is_active
    ORDER BY module.position, operation.position
  `);

  if (!result.rows.length) throw new Error('Nenhuma taxonomia ativa foi encontrada.');
  const modules = result.rows.reduce<Record<string, string[]>>((all, row) => {
    (all[row.module] ??= []).push(row.operation);
    return all;
  }, {});
  return { version: result.rows[0].version, modules };
}
