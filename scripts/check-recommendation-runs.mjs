// Published executions and replay in a disposable LOCAL PostgreSQL schema.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { checkRecommendationReview } from './check-recommendation-review.mjs';
const schema = `recommendation_check_${randomUUID().replaceAll('-', '')}`;
assert.match(schema, /^recommendation_check_[a-f0-9]{32}$/);
process.env.DATABASE_URL = `postgresql://us_agent:us_agent_local@127.0.0.1:5432/us_agent?options=${encodeURIComponent(`-c search_path=${schema}`)}`;
process.env.DATABASE_POOL_MAX = '6';
for (const key of ['DATABASE_SSL', 'VERCEL', 'INGEST_API_KEY']) delete process.env[key];
const { pool } = await import('../apps/api/dist/database/pool.js');
const { createApp } = await import('../apps/api/dist/app.js');
const { legacyNfrInput } = await import('../apps/api/dist/services/configured-nfr.js');
const { createRecommendationRun } = await import('../apps/api/dist/services/recommendation-runs.js');
const { checkNfrBaseline } = await import('../apps/api/dist/evaluation/nfr-baseline.js');
let server, created = false;
try {
  await pool.query(`CREATE SCHEMA ${schema}`); created = true;
  const migrations = new URL('../database/migrations/', import.meta.url);
  for (const file of (await readdir(migrations)).filter(name => name.endsWith('.sql')).sort()) await pool.query(await readFile(new URL(file, migrations), 'utf8'));
  server = createApp().listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const root = `http://127.0.0.1:${server.address().port}/api/internal`;
  const path = (id, version = '1') => `/${id}/versions/${encodeURIComponent(version)}`;
  async function request(resource, suffix = '', method = 'GET', body, expected = 200, authorization) {
    const response = await fetch(`${root}/${resource}${suffix}`, { method, headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(authorization ? { authorization } : {})
    }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const result = await response.json(); assert.equal(response.status, expected, JSON.stringify(result)); return result;
  }
  const runRequest = (...args) => request('recommendation-runs', ...args);
  const ref = (record, id, version) => ({ id, version, format: record.snapshot.format, sha256: record.snapshot.sha256 });
  async function publishDefinition(draft) {
    await request('recommender-definitions', path(draft.id, draft.version), 'PUT', draft);
    return request('recommender-definitions', path(draft.id, draft.version) + '/publish', 'POST', {});
  }
  async function publishDataset(id, draft, definition, records, version = '1') {
    const spec = { schemaVersion: 1, id, version, format: 'json', definition: ref(definition, draft.id, draft.version),
      source: { description: 'Frozen reconstructed demonstration', authorization: { basis: 'synthetic', reference: 'Not an author dataset' } },
      mapping: { recordId: ['id'], attributes: Object.fromEntries(draft.attributes.map(attribute => [attribute.id, { path: ['values', attribute.id], encoding: 'value' }])) } };
    const form = new FormData(); form.set('spec', JSON.stringify(spec)); form.set('file', new Blob([JSON.stringify(records)]), 'demo.json');
    const response = await fetch(`${root}/recommender-datasets/imports/preview`, { method: 'POST', body: form });
    const imported = await response.json(); assert.equal(response.status, 201, JSON.stringify(imported));
    assert.equal(imported.snapshot.content.report.valid, records.length);
    return request('recommender-datasets', path(id, version) + '/publish', 'POST', { importId: imported.id, previewSha256: imported.snapshot.sha256, excludedOrdinals: [] });
  }
  const template = JSON.parse(await readFile(new URL('../config/recommenders/rnf-v2.draft.json', import.meta.url), 'utf8'));
  const referenceText = await readFile(new URL('../research/baselines/rnf-v2/reference.json', import.meta.url), 'utf8');
  checkNfrBaseline(referenceText, await readFile(new URL('../research/baselines/rnf-v2/manifest.json', import.meta.url), 'utf8'));
  const reference = JSON.parse(referenceText), definition = await publishDefinition(template);
  const input = id => legacyNfrInput(template, reference.profiles[id], id, 'frozen demonstration');
  const requests = [], runs = [], bases = [];
  assert.deepEqual(await runRequest(), []);
  for (const [index, scenario] of reference.cases.entries()) {
    const baseId = `frozen-${index}`, base = await publishDataset(baseId, template, definition, scenario.historyIds.map(id => input(id)));
    const body = { id: randomUUID(), definition: ref(definition, template.id, template.version), dataset: ref(base, baseId, '1'), input: input(scenario.targetId), selection: { labelIndex: scenario.labelIndex } };
    const run = await runRequest('', 'POST', body, 201);
    assert.deepEqual(run.snapshot.content.result.content, scenario.expected, scenario.id);
    assert.equal(run.snapshot.content.dataset.sha256, base.snapshot.sha256);
    assert.equal(run.snapshot.content.definition.sha256, definition.snapshot.sha256);
    assert.deepEqual(await runRequest(`/${run.id}`), run);
    assert.equal((await runRequest(`/${run.id}/replay`, 'POST', {})).verified, true);
    runs.push(run); requests.push(body); bases.push(base);
  }
  const concurrentBody = { ...requests[0], id: randomUUID() };
  const concurrent = await Promise.all([1, 2].map(() => runRequest('', 'POST', concurrentBody, 201)));
  assert.deepEqual(concurrent[0], concurrent[1]);
  assert.equal((await pool.query('SELECT 1 FROM recommender_runs WHERE id = $1', [concurrentBody.id])).rowCount, 1);
  await runRequest('', 'POST', { ...concurrentBody, selection: { labelIndex: 1 } }, 409);
  process.env.INGEST_API_KEY = 'local-check-only';
  await runRequest('', 'GET', undefined, 401);
  await runRequest('', 'POST', requests[0], 401);
  await runRequest('', 'GET', undefined, 200, 'Bearer local-check-only');
  delete process.env.INGEST_API_KEY; process.env.VERCEL = '1';
  await runRequest('', 'GET', undefined, 503); delete process.env.VERCEL;

  // Each explicit base gives its own neighbor; the better neighbor in another base is not consulted.
  const f4 = await publishDataset('only-f4', template, definition, [input('f4')]);
  const f5 = await publishDataset('only-f5', template, definition, [input('f5')]);
  const selectedBase = async (base, id) => runRequest('', 'POST', { ...requests[0], id: randomUUID(), dataset: ref(base, id, '1') }, 201);
  assert.equal((await selectedBase(f4, 'only-f4')).snapshot.content.result.content.neighbor.classificationId, reference.profiles.f4.classificationId);
  assert.equal((await selectedBase(f5, 'only-f5')).snapshot.content.result.content.neighbor.classificationId, reference.profiles.f5.classificationId);
  const wrongHash = { ...requests[0], id: randomUUID(), dataset: { ...requests[0].dataset, sha256: '0'.repeat(64) } };
  await runRequest('', 'POST', wrongHash, 422);
  await runRequest(`/${wrongHash.id}`, 'GET', undefined, 404);
  await runRequest('', 'POST', { ...requests[0], id: randomUUID(), dataset: { ...requests[0].dataset, version: 'missing' } }, 422);
  const otherDraft = { ...template, version: 'other-version' }, otherDefinition = await publishDefinition(otherDraft);
  await runRequest('', 'POST', { ...requests[0], id: randomUUID(), definition: ref(otherDefinition, otherDraft.id, otherDraft.version) }, 422);
  await runRequest('', 'POST', { ...requests[0], id: randomUUID(), selection: { labelIndex: 0 }, arbitraryPolicy: 'change-distance' }, 422);
  const malformed = structuredClone(requests[0]); malformed.id = randomUUID(); malformed.input.values.platforms = 'Web';
  await runRequest('', 'POST', malformed, 422);
  const blocked = await runRequest('', 'POST', { ...requests[0], id: randomUUID(), selection: { labelIndex: -1 } }, 201);
  assert.equal(blocked.snapshot.content.result.content.status, 'blocked');
  await assert.rejects(pool.query('UPDATE recommender_runs SET content = content WHERE id = $1', [runs[0].id]), /immutable/);
  await assert.rejects(pool.query('DELETE FROM recommender_runs WHERE id = $1', [runs[0].id]), /immutable/);
  const forced = { ...requests[0], id: randomUUID() };
  assert.match(forced.id, /^[a-f0-9-]{36}$/);
  await pool.query(`ALTER TABLE recommender_runs ADD CONSTRAINT forced_rollback CHECK (id <> '${forced.id}'::uuid)`);
  await assert.rejects(createRecommendationRun(forced, 'local-check'), error => error.code === '23514');
  await runRequest(`/${forced.id}`, 'GET', undefined, 404);
  await pool.query('ALTER TABLE recommender_runs DROP CONSTRAINT forced_rollback');
  assert.equal((await runRequest('?limit=2')).length, 2);
  assert.equal((await runRequest('?limit=2&offset=2')).length, 2);

  // Taxonomic IDs project by explicit legacy names, independent of their display names.
  const catalog = { schemaVersion: 1, id: 'platform-demo', version: '1', name: 'Plataformas sintéticas', kind: 'list', selection: 'any', source: 'Synthetic demonstration',
    nodes: [{ id: 'browser', name: 'Nome de apresentação', description: '', parentId: null }] };
  await request('recommender-taxonomies', path(catalog.id), 'PUT', catalog);
  const taxonomy = await request('recommender-taxonomies', path(catalog.id) + '/publish', 'POST', {});
  const mapped = structuredClone(template); mapped.id = 'mapped-rnf'; mapped.version = '1';
  mapped.attributes.find(attribute => attribute.id === 'platforms').valueType = { type: 'taxonomy_node', taxonomy: ref(taxonomy, catalog.id, '1') };
  await request('recommender-definitions', path(mapped.id), 'PUT', mapped);
  await request('recommender-definitions', path(mapped.id) + '/publish', 'POST', {}, 422);
  mapped.method.parameters.legacy_names = { platforms: { browser: 'Web', unknown: 'Other' } };
  await request('recommender-definitions', path(mapped.id), 'PUT', mapped);
  await request('recommender-definitions', path(mapped.id) + '/publish', 'POST', {}, 422);
  mapped.method.parameters.legacy_names = { platforms: { browser: 'Web' } };
  const mappedDefinition = await publishDefinition(mapped);
  const dependencies = mappedDefinition.snapshot.content.taxonomies;
  const mappedInput = id => legacyNfrInput(mapped, reference.profiles[id], id, 'frozen demonstration', dependencies);
  const mappedBase = await publishDataset('mapped-base', mapped, mappedDefinition, [mappedInput('f4')]);
  const mappedRequest = { id: randomUUID(), definition: ref(mappedDefinition, mapped.id, '1'), dataset: ref(mappedBase, 'mapped-base', '1'), input: mappedInput('fa'), selection: { labelIndex: 0 } };
  const mappedRun = await runRequest('', 'POST', mappedRequest, 201);
  assert.deepEqual(mappedRun.snapshot.content.request.content.input.values.platforms, ['browser']);
  assert.deepEqual(mappedRun.snapshot.content.projection.content.target.projectProfile.platforms, ['Web']);
  assert.equal(mappedRun.snapshot.content.result.content.neighbor.similarity, 1);

  // A dependency retirement that wins the row lock prevents this new run; no partial evidence is inserted.
  const blocker = await pool.connect(); let pending, committed = false;
  const racing = { ...mappedRequest, id: randomUUID() };
  try {
    await blocker.query('BEGIN'); const pid = (await blocker.query('SELECT pg_backend_pid() AS id')).rows[0].id;
    await blocker.query('SELECT 1 FROM recommender_taxonomy_versions WHERE taxonomy_id = $1 FOR UPDATE', [catalog.id]);
    pending = runRequest('', 'POST', racing, 422); pending.catch(() => {});
    let waiting = false; const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      waiting = (await pool.query("SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND $1 = ANY(pg_blocking_pids(pid))) AS waiting", [pid])).rows[0].waiting;
      if (waiting) break; await delay(30);
    }
    assert.ok(waiting);
    await blocker.query("UPDATE recommender_taxonomy_versions SET state = 'retired', updated_at = NOW() WHERE taxonomy_id = $1", [catalog.id]);
    await blocker.query('COMMIT'); committed = true;
  } finally { if (!committed) await blocker.query('ROLLBACK'); blocker.release(); }
  await pending; await runRequest(`/${racing.id}`, 'GET', undefined, 404);
  assert.equal((await runRequest(`/${mappedRun.id}/replay`, 'POST', {})).verified, true);
  await request('recommender-datasets', path('only-f4') + '/retire', 'POST', {});
  await runRequest('', 'POST', { ...requests[0], id: randomUUID(), dataset: ref(f4, 'only-f4', '1') }, 422);
  await request('recommender-datasets', path('frozen-0') + '/retire', 'POST', {});
  await request('recommender-definitions', path(template.id, template.version) + '/retire', 'POST', {});
  await runRequest('', 'POST', { ...requests[0], id: randomUUID() }, 422);
  assert.deepEqual(await runRequest(`/${runs[0].id}`), runs[0]);
  assert.deepEqual(await runRequest('', 'POST', requests[0], 201), runs[0]);
  assert.equal((await runRequest(`/${runs[0].id}/replay`, 'POST', {})).verified, true);
  assert.equal((await pool.query('SELECT count(*)::int AS count FROM classifications')).rows[0].count, 0);
  await checkRecommendationReview({ pool, request, publishDefinition, publishDataset, template, reference, legacyNfrInput });
  assert.equal((await pool.query('SELECT current_schema() AS name')).rows[0].name, schema);
  console.log('Published runs: 8 legacy comparisons, selected-base isolation, exact dependencies, ID mapping, concurrency, immutable evidence, rollback and replay after retirement OK.');
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  if (created) await pool.query(`DROP SCHEMA ${schema} CASCADE`);
  await pool.end();
}
