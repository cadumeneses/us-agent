// Publication checks in a disposable LOCAL schema; no external providers or scientific dataset imports.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

const schema = `definition_check_${randomUUID().replaceAll('-', '')}`;
assert.match(schema, /^definition_check_[a-f0-9]{32}$/);
process.env.DATABASE_URL = `postgresql://us_agent:us_agent_local@127.0.0.1:5432/us_agent?options=${encodeURIComponent(`-c search_path=${schema}`)}`;
process.env.DATABASE_POOL_MAX = '6';
for (const key of ['DATABASE_SSL', 'VERCEL', 'INGEST_API_KEY']) delete process.env[key];
const { pool } = await import('../apps/api/dist/database/pool.js');
const { createApp } = await import('../apps/api/dist/app.js');
const { snapshotContent } = await import('../apps/api/dist/domain/content-snapshot.js');
const { publishDefinitionVersion } = await import('../apps/api/dist/services/recommender-definitions.js');
const { legacyNfrInput, simulateConfiguredNfr } = await import('../apps/api/dist/services/configured-nfr.js');
const { checkNfrBaseline } = await import('../apps/api/dist/evaluation/nfr-baseline.js');
let server;
let created = false;
try {
  await pool.query(`CREATE SCHEMA ${schema}`); created = true;
  const directory = new URL('../database/migrations/', import.meta.url);
  for (const file of (await readdir(directory)).filter(name => name.endsWith('.sql')).sort()) {
    await pool.query(await readFile(new URL(file, directory), 'utf8'));
  }
  server = createApp().listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const root = `http://127.0.0.1:${server.address().port}/api/internal`;
  async function request(resource, path = '', method = 'GET', body, expected = 200, authorization) {
    const response = await fetch(`${root}/recommender-${resource}${path}`, { method, headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(authorization ? { authorization } : {})
    }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const result = await response.json(); assert.equal(response.status, expected, JSON.stringify(result)); return result;
  }
  const path = (id, version = '1') => `/${id}/versions/${encodeURIComponent(version)}`;
  const defRequest = (...args) => request('definitions', ...args);
  const taxRequest = (...args) => request('taxonomies', ...args);
  const template = JSON.parse(await readFile(new URL('../config/recommenders/rnf-v2.draft.json', import.meta.url), 'utf8'));
  const definition = { ...template, id: 'rnf-published-demo', version: '1' };
  const taxonomy = JSON.parse(await readFile(new URL('../config/taxonomies/languages-demo.v1.json', import.meta.url), 'utf8'));
  await taxRequest(path(taxonomy.id), 'PUT', taxonomy);
  const tax = await taxRequest(path(taxonomy.id) + '/publish', 'POST', {});
  const ref = { id: taxonomy.id, version: taxonomy.version, format: tax.snapshot.format, sha256: tax.snapshot.sha256 };
  const context = { id: 'additional_languages', name: 'Linguagens adicionais de contexto', scope: 'project', cardinality: 'many', required: false,
    role: 'context', representation: 'none', valueType: { type: 'taxonomy_node', taxonomy: ref } };
  definition.attributes.push(context);

  assert.deepEqual(await defRequest(), []);
  process.env.INGEST_API_KEY = 'local-test-only';
  await defRequest('', 'GET', undefined, 401);
  await defRequest(path(definition.id), 'PUT', definition, 401);
  await defRequest('', 'GET', undefined, 401, 'Bearer wrong');
  await defRequest('', 'GET', undefined, 200, 'Bearer local-test-only');
  delete process.env.INGEST_API_KEY; process.env.VERCEL = '1';
  await defRequest('', 'GET', undefined, 503); delete process.env.VERCEL;

  await defRequest(path(definition.id), 'PUT', { ...definition, id: 'wrong' }, 400);
  await defRequest(path(definition.id), 'PUT', { ...definition, state: 'published' }, 422);
  await defRequest(path(definition.id), 'PUT', { ...definition, attributes: [...definition.attributes, context] }, 422);
  await defRequest(path(definition.id), 'GET', undefined, 404);
  const draft = await defRequest(path(definition.id), 'PUT', definition);
  assert.equal(draft.state, 'draft'); assert.equal(draft.snapshot, null);
  definition.name = 'RNF de demonstração revisado';
  await defRequest(path(definition.id), 'PUT', definition);
  await defRequest(path(definition.id) + '/retire', 'POST', {}, 409);
  await defRequest(path(definition.id) + '/publish', 'POST', { snapshot: {} }, 400);
  await defRequest(path(definition.id) + '/publish', 'POST', [], 400);
  const concurrent = await Promise.all([1, 2].map(() => defRequest(path(definition.id) + '/publish', 'POST', {})));
  assert.deepEqual(concurrent[0], concurrent[1]);
  const published = concurrent[0];
  assert.equal(published.state, 'published'); assert.equal(published.definition.state, 'published');
  assert.equal(published.publishedBy, 'local-development');
  assert.equal(snapshotContent(published.snapshot.content).sha256, published.snapshot.sha256);
  assert.equal(published.snapshot.content.taxonomies[0].snapshot.sha256, tax.snapshot.sha256);
  assert.deepEqual(await defRequest(path(definition.id)), published);
  await defRequest(path(definition.id), 'PUT', definition, 409);
  const bindings = (await pool.query('SELECT * FROM recommender_definition_taxonomies WHERE definition_id = $1', [definition.id])).rows;
  assert.equal(bindings.length, 1); assert.equal(bindings[0].content_sha256, ref.sha256);
  await assert.rejects(pool.query(`UPDATE recommender_definition_versions SET content = jsonb_set(content, '{name}', '"Changed"') WHERE definition_id = $1`, [definition.id]), /immutable/);
  await assert.rejects(pool.query('UPDATE recommender_definition_versions SET content_sha256 = $2 WHERE definition_id = $1', [definition.id, '0'.repeat(64)]), /immutable/);
  await assert.rejects(pool.query('DELETE FROM recommender_definition_versions WHERE definition_id = $1', [definition.id]), /immutable/);
  await assert.rejects(pool.query('DELETE FROM recommender_definition_taxonomies WHERE definition_id = $1', [definition.id]), /immutable/);
  await assert.rejects(pool.query(`UPDATE recommender_definition_taxonomies SET content_sha256 = $2 WHERE definition_id = $1`, [definition.id, '0'.repeat(64)]), /cannot be updated/);
  await assert.rejects(pool.query(`INSERT INTO recommender_definition_taxonomies VALUES ($1, '1', $2, '1', $3, $4)`,
    [definition.id, taxonomy.id, ref.format, ref.sha256]), /before publication/);

  const invalidCases = [
    ['bad-k', value => { value.method.parameters.k = 3; }],
    ['unknown-method', value => { value.method.id = 'ednaldo-unconfirmed'; }],
    ['bad-binding', value => { value.method.bindings.apis = value.method.bindings.frameworks; }],
    ['bad-hash', value => { value.attributes.at(-1).valueType.taxonomy.sha256 = '0'.repeat(64); }],
    ['missing-taxonomy', value => { value.attributes.at(-1).valueType.taxonomy.id = 'missing'; }],
    ['missing-version', value => { value.attributes.at(-1).valueType.taxonomy.version = '2'; }]
  ];
  for (const [id, change] of invalidCases) {
    const invalid = structuredClone(definition); invalid.id = id; change(invalid);
    await defRequest(path(id), 'PUT', invalid);
    await defRequest(path(id) + '/publish', 'POST', {}, 422);
    const current = await defRequest(path(id)); assert.equal(current.state, 'draft'); assert.equal(current.snapshot, null);
    assert.equal((await pool.query('SELECT 1 FROM recommender_definition_taxonomies WHERE definition_id = $1', [id])).rowCount, 0);
  }
  // Failure after writing bindings must roll back both the bindings and publication state.
  const forced = { ...definition, id: 'force-rollback' };
  await defRequest(path(forced.id), 'PUT', forced);
  await pool.query("ALTER TABLE recommender_definition_versions ADD CONSTRAINT check_forced_rollback CHECK (definition_id <> 'force-rollback' OR state = 'draft')");
  await assert.rejects(publishDefinitionVersion(forced.id, '1', 'local-check'), error => error.code === '23514');
  assert.equal((await defRequest(path(forced.id))).state, 'draft');
  assert.equal((await pool.query('SELECT 1 FROM recommender_definition_taxonomies WHERE definition_id = $1', [forced.id])).rowCount, 0);
  await pool.query('ALTER TABLE recommender_definition_versions DROP CONSTRAINT check_forced_rollback');

  // A newer version does not replace an older reference or mutate its package.
  const newer = { ...definition, version: '2', name: 'Nova configuração' };
  await defRequest(path(newer.id, '2'), 'PUT', newer);
  const secondVersion = await defRequest(path(newer.id, '2') + '/publish', 'POST', {});
  assert.notEqual(secondVersion.snapshot.sha256, published.snapshot.sha256);
  assert.deepEqual(await defRequest(path(definition.id)), published);
  assert.equal((await defRequest('?state=published&limit=1')).length, 1);
  assert.equal((await defRequest('?state=published&limit=1&offset=1')).length, 1);
  await defRequest('?limit=101', 'GET', undefined, 422);

  // Compare a disposable draft copy of the retrieved publication, without changing sealed content.
  const referenceText = await readFile(new URL('../research/baselines/rnf-v2/reference.json', import.meta.url), 'utf8');
  const manifestText = await readFile(new URL('../research/baselines/rnf-v2/manifest.json', import.meta.url), 'utf8');
  checkNfrBaseline(referenceText, manifestText);
  const baseline = JSON.parse(referenceText);
  const comparison = { ...structuredClone(published.snapshot.content.definition), state: 'draft' };
  const dependencies = published.snapshot.content.taxonomies;
  for (const scenario of baseline.cases) {
    const input = legacyNfrInput(comparison, baseline.profiles[scenario.targetId], scenario.targetId, 'reconstructed demonstration', dependencies);
    input.values.additional_languages = ['typescript'];
    const dataset = { id: 'frozen-demo', version: '1', source: 'reconstructed_demonstration', records: scenario.historyIds.map(id =>
      legacyNfrInput(comparison, baseline.profiles[id], id, 'reconstructed demonstration', dependencies)) };
    assert.deepEqual(simulateConfiguredNfr(comparison, input, dataset, scenario.labelIndex, dependencies).result.content, scenario.expected);
  }
  assert.deepEqual(await defRequest(path(definition.id)), published);

  // Deterministic retirement race: publication waits for the taxonomy row and must recheck its state.
  const raceTax = { ...taxonomy, id: 'retiring-demo' };
  await taxRequest(path(raceTax.id), 'PUT', raceTax);
  const racePublished = await taxRequest(path(raceTax.id) + '/publish', 'POST', {});
  const raceDef = structuredClone(definition); raceDef.id = 'retirement-race';
  raceDef.attributes.at(-1).valueType.taxonomy = { ...ref, id: raceTax.id, sha256: racePublished.snapshot.sha256 };
  await defRequest(path(raceDef.id), 'PUT', raceDef);
  const blocker = await pool.connect();
  let pending;
  let committed = false;
  try {
    await blocker.query('BEGIN');
    const pid = (await blocker.query('SELECT pg_backend_pid() AS id')).rows[0].id;
    await blocker.query('SELECT 1 FROM recommender_taxonomy_versions WHERE taxonomy_id = $1 FOR UPDATE', [raceTax.id]);
    pending = defRequest(path(raceDef.id) + '/publish', 'POST', {}, 422);
    // Attach a rejection handler while the deterministic lock observation is pending.
    pending.catch(() => {});
    const deadline = Date.now() + 10000;
    let waiting = false;
    while (Date.now() < deadline) {
      waiting = (await pool.query("SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND $1 = ANY(pg_blocking_pids(pid))) AS waiting", [pid])).rows[0].waiting;
      if (waiting) break;
      await delay(30);
    }
    assert.ok(waiting, 'Publicação deve aguardar o lock da taxonomia.');
    await blocker.query("UPDATE recommender_taxonomy_versions SET state = 'retired', updated_at = NOW() WHERE taxonomy_id = $1", [raceTax.id]);
    await blocker.query('COMMIT');
    committed = true;
  } finally { if (!committed) await blocker.query('ROLLBACK'); blocker.release(); }
  await pending;
  assert.equal((await defRequest(path(raceDef.id))).state, 'draft');
  assert.equal((await pool.query('SELECT 1 FROM recommender_definition_taxonomies WHERE definition_id = $1', [raceDef.id])).rowCount, 0);

  await taxRequest(path(taxonomy.id) + '/retire', 'POST', {});
  assert.deepEqual(await defRequest(path(definition.id)), published); // archived dependency remains consultable
  const late = { ...definition, id: 'retired-dependency' };
  await defRequest(path(late.id), 'PUT', late);
  await defRequest(path(late.id) + '/publish', 'POST', {}, 422);
  const retired = await defRequest(path(definition.id) + '/retire', 'POST', {});
  assert.equal(retired.state, 'retired'); assert.deepEqual(retired.snapshot, published.snapshot);
  assert.deepEqual(await defRequest(path(definition.id) + '/retire', 'POST', {}), retired);
  await defRequest(path(definition.id) + '/publish', 'POST', {}, 409);
  await defRequest(path(definition.id), 'PUT', definition, 409);
  await assert.rejects(pool.query("UPDATE recommender_definition_versions SET state = 'published' WHERE definition_id = $1 AND version = '1'", [definition.id]), /immutable/);
  const noCatalog = JSON.parse(await readFile(new URL('../config/recommenders/rnf-v2.draft.json', import.meta.url), 'utf8'));
  noCatalog.id = 'rnf-without-context-catalog'; noCatalog.version = '1';
  await defRequest(path(noCatalog.id), 'PUT', noCatalog);
  const noCatalogPublication = await defRequest(path(noCatalog.id) + '/publish', 'POST', {});
  assert.deepEqual(noCatalogPublication.snapshot.content.taxonomies, []);
  // Catalog lock order differs from attribute order; the package still follows the declared references.
  const nextTax = { ...taxonomy, version: '2' };
  await taxRequest(path(nextTax.id, '2'), 'PUT', nextTax);
  const nextTaxPublication = await taxRequest(path(nextTax.id, '2') + '/publish', 'POST', {});
  const otherTax = { ...taxonomy, id: 'a-second-catalog' };
  await taxRequest(path(otherTax.id), 'PUT', otherTax);
  const otherPublication = await taxRequest(path(otherTax.id) + '/publish', 'POST', {});
  const multiple = structuredClone(noCatalog); multiple.id = 'multiple-catalogs';
  for (const [index, dependency] of [nextTaxPublication, otherPublication, nextTaxPublication].entries()) {
    multiple.attributes.push({ ...context, id: `context-${index}`, valueType: { type: 'taxonomy_node', taxonomy: {
      id: dependency.snapshot.content.id, version: dependency.snapshot.content.version, format: dependency.snapshot.format, sha256: dependency.snapshot.sha256
    } } });
  }
  await defRequest(path(multiple.id), 'PUT', multiple);
  const multiPublication = await defRequest(path(multiple.id) + '/publish', 'POST', {});
  assert.deepEqual(multiPublication.snapshot.content.taxonomies.map(dependency => dependency.snapshot.content.id), [taxonomy.id, otherTax.id]);
  assert.equal((await pool.query('SELECT 1 FROM recommender_definition_taxonomies WHERE definition_id = $1', [multiple.id])).rowCount, 2);
  // UI publication pins the reviewed draft while retaining empty-body API compatibility.
  const guarded = { ...structuredClone(noCatalog), id: 'reviewed-draft', version: '1' };
  const firstDraft = await defRequest(path(guarded.id), 'PUT', guarded);
  assert.equal(firstDraft.draftSha256, snapshotContent(guarded).sha256);
  const editedDraft = await defRequest(path(guarded.id), 'PUT', { ...guarded, name: 'Edited after review' });
  await defRequest(path(guarded.id) + '/publish', 'POST', { expectedDraftSha256: firstDraft.draftSha256 }, 409);
  assert.equal((await defRequest(path(guarded.id))).state, 'draft');
  await defRequest(path(guarded.id) + '/publish', 'POST', { expectedDraftSha256: 'invalid' }, 400);
  const pinned = await defRequest(path(guarded.id) + '/publish', 'POST', { expectedDraftSha256: editedDraft.draftSha256 });
  assert.equal(pinned.definition.name, 'Edited after review');
  assert.deepEqual(await defRequest(path(guarded.id) + '/publish', 'POST', { expectedDraftSha256: editedDraft.draftSha256 }), pinned);
  await defRequest(path(guarded.id) + '/publish', 'POST', { expectedDraftSha256: firstDraft.draftSha256 }, 409);
  assert.equal((await pool.query('SELECT current_schema() AS name')).rows[0].name, schema);
  console.log('Definition publication: immutable packages/bindings, exact dependencies, atomic rollback, publication/retirement concurrency, internal authorization and 8 RNF comparisons OK.');
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  if (created) await pool.query(`DROP SCHEMA ${schema} CASCADE`);
  await pool.end();
}
