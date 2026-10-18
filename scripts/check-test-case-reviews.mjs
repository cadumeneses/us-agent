// Real HTTP/PostgreSQL checks in a disposable, explicitly local schema; synthetic data only.
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { snapshotContent } from '../apps/api/dist/domain/content-snapshot.js';
import { buildTestTarget, buildTestDecision, buildTestCopy } from '../apps/api/dist/domain/test-case-review.js';
const args = process.argv.slice(2), root = new URL('../', import.meta.url);
if (args.length && (args.length !== 2 || !['--output', '--replay'].includes(args[0]))) throw new Error('Usage: check:test-case-reviews [--output new-file.json | --replay evidence.json]');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const read = async file => JSON.parse(await readFile(new URL(file, root), 'utf8'));
const files = ['apps/api/src/domain/test-case-review.ts', 'apps/api/src/services/test-case-review.ts', 'apps/api/src/routes/test-case-review.ts',
  'database/migrations/024_test_case_reviews.sql', 'scripts/check-test-case-reviews.mjs'];
const sources = async () => Object.fromEntries(await Promise.all(files.map(async file => [file, hash(await readFile(new URL(file, root)))])));
if (args[0] === '--replay') {
  const evidence = JSON.parse(await readFile(resolve(args[1]), 'utf8')), data = evidence.content;
  assert.equal(snapshotContent(data).sha256, evidence.sha256); assert.deepEqual(await sources(), data.sourceHashes);
  assert.equal(snapshotContent(data.run.snapshot.content).sha256, data.run.snapshot.sha256);
  assert.equal(buildTestTarget(data.run, data.target.snapshot.content.request.content).sha256, data.target.snapshot.sha256);
  for (const decision of data.decisions) assert.equal(buildTestDecision(data.run, data.target.snapshot, decision.snapshot.content.request.content).sha256, decision.snapshot.sha256);
  for (const copy of data.copies) {
    const decision = data.decisions.find(row => row.id === copy.snapshot.content.decision.id);
    const previous = data.copies.find(row => row.id === copy.snapshot.content.previous?.id);
    assert.equal(buildTestCopy(data.run, data.target.snapshot, decision.snapshot, previous?.snapshot ?? null, copy.snapshot.content.request.content).sha256, copy.snapshot.sha256);
  }
  console.log(JSON.stringify({ verified: true, decisions: data.decisions.length, copies: data.copies.length, sha256: evidence.sha256 }));
} else {
  const schema = `test_review_${randomUUID().replaceAll('-', '')}`; assert.match(schema, /^test_review_[a-f0-9]{32}$/);
  process.env.DATABASE_URL = `postgresql://us_agent:us_agent_local@127.0.0.1:5432/us_agent?options=${encodeURIComponent(`-c search_path=${schema}`)}`;
  process.env.DATABASE_POOL_MAX = '6'; process.env.API_ACCESS_MODE = 'local'; process.env.NODE_ENV = 'test';
  for (const key of ['DATABASE_SSL', 'VERCEL', 'INGEST_API_KEY', 'API_ALLOWED_ORIGINS']) delete process.env[key];
  const { pool } = await import('../apps/api/dist/database/pool.js');
  const { createApp } = await import('../apps/api/dist/app.js');
  const { createTestCopy } = await import('../apps/api/dist/services/test-case-review.js');
  let server, created = false;
  try {
    await pool.query(`CREATE SCHEMA ${schema}`); created = true;
    assert.equal((await pool.query('SELECT current_schema() AS name')).rows[0].name, schema);
    const migrations = new URL('../database/migrations/', import.meta.url);
    for (const file of (await readdir(migrations)).filter(file => file.endsWith('.sql')).sort()) await pool.query(await readFile(new URL(file, migrations), 'utf8'));
    server = createApp().listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    const endpoint = `http://127.0.0.1:${server.address().port}/api/internal`, checks = [];
    const path = (id, version) => `/${id}/versions/${encodeURIComponent(version)}`;
    async function request(resource, suffix = '', method = 'GET', body, expected = 200) {
      const response = await fetch(`${endpoint}/${resource}${suffix}`, { method, headers: body === undefined ? {} : { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      const result = await response.json(); assert.equal(response.status, expected, JSON.stringify(result)); return result;
    }
    async function upload(resource, suffix, bytes, spec, expected) {
      const form = new FormData(); form.set('spec', JSON.stringify(spec)); form.set('file', new Blob([bytes]), 'synthetic.json');
      const response = await fetch(`${endpoint}/${resource}${suffix}`, { method: 'POST', body: form });
      const result = await response.json(); assert.equal(response.status, expected, JSON.stringify(result)); return result;
    }
    const ref = record => ({ id: record.snapshot.content.id ?? record.definition.id, version: record.snapshot.content.version ?? record.definition.version, format: record.snapshot.format, sha256: record.snapshot.sha256 });
    const draft = await read('config/recommenders/testrec-equations.draft.json'), source = await read('research/examples/testrec-e21/equations-synthetic.json'), catalogSource = await read('research/examples/testrec-e21/synthetic-catalog.json');
    const bytes = Buffer.from(JSON.stringify(catalogSource)), authorization = { basis: 'synthetic', reference: 'Authored local review fixture' };
    const catalog = await upload('test-case-catalogs', path(catalogSource.id, catalogSource.version) + '/publish', bytes, { expectedFileSha256: hash(bytes), authorization }, 200);
    await request('recommender-definitions', path(draft.id, draft.version), 'PUT', draft);
    const definition = await request('recommender-definitions', path(draft.id, draft.version) + '/publish', 'POST', {});
    const spec = { schemaVersion: 2, id: 'review-base', version: '1', definition: ref(definition), catalog: ref(catalog), format: 'json',
      source: { description: 'Synthetic assessment profiles', authorization }, mapping: { recordId: ['id'], attributes: Object.fromEntries(draft.attributes.map(row => [row.id, { path: ['values', row.id], encoding: 'value' }])) } };
    const preview = await upload('recommender-datasets', '/imports/preview', Buffer.from(JSON.stringify(source.dataset.records)), spec, 201);
    const base = await request('recommender-datasets', path(spec.id, spec.version) + '/publish', 'POST', { importId: preview.id, previewSha256: preview.snapshot.sha256, excludedOrdinals: [5] });
    const body = { id: randomUUID(), definition: ref(definition), dataset: ref(base), catalog: ref(catalog), input: source.target };
    const run = await request('recommendation-runs', '', 'POST', body, 201), before = run.snapshot.sha256;
    const review = (suffix = '', method = 'GET', value, expected = 200, runId = run.id) => request('test-case-reviews', `/${runId}${suffix}`, method, value, expected);
    assert.equal((await review()).target, null);
    const targetBody = { runSha256: before, target: { kind: 'input' } };
    await review('/target', 'POST', { ...targetBody, runSha256: '0'.repeat(64) }, 422);
    await review('/target', 'POST', { ...targetBody, target: { kind: 'classification', classificationId: '1' } }, 422);
    const targetResults = await Promise.all([1, 2].map(() => review('/target', 'POST', targetBody))), target = targetResults[0]; assert.deepEqual(targetResults[1], target);
    const [first, second] = run.snapshot.content.result.content.items;
    const decisionBody = { id: randomUUID(), runSha256: before, targetSha256: target.snapshot.sha256, itemKey: first.key, decision: 'accepted', notes: 'Relevant to this synthetic target' };
    const acceptedResults = await Promise.all([1, 2].map(() => review('/decisions', 'POST', decisionBody))), accepted = acceptedResults[0]; assert.deepEqual(acceptedResults[1], accepted);
    assert.deepEqual(await review('/decisions', 'POST', { ...decisionBody, id: randomUUID() }), accepted);
    await review('/decisions', 'POST', { ...decisionBody, decision: 'rejected' }, 409);
    await review('/decisions', 'POST', { ...decisionBody, id: randomUUID(), itemKey: '0'.repeat(64) }, 422);
    const rejected = await review('/decisions', 'POST', { ...decisionBody, id: randomUUID(), itemKey: second.key, decision: 'rejected', notes: 'Not selected for the target' });
    checks.push('Explicit input destination; exact run/item hashes; immutable, idempotent accept/reject with concurrent retries');
    const copyBody = { id: randomUUID(), runSha256: before, targetSha256: target.snapshot.sha256, decisionId: accepted.id, itemKey: first.key,
      previousCopy: null, title: first.artifact.title, gherkin: first.artifact.gherkin, reason: 'Preserve an unchanged copy for this target' };
    await review('/copies', 'POST', { ...copyBody, id: randomUUID(), decisionId: rejected.id, itemKey: second.key }, 422);
    await review('/copies', 'POST', { ...copyBody, id: randomUUID(), metadata: { replaced: true } }, 422);
    const copies = await Promise.all([1, 2].map(() => review('/copies', 'POST', copyBody, 201))), copy1 = copies[0]; assert.deepEqual(copies[1], copy1);
    assert.deepEqual(copy1.snapshot.content.changes, []); assert.deepEqual(copy1.snapshot.content.originalItem.content, first);
    const next = { ...copyBody, id: randomUUID(), previousCopy: { id: copy1.id, sha256: copy1.snapshot.sha256 }, title: 'Explicit adapted title', gherkin: first.artifact.gherkin + '\nE verifico o alvo sintético', reason: 'Adapted manually for the preserved target' };
    const revisionRace = await Promise.all([next, { ...next, id: randomUUID() }].map(async value => {
      const response = await fetch(`${endpoint}/test-case-reviews/${run.id}/copies`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
      return { status: response.status, body: await response.json() };
    }));
    assert.deepEqual(revisionRace.map(row => row.status).sort(), [201, 409]);
    const copy2 = revisionRace.find(row => row.status === 201).body;
    assert.equal(copy2.snapshot.content.revision, 2); assert.deepEqual(copy2.snapshot.content.changes.map(row => row.field), ['title', 'gherkin']);
    assert.deepEqual(copy2.snapshot.content.artifact.content.metadata, first.artifact.metadata);
    assert.equal(copy2.snapshot.content.originalItem.sha256, copy1.snapshot.content.originalItem.sha256);
    await review('/copies', 'POST', { ...next, id: randomUUID() }, 409);
    await review('/copies', 'POST', { ...copyBody, title: 'Reused UUID with changed content' }, 409);
    const page = await review(`/items/${first.key}?limit=1`); assert.equal(page.page.total, 2); assert.deepEqual(page.copies, [copy2]);
    assert.deepEqual((await review(`/items/${first.key}?limit=1&offset=1`)).copies, [copy1]);
    await review(`/items/${first.key}?limit=100`, 'GET', undefined, 422);
    checks.push('Accepted-only copies; complete original provenance; immutable revision chain; competing revisions produce one winner; stale-parent rejection and bounded history');
    const other = await request('recommendation-runs', '', 'POST', { ...body, id: randomUUID() }, 201);
    await review('/target', 'POST', { ...targetBody, runSha256: other.snapshot.sha256 }, 200, other.id);
    await review('/decisions', 'POST', { ...decisionBody, runSha256: other.snapshot.sha256 }, 422, other.id);
    await review('/copies', 'POST', copyBody, 422, other.id);
    const forced = { ...next, id: randomUUID(), previousCopy: { id: copy2.id, sha256: copy2.snapshot.sha256 } }; assert.match(forced.id, /^[a-f0-9-]{36}$/);
    await pool.query(`ALTER TABLE test_case_adapted_copies ADD CONSTRAINT forced_test_copy_rollback CHECK (id <> '${forced.id}'::uuid)`);
    await assert.rejects(createTestCopy(run.id, forced, 'local-check'), error => error.code === '23514');
    await pool.query('ALTER TABLE test_case_adapted_copies DROP CONSTRAINT forced_test_copy_rollback');
    assert.equal((await review(`/items/${first.key}`)).page.total, 2);
    for (const table of ['test_case_run_targets', 'test_case_item_decisions', 'test_case_adapted_copies']) {
      await assert.rejects(pool.query(`UPDATE ${table} SET created_by = created_by`), /immutable/); await assert.rejects(pool.query(`DELETE FROM ${table}`), /immutable/);
    }
    checks.push('Cross-run reference isolation; forced rollback; SQL update/delete protection on all assessment tables');
    for (const [resource, reference] of [['test-case-catalogs', ref(catalog)], ['recommender-datasets', ref(base)], ['recommender-definitions', ref(definition)]]) await request(resource, path(reference.id, reference.version) + '/retire', 'POST', {});
    assert.deepEqual((await review()).target, target); assert.deepEqual((await review(`/items/${first.key}`)).copies, [copy2, copy1]);
    assert.equal((await request('recommendation-runs', `/${run.id}/replay`, 'POST', {})).verified, true);
    assert.equal((await request('recommendation-runs', `/${run.id}`)).snapshot.sha256, before);
    for (const table of ['recommender_run_targets', 'recommender_item_decisions', 'story_non_functional_requirements']) assert.equal((await pool.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n, 0);
    process.env.INGEST_API_KEY = 'synthetic-local-review'; await review('', 'GET', undefined, 401); await review('/copies', 'POST', copyBody, 401); delete process.env.INGEST_API_KEY;
    checks.push('Retired dependencies preserve assessment/history/replay; original run unchanged; no RNF materialization; global authorization');
    const evidence = snapshotContent({ schemaVersion: 1, scope: 'Synthetic technical assessment verification, not empirical relevance or original TestRec reproduction', sourceHashes: await sources(), checks,
      run, target, decisions: [accepted, rejected], copies: [copy1, copy2] });
    if (args[0] === '--output') { const output = resolve(args[1]); await mkdir(dirname(output), { recursive: true }); await writeFile(output, JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx' }); }
    console.log(JSON.stringify({ checks, sha256: evidence.sha256 }, null, 2));
  } finally {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    if (created) await pool.query(`DROP SCHEMA ${schema} CASCADE`); await pool.end();
  }
}
