import { z } from 'zod';
import { query } from '../database/pool.js';

const tags = z.array(z.string().trim().min(1).max(120)).max(100)
  .transform(values => [...new Set(values)]);
export const technologiesSchema = z.object({
  languages: tags, frameworks: tags, apis: tags, dataPersistence: tags
});
export const projectResearchProfileSchema = z.object({
  taxonomyVersion: z.string().trim().max(40).default(''),
  platforms: tags,
  applicationDomains: tags,
  // Prototype exclusion is part of the original recommendation method.
  objective: z.enum(['', 'product', 'prototype']),
  architectures: tags,
  technologies: technologiesSchema
});
export type ProjectResearchProfile = z.infer<typeof projectResearchProfileSchema>;
export const emptyTechnologies = (): z.infer<typeof technologiesSchema> => ({ languages: [], frameworks: [], apis: [], dataPersistence: [] });
export const emptyProjectResearchProfile = (): ProjectResearchProfile => ({
  taxonomyVersion: '', platforms: [], applicationDomains: [], objective: '', architectures: [], technologies: emptyTechnologies()
});

export async function loadProjectResearchProfile(project: string) {
  const result = await query<{ content: ProjectResearchProfile | null }>(`
    SELECT profile.content FROM projects project
    LEFT JOIN project_research_profiles profile ON profile.project_id = project.id
    WHERE project.name = $1
  `, [project]);
  return result.rows.length ? projectResearchProfileSchema.parse(result.rows[0].content ?? emptyProjectResearchProfile()) : null;
}

export async function saveProjectResearchProfile(project: string, profile: ProjectResearchProfile) {
  const result = await query(`
    INSERT INTO project_research_profiles (project_id, content)
    SELECT id, $2::jsonb FROM projects WHERE name = $1
    ON CONFLICT (project_id) DO UPDATE SET content = EXCLUDED.content, updated_at = NOW()
    RETURNING project_id
  `, [project, JSON.stringify(profile)]);
  return Boolean(result.rowCount);
}
