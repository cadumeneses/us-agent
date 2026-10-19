import { withTransaction } from '../database/pool.js';
import { canonicalJson } from '../domain/content-snapshot.js';
import { createRecommendationInputValidator, type RecommendationInput } from '../domain/recommender-definition.js';
import { lockPublishedDefinition } from './recommender-datasets.js';
import { loadProjectResearchProfile } from './research-inputs.js';
import { validateConfigurableDefinition } from './configurable-knn.js';
import type { z } from 'zod';
import type { contentReferenceSchema } from '../domain/dataset-import.js';

export class ConfigurableRequestError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
type Reference = z.infer<typeof contentReferenceSchema>;
export async function configurableProjectProfile(project: string, reference: Reference) {
  return withTransaction(async client => {
    const publication = await lockPublishedDefinition(client, reference);
    const { definition, parameters } = validateConfigurableDefinition(publication.content.definition, publication.content.taxonomies);
    const selected = await client.query<{ id: string }>('SELECT id FROM projects WHERE name=$1', [project]);
    if (!selected.rows[0]) throw new ConfigurableRequestError(404, 'Project not found.');
    const existing = await client.query<{ revision: number; values: RecommendationInput['values'] }>(`SELECT revision, values FROM project_recommender_profiles
      WHERE project_id=$1 AND definition_id=$2 AND definition_version=$3`, [selected.rows[0].id, reference.id, reference.version]);
    if (existing.rows[0]) return { projectId: selected.rows[0].id, ...existing.rows[0] };
    const profile = await loadProjectResearchProfile(project);
    const values: RecommendationInput['values'] = {};
    for (const [id, source] of Object.entries(parameters.profile_sources)) {
      let value: unknown = profile;
      for (const key of source.split('.')) value = (value as Record<string, unknown> | null)?.[key];
      if (value !== undefined) values[id] = value as RecommendationInput['values'][string];
    }
    for (const attribute of definition.attributes) if (attribute.role === 'output') values[attribute.id] = [];
    return { projectId: selected.rows[0].id, revision: 0, values };
  });
}

export async function saveConfigurableProjectProfile(project: string, reference: Reference, revision: number, values: RecommendationInput['values']) {
  return withTransaction(async client => {
    const publication = await lockPublishedDefinition(client, reference);
    const { definition, outputs } = validateConfigurableDefinition(publication.content.definition, publication.content.taxonomies);
    if (outputs.some(attribute => !Array.isArray(values[attribute.id]) || (values[attribute.id] as unknown[]).length)) throw new ConfigurableRequestError(422, 'Project query outputs must be empty lists.');
    createRecommendationInputValidator(definition, publication.content.taxonomies)({ id: 'profile', provenance: { source: 'Project profile' }, values });
    // Serialize saves even when this definition has no profile row yet.
    const selected = await client.query<{ id: string }>('SELECT id FROM projects WHERE name=$1 FOR UPDATE', [project]);
    if (!selected.rows[0]) throw new ConfigurableRequestError(404, 'Project not found.');
    if (revision > 0) {
      const updated = await client.query<{ revision: number; values: RecommendationInput['values'] }>(`UPDATE project_recommender_profiles
        SET values=$4::jsonb, revision=revision+1, updated_at=NOW()
        WHERE project_id=$1 AND definition_id=$2 AND definition_version=$3 AND revision=$5 RETURNING revision, values`,
        [selected.rows[0].id, reference.id, reference.version, canonicalJson(values), revision]);
      if (updated.rows[0]) return { projectId: selected.rows[0].id, ...updated.rows[0] };
    } else {
      const saved = await client.query<{ revision: number; values: RecommendationInput['values'] }>(`INSERT INTO project_recommender_profiles
        (project_id, definition_id, definition_version, revision, values) VALUES ($1,$2,$3,1,$4::jsonb)
        ON CONFLICT DO NOTHING RETURNING revision, values`,
        [selected.rows[0].id, reference.id, reference.version, canonicalJson(values)]);
      if (saved.rows[0]) return { projectId: selected.rows[0].id, ...saved.rows[0] };
    }
    throw new ConfigurableRequestError(409, 'This project profile changed. Reload it before saving.');
  });
}
