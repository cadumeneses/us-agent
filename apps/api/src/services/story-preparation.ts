import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { query, withTransaction } from '../database/pool.js';
import { technologiesSchema } from './research-inputs.js';
import { loadStoryDetails, saveStoryDetails } from './story-details.js';

export class StoryPreparationError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export const preparedDetailsSchema = z.strictObject({
  tasks: z.array(z.object({ id: z.string().max(160).optional(), title: z.string().trim().min(1).max(500), done: z.boolean(),
    category: z.string().trim().max(160).optional(), technologies: technologiesSchema.optional() })).max(100),
  functionalRequirements: z.array(z.object({ id: z.string().optional(), description: z.string().trim().min(1).max(1000) })).max(100),
  nonFunctionalRequirements: z.array(z.object({ id: z.string().optional(), description: z.string().trim().min(1).max(1000),
    type: z.string().trim().min(1).max(80), metric: z.string().trim().min(1).max(120) })).max(100)
});
const empty = () => ({ tasks: [], functionalRequirements: [], nonFunctionalRequirements: [] });
export type SavedStoryTarget = { storyId: string; revision: number; classificationId: string | null };
type ProjectStory = { storyId: string; externalId: string; text: string; project: string; sprint: string;
  classificationId: string | null; status: string; module: string; operation: string;
  labels: Array<{ module: string; operation: string }>; confidence: number; taxonomyVersion: string; revision: number };
const selectStories = `SELECT s.id::text AS "storyId", s.external_id AS "externalId", s.content AS text,
  p.name AS project, sp.name AS sprint, c.id::text AS "classificationId", COALESCE(c.review_status,'unclassified') AS status,
  COALESCE(l.labels,'[]'::jsonb) AS labels, COALESCE(l.labels->0->>'module','') AS module,
  COALESCE(l.labels->0->>'operation','') AS operation, COALESCE(c.final_confidence,0) AS confidence,
  COALESCE(c.taxonomy_version,'') AS "taxonomyVersion", COALESCE(prep.revision,0) AS revision
  FROM stories s JOIN projects p ON p.id=s.project_id JOIN project_sprints sp ON sp.id=s.sprint_id
  LEFT JOIN story_preparations prep ON prep.story_id=s.id
  LEFT JOIN LATERAL (SELECT * FROM classifications WHERE story_id=s.id ORDER BY created_at DESC,id DESC LIMIT 1) c ON TRUE
  LEFT JOIN LATERAL (SELECT jsonb_agg(jsonb_build_object('module',module,'operation',operation) ORDER BY position,id) AS labels
    FROM classification_labels WHERE classification_id=c.id) l ON TRUE`;

export async function listProjectStories(project: string) {
  return (await query<ProjectStory>(`${selectStories} WHERE p.name=$1 ORDER BY s.created_at DESC,s.id DESC`, [project])).rows;
}
export async function projectStoryCounts() {
  return (await query<{project:string;stories:number;unclassified:number;cycles:number}>(`SELECT p.name AS project,
    COUNT(s.id)::int AS stories,COUNT(s.id) FILTER(WHERE c.id IS NULL)::int AS unclassified,
    COUNT(DISTINCT s.sprint_id)::int AS cycles FROM projects p LEFT JOIN stories s ON s.project_id=p.id
    LEFT JOIN LATERAL(SELECT id FROM classifications WHERE story_id=s.id ORDER BY created_at DESC,id DESC LIMIT 1)c ON TRUE
    GROUP BY p.id,p.name ORDER BY p.name`)).rows;
}
export async function loadProjectStory(id: string) {
  const row = (await query<ProjectStory>(`${selectStories} WHERE s.id=$1`, [id])).rows[0];
  if (!row) throw new StoryPreparationError(404, 'Story not found.');
  const draft = await query<{ details: ReturnType<typeof empty> }>('SELECT details FROM story_preparations WHERE story_id=$1', [id]);
  return { ...row, details: row.classificationId ? await loadStoryDetails(row.classificationId) : draft.rows[0]?.details ?? empty() };
}
export async function createPreparedStory(input: { project: string; sprint: string; text: string; requestId: string }) {
  const id = await withTransaction(async client => {
    const project = (await client.query<{ id: string }>('SELECT id::text FROM projects WHERE name=$1', [input.project])).rows[0];
    if (!project) throw new StoryPreparationError(404, 'Project not found.');
    const sprint = (await client.query<{ id: string }>(`INSERT INTO project_sprints(project_id,name,status) VALUES($1,$2,'planning')
      ON CONFLICT(project_id,name) DO UPDATE SET name=EXCLUDED.name RETURNING id::text`, [project.id,input.sprint])).rows[0];
    const existing = (await client.query<{ id: string; content: string; sprint_id: string }>(`SELECT id::text,content,sprint_id::text FROM stories
      WHERE project_id=$1 AND external_id=$2 FOR UPDATE`, [project.id,`draft_${input.requestId}`])).rows[0];
    if (existing) {
      if (existing.content !== input.text || existing.sprint_id !== sprint.id) throw new StoryPreparationError(409, 'This save request already belongs to a different story.');
      return existing.id;
    }
    const story = (await client.query<{ id: string }>(`INSERT INTO stories(project_id,sprint_id,external_id,content)
      VALUES($1,$2,$3,$4) RETURNING id::text`, [project.id,sprint.id,`draft_${input.requestId}`,input.text])).rows[0];
    await client.query('INSERT INTO story_preparations(story_id) VALUES($1)', [story.id]);
    return story.id;
  });
  return loadProjectStory(id);
}

export async function lockPreparedStory(client: PoolClient, target: SavedStoryTarget, expectedText?: string, projectId?: string) {
  const story = (await client.query<{ id: string; content: string; project_id: string }>('SELECT id::text,content,project_id::text FROM stories WHERE id=$1 FOR UPDATE', [target.storyId])).rows[0];
  if (!story) throw new StoryPreparationError(404, 'Story not found.');
  const revision = (await client.query<{ revision: number }>('SELECT revision FROM story_preparations WHERE story_id=$1', [target.storyId])).rows[0]?.revision ?? 0;
  const latest = (await client.query<{ id: string }>('SELECT id::text FROM classifications WHERE story_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1', [target.storyId])).rows[0]?.id ?? null;
  if (revision !== target.revision || latest !== target.classificationId || expectedText !== undefined && story.content !== expectedText || projectId !== undefined && story.project_id !== projectId) {
    throw new StoryPreparationError(409, 'This story changed. Reload it before saving or classifying.');
  }
  return story;
}
export async function savePreparedStory(target: SavedStoryTarget, text: string, rawDetails: unknown) {
  const details = preparedDetailsSchema.parse(rawDetails);
  await withTransaction(async client => {
    await lockPreparedStory(client, target);
    // Classified text is evidence: revisions create new classifications, not rewritten inputs.
    if (target.classificationId) {
      const row = (await client.query<{ content: string }>('SELECT content FROM stories WHERE id=$1', [target.storyId])).rows[0];
      if (row.content !== text) throw new StoryPreparationError(409, 'Classified story text is preserved. Create another story for different text.');
      await saveStoryDetails(target.classificationId, details, client);
    }
    await client.query('UPDATE stories SET content=$2,updated_at=NOW() WHERE id=$1', [target.storyId,text]);
    const withIds = { ...details, tasks: details.tasks.map(task => ({ ...task, id: task.id ?? randomUUID() })) };
    await client.query(`INSERT INTO story_preparations(story_id,revision,details) VALUES($1,1,$2::jsonb)
      ON CONFLICT(story_id) DO UPDATE SET revision=story_preparations.revision+1,details=EXCLUDED.details,updated_at=NOW()`, [target.storyId,JSON.stringify(withIds)]);
  });
  return loadProjectStory(target.storyId);
}
export async function copyPreparedStoryDetails(client: PoolClient, storyId: string, classificationId: string) {
  const row = (await client.query<{ details: unknown }>('SELECT details FROM story_preparations WHERE story_id=$1', [storyId])).rows[0];
  if (row) await saveStoryDetails(classificationId, preparedDetailsSchema.parse(row.details), client);
}
