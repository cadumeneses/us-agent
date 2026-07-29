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

export async function loadTaxonomy(versionFilter?: string): Promise<Taxonomy> {
  const versions = await query<{ version: string; active: boolean; modules: number; operations: number }>(`
    SELECT version, is_active AS active,
      (SELECT COUNT(*)::int FROM taxonomy_modules WHERE taxonomy_version_id = taxonomy_versions.id) AS modules,
      (SELECT COUNT(*)::int FROM taxonomy_operations operation JOIN taxonomy_modules module ON module.id = operation.module_id WHERE module.taxonomy_version_id = taxonomy_versions.id) AS operations
    FROM taxonomy_versions ORDER BY created_at
  `);
  const result = await query<{ version: string; module: string; operation: string; description: string }>(`
    SELECT version.version, module.name AS module, operation.name AS operation, operation.description
    FROM taxonomy_versions version
    JOIN taxonomy_modules module ON module.taxonomy_version_id = version.id
    JOIN taxonomy_operations operation ON operation.module_id = module.id
    WHERE version.is_active AND operation.is_active ${versionFilter ? 'AND version.version = $1' : ''}
    ORDER BY module.position, operation.position
  `, versionFilter ? [versionFilter] : []);

  if (!result.rows.length) return { version: '', modules: {}, descriptions: {}, taxonomies: versions.rows };
  const modules = result.rows.reduce<Record<string, string[]>>((all, row) => {
    (all[row.module] ??= []).push(row.operation);
    return all;
  }, {});
  const descriptions = result.rows.reduce<Record<string, Record<string, string>>>((all, row) => { (all[row.module] ??= {})[row.operation] = row.description; return all; }, {});
  return { version: [...new Set(result.rows.map(row => row.version))].join(' + '), modules, descriptions, taxonomies: versions.rows };
}

export async function addTaxonomyOperation(input: { module: string; operation: string; description: string; version?: string }) {
  const version = await query<{ id: string }>(`SELECT id::text FROM taxonomy_versions WHERE is_active ${input.version ? 'AND version = $1' : ''} ORDER BY created_at LIMIT 1`, input.version ? [input.version] : []);
  if (!version.rows[0]) throw new Error('Nenhuma taxonomia ativa foi encontrada.');
  const module = await query<{ id: string }>(`INSERT INTO taxonomy_modules (taxonomy_version_id, name, description, position) VALUES ($1, $2, '', COALESCE((SELECT MAX(position) + 1 FROM taxonomy_modules WHERE taxonomy_version_id = $1), 1)) ON CONFLICT (taxonomy_version_id, name) DO UPDATE SET name = EXCLUDED.name RETURNING id::text`, [version.rows[0].id, input.module]);
  const operations = input.operation.split(/[\n;,]+/).map(value => value.trim()).filter(Boolean);
  for (const operation of operations) {
    await query(`INSERT INTO taxonomy_operations (module_id, name, description, position, is_active) VALUES ($1, $2, $3, COALESCE((SELECT MAX(position) + 1 FROM taxonomy_operations WHERE module_id = $1), 1), TRUE) ON CONFLICT (module_id, name) DO UPDATE SET description = EXCLUDED.description, is_active = TRUE`, [module.rows[0].id, operation, input.description]);
  }
}

export async function createTaxonomyVersion(version: string) {
  await query('INSERT INTO taxonomy_versions (version, is_active) VALUES ($1, TRUE)', [version]);
}
