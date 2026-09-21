// End-to-end check of project taxonomy selection and classification persistence.
// Uses an isolated schema in the local development PostgreSQL database.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';

process.env.DATABASE_URL = 'postgresql://us_agent:us_agent_local@localhost:5432/us_agent';
process.env.DATABASE_POOL_MAX = '1';
delete process.env.DATABASE_SSL;
delete process.env.VERCEL;

const { pool } = await import('../apps/api/dist/database/pool.js');
const { createApp } = await import('../apps/api/dist/app.js');
const schema = `taxonomy_check_${randomUUID().replaceAll('-', '')}`;
assert.match(schema, /^taxonomy_check_[a-f0-9]{32}$/);
let server;

try {
  await pool.query(`CREATE SCHEMA ${schema}`);
  await pool.query(`SET search_path TO ${schema}`);
  const migrations = new URL('../database/migrations/', import.meta.url);
  for (const file of (await readdir(migrations)).filter(name => name.endsWith('.sql')).sort()) {
    await pool.query(await readFile(new URL(file, migrations), 'utf8'));
  }
  const { rows: [version] } = await pool.query("INSERT INTO taxonomy_versions (version, is_active) VALUES ('project-v2', TRUE) RETURNING id");
  const { rows: [domain] } = await pool.query("INSERT INTO taxonomy_domains (taxonomy_version_id, name) VALUES ($1, 'General') RETURNING id", [version.id]);
  const { rows: [module] } = await pool.query("INSERT INTO taxonomy_modules (taxonomy_version_id, domain_id, name) VALUES ($1, $2, 'Registry') RETURNING id", [version.id, domain.id]);
  await pool.query("INSERT INTO taxonomy_operations (module_id, name) VALUES ($1, 'Insert data')", [module.id]);

  server = createApp().listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const root = `http://127.0.0.1:${server.address().port}/api`;
  async function request(path, body, expected = 200, method = 'POST') {
    const response = await fetch(root + path, body === undefined ? {} : {
      method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    const data = await response.json();
    assert.equal(response.status, expected, JSON.stringify(data));
    return data;
  }

  const input = { stories: ['Como usuário, quero fazer login com minha senha'], project: 'Projeto de teste', sprint: 'Backlog', mode: 'preview' };
  await request('/classify', input, 400); // Two active versions require an explicit choice.
  const first = await request('/classify', { ...input, taxonomyVersion: '1.0.0' }, 201);
  assert.equal(first.results[0].module, 'Authentication');
  const firstStory = (await request('/stories')).find(item => item.id === first.results[0].id);
  assert.equal(firstStory.taxonomyVersion, '1.0.0');
  assert.equal((await request('/project-research-profile?project=Projeto%20de%20teste')).taxonomyVersion, '1.0.0');

  const second = await request('/classify', { ...input, taxonomyVersion: 'project-v2' }, 201);
  assert.equal(second.results[0].module, 'n/a'); // The selected version lacks the login operation.
  const latest = await request('/stories');
  assert.equal(latest.length, 1);
  assert.equal(latest[0].taxonomyVersion, 'project-v2');
  assert.equal((await request('/project-research-profile?project=Projeto%20de%20teste')).taxonomyVersion, 'project-v2');
  const inherited = await request('/classify', input, 201);
  assert.equal((await request('/stories'))[0].id, inherited.results[0].id);
  assert.equal((await request('/stories'))[0].taxonomyVersion, 'project-v2');
  const { rows } = await pool.query('SELECT taxonomy_version FROM classifications WHERE id = ANY($1::bigint[]) ORDER BY id', [[first.results[0].id, second.results[0].id]]);
  assert.deepEqual(rows.map(row => row.taxonomy_version), ['1.0.0', 'project-v2']);
  const savedProfile = await request('/project-research-profile?project=Projeto%20de%20teste');
  await request('/project-research-profile?project=Projeto%20de%20teste', { ...savedProfile, taxonomyVersion: '1.0.0' }, 200, 'PUT');
  await request('/classify', input, 201);
  assert.equal((await request('/stories'))[0].taxonomyVersion, '1.0.0');
  await request('/classify', { ...input, taxonomyVersion: 'does-not-exist' }, 400);
  console.log('Project taxonomy selection, use and persistence: OK');
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  await pool.query('SET search_path TO public');
  await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await pool.end();
}
