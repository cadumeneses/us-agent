// End-to-end HTTP + PostgreSQL verification, using an isolated local schema.
// Run after npm run build: node scripts/check-nfr-recommendations.mjs
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

process.env.DATABASE_URL = 'postgresql://us_agent:us_agent_local@localhost:5432/us_agent';
process.env.DATABASE_POOL_MAX = '1';
delete process.env.DATABASE_SSL;
delete process.env.VERCEL;
const { pool } = await import('../apps/api/dist/database/pool.js');
const { createApp } = await import('../apps/api/dist/app.js');
const schema = `nfr_check_${randomUUID().replaceAll('-', '')}`;
assert.match(schema, /^nfr_check_[a-f0-9]{32}$/);
let server;
try {
  await pool.query(`CREATE SCHEMA ${schema}`);
  await pool.query(`SET search_path TO ${schema}`);
  const migrations = new URL('../database/migrations/', import.meta.url);
  for (const file of (await readdir(migrations)).filter(file => file.endsWith('.sql')).sort()) {
    await pool.query(await readFile(new URL(file, migrations), 'utf8'));
  }
  const { rows: projects } = await pool.query("INSERT INTO projects (name) VALUES ('NFR target'), ('NFR history') RETURNING id, name");
  const profile = { platforms: ['Web'], applicationDomains: ['Education'], objective: 'product', architectures: ['Client-server'], technologies: { languages: ['Java'], frameworks: [], apis: [], dataPersistence: ['PostgreSQL'] } };
  for (const project of projects) await pool.query('INSERT INTO project_research_profiles (project_id, content) VALUES ($1, $2)', [project.id, profile]);
  const ids = [];
  for (const project of projects) {
    const { rows: [sprint] } = await pool.query("INSERT INTO project_sprints (project_id, name) VALUES ($1, 'Backlog') RETURNING id", [project.id]);
    const { rows: [story] } = await pool.query("INSERT INTO stories (project_id, sprint_id, external_id, content) VALUES ($1, $2, 'US-1', 'Retrieve educational records') RETURNING id", [project.id, sprint.id]);
    const { rows: [c] } = await pool.query("INSERT INTO classifications (story_id, review_status, taxonomy_version) VALUES ($1, 'reviewed', 'test-v1') RETURNING id::text", [story.id]);
    await pool.query("INSERT INTO classification_labels (classification_id, module, operation) VALUES ($1, 'Registry', 'Retrieve data')", [c.id]);
    ids.push(c.id);
  }
  await pool.query("INSERT INTO story_non_functional_requirements (classification_id, description, nfr_type, metric) VALUES ($1, 'Preserve integrity of retrieved data.', 'Reliability', 'integrity')", [ids[1]]);
  server = createApp().listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const root = `http://127.0.0.1:${server.address().port}/api`;
  async function request(path, body, status = 200) {
    const response = await fetch(root + path, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const json = await response.json();
    assert.equal(response.status, status, JSON.stringify(json));
    return json;
  }
  await request('/quality-plans', undefined, 404);
  await request('/quality-plans/scopes', {}, 404);
  await request('/classifications/abc/nfr-context', undefined, 400);
  await request('/classifications/9999999999999999999/nfr-context', undefined, 400);
  await request(`/classifications/${ids[0]}/nfr-runs`, { labelIndex: -1 }, 400);
  const context = await request(`/classifications/${ids[0]}/nfr-context`);
  assert.equal(context.issues.length, 0);
  const run = await request(`/classifications/${ids[0]}/nfr-runs`, { labelIndex: 0 }, 201);
  assert.equal(run.status, 'completed');
  assert.equal(run.items.length, 1);
  assert.equal(run.neighbor.classificationId, ids[1]);
  assert.equal(run.neighbor.similarity, 1);
  const body = { itemKey: run.items[0].key, decision: 'accepted' };
  // Two concurrent acceptance requests must produce only one association.
  await Promise.all([request(`/nfr-runs/${run.id}/decisions`, body), request(`/nfr-runs/${run.id}/decisions`, body)]);
  const details = await request(`/classifications/${ids[0]}/details`);
  assert.equal(details.nonFunctionalRequirements.length, 1);
  assert.equal(details.nonFunctionalRequirements[0].metric, 'integrity');
  await request(`/nfr-runs/${run.id}/decisions`, { ...body, decision: 'rejected' }, 409);
  const history = await request(`/classifications/${ids[0]}/nfr-runs`);
  assert.equal(history[0].decisions[body.itemKey], 'accepted');
  const rerun = await request(`/classifications/${ids[0]}/nfr-runs`, { labelIndex: 0 }, 201);
  assert.equal(rerun.items[0].alreadyLinked, true);
  await pool.query("UPDATE classifications SET review_status = 'taxonomy_gap' WHERE id = $1", [ids[0]]);
  await request(`/nfr-runs/${rerun.id}/decisions`, body, 409);
  const blocked = await request(`/classifications/${ids[0]}/nfr-runs`, { labelIndex: 0 }, 201);
  assert.equal(blocked.status, 'blocked');
  assert.deepEqual(blocked.items, []);
  const { rows: [snapshot] } = await pool.query('SELECT input_snapshot FROM nfr_recommendation_runs WHERE id = $1', [run.id]);
  assert.equal(snapshot.input_snapshot.target.reviewStatus, 'reviewed');
  assert.equal(snapshot.input_snapshot.history[0].classificationId, ids[1]);
  // Task technologies enrich the effective project profile without rewriting manual tags.
  await pool.query("INSERT INTO story_tasks (classification_id, title, category, technologies) VALUES ($1, 'Create view', 'View', $2)", [ids[0], { languages: ['TypeScript'], frameworks: ['Angular'], apis: [], dataPersistence: [] }]);
  const updated = await request(`/classifications/${ids[0]}/nfr-context`);
  assert.ok(updated.target.projectProfile.technologies.languages.includes('TypeScript'));
  await pool.query('DELETE FROM story_tasks WHERE classification_id = $1', [ids[0]]);
  assert.ok(!(await request(`/classifications/${ids[0]}/nfr-context`)).target.projectProfile.technologies.languages.includes('TypeScript'));
  // Latest classification is authoritative: old accepted versions cannot bypass review.
  const { rows: [newClassification] } = await pool.query("INSERT INTO classifications (story_id, review_status, taxonomy_version) SELECT story_id, 'pending_review', taxonomy_version FROM classifications WHERE id = $1 RETURNING id::text", [ids[0]]);
  await request(`/classifications/${ids[0]}/nfr-context`, undefined, 409);
  const recent = await request(`/classifications/${newClassification.id}/nfr-runs`, { labelIndex: 0 }, 201);
  assert.equal(recent.status, 'blocked');
  console.log('NFR API, migrations, ranking, provenance, acceptance, idempotency, review guards and removed quality routes: OK');
} finally {
  if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  await pool.query('SET search_path TO public');
  await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await pool.end();
}
