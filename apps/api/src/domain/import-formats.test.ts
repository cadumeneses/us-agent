import assert from 'node:assert/strict';
import test from 'node:test';
import { parseImportCsv, parseImportJson } from './import-formats.js';

test('CSV preserves quoted delimiters, escaped quotes, CRLF inside cells, empty fields and physical row locations', () => {
  const parsed = parseImportCsv('id,text,empty\r\na,"Hello, ""world""\r\nsecond line",\r\nb,short,\r\n', ',');
  assert.deepEqual(parsed.rows, [
    { ordinal: 1, line: 2, value: { id: 'a', text: 'Hello, "world"\r\nsecond line', empty: '' } },
    { ordinal: 2, line: 4, value: { id: 'b', text: 'short', empty: '' } }
  ]);
  assert.deepEqual(parseImportCsv('id;text\nx;"comma,semicolon;tab\t"', ';').rows[0].value, { id: 'x', text: 'comma,semicolon;tab\t' });
  assert.deepEqual(parseImportCsv('id\tvalue\na\t"x\ty"', '\t').rows[0].value, { id: 'a', value: 'x\ty' });
});

test('CSV does not discard blank rows or column count errors and rejects ambiguous structure', () => {
  const parsed = parseImportCsv('id,text\na,ok\n\nb,extra,field\nc,ok', ',');
  assert.equal(parsed.rows.length, 4);
  assert.ok(parsed.rows[1].error); assert.ok(parsed.rows[2].error); assert.equal(parsed.rows[3].ordinal, 4);
  for (const text of ['id,id\na,b', 'id,\na,b', 'id,text\na,"unclosed', 'id,text\na,un"quoted', 'id,text\na,"closed"extra']) {
    assert.throws(() => parseImportCsv(text, ','));
  }
});

test('JSON rejects duplicate keys including escaped equivalents without confusing string contents and nested arrays', () => {
  assert.deepEqual(parseImportJson('[{"a":[{"a":1}],"text":"{ \\" not a key"}]'), [{ a: [{ a: 1 }], text: '{ " not a key' }]);
  assert.throws(() => parseImportJson('[{"label":1,"label":2}]'), /duplicada/);
  assert.throws(() => parseImportJson('[{"name":1,"\\u006eame":2}]'), /duplicada/);
  assert.throws(() => parseImportJson('[{"a":{"b":1,"b":2}}]'), /duplicada/);
  assert.throws(() => parseImportJson('[{"a":1,}]'), /JSON inválido/);
});
