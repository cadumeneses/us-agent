// Run after npm run build. Uses only the local development database.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

process.env.DATABASE_URL = 'postgresql://us_agent:us_agent_local@localhost:5432/us_agent';
process.env.DATABASE_POOL_MAX = '1';
delete process.env.DATABASE_SSL;
delete process.env.VERCEL;
const { pool } = await import('../apps/api/dist/database/pool.js');
const { loadProjectResearchProfile, saveProjectResearchProfile, emptyProjectResearchProfile } = await import('../apps/api/dist/services/research-inputs.js');
const { loadStoryDetails, saveStoryDetails } = await import('../apps/api/dist/services/story-details.js');
const schema = `research_check_${randomUUID().replaceAll('-', '')}`;
assert.match(schema, /^research_check_[a-f0-9]{32}$/);
try {
  await pool.query(`CREATE SCHEMA ${schema}`);
  await pool.query(`SET search_path TO ${schema}`);
  for (const name of ['001_initial_schema.sql', '005_story_details.sql', '014_research_input_profiles.sql']) {
    await pool.query(await readFile(new URL(`../database/migrations/${name}`, import.meta.url), 'utf8'));
  }
  await pool.query("INSERT INTO projects (name) VALUES ('Research check')");
  assert.equal(await loadProjectResearchProfile('Missing'), null);
  assert.deepEqual(await loadProjectResearchProfile('Research check'), emptyProjectResearchProfile());
  const profile = { ...emptyProjectResearchProfile(), platforms: ['Web'], objective: 'prototype' };
  assert.equal(await saveProjectResearchProfile('Missing', profile), false);
  assert.equal(await saveProjectResearchProfile('Research check', profile), true);
  assert.deepEqual(await loadProjectResearchProfile('Research check'), profile);
  const story = await pool.query("INSERT INTO stories (project_id, external_id, content) SELECT id, 'US-check', 'Research story' FROM projects RETURNING id");
  const classification = await pool.query('INSERT INTO classifications (story_id) VALUES ($1) RETURNING id::text', [story.rows[0].id]);
  const id = classification.rows[0].id;
  const details = {
    tasks: [{ title: 'Associate entities', done: false, category: 'Database relationships', technologies: { languages: ['Java'], frameworks: ['Spring'], apis: [], dataPersistence: ['PostgreSQL'] } }],
    functionalRequirements: [],
    nonFunctionalRequirements: [{ description: 'Preserve data integrity', type: 'Reliability', metric: 'integrity' }]
  };
  assert.equal(await saveStoryDetails(id, details), true);
  const saved = await loadStoryDetails(id);
  assert.deepEqual(saved.tasks[0].technologies, details.tasks[0].technologies);
  assert.equal(saved.tasks[0].category, details.tasks[0].category);
  // A legacy client editing a title must not erase structured metadata.
  await saveStoryDetails(id, { ...saved, tasks: [{ id: saved.tasks[0].id, title: 'Renamed task', done: true }] });
  const legacySaved = await loadStoryDetails(id);
  assert.equal(legacySaved.tasks[0].category, details.tasks[0].category);
  assert.deepEqual(legacySaved.tasks[0].technologies, details.tasks[0].technologies);
  assert.equal(legacySaved.tasks[0].done, true);
  // Database error midway through replacement must roll back the complete edit.
  await assert.rejects(saveStoryDetails(id, { ...details, nonFunctionalRequirements: [{ ...details.nonFunctionalRequirements[0], type: 'x'.repeat(81) }] }));
  assert.deepEqual(await loadStoryDetails(id), legacySaved);
  const untouched = await pool.query('SELECT review_status, final_confidence FROM classifications WHERE id = $1', [id]);
  assert.equal(untouched.rows[0].review_status, 'pending_review');
  assert.equal(untouched.rows[0].final_confidence, 0);
  console.log('Research input migration, persistence, legacy preservation and rollback: OK');
} finally {
  await pool.query('SET search_path TO public');
  await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await pool.end();
}
