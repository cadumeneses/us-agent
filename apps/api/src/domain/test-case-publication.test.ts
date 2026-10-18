import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildTestCasePublication } from './test-case-publication.js';

const fixture = () => JSON.parse(readFileSync(new URL('../../../../research/examples/testrec-e21/synthetic-catalog.json', import.meta.url), 'utf8'));
const spec = (bytes: Buffer) => ({ expectedFileSha256: createHash('sha256').update(bytes).digest('hex'),
  authorization: { basis: 'synthetic', reference: 'US-Agent authored fixture, no original author data' } });

test('catalog publication pins source bytes, BOM, title/steps/metadata and the engineering declaration independently from its catalog hash', () => {
  const catalog = fixture(); catalog.items[1].title = catalog.items[0].title;
  const bytes = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(JSON.stringify(catalog, null, 2).replaceAll('\n', '\r\n'))]);
  const source = Buffer.from(bytes), publication = buildTestCasePublication(bytes, 'catalog.json', spec(bytes));
  assert.equal(publication.content.file.bom, true); assert.equal(publication.content.file.byteLength, bytes.length);
  assert.equal(publication.content.file.sha256, spec(bytes).expectedFileSha256);
  assert.deepEqual(publication.content.catalog.content.items, catalog.items);
  assert.equal(Object.isFrozen(publication.content.catalog.content.items[0]), true); assert.deepEqual(bytes, source);
  const alternate = Buffer.from(JSON.stringify(catalog));
  const other = buildTestCasePublication(alternate, 'catalog.json', spec(alternate));
  assert.equal(other.content.catalog.sha256, publication.content.catalog.sha256);
  assert.notEqual(other.sha256, publication.sha256); assert.notEqual(other.content.file.sha256, publication.content.file.sha256);
});

test('catalog publication rejects duplicate keys/IDs, unknown fields, invalid UTF-8, empty/oversize files, changed review hash and unsafe names', () => {
  const catalog = fixture(), bytes = Buffer.from(JSON.stringify(catalog));
  assert.throws(() => buildTestCasePublication(bytes, 'catalog.json', { ...spec(bytes), expectedFileSha256: '0'.repeat(64) }), /Hash/);
  for (const name of ['', '../cat.json', 'dir\\cat.json', 'cat\n.json']) assert.throws(() => buildTestCasePublication(bytes, name, spec(bytes)), /Nome/);
  for (const invalid of [Buffer.alloc(0), Buffer.alloc(5_000_001), Buffer.from([0xff]),
    Buffer.from('{"schemaVersion":1,"schemaVersion":1}'), Buffer.from(JSON.stringify({ ...catalog, extra: true }))]) {
    assert.throws(() => buildTestCasePublication(invalid, 'catalog.json', spec(invalid)));
  }
  catalog.items.push(catalog.items[0]); const duplicate = Buffer.from(JSON.stringify(catalog));
  assert.throws(() => buildTestCasePublication(duplicate, 'catalog.json', spec(duplicate)), /duplicado/);
});

test('publication distinguishes declared permission from synthetic origin without asserting license verification', () => {
  const catalog = fixture(), bytes = Buffer.from(JSON.stringify(catalog));
  assert.throws(() => buildTestCasePublication(bytes, 'cat.json', { ...spec(bytes), authorization: { basis: 'permission', reference: 'Declared permission' } }), /consistentes/);
  catalog.source.kind = 'source_example'; const example = Buffer.from(JSON.stringify(catalog));
  assert.throws(() => buildTestCasePublication(example, 'cat.json', spec(example)), /consistentes/);
  assert.throws(() => buildTestCasePublication(example, 'cat.json', { ...spec(example), authorization: { basis: 'permission', reference: '' } }));
  const saved = buildTestCasePublication(example, 'cat.json', { ...spec(example), authorization: { basis: 'permission', reference: 'Technical fixture of a permission declaration; not original author data' } });
  assert.equal(saved.content.authorization.basis, 'permission');
});
