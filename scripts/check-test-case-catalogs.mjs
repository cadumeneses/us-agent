// HTTP/PostgreSQL verification in a disposable schema on the explicit local database only.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--output')) throw new Error('Uso: check:test-case-catalogs [--output arquivo-novo.json]');
const schema = `test_case_check_${randomUUID().replaceAll('-', '')}`;
assert.match(schema, /^test_case_check_[a-f0-9]{32}$/);
process.env.DATABASE_URL = `postgresql://us_agent:us_agent_local@127.0.0.1:5432/us_agent?options=${encodeURIComponent(`-c search_path=${schema}`)}`;
process.env.DATABASE_POOL_MAX = '6'; process.env.NODE_ENV = 'test'; process.env.API_ACCESS_MODE = 'local';
for (const key of ['DATABASE_SSL', 'VERCEL', 'INGEST_API_KEY', 'API_ALLOWED_ORIGINS']) delete process.env[key];
const { pool, withTransaction } = await import('../apps/api/dist/database/pool.js');
const { createApp } = await import('../apps/api/dist/app.js');
const { lockPublishedTestCaseCatalog, publishTestCaseCatalog } = await import('../apps/api/dist/services/test-case-catalogs.js');
const { runTestrecEquationDemo } = await import('../apps/api/dist/services/testrec-equations.js');
const { snapshotContent } = await import('../apps/api/dist/domain/content-snapshot.js');
const root = new URL('../', import.meta.url);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const read = async file => JSON.parse(await readFile(new URL(file, root), 'utf8'));
let server, created = false;
try {
  await pool.query(`CREATE SCHEMA ${schema}`); created = true;
  assert.equal((await pool.query('SELECT current_schema() AS name')).rows[0].name, schema);
  const migrations = new URL('../database/migrations/', import.meta.url);
  for (const file of (await readdir(migrations)).filter(name => name.endsWith('.sql')).sort()) await pool.query(await readFile(new URL(file, migrations), 'utf8'));
  server = createApp().listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const endpoint = `http://127.0.0.1:${server.address().port}/api/internal/test-case-catalogs`;
  const path = (id, version = '1') => `/${id}/versions/${encodeURIComponent(version)}`;
  async function request(suffix = '', method = 'GET', body, expected = 200) {
    const response = await fetch(endpoint + suffix, { method, headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const result = await response.json(); assert.equal(response.status, expected, JSON.stringify(result)); return result;
  }
  const authorization = { basis: 'synthetic', reference: 'US-Agent authored synthetic catalog for local integration verification' };
  async function publish(catalog, bytes = Buffer.from(JSON.stringify(catalog)), options = {}) {
    const form = new FormData();
    form.set('spec', JSON.stringify({ expectedFileSha256: hash(bytes), authorization, ...options.spec }));
    form.set('file', new Blob([bytes]), options.filename ?? 'synthetic-catalog.json');
    const response = await fetch(endpoint + path(options.id ?? catalog.id, catalog.version) + '/publish', { method: 'POST', body: form });
    const result = await response.json(); assert.equal(response.status, options.status ?? 200, JSON.stringify(result)); return result;
  }
  const fixture = await read('research/examples/testrec-e21/synthetic-catalog.json');
  const bytes = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(JSON.stringify(fixture, null, 2).replaceAll('\n', '\r\n'))]);
  assert.deepEqual(await request(), []);
  await publish(fixture, bytes, { spec: { expectedFileSha256: '0'.repeat(64) }, status: 422 });
  await publish(fixture, Buffer.from([0xff]), { status: 422 });
  await publish(fixture, Buffer.from('{"schemaVersion":1,"schemaVersion":1}'), { status: 422 });
  const duplicate = structuredClone(fixture); duplicate.items.push(duplicate.items[0]);
  await publish(duplicate, undefined, { status: 422 });
  await publish(fixture, bytes, { id: 'wrong-path', status: 422 });
  await publish(fixture, bytes, { spec: { authorization: { basis: 'permission', reference: 'Inconsistent fixture' } }, status: 422 });
  assert.equal((await pool.query('SELECT count(*)::int AS count FROM test_case_catalog_versions')).rows[0].count, 0);
  const concurrent = await Promise.all([1, 2].map(() => publish(fixture, bytes)));
  const first = concurrent[0]; assert.deepEqual(concurrent[1], first);
  assert.deepEqual(await request(path(fixture.id)), first);
  const download = await fetch(endpoint + path(fixture.id) + '/original');
  assert.equal(download.status, 200); assert.deepEqual(Buffer.from(await download.arrayBuffer()), bytes);
  assert.equal(download.headers.get('x-content-sha256'), hash(bytes));
  assert.equal(download.headers.get('content-type'), 'application/octet-stream');
  assert.equal(download.headers.get('cache-control'), 'no-store');
  const reference = { id: fixture.id, version: fixture.version, format: first.snapshot.format, sha256: first.snapshot.sha256 };
  assert.deepEqual(await withTransaction(client => lockPublishedTestCaseCatalog(client, reference)), first.snapshot);
  await assert.rejects(withTransaction(client => lockPublishedTestCaseCatalog(client, { ...reference, sha256: '0'.repeat(64) })), /Hash/);
  // Neither inner catalog hash nor another version substitutes for the publication reference.
  await assert.rejects(withTransaction(client => lockPublishedTestCaseCatalog(client, { ...reference, sha256: first.snapshot.content.catalog.sha256 })), /Hash/);
  const changed = structuredClone(fixture); changed.items[0].gherkin += '\nE um passo sintético alterado';
  await publish(changed, undefined, { status: 409 });
  changed.version = '2'; const second = await publish(changed);
  assert.notEqual(second.snapshot.sha256, first.snapshot.sha256);
  assert.deepEqual((await request('?state=published&limit=1&offset=1')).map(row => row.version), ['2']);
  assert.deepEqual((await request('?id=missing')).map(row => row.id), []);
  assert.equal((await request()).length, 2);
  for (const sql of ["UPDATE test_case_catalog_versions SET original_file = decode('00','hex')", "UPDATE test_case_catalog_versions SET published_by = 'changed'",
    "UPDATE test_case_catalog_versions SET publication = '{}'::jsonb", "DELETE FROM test_case_catalog_versions"]) {
    await assert.rejects(pool.query(sql), /immutable/);
  }
  const forced = { ...fixture, id: 'rollback-probe' }, forcedBytes = Buffer.from(JSON.stringify(forced));
  await pool.query("ALTER TABLE test_case_catalog_versions ADD CONSTRAINT forced_rollback CHECK (catalog_id <> 'rollback-probe')");
  await assert.rejects(publishTestCaseCatalog(forced.id, forced.version, forcedBytes, 'forced.json', {
    expectedFileSha256: hash(forcedBytes), authorization }, 'local-check'), error => error.code === '23514');
  await request(path(forced.id), 'GET', undefined, 404);
  // Loaded immutable versions provide their exact artifact text to the existing local demo.
  const definition = await read('config/recommenders/testrec-e21.draft.json');
  const profiles = await read('research/examples/testrec-e21/equations-synthetic.json');
  const oldResult = runTestrecEquationDemo(definition, profiles.target, profiles.dataset, first.snapshot.content.catalog.content);
  const newResult = runTestrecEquationDemo(definition, profiles.target, profiles.dataset, second.snapshot.content.catalog.content);
  assert.equal(oldResult.content.status, 'completed'); assert.equal(newResult.content.status, 'completed');
  assert.notEqual(oldResult.content.items[0].artifact.gherkin, newResult.content.items[0].artifact.gherkin);
  assert.equal(oldResult.content.items[0].score, newResult.content.items[0].score);
  const reader = await pool.connect(); let retirementFinished = false, retirement;
  try {
    await reader.query('BEGIN'); await lockPublishedTestCaseCatalog(reader, reference);
    retirement = request(path(fixture.id) + '/retire', 'POST', {}).then(value => { retirementFinished = true; return value; });
    await delay(100); assert.equal(retirementFinished, false, 'Retirada deve aguardar o lock de uso.');
    await reader.query('COMMIT');
  } finally { await reader.query('ROLLBACK'); reader.release(); }
  const retired = await retirement;
  assert.equal(retired.state, 'retired'); assert.deepEqual(retired.snapshot, first.snapshot);
  assert.deepEqual(await request(path(fixture.id) + '/retire', 'POST', {}), retired);
  await assert.rejects(withTransaction(client => lockPublishedTestCaseCatalog(client, reference)), /disponível/);
  await assert.rejects(pool.query("UPDATE test_case_catalog_versions SET state = 'published', retired_at = NULL WHERE version = '1'"), /immutable/);
  await publish(fixture, bytes, { status: 409 });
  assert.deepEqual((await request(path(fixture.id))).snapshot, first.snapshot);
  const historicalDownload = await fetch(endpoint + path(fixture.id) + '/original');
  assert.deepEqual(Buffer.from(await historicalDownload.arrayBuffer()), bytes);
  await request(path(fixture.id) + '/retire', 'POST', { content: 'change' }, 400);
  process.env.INGEST_API_KEY = 'local-check-only';
  await request('', 'GET', undefined, 401);
  await publish(fixture, bytes, { status: 401 });
  const authenticated = await fetch(endpoint, { headers: { authorization: 'Bearer local-check-only' } });
  assert.equal(authenticated.status, 200); delete process.env.INGEST_API_KEY;
  assert.equal((await pool.query('SELECT current_schema() AS name')).rows[0].name, schema);
  const paths = ['database/migrations/022_test_case_catalogs.sql', 'apps/api/src/domain/test-case-publication.ts',
    'apps/api/src/services/test-case-catalogs.ts', 'apps/api/src/routes/test-case-catalogs.ts', 'apps/api/src/routes/api.ts', 'scripts/check-test-case-catalogs.mjs'];
  const sourceHashes = {};
  for (const file of paths) sourceHashes[file] = hash(await readFile(new URL(file, root)));
  const evidence = snapshotContent({ schemaVersion: 1, kind: 'synthetic_catalog_integration', schema, sourceHashes,
    checks: { originalBytes: true, immutableVersions: true, concurrency: true, rollback: true, retirementLock: true,
      exactReferences: true, internalAuthorization: true, historicalRecovery: true, versionedDemoArtifacts: true },
    publications: [first.snapshot, second.snapshot], limitations: ['no_original_author_data', 'no_persisted_TestRec_run', 'no_UI', 'not_an_empirical_evaluation'] });
  if (args.length) {
    const output = resolve(args[1]); await mkdir(dirname(output), { recursive: true });
    await writeFile(output, JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx' });
  }
  console.log(JSON.stringify({ ...evidence.content.checks, evidenceSha256: evidence.sha256, catalogVersions: 2, localSchema: schema }, null, 2));
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  if (created) {
    assert.equal((await pool.query('SELECT current_schema() AS name')).rows[0].name, schema);
    await pool.query(`DROP SCHEMA ${schema} CASCADE`);
  }
  await pool.end();
}
