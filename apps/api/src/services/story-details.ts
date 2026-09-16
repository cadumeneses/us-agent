import { query, withTransaction } from '../database/pool.js';
import { emptyTechnologies } from './research-inputs.js';

type Technologies = ReturnType<typeof emptyTechnologies>;

export type StoryDetails = {
  tasks: Array<{ id: string; title: string; done: boolean; category: string; technologies: Technologies }>;
  functionalRequirements: Array<{ id: string; description: string }>;
  nonFunctionalRequirements: Array<{ id: string; description: string; type: string; metric: string }>;
};

export async function loadStoryDetails(classificationId: string): Promise<StoryDetails> {
  const [tasks, functionalRequirements, nonFunctionalRequirements] = await Promise.all([
    query<StoryDetails['tasks'][number]>('SELECT id::text, title, is_done AS done, category, technologies FROM story_tasks WHERE classification_id = $1 ORDER BY position, id', [classificationId]),
    query<{ id: string; description: string }>('SELECT id::text, description FROM story_functional_requirements WHERE classification_id = $1 ORDER BY position, id', [classificationId]),
    query<{ id: string; description: string; type: string; metric: string }>('SELECT id::text, description, nfr_type AS type, metric FROM story_non_functional_requirements WHERE classification_id = $1 ORDER BY position, id', [classificationId])
  ]);
  return { tasks: tasks.rows, functionalRequirements: functionalRequirements.rows, nonFunctionalRequirements: nonFunctionalRequirements.rows };
}

export async function saveStoryDetails(classificationId: string, details: { tasks: Array<{ id?: string; title: string; done: boolean; category?: string; technologies?: Technologies }>; functionalRequirements: Array<{ description: string }>; nonFunctionalRequirements: Array<{ description: string; type: string; metric: string }> }) {
  return withTransaction(async client => {
    const exists = await client.query('SELECT 1 FROM classifications WHERE id = $1 FOR UPDATE', [classificationId]);
    if (!exists.rowCount) return false;
    const previousTasks = await client.query<{ id: string; title: string; category: string; technologies: Technologies; position: number }>('SELECT id::text, title, category, technologies, position FROM story_tasks WHERE classification_id = $1', [classificationId]);
    await client.query('DELETE FROM story_tasks WHERE classification_id = $1', [classificationId]);
    await client.query('DELETE FROM story_functional_requirements WHERE classification_id = $1', [classificationId]);
    await client.query('DELETE FROM story_non_functional_requirements WHERE classification_id = $1', [classificationId]);
    for (const [position, task] of details.tasks.entries()) {
      const previous = previousTasks.rows.find(item => task.id ? item.id === task.id : item.position === position && item.title === task.title);
      await client.query('INSERT INTO story_tasks (classification_id, title, is_done, position, category, technologies) VALUES ($1, $2, $3, $4, $5, $6::jsonb)', [classificationId, task.title, task.done, position, task.category ?? previous?.category ?? '', JSON.stringify(task.technologies ?? previous?.technologies ?? emptyTechnologies())]);
    }
    for (const [position, item] of details.functionalRequirements.entries()) await client.query('INSERT INTO story_functional_requirements (classification_id, description, position) VALUES ($1, $2, $3)', [classificationId, item.description, position]);
    for (const [position, item] of details.nonFunctionalRequirements.entries()) await client.query('INSERT INTO story_non_functional_requirements (classification_id, description, nfr_type, metric, position) VALUES ($1, $2, $3, $4, $5)', [classificationId, item.description, item.type, item.metric, position]);
    return true;
  });
}
