// Runs HTTP, migrations and persistence checks in a disposable schema on LOCAL PostgreSQL.
// All model responses come from a loopback mock server; no external LLM is contacted.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { createServer } from 'node:http';

const schema = `classification_check_${randomUUID().replaceAll('-', '')}`;
assert.match(schema, /^classification_check_[a-f0-9]{32}$/);
// Every pooled connection must retain isolation, including after an idle reconnect.
process.env.DATABASE_URL = `postgresql://us_agent:us_agent_local@127.0.0.1:5432/us_agent?options=${encodeURIComponent(`-c search_path=${schema}`)}`;
process.env.DATABASE_POOL_MAX = '1';
for (const key of ['DATABASE_SSL', 'VERCEL', 'OPENAI_API_KEY', 'GEMINI_API_KEY']) delete process.env[key];
const labels = [{ module: 'Authentication', operation: 'Login with OAuth' }, { module: 'Registry', operation: 'Retrieve data' }];
let scenario = 'review';
const mock = createServer(async (req, res) => {
  const parts = []; for await (const part of req) parts.push(part);
  const body = JSON.parse(Buffer.concat(parts).toString());
  assert.ok(body.messages[0].content.includes('rows'));
  if (scenario === 'failed' || scenario === 'partial' && req.url === '/p2') {
    res.writeHead(503, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: 'Simulated failure' })); return;
  }
  const rows = scenario === 'tie' ? [labels[req.url === '/p1' ? 0 : 1]] : labels;
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ model: `resolved${req.url}`, choices: [{ message: { content: JSON.stringify({ rows,
    confidence: 0.9, needs_review: scenario === 'review', rationale: 'Mock evidence', evidence: ['Local fixture'] }) } }] }));
});
await new Promise(resolve => mock.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${mock.address().port}`;
for (const [name, endpoint] of [['DEEPSEEK', 'p1'], ['GROQ', 'p2']]) {
  process.env[`${name}_API_KEY`] = 'local-test-only';
  process.env[`${name}_MODEL`] = `requested-${endpoint}`;
  process.env[`${name}_BASE_URL`] = `${base}/${endpoint}`;
}

const { pool } = await import('../apps/api/dist/database/pool.js');
const { createApp } = await import('../apps/api/dist/app.js');
let server;
let created = false;
try {
  await pool.query(`CREATE SCHEMA ${schema}`); created = true;
  await pool.query(`SET search_path TO ${schema}`);
  const directory = new URL('../database/migrations/', import.meta.url);
  for (const file of (await readdir(directory)).filter(name => name.endsWith('.sql')).sort()) {
    await pool.query(await readFile(new URL(file, directory), 'utf8'));
  }
  server = createApp().listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const root = `http://127.0.0.1:${server.address().port}/api`;
  async function request(path, body, expected = 200, method = 'POST') {
    const response = await fetch(root + path, body === undefined ? {} : {
      method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    const result = await response.json();
    assert.equal(response.status, expected, JSON.stringify(result)); return result;
  }
  const input = { stories: ['As a user I want to sign in and retrieve my records'], project: 'Local workflow fixture',
    sprint: 'Backlog', taxonomyVersion: '1.0.0', mode: 'committee' };
  const classify = () => request('/classify', input, 201);
  const review = (id, body, status = 200) => request(`/classifications/${id}/review`, body, status, 'PATCH');
  const context = id => request(`/classifications/${id}/review-context`);
  const first = (await classify()).results[0];
  assert.deepEqual(first.labels, labels);
  assert.equal(first.needsReview, true);
  let story = (await request('/stories')).find(item => item.id === first.id);
  assert.deepEqual(story.labels, labels); assert.equal(story.metricsSource, 'committee');
  assert.equal(story.consensus, 1); assert.equal(story.uncertainty, 0.175);
  const original = await context(first.id);
  assert.equal(original.provenance.engine, 'web_committee_v2');
  assert.equal(original.provenance.policyVersion, 'web_committee_multilabel_v1');
  assert.equal(original.provenance.promptVersion, 'web_wis_multilabel_v3_en');
  assert.ok(original.provenance.prompt.user.includes(input.stories[0]));
  assert.equal(original.votes[0].model, 'resolved/p1');
  assert.equal(original.votes[0].requestedModel, 'requested-p1');
  assert.deepEqual(original.provenance.execution, { arbitration: false, reruns: 0 });
  const { rows: [versions] } = await pool.query(`SELECT c.policy_version, c.prompt_version,
    r.policy_version AS run_policy FROM classifications c JOIN classification_runs r ON r.id = c.run_id WHERE c.id = $1`, [first.id]);
  assert.equal(versions.policy_version, original.provenance.policyVersion);
  assert.equal(versions.run_policy, original.provenance.policyVersion);
  assert.equal(versions.prompt_version, original.provenance.promptVersion);

  // Old single-label clients cannot accidentally erase a multi-label decision.
  await review(first.id, { action: 'approve', ...labels[0] }, 422);
  await review(first.id, { action: 'approve', labels: [labels[0], { module: 'Unknown', operation: 'Unknown' }] }, 422);
  await review(first.id, { action: 'approve', labels: [] }, 400);
  assert.deepEqual((await context(first.id)).labels, labels);
  assert.equal((await context(first.id)).reviews.length, 0);
  await review(first.id, { action: 'approve', labels, notes: 'Confirmed both labels' });
  const approved = await context(first.id);
  assert.deepEqual(approved.labels, labels);
  assert.deepEqual(approved.provenance, original.provenance);
  assert.deepEqual(approved.reviews[0].before.labels, labels);
  assert.deepEqual(approved.reviews[0].after.labels, labels);
  assert.equal(approved.reviews[0].before.review_status, 'pending_review');
  assert.equal(approved.reviews[0].after.review_status, 'reviewed');
  await review(first.id, { action: 'approve', labels }, 409);

  const second = (await classify()).results[0];
  await review(second.id, { action: 'approve', labels: [labels[1]], notes: 'Explicitly keep one pair' });
  const narrowed = await context(second.id);
  assert.deepEqual(narrowed.labels, [labels[1]]);
  assert.deepEqual(narrowed.reviews[0].before.labels, labels);
  assert.deepEqual(narrowed.reviews[0].after.labels, [labels[1]]);
  assert.deepEqual(narrowed.provenance.decision.labels, labels);
  assert.deepEqual((await context(first.id)).labels, labels);

  scenario = 'tie';
  const tie = (await classify()).results[0];
  story = (await request('/stories')).find(item => item.id === tie.id);
  assert.equal(story.status, 'pending_review'); assert.equal(story.consensus, 0.5); assert.equal(story.uncertainty, 0.35);
  scenario = 'partial';
  const partial = (await classify()).results[0];
  const partialContext = await context(partial.id);
  assert.deepEqual(partialContext.provenance.decision.providerHealth, { total: 2, successful: 1, failed: 1 });
  assert.ok(partialContext.provenance.decision.reviewReasons.includes('insufficient_quorum'));
  assert.deepEqual(partialContext.labels, labels);
  scenario = 'failed';
  const failed = (await classify()).results[0];
  const failureContext = await context(failed.id);
  assert.equal(failed.needsReview, true);
  assert.equal(failureContext.final.disagreementCause, 'provider_failure');
  assert.equal(failureContext.provenance.decision.consensusRatio, 0);
  assert.equal(failureContext.provenance.decision.providerHealth.failed, 2);

  const rules = (await request('/classify', { ...input, mode: 'preview' }, 201)).results[0];
  assert.equal((await request('/stories')).find(item => item.id === rules.id).metricsSource, 'rules');
  assert.equal((await context(rules.id)).provenance.decision.consensusRatio, null);
  assert.equal((await context(rules.id)).provenance.decision.uncertainty, null);

  // Legacy evidence remains unmodified and clearly identified as unavailable.
  const { rows: [legacy] } = await pool.query(`INSERT INTO classifications
    (story_id, review_status, final_confidence, uncertainty_score, consensus_ratio, taxonomy_version)
    SELECT story_id, 'pending_review', .37, .63, .42, taxonomy_version FROM classifications WHERE id = $1 RETURNING id::text`, [rules.id]);
  await pool.query(`INSERT INTO classification_labels (classification_id, module, operation) VALUES ($1,$2,$3)`, [legacy.id, labels[0].module, labels[0].operation]);
  const legacyContext = await context(legacy.id);
  assert.equal(legacyContext.provenance, null);
  const legacyStory = (await request('/stories')).find(item => item.id === legacy.id);
  assert.equal(legacyStory.metricsSource, 'legacy'); assert.equal(legacyStory.consensus, 0.42);
  await review(legacy.id, { action: 'approve', ...labels[0] });
  assert.equal((await context(legacy.id)).reviews[0].before.consensus_ratio, 0.42);

  await assert.rejects(pool.query('INSERT INTO classification_provenance (classification_id, payload) VALUES ($1, $2::jsonb)',
    [legacy.id, JSON.stringify({ schemaVersion: null })]), error => error.code === '23514');

  scenario = 'review';
  const concurrent = (await classify()).results[0];
  const statuses = await Promise.all([1, 2].map(async () => (await fetch(`${root}/classifications/${concurrent.id}/review`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'approve', labels })
  })).status));
  assert.deepEqual(statuses.sort(), [200, 409]);
  assert.equal((await context(concurrent.id)).reviews.length, 1);

  await assert.rejects(pool.query('UPDATE classification_provenance SET payload = payload WHERE classification_id = $1', [first.id]), /immutable/);
  assert.deepEqual((await context(first.id)).provenance, original.provenance);
  assert.equal((await pool.query('SELECT current_schema() AS name')).rows[0].name, schema);
  console.log('Classification workflow: multi-label, actual metrics, model provenance, review snapshots, rollback and legacy compatibility OK.');
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  await new Promise(resolve => mock.close(resolve));
  if (created) {
    await pool.query('SET search_path TO public');
    await pool.query(`DROP SCHEMA ${schema} CASCADE`);
  }
  await pool.end();
}
