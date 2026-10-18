import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildImportPreview, selectImportRecords, type DatasetImportSpec } from './dataset-import.js';
import { snapshotContent } from './content-snapshot.js';
import { parseRecommenderDefinition } from './recommender-definition.js';
import { legacyNfrInput, RNF_ADAPTER_VERSION, simulateConfiguredNfr } from '../services/configured-nfr.js';
import type { NfrProfile, NfrResult } from '../services/nfr-engine.js';

const root = new URL('../../../../', import.meta.url);
function setup() {
  const draft = parseRecommenderDefinition(JSON.parse(readFileSync(new URL('config/recommenders/rnf-v2.draft.json', root), 'utf8')));
  const reference = JSON.parse(readFileSync(new URL('research/baselines/rnf-v2/reference.json', root), 'utf8')) as {
    profiles: Record<string, NfrProfile>; cases: Array<{ id: string; targetId: string; historyIds: string[]; labelIndex: number; expected: NfrResult }>
  };
  const publication = { schemaVersion: 1, definition: { ...draft, state: 'published' }, taxonomies: [],
    implementation: { methodId: draft.method.id, adapterVersion: RNF_ADAPTER_VERSION } };
  const definition = snapshotContent(publication);
  const spec: DatasetImportSpec = { schemaVersion: 1, id: 'dataset-demo', version: '1', format: 'json',
    definition: { id: draft.id, version: draft.version, format: definition.format, sha256: definition.sha256 },
    source: { description: 'Synthetic frozen demonstration', authorization: { basis: 'synthetic', reference: 'Not an original author dataset' } },
    mapping: { recordId: ['id'], attributes: Object.fromEntries(draft.attributes.map(attribute => [attribute.id, { path: ['values', attribute.id], encoding: 'value' }])) } };
  const record = (id = 'f4') => legacyNfrInput(draft, reference.profiles[id], id, 'fixture');
  const preview = (rows: unknown[]) => buildImportPreview(spec, Buffer.from(JSON.stringify(rows)), 'demo.json', publication);
  return { draft, reference, publication, spec, record, preview };
}
const csvCell = (value: string) => '"' + value.replaceAll('"', '""') + '"';

test('JSON imports all mapped roles without reclassifying or discarding short text and reports unmapped source fields', () => {
  const { record, preview } = setup();
  const source = record(); source.values.text = 'x';
  const result = preview([{ ...source, ignored: 'kept in original file' }]);
  assert.equal(result.report.valid, 1); assert.equal(result.report.total, 1);
  assert.deepEqual(result.report.rows[0].input?.values, source.values);
  assert.ok(result.report.unmappedSourceFields.includes('ignored'));
  assert.equal(result.fields.find(field => field.id === 'labels')?.role, 'filter');
  assert.equal(result.fields.find(field => field.id === 'nfrs')?.role, 'output');
  assert.equal(result.report.rows[0].input?.provenance.source, `import:${result.file.sha256}`);
});

test('CSV with explicit JSON cells preserves arrays, label pairs, NFR associations, BOM and multiline text', () => {
  const { draft, publication, spec, record } = setup();
  const source = record(); source.values.text = 'As a user, I want "records"\r\nwith continuity; preserved.';
  spec.format = 'csv'; spec.delimiter = ';';
  spec.mapping.attributes = Object.fromEntries(draft.attributes.map(attribute => [attribute.id,
    { path: [attribute.id], encoding: attribute.cardinality === 'many' || attribute.valueType.type === 'record' ? 'json' : 'value' }]));
  const header = ['id', ...draft.attributes.map(attribute => attribute.id)];
  const cells = [source.id, ...draft.attributes.map(attribute => spec.mapping.attributes[attribute.id].encoding === 'json'
    ? JSON.stringify(source.values[attribute.id]) : String(source.values[attribute.id]))];
  const bytes = Buffer.from('\uFEFF' + header.map(csvCell).join(';') + '\r\n' + cells.map(csvCell).join(';') + '\r\n');
  const result = buildImportPreview(spec, bytes, 'demo.csv', publication);
  assert.equal(result.file.bom, true); assert.equal(result.file.byteLength, bytes.length);
  assert.equal(result.report.valid, 1); assert.equal(result.report.rows[0].line, 2);
  assert.deepEqual(result.report.rows[0].input?.values, source.values);
});

test('invalid rows identify fields and remain visible; publication requires explicit exclusions', () => {
  const { record, preview } = setup();
  const valid = record(); const malformed = record('f5'); malformed.values.platforms = 'Web';
  const result = preview([valid, malformed, 'not an object']);
  assert.equal(result.report.total, 3); assert.equal(result.report.valid, 1); assert.equal(result.report.invalid, 2);
  assert.ok(result.report.rows[1].issues.some(issue => issue.path.includes('platforms')));
  assert.throws(() => selectImportRecords(result, []), /explicitamente/);
  assert.deepEqual(selectImportRecords(result, [3, 2]).includedOrdinals, [1]);
  assert.throws(() => selectImportRecords(result, [2, 2]), /duplicatas/);
  assert.throws(() => selectImportRecords(result, [4]), /existentes/);
  assert.throws(() => selectImportRecords(result, [1, 2, 3]), /ao menos/);
});

test('duplicate record/story/classification identities mark all affected rows and never pick a winner silently', () => {
  const { record, preview } = setup();
  const first = record(), repeated = structuredClone(first); repeated.id = 'different-source-id';
  const result = preview([first, repeated]);
  assert.equal(result.report.duplicate, 2); assert.ok(result.report.rows.every(row => row.input !== null));
  assert.throws(() => selectImportRecords(result, []), /duplicadas/);
  assert.equal(selectImportRecords(result, [1]).records[0].id, repeated.id);
  const emptyIdentity = record(); emptyIdentity.values.story_id = '';
  assert.equal(preview([emptyIdentity]).report.rows[0].status, 'invalid');
});

test('file/mapping failures are explicit and cannot become partial publications', () => {
  const { spec, publication, record } = setup();
  for (const bytes of [Buffer.from('[{"id":1,"id":2}]'), Buffer.from('{bad'), Buffer.from('{}'), Buffer.from('[]'), Buffer.from([0xff, 0xfe])]) {
    const result = buildImportPreview(spec, bytes, 'invalid.json', publication);
    assert.ok(result.report.fatal.length); assert.throws(() => selectImportRecords(result, []), /erro de arquivo/);
  }
  const tooMany = Buffer.from(JSON.stringify(Array.from({ length: 10001 }, () => ({}))));
  assert.ok(buildImportPreview(spec, tooMany, 'large.json', publication).report.fatal[0].message.includes('10000'));
  const missing = structuredClone(spec); delete missing.mapping.attributes.labels;
  assert.throws(() => buildImportPreview(missing, Buffer.from(JSON.stringify([record()])), 'x.json', publication), /sem mapeamento/);
  const unknown = structuredClone(spec); unknown.mapping.attributes.surprise = { path: ['x'], encoding: 'value' };
  assert.throws(() => buildImportPreview(unknown, Buffer.from('[]'), 'x.json', publication), /inexistente/);
});

test('imported reference candidates preserve all eight frozen RNF outputs', () => {
  const { draft, reference, record, preview } = setup();
  for (const scenario of reference.cases) {
    const imported = preview(scenario.historyIds.map(id => record(id)));
    const selected = selectImportRecords(imported, []);
    const target = legacyNfrInput(draft, reference.profiles[scenario.targetId], scenario.targetId, 'frozen demonstration');
    assert.deepEqual(simulateConfiguredNfr(draft, target, { id: 'imported-demo', version: '1', source: 'reconstructed_demonstration', records: selected.records }, scenario.labelIndex).result.content, scenario.expected);
  }
});
