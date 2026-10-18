// HTTP/publication verification in a disposable LOCAL schema, without external providers.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';

const schema = `recommender_taxonomy_check_${randomUUID().replaceAll('-', '')}`;
assert.match(schema, /^recommender_taxonomy_check_[a-f0-9]{32}$/);
process.env.DATABASE_URL = `postgresql://us_agent:us_agent_local@127.0.0.1:5432/us_agent?options=${encodeURIComponent(`-c search_path=${schema}`)}`;
process.env.DATABASE_POOL_MAX = '3';
for (const key of ['DATABASE_SSL', 'VERCEL', 'INGEST_API_KEY']) delete process.env[key];
const { pool } = await import('../apps/api/dist/database/pool.js');
const { createApp } = await import('../apps/api/dist/app.js');
const { snapshotContent } = await import('../apps/api/dist/domain/content-snapshot.js');
const { parseRecommenderDefinition, validateRecommendationInput } = await import('../apps/api/dist/domain/recommender-definition.js');
const { simulateConfiguredNfr, legacyNfrInput } = await import('../apps/api/dist/services/configured-nfr.js');
let server;
let created = false;
try {
  await pool.query(`CREATE SCHEMA ${schema}`); created = true;
  const directory = new URL('../database/migrations/', import.meta.url);
  for (const file of (await readdir(directory)).filter(name => name.endsWith('.sql')).sort()) {
    await pool.query(await readFile(new URL(file, directory), 'utf8'));
  }
  const wisBefore = (await pool.query('SELECT row_to_json(taxonomy_row) AS content FROM taxonomy_versions taxonomy_row ORDER BY id')).rows;
  server = createApp().listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const root = `http://127.0.0.1:${server.address().port}/api/internal/recommender-taxonomies`;
  async function request(path = '', method = 'GET', body, expected = 200, authorization) {
    const response = await fetch(root + path, { method, headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(authorization ? { authorization } : {})
    }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const result = await response.json();
    assert.equal(response.status, expected, JSON.stringify(result)); return result;
  }
  const path = (id, version = '1') => `/${id}/versions/${version}`;
  const tree = JSON.parse(await readFile(new URL('../config/taxonomies/acceptance-demo.v1.json', import.meta.url), 'utf8'));
  const list = JSON.parse(await readFile(new URL('../config/taxonomies/languages-demo.v1.json', import.meta.url), 'utf8'));
  assert.deepEqual(await request(), []);

  // Existing internal authorization: required key when configured; fail closed on Vercel without it.
  process.env.INGEST_API_KEY = 'local-check-only';
  await request('', 'GET', undefined, 401);
  await request(path(tree.id), 'PUT', tree, 401);
  await request('', 'GET', undefined, 401, 'Bearer wrong');
  await request('', 'GET', undefined, 200, 'Bearer local-check-only');
  delete process.env.INGEST_API_KEY; process.env.VERCEL = '1';
  await request('', 'GET', undefined, 503);
  delete process.env.VERCEL;

  await request(path(tree.id), 'PUT', { ...tree, id: 'mismatch' }, 400);
  await assert.rejects(pool.query(`INSERT INTO recommender_taxonomy_versions (taxonomy_id, version, content, created_by)
    VALUES ('missing-identity', '1', '{"schemaVersion":1}', 'local-check')`), error => error.code === '23514');
  const draft = await request(path(tree.id), 'PUT', tree);
  assert.equal(draft.state, 'draft'); assert.equal(draft.createdBy, 'local-development');
  const edited = { ...tree, name: 'Critérios sintéticos revisados' };
  const revised = await request(path(tree.id), 'PUT', edited);
  assert.notEqual(revised.snapshot.sha256, draft.snapshot.sha256);
  await request(path(tree.id) + '/retire', 'POST', {}, 409);
  await request(path(tree.id) + '/publish', 'POST', { content: tree }, 400);
  await request(path(tree.id) + '/publish', 'POST', [], 400);
  const concurrent = await Promise.all([1, 2].map(() => request(path(tree.id) + '/publish', 'POST', {})));
  assert.deepEqual(concurrent[0], concurrent[1]);
  const published = concurrent[0];
  assert.equal(published.state, 'published'); assert.equal(published.publishedBy, 'local-development');
  assert.equal(published.snapshot.sha256, snapshotContent(edited).sha256);
  await request(path(tree.id), 'PUT', tree, 409);
  assert.deepEqual(await request(path(tree.id)), published);
  await assert.rejects(pool.query(`UPDATE recommender_taxonomy_versions SET content = jsonb_set(content, '{name}', '"Changed"') WHERE taxonomy_id = $1`, [tree.id]), /immutable/);
  await assert.rejects(pool.query('DELETE FROM recommender_taxonomy_versions WHERE taxonomy_id = $1', [tree.id]), /immutable/);
  await assert.rejects(pool.query('UPDATE recommender_taxonomy_versions SET content_sha256 = $2 WHERE taxonomy_id = $1', [tree.id, '0'.repeat(64)]), /immutable/);
  await assert.rejects(pool.query(`UPDATE recommender_taxonomy_versions SET state = 'draft' WHERE taxonomy_id = $1`, [tree.id]), /immutable/);
  await request(path(list.id), 'PUT', list);
  const second = await request(path(list.id) + '/publish', 'POST', {});

  const invalid = [
    { ...list, id: 'duplicate-demo', nodes: [list.nodes[0], list.nodes[0]] },
    { ...tree, id: 'orphan-demo', nodes: [{ ...tree.nodes[0], parentId: 'missing' }] },
    { ...tree, id: 'cycle-demo', nodes: [{ ...tree.nodes[0], parentId: 'criterion-group' }] },
    { ...list, id: 'invalid-list', nodes: [{ ...list.nodes[0], parentId: 'typescript' }] }
  ];
  for (const value of invalid) {
    const result = await request(path(value.id), 'PUT', value, 422);
    assert.ok(result.issues.some(issue => issue.path[0] === 'nodes'));
    await request(path(value.id), 'GET', undefined, 404);
  }
  // Publication revalidates storage too; an invalid graph must stay unpublished after rollback.
  const invalidStored = { ...tree, id: 'stored-invalid', nodes: [{ ...tree.nodes[0], parentId: 'missing' }] };
  await pool.query(`INSERT INTO recommender_taxonomy_versions (taxonomy_id, version, content, created_by)
    VALUES ($1, $2, $3, 'local-check')`, [invalidStored.id, '1', JSON.stringify(invalidStored)]);
  await request(path(invalidStored.id) + '/publish', 'POST', {}, 422);
  const failed = (await pool.query('SELECT state, content_sha256, published_at FROM recommender_taxonomy_versions WHERE taxonomy_id = $1', [invalidStored.id])).rows[0];
  assert.deepEqual(failed, { state: 'draft', content_sha256: null, published_at: null });
  await pool.query('DELETE FROM recommender_taxonomy_versions WHERE taxonomy_id = $1', [invalidStored.id]);

  const newer = { ...edited, version: '2', nodes: [...edited.nodes, { id: 'example-two', name: 'Outro critério sintético', description: '', parentId: 'criterion-group' }] };
  await request(path(tree.id, '2'), 'PUT', newer);
  const versionTwo = await request(path(tree.id, '2') + '/publish', 'POST', {});
  assert.notEqual(versionTwo.snapshot.sha256, published.snapshot.sha256);
  assert.deepEqual(await request(path(tree.id)), published);
  const items = await request('?state=published&limit=2&offset=0');
  assert.equal(items.length, 2); assert.ok(items.every(item => !('content' in item.snapshot)));
  assert.equal((await request('?state=published&limit=2&offset=2')).length, 1);
  await request('?limit=101', 'GET', undefined, 422);

  const dependencies = [second, published].map(({ state, snapshot }) => ({ state, snapshot }));
  const ref = entry => ({ id: entry.snapshot.content.id, version: entry.snapshot.content.version, format: entry.snapshot.format, sha256: entry.snapshot.sha256 });
  const config = parseRecommenderDefinition(JSON.parse(await readFile(new URL('../config/recommenders/rnf-v2.draft.json', import.meta.url), 'utf8')));
  const originalConfig = structuredClone(config);
  const baseline = JSON.parse(await readFile(new URL('../research/baselines/rnf-v2/reference.json', import.meta.url), 'utf8'));
  config.attributes.push(...dependencies.map((dependency, index) => ({ id: ['additional_languages', 'acceptance_criteria'][index], name: 'Contexto configurado',
    scope: 'artifact', cardinality: 'many', required: false, role: 'context', representation: 'none', valueType: { type: 'taxonomy_node', taxonomy: ref(dependency) } })));
  for (const scenario of baseline.cases) {
    const input = legacyNfrInput(config, baseline.profiles[scenario.targetId], scenario.targetId, 'frozen reconstructed demonstration', dependencies);
    input.values.additional_languages = ['typescript']; input.values.acceptance_criteria = ['example-one'];
    const dataset = { id: 'demo-base', version: '1', source: 'reconstructed_demonstration', records: scenario.historyIds.map(id =>
      legacyNfrInput(config, baseline.profiles[id], id, 'frozen reconstructed demonstration', dependencies)) };
    const run = simulateConfiguredNfr(config, input, dataset, scenario.labelIndex, dependencies);
    assert.deepEqual(run.result.content, scenario.expected);
    assert.equal(run.taxonomies.content.length, 2);
    assert.throws(() => validateRecommendationInput(config, input, [dependencies[0], { state: versionTwo.state, snapshot: versionTwo.snapshot }]));
  }
  const retired = await request(path(tree.id) + '/retire', 'POST', {});
  assert.equal(retired.state, 'retired'); assert.deepEqual(retired.snapshot, published.snapshot);
  assert.deepEqual(await request(path(tree.id)), retired);
  assert.deepEqual(await request(path(tree.id) + '/retire', 'POST', {}), retired);
  await request(path(tree.id) + '/publish', 'POST', {}, 409);
  await request(path(tree.id), 'PUT', tree, 409);
  const input = legacyNfrInput(originalConfig, baseline.profiles.fa, 'fa', 'demonstration');
  assert.throws(() => validateRecommendationInput(config, input, [dependencies[0], { state: retired.state, snapshot: retired.snapshot }]), /indisponível/);
  await request(path(tree.id) + '/retire', 'POST', [], 400);
  assert.deepEqual((await pool.query('SELECT row_to_json(taxonomy_row) AS content FROM taxonomy_versions taxonomy_row ORDER BY id')).rows, wisBefore);
  const guarded = { ...list, id: 'reviewed-taxonomy', version: '1' };
  const firstDraft = await request(path(guarded.id), 'PUT', guarded);
  const editedDraft = await request(path(guarded.id), 'PUT', { ...guarded, name: 'Edited after review' });
  await request(path(guarded.id) + '/publish', 'POST', { expectedDraftSha256: firstDraft.snapshot.sha256 }, 409);
  assert.equal((await request(path(guarded.id))).state, 'draft');
  await request(path(guarded.id) + '/publish', 'POST', { expectedDraftSha256: 'invalid' }, 400);
  const pinned = await request(path(guarded.id) + '/publish', 'POST', { expectedDraftSha256: editedDraft.snapshot.sha256 });
  assert.equal(pinned.snapshot.content.name, 'Edited after review');
  assert.deepEqual(await request(path(guarded.id) + '/publish', 'POST', { expectedDraftSha256: editedDraft.snapshot.sha256 }), pinned);
  await request(path(guarded.id) + '/publish', 'POST', { expectedDraftSha256: firstDraft.snapshot.sha256 }, 409);
  assert.equal((await pool.query('SELECT current_schema() AS name')).rows[0].name, schema);
  console.log('Independent taxonomies: list/tree validation, immutable publication, concurrent publish, rollback, exact references, retirement, internal authorization and 8 RNF comparisons OK.');
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  if (created) await pool.query(`DROP SCHEMA ${schema} CASCADE`);
  await pool.end();
}
