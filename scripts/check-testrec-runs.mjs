// Synthetic equation demonstration through the common API; explicit local database only.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { snapshotContent } from '../apps/api/dist/domain/content-snapshot.js';
import { executeMethodRecommendation, canReplayMethod } from '../apps/api/dist/services/method-execution.js';

const args = process.argv.slice(2), root = new URL('../', import.meta.url);
if (args.length && (args.length !== 2 || !['--output', '--replay'].includes(args[0]))) throw new Error('Usage: check:testrec-runs [--output new-file.json | --replay evidence.json]');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const read = async file => JSON.parse(await readFile(new URL(file, root), 'utf8'));
const sourceFiles = [
  'config/recommenders/testrec-equations.draft.json', 'research/examples/testrec-e21/equations-synthetic.json', 'research/examples/testrec-e21/synthetic-catalog.json',
  'apps/api/src/domain/content-snapshot.ts', 'apps/api/src/domain/recommender-definition.ts', 'apps/api/src/domain/recommender-taxonomy.ts',
  'apps/api/src/domain/dataset-import.ts', 'apps/api/src/domain/import-formats.ts', 'apps/api/src/domain/dataset-publication.ts', 'apps/api/src/domain/definition-publication.ts',
  'apps/api/src/domain/test-case-catalog.ts', 'apps/api/src/domain/test-case-publication.ts', 'apps/api/src/domain/test-case-publication-integrity.ts', 'apps/api/src/domain/test-case-dataset.ts',
  'apps/api/src/services/testrec-contract.ts', 'apps/api/src/services/testrec-equations.ts', 'apps/api/src/services/testrec-method.ts', 'apps/api/src/services/recommender-methods.ts',
  'apps/api/src/services/method-execution.ts', 'apps/api/src/services/knn.ts', 'apps/api/src/services/test-case-catalogs.ts',
  'apps/api/src/services/recommender-definitions.ts', 'apps/api/src/services/recommender-datasets.ts', 'apps/api/src/services/recommendation-runs.ts',
  'apps/api/src/services/recommendation-review.ts', 'apps/api/src/routes/recommender-datasets.ts', 'apps/api/src/routes/recommendation-runs.ts',
  'database/migrations/023_test_case_dataset_runs.sql', 'scripts/check-testrec-runs.mjs'
];
async function sourceHashes() { return Object.fromEntries(await Promise.all(sourceFiles.map(async file => [file, hash(await readFile(new URL(file, root)))]))); }
if (args[0] === '--replay') {
  const evidence = JSON.parse(await readFile(resolve(args[1]), 'utf8'));
  assert.equal(snapshotContent(evidence.content).sha256, evidence.sha256); assert.equal(evidence.format, 'us-agent-json-v1');
  assert.deepEqual(await sourceHashes(), evidence.content.sourceHashes, 'Evidence source bytes changed');
  for (const run of evidence.content.runs) {
    const original = run.snapshot.content;
    assert.equal(snapshotContent(original).sha256, run.snapshot.sha256); assert.ok(canReplayMethod(original));
    for (const child of ['request', 'definition', 'dataset', 'catalog', 'projection', 'result', 'explanation']) assert.equal(snapshotContent(original[child].content).sha256, original[child].sha256);
    const replay = executeMethodRecommendation(original.request.content, original.definition.content, original.dataset.content, original.catalog.content);
    for (const child of ['result', 'projection', 'explanation']) assert.equal(replay[child].sha256, original[child].sha256);
  }
  console.log(JSON.stringify({ verified: true, runs: evidence.content.runs.length, sha256: evidence.sha256, scientificReproduction: false }));
} else {
  const schema = `testrec_runs_${randomUUID().replaceAll('-', '')}`;
  assert.match(schema, /^testrec_runs_[a-f0-9]{32}$/);
  process.env.DATABASE_URL = `postgresql://us_agent:us_agent_local@127.0.0.1:5432/us_agent?options=${encodeURIComponent(`-c search_path=${schema}`)}`;
  process.env.DATABASE_POOL_MAX = '6'; process.env.NODE_ENV = 'test'; process.env.API_ACCESS_MODE = 'local';
  for (const key of ['DATABASE_SSL', 'VERCEL', 'INGEST_API_KEY', 'API_ALLOWED_ORIGINS']) delete process.env[key];
  const { pool } = await import('../apps/api/dist/database/pool.js');
  const { createApp } = await import('../apps/api/dist/app.js');
  const { createRecommendationRun } = await import('../apps/api/dist/services/recommendation-runs.js');
  let server, created = false;
  try {
    await pool.query(`CREATE SCHEMA ${schema}`); created = true;
    assert.equal((await pool.query('SELECT current_schema() AS name')).rows[0].name, schema);
    const migrations = new URL('../database/migrations/', import.meta.url);
    for (const file of (await readdir(migrations)).filter(name => name.endsWith('.sql')).sort()) await pool.query(await readFile(new URL(file, migrations), 'utf8'));
    server = createApp().listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    const endpoint = `http://127.0.0.1:${server.address().port}/api/internal`, checks = [];
    const path = (id, version = '1') => `/${id}/versions/${encodeURIComponent(version)}`;
    const ref = record => ({ id: record.snapshot.content.id ?? record.definition.id, version: record.snapshot.content.version ?? record.definition.version,
      format: record.snapshot.format, sha256: record.snapshot.sha256 });
    async function request(resource, suffix = '', method = 'GET', body, expected = 200) {
      const response = await fetch(`${endpoint}/${resource}${suffix}`, { method, headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      const result = await response.json(); assert.equal(response.status, expected, JSON.stringify(result)); return result;
    }
    async function upload(resource, suffix, bytes, spec, expected) {
      const form = new FormData(); form.set('spec', JSON.stringify(spec)); form.set('file', new Blob([bytes]), 'synthetic.json');
      const response = await fetch(`${endpoint}/${resource}${suffix}`, { method: 'POST', body: form });
      const result = await response.json(); assert.equal(response.status, expected, JSON.stringify(result)); return result;
    }
    const runRequest = (...values) => request('recommendation-runs', ...values);
    const authorization = { basis: 'synthetic', reference: 'US-Agent authored fixture; not original author data' };
    const catalogSource = await read('research/examples/testrec-e21/synthetic-catalog.json');
    async function publishCatalog(content) {
      const bytes = Buffer.from(JSON.stringify(content));
      return upload('test-case-catalogs', path(content.id, content.version) + '/publish', bytes, { expectedFileSha256: hash(bytes), authorization }, 200);
    }
    const catalog = await publishCatalog(catalogSource), draft = await read('config/recommenders/testrec-equations.draft.json');
    const source = await read('research/examples/testrec-e21/equations-synthetic.json');
    const dataOnly = await read('config/recommenders/testrec-e21.draft.json');
    await request('recommender-definitions', path(dataOnly.id, dataOnly.version), 'PUT', dataOnly);
    await request('recommender-definitions', path(dataOnly.id, dataOnly.version) + '/publish', 'POST', {}, 422);
    const saved = await request('recommender-definitions', path(draft.id, draft.version), 'PUT', draft);
    const definition = await request('recommender-definitions', path(draft.id, draft.version) + '/publish', 'POST', { expectedDraftSha256: saved.draftSha256 });
    const makeSpec = (id, cat = catalog, version = '1') => ({ schemaVersion: 2, id, version, format: 'json', definition: ref(definition), catalog: ref(cat),
      source: { description: 'Synthetic E21 equation profiles', authorization },
      mapping: { recordId: ['id'], attributes: Object.fromEntries(draft.attributes.map(attribute => [attribute.id, { path: ['values', attribute.id], encoding: 'value' }])) } });
    const spec = makeSpec('testrec-base'), bytes = Buffer.from(JSON.stringify(source.dataset.records));
    const preview = await upload('recommender-datasets', '/imports/preview', bytes, spec, 201);
    assert.equal(preview.snapshot.content.report.valid, 4); assert.equal(preview.snapshot.content.report.invalid, 1);
    assert.deepEqual(preview.snapshot.content.catalog, catalog.snapshot);
    assert.deepEqual(await request('recommender-datasets', `/imports/${preview.id}`), preview);
    const originalFile = await fetch(`${endpoint}/recommender-datasets/imports/${preview.id}/original`);
    assert.equal(originalFile.status, 200); assert.deepEqual(Buffer.from(await originalFile.arrayBuffer()), bytes);
    const publish = (p, excluded = [], expected = 200) => request('recommender-datasets', path(p.snapshot.content.spec.id, p.snapshot.content.spec.version) + '/publish',
      'POST', { importId: p.id, previewSha256: p.snapshot.sha256, excludedOrdinals: excluded }, expected);
    await publish(preview, [], 422);
    const base = await publish(preview, [5]); assert.deepEqual(base.snapshot.content.catalog, ref(catalog));
    const { catalog: _catalog, ...oldSpec } = spec;
    await upload('recommender-datasets', '/imports/preview', bytes, { ...oldSpec, schemaVersion: 1 }, 422);
    await upload('recommender-datasets', '/imports/preview', bytes, { ...spec, catalog: { ...spec.catalog, sha256: '0'.repeat(64) } }, 422);
    await upload('recommender-datasets', '/imports/preview', bytes, { ...spec, source: { ...spec.source, authorization: { basis: 'permission', reference: 'Declared' } } }, 422);
    checks.push('Common definition publication, catalog-bound import, exact original bytes and explicit invalid-row exclusion');
    const body = { id: randomUUID(), definition: ref(definition), dataset: ref(base), catalog: ref(catalog), input: source.target };
    const run = await runRequest('', 'POST', body, 201), result = run.snapshot.content.result.content;
    assert.equal(result.status, 'completed'); assert.equal(result.scientificReproduction, false);
    assert.deepEqual(result.neighbors.map(row => row.recordId), source.expected.neighborIds);
    for (const item of result.items) { assert.equal(item.score, source.expected.scores[item.testCaseId]); assert.deepEqual(item.artifact, catalogSource.items.find(row => row.id === item.testCaseId)); }
    assert.deepEqual(run.snapshot.content.catalog, catalog.snapshot);
    assert.equal((await runRequest(`/${run.id}/replay`, 'POST', {})).verified, true);
    assert.deepEqual(await runRequest(`/${run.id}`), run); assert.equal((await runRequest())[0].id, run.id);
    const concurrentBody = { ...body, id: randomUUID() };
    const concurrent = await Promise.all([1, 2].map(() => runRequest('', 'POST', concurrentBody, 201)));
    assert.deepEqual(concurrent[0], concurrent[1]);
    assert.equal((await pool.query('SELECT 1 FROM recommender_runs WHERE id = $1', [concurrentBody.id])).rowCount, 1);
    await runRequest('', 'POST', { ...concurrentBody, input: { ...body.input, id: 'changed' } }, 409);
    const { catalog: _dependency, ...withoutCatalog } = body;
    await runRequest('', 'POST', { ...withoutCatalog, id: randomUUID() }, 422);
    await runRequest('', 'POST', { ...body, id: randomUUID(), selection: { labelIndex: 0 } }, 422);
    await runRequest('', 'POST', { ...body, id: randomUUID(), catalog: { ...body.catalog, sha256: '0'.repeat(64) } }, 422);
    await runRequest('', 'POST', { ...body, id: randomUUID(), dataset: { ...body.dataset, sha256: '0'.repeat(64) } }, 422);
    checks.push('K=3, exact synthetic scores/artifacts, cross-module neighbor, history, replay, idempotent concurrency, rejected incompatible requests');
    const nextCatalog = structuredClone(catalogSource); nextCatalog.version = '2'; nextCatalog.items[0].title += ' v2';
    const catalog2 = await publishCatalog(nextCatalog), spec2 = makeSpec('testrec-base', catalog2, '2');
    const preview2 = await upload('recommender-datasets', '/imports/preview', bytes, spec2, 201), base2 = await publish(preview2, [5]);
    await runRequest('', 'POST', { ...body, id: randomUUID(), catalog: ref(catalog2) }, 422);
    const run2 = await runRequest('', 'POST', { ...body, id: randomUUID(), catalog: ref(catalog2), dataset: ref(base2) }, 201);
    assert.deepEqual(run2.snapshot.content.result.content.items[0].artifact, nextCatalog.items.find(row => row.id === run2.snapshot.content.result.content.items[0].testCaseId));
    assert.deepEqual(await runRequest(`/${run.id}`), run);
    const badRows = structuredClone(source.dataset.records.slice(0, 4)); badRows[0].values.test_case_ids = ['unknown']; badRows.push({ ...badRows[1] });
    const badPreview = await upload('recommender-datasets', '/imports/preview', Buffer.from(JSON.stringify(badRows)), makeSpec('invalid-profiles'), 201);
    assert.equal(badPreview.snapshot.content.report.invalid, 1); assert.ok(badPreview.snapshot.content.report.duplicate > 0);
    await publish(badPreview, [], 422);
    async function runRows(id, rows) {
      const p = await upload('recommender-datasets', '/imports/preview', Buffer.from(JSON.stringify(rows)), makeSpec(id), 201), b = await publish(p);
      return runRequest('', 'POST', { ...body, id: randomUUID(), dataset: ref(b) }, 201);
    }
    const emptyRows = structuredClone(source.dataset.records.slice(0, 4)); emptyRows.forEach(row => { row.values.test_case_ids = []; });
    const empty = await runRows('empty-associations', emptyRows); assert.equal(empty.snapshot.content.result.content.status, 'no_items');
    const insufficient = await runRows('insufficient-profiles', source.dataset.records.slice(0, 2)); assert.equal(insufficient.snapshot.content.result.content.status, 'blocked');
    const leaked = await runRequest('', 'POST', { ...body, id: randomUUID(), input: { ...body.input, values: { ...body.input.values, test_case_ids: ['demo-create'] } } }, 201);
    assert.equal(leaked.snapshot.content.result.content.status, 'blocked');
    checks.push('Version isolation, unknown/duplicate profiles, known empty outputs, insufficient candidates and target output leakage');
    await runRequest(`/${run.id}/review`, 'GET', undefined, 422);
    await runRequest(`/${run.id}/destinations/1`, 'GET', undefined, 422);
    await runRequest(`/${run.id}/target`, 'POST', { runSha256: run.snapshot.sha256, target: { kind: 'input' } }, 422);
    await runRequest(`/${run.id}/decisions`, 'POST', { id: randomUUID(), runSha256: run.snapshot.sha256, targetSha256: '0'.repeat(64), itemKey: result.items[0].key, decision: 'accepted' }, 422);
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM recommender_run_targets')).rows[0].count, 0);
    await assert.rejects(pool.query('UPDATE recommender_runs SET content = content WHERE id = $1', [run.id]), /immutable/);
    await assert.rejects(pool.query('DELETE FROM recommender_runs WHERE id = $1', [run.id]), /immutable/);
    const forced = { ...body, id: randomUUID() }; assert.match(forced.id, /^[a-f0-9-]{36}$/);
    await pool.query(`ALTER TABLE recommender_runs ADD CONSTRAINT forced_testrec_rollback CHECK (id <> '${forced.id}'::uuid)`);
    await assert.rejects(createRecommendationRun(forced, 'local-check'), error => error.code === '23514');
    await runRequest(`/${forced.id}`, 'GET', undefined, 404);
    await pool.query('ALTER TABLE recommender_runs DROP CONSTRAINT forced_testrec_rollback');
    checks.push('Test results cannot enter RNF review/materialization, immutable persisted execution and transactional rollback');
    const pendingPreview = await upload('recommender-datasets', '/imports/preview', bytes, makeSpec('retirement-pending'), 201);
    // Retirement winning the catalog row lock must block a concurrent new run.
    const blocker = await pool.connect(); let pending, committed = false;
    const racing = { ...body, id: randomUUID() };
    try {
      await blocker.query('BEGIN'); const pid = (await blocker.query('SELECT pg_backend_pid() AS id')).rows[0].id;
      await blocker.query('SELECT 1 FROM test_case_catalog_versions WHERE catalog_id = $1 AND version = $2 FOR UPDATE', [catalogSource.id, catalogSource.version]);
      pending = runRequest('', 'POST', racing, 422); pending.catch(() => {});
      let waiting = false; const deadline = Date.now() + 10_000;
      while (Date.now() < deadline) {
        waiting = (await pool.query("SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND $1 = ANY(pg_blocking_pids(pid))) AS waiting", [pid])).rows[0].waiting;
        if (waiting) break; await delay(30);
      }
      assert.ok(waiting);
      await blocker.query("UPDATE test_case_catalog_versions SET state = 'retired', retired_at = NOW() WHERE catalog_id = $1 AND version = $2", [catalogSource.id, catalogSource.version]);
      await blocker.query('COMMIT'); committed = true;
    } finally { if (!committed) await blocker.query('ROLLBACK'); blocker.release(); }
    await pending; await runRequest(`/${racing.id}`, 'GET', undefined, 404);
    await publish(pendingPreview, [5], 422);
    await upload('recommender-datasets', '/imports/preview', bytes, makeSpec('retired-catalog'), 422);
    await runRequest('', 'POST', { ...body, id: randomUUID() }, 422);
    await request('recommender-datasets', path(spec.id) + '/retire', 'POST', {});
    await request('recommender-definitions', path(draft.id, draft.version) + '/retire', 'POST', {});
    assert.deepEqual(await runRequest('', 'POST', body, 201), run);
    assert.deepEqual(await runRequest(`/${run.id}`), run);
    for (const r of [run, run2, empty, insufficient, leaked]) assert.equal((await runRequest(`/${r.id}/replay`, 'POST', {})).verified, true);
    process.env.INGEST_API_KEY = 'synthetic-local-check';
    await runRequest('', 'GET', undefined, 401); await runRequest('', 'POST', body, 401);
    delete process.env.INGEST_API_KEY;
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM classifications')).rows[0].count, 0);
    checks.push('Catalog retirement race blocks new use/publication; replay and idempotent history survive retirement; authorization remains global');
    const evidence = snapshotContent({ schemaVersion: 1, kind: 'published_e21_equations_demonstration', scientificReproduction: false,
      limits: ['Synthetic data only', 'Manhattan equations, not the original selected Euclidean configuration', 'Q01/Q02 remain unresolved', 'No empirical accuracy claim', 'Web and test-specific assessment pending'],
      sourceHashes: await sourceHashes(), checks, runs: [run, run2, empty, insufficient, leaked] });
    if (args[0] === '--output') { const output = resolve(args[1]); await mkdir(dirname(output), { recursive: true }); await writeFile(output, JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx' }); }
    console.log(JSON.stringify({ checks, runs: evidence.content.runs.length, sha256: evidence.sha256, scientificReproduction: false }, null, 2));
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (created) await pool.query(`DROP SCHEMA ${schema} CASCADE`);
    await pool.end();
  }
}
