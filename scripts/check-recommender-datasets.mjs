// Dataset import/publication checks in a disposable LOCAL schema. No providers are contacted.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
const schema = `dataset_check_${randomUUID().replaceAll('-', '')}`;
assert.match(schema, /^dataset_check_[a-f0-9]{32}$/);
process.env.DATABASE_URL = `postgresql://us_agent:us_agent_local@127.0.0.1:5432/us_agent?options=${encodeURIComponent(`-c search_path=${schema}`)}`;
process.env.DATABASE_POOL_MAX = '6';
for (const key of ['DATABASE_SSL', 'VERCEL', 'INGEST_API_KEY']) delete process.env[key];
const { pool } = await import('../apps/api/dist/database/pool.js');
const { createApp } = await import('../apps/api/dist/app.js');
const { legacyNfrInput, simulateConfiguredNfr } = await import('../apps/api/dist/services/configured-nfr.js');
const { publishDatasetVersion } = await import('../apps/api/dist/services/recommender-datasets.js');
const { snapshotContent } = await import('../apps/api/dist/domain/content-snapshot.js');
const { checkNfrBaseline } = await import('../apps/api/dist/evaluation/nfr-baseline.js');
let server, created = false;
try {
  await pool.query(`CREATE SCHEMA ${schema}`); created = true;
  const directory = new URL('../database/migrations/', import.meta.url);
  for (const file of (await readdir(directory)).filter(name => name.endsWith('.sql')).sort()) await pool.query(await readFile(new URL(file, directory), 'utf8'));
  const operationalBefore = (await pool.query('SELECT count(*)::int AS count FROM classifications')).rows[0].count;
  server = createApp().listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const root = `http://127.0.0.1:${server.address().port}/api/internal`;
  const path = (id, version = '1') => `/${id}/versions/${encodeURIComponent(version)}`;
  async function request(resource, suffix = '', method = 'GET', body, expected = 200) {
    const response = await fetch(`${root}/recommender-${resource}${suffix}`, { method,
      ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) });
    const result = await response.json(); assert.equal(response.status, expected, JSON.stringify(result)); return result;
  }
  const req = (...args) => request('datasets', ...args);
  async function upload(spec, bytes, name = 'demo.json', expected = 201, authorization) {
    const form = new FormData(); form.set('spec', JSON.stringify(spec)); form.set('file', new Blob([bytes]), name);
    const response = await fetch(`${root}/recommender-datasets/imports/preview`, { method: 'POST', body: form,
      ...(authorization ? { headers: { authorization } } : {}) });
    const result = await response.json(); assert.equal(response.status, expected, JSON.stringify(result)); return result;
  }
  const template = JSON.parse(await readFile(new URL('../config/recommenders/rnf-v2.draft.json', import.meta.url), 'utf8'));
  await request('definitions', path(template.id, template.version), 'PUT', template);
  const definition = await request('definitions', path(template.id, template.version) + '/publish', 'POST', {});
  const spec = { schemaVersion: 1, id: 'imported-rnf', version: '1', format: 'json',
    definition: { id: template.id, version: template.version, format: definition.snapshot.format, sha256: definition.snapshot.sha256 },
    source: { description: 'Frozen reconstructed demonstration', authorization: { basis: 'synthetic', reference: 'Not an original author dataset' } },
    mapping: { recordId: ['id'], attributes: Object.fromEntries(template.attributes.map(attribute => [attribute.id, { path: ['values', attribute.id], encoding: 'value' }])) } };
  const referenceText = await readFile(new URL('../research/baselines/rnf-v2/reference.json', import.meta.url), 'utf8');
  checkNfrBaseline(referenceText, await readFile(new URL('../research/baselines/rnf-v2/manifest.json', import.meta.url), 'utf8'));
  const reference = JSON.parse(referenceText);
  const record = id => legacyNfrInput(template, reference.profiles[id], id, 'frozen demonstration');
  const source = Buffer.from('\uFEFF' + JSON.stringify([record('f4'), record('f5')], null, 2) + '\r\n');
  assert.deepEqual(await req(), []);
  process.env.INGEST_API_KEY = 'local-check-only';
  await upload(spec, source, 'demo.json', 401);
  const authorized = await upload({ ...spec, id: 'authorized-demo' }, source, 'demo.json', 201, 'Bearer local-check-only');
  assert.equal(authorized.createdBy, 'internal-api');
  delete process.env.INGEST_API_KEY; process.env.VERCEL = '1';
  await req('', 'GET', undefined, 503); delete process.env.VERCEL;
  const imported = await upload(spec, source);
  assert.equal(imported.snapshot.content.report.valid, 2);
  assert.equal(imported.snapshot.content.file.bom, true);
  assert.equal(imported.snapshot.content.file.sha256, createHash('sha256').update(source).digest('hex'));
  assert.deepEqual(await req(`/imports/${imported.id}`), imported);
  const download = await fetch(`${root}/recommender-datasets/imports/${imported.id}/original`);
  assert.equal(download.status, 200); assert.deepEqual(Buffer.from(await download.arrayBuffer()), source);
  assert.equal(download.headers.get('x-content-sha256'), imported.snapshot.content.file.sha256);
  const body = { importId: imported.id, previewSha256: imported.snapshot.sha256, excludedOrdinals: [] };
  await req(path(spec.id) + '/publish', 'POST', { ...body, previewSha256: '0'.repeat(64) }, 422);
  await req(path('wrong') + '/publish', 'POST', body, 422);
  const published = await Promise.all([1, 2].map(() => req(path(spec.id) + '/publish', 'POST', body)));
  assert.deepEqual(published[0], published[1]); const first = published[0];
  assert.equal(first.snapshot.content.records.length, 2);
  assert.equal(snapshotContent(first.snapshot.content).sha256, first.snapshot.sha256);
  await req(path(spec.id) + '/publish', 'POST', { ...body, excludedOrdinals: [2] }, 409);
  assert.deepEqual(await req(path(spec.id)), first);
  await assert.rejects(pool.query('UPDATE recommender_dataset_imports SET preview = preview WHERE id = $1', [imported.id]), /immutable/);
  await assert.rejects(pool.query('DELETE FROM recommender_dataset_imports WHERE id = $1', [imported.id]), /immutable/);
  await assert.rejects(pool.query("UPDATE recommender_dataset_versions SET publication = jsonb_set(publication, '{version}', '\"changed\"') WHERE dataset_id = $1", [spec.id]), /immutable/);
  await assert.rejects(pool.query('DELETE FROM recommender_dataset_versions WHERE dataset_id = $1', [spec.id]), /immutable/);

  // Invalid and duplicate records stay visible. Selection is explicit and duplicate identity is rechecked.
  const duplicate = record('f4'); duplicate.id = 'different-id';
  const invalid = record('f5'); invalid.values.platforms = 'wrong type';
  const partialSpec = { ...spec, id: 'partial-demo' };
  const partial = await upload(partialSpec, Buffer.from(JSON.stringify([record('f4'), duplicate, invalid])));
  assert.equal(partial.snapshot.content.report.duplicate, 2); assert.equal(partial.snapshot.content.report.invalid, 1);
  const partialBody = { importId: partial.id, previewSha256: partial.snapshot.sha256, excludedOrdinals: [] };
  await req(path(partialSpec.id) + '/publish', 'POST', partialBody, 422);
  await req(path(partialSpec.id) + '/publish', 'POST', { ...partialBody, excludedOrdinals: [3] }, 422);
  const selected = await req(path(partialSpec.id) + '/publish', 'POST', { ...partialBody, excludedOrdinals: [2, 3] });
  assert.deepEqual(selected.snapshot.content.selection, { excludedOrdinals: [2, 3], includedOrdinals: [1] });
  assert.equal(selected.snapshot.content.records.length, 1);
  const malformed = await upload({ ...spec, id: 'bad-file' }, Buffer.from('[{"id":1,"id":2}]'));
  assert.ok(malformed.snapshot.content.report.fatal.length);
  await req(path('bad-file') + '/publish', 'POST', { importId: malformed.id, previewSha256: malformed.snapshot.sha256, excludedOrdinals: [] }, 422);
  await req(path('bad-file'), 'GET', undefined, 404);
  const missingMapping = structuredClone(spec); delete missingMapping.mapping.attributes.labels;
  await upload(missingMapping, source, 'demo.json', 422);
  await upload(spec, Buffer.alloc(5_000_001, 0x61), 'too-large.json', 413);

  // A failing final database write cannot leave a partially published dataset.
  const rollbackSpec = { ...spec, id: 'force-rollback' };
  const rollback = await upload(rollbackSpec, source);
  await pool.query("ALTER TABLE recommender_dataset_versions ADD CONSTRAINT force_rollback CHECK (dataset_id <> 'force-rollback')");
  await assert.rejects(publishDatasetVersion(rollbackSpec.id, '1', rollback.id, rollback.snapshot.sha256, [], 'local-check'), error => error.code === '23514');
  await req(path(rollbackSpec.id), 'GET', undefined, 404);
  assert.deepEqual(await req(`/imports/${rollback.id}`), rollback);
  await pool.query('ALTER TABLE recommender_dataset_versions DROP CONSTRAINT force_rollback');

  // Upload CSV, preserve physical quoted newlines and JSON-encoded associations, and create a new version.
  const csvSpec = structuredClone(spec); csvSpec.version = '2'; csvSpec.format = 'csv'; csvSpec.delimiter = ',';
  csvSpec.mapping.attributes = Object.fromEntries(template.attributes.map(attribute => [attribute.id, { path: [attribute.id],
    encoding: attribute.cardinality === 'many' || attribute.valueType.type === 'record' ? 'json' : 'value' }]));
  const csvRecord = record('f4'); csvRecord.values.text = 'As a user, I want "quality"\r\nwith continuity.';
  const quote = value => '"' + value.replaceAll('"', '""') + '"';
  const csv = Buffer.from(['id', ...template.attributes.map(attribute => attribute.id)].map(quote).join(',') + '\r\n' +
    [csvRecord.id, ...template.attributes.map(attribute => csvSpec.mapping.attributes[attribute.id].encoding === 'json'
      ? JSON.stringify(csvRecord.values[attribute.id]) : String(csvRecord.values[attribute.id]))].map(quote).join(',') + '\r\n');
  const csvImport = await upload(csvSpec, csv, 'demo.csv');
  assert.deepEqual(csvImport.snapshot.content.report.rows[0].input.values, csvRecord.values);
  const second = await req(path(spec.id, '2') + '/publish', 'POST', { importId: csvImport.id, previewSha256: csvImport.snapshot.sha256, excludedOrdinals: [] });
  assert.notEqual(first.snapshot.sha256, second.snapshot.sha256); assert.deepEqual(await req(path(spec.id)), first);
  assert.equal((await req('?id=imported-rnf&limit=1')).length, 1);
  assert.equal((await req('?id=imported-rnf&limit=1&offset=1')).length, 1);

  // Every baseline uses a separately imported/published reference base, with no operational classifications.
  for (const [index, scenario] of reference.cases.entries()) {
    const scenarioSpec = { ...spec, id: `frozen-case-${index}` };
    const preview = await upload(scenarioSpec, Buffer.from(JSON.stringify(scenario.historyIds.map(id => record(id)))));
    const base = await req(path(scenarioSpec.id) + '/publish', 'POST', { importId: preview.id, previewSha256: preview.snapshot.sha256, excludedOrdinals: [] });
    const target = record(scenario.targetId);
    const result = simulateConfiguredNfr(template, target, { id: scenarioSpec.id, version: '1', source: 'reconstructed_demonstration', records: base.snapshot.content.records }, scenario.labelIndex);
    assert.deepEqual(result.result.content, scenario.expected);
  }
  // Attribute IDs are checked against the published catalog; retirement prevents a new dataset publication.
  const catalog = JSON.parse(await readFile(new URL('../config/taxonomies/languages-demo.v1.json', import.meta.url), 'utf8'));
  await request('taxonomies', path(catalog.id), 'PUT', catalog);
  const tax = await request('taxonomies', path(catalog.id) + '/publish', 'POST', {});
  const contextual = structuredClone(template); contextual.id = 'contextual-rnf'; contextual.version = '1';
  contextual.attributes.push({ id: 'extra_languages', name: 'Contexto', scope: 'project', cardinality: 'many', required: false,
    role: 'context', representation: 'none', valueType: { type: 'taxonomy_node', taxonomy: {
      id: catalog.id, version: catalog.version, format: tax.snapshot.format, sha256: tax.snapshot.sha256
    } } });
  await request('definitions', path(contextual.id), 'PUT', contextual);
  const contextualPub = await request('definitions', path(contextual.id) + '/publish', 'POST', {});
  const contextSpec = structuredClone(spec); contextSpec.id = 'context-base';
  contextSpec.definition = { id: contextual.id, version: contextual.version, format: contextualPub.snapshot.format, sha256: contextualPub.snapshot.sha256 };
  contextSpec.mapping.attributes.extra_languages = { path: ['values', 'extra_languages'], encoding: 'value' };
  const withContext = record('f4'); withContext.values.extra_languages = ['unknown'];
  const invalidTax = await upload(contextSpec, Buffer.from(JSON.stringify([withContext])));
  assert.equal(invalidTax.snapshot.content.report.invalid, 1);
  withContext.values.extra_languages = ['typescript'];
  const validTax = await upload(contextSpec, Buffer.from(JSON.stringify([withContext])));
  assert.equal(validTax.snapshot.content.report.valid, 1);
  await request('taxonomies', path(catalog.id) + '/retire', 'POST', {});
  await req(path(contextSpec.id) + '/publish', 'POST', { importId: validTax.id, previewSha256: validTax.snapshot.sha256, excludedOrdinals: [] }, 422);
  assert.deepEqual(await req(`/imports/${validTax.id}`), validTax);
  const retired = await req(path(spec.id) + '/retire', 'POST', {});
  assert.equal(retired.state, 'retired'); assert.deepEqual(retired.snapshot, first.snapshot);
  assert.deepEqual(await req(path(spec.id) + '/retire', 'POST', {}), retired);
  await req(path(spec.id) + '/publish', 'POST', body, 409);
  const late = await upload({ ...spec, id: 'late-demo' }, source);
  await request('definitions', path(template.id, template.version) + '/retire', 'POST', {});
  await req(path('late-demo') + '/publish', 'POST', { importId: late.id, previewSha256: late.snapshot.sha256, excludedOrdinals: [] }, 422);
  await upload({ ...spec, id: 'after-retirement' }, source, 'demo.json', 422);
  assert.deepEqual(await req(`/imports/${imported.id}`), imported);
  assert.deepEqual(await req(path(spec.id, '2')), second);
  assert.equal((await pool.query('SELECT count(*)::int AS count FROM classifications')).rows[0].count, operationalBefore);
  assert.equal((await pool.query('SELECT current_schema() AS name')).rows[0].name, schema);
  console.log('Datasets: CSV/JSON, exact original bytes, mapping/report, explicit exclusions, immutable versions, concurrency, rollback, retirement and 8 imported RNF comparisons OK.');
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  if (created) await pool.query(`DROP SCHEMA ${schema} CASCADE`);
  await pool.end();
}
