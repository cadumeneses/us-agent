import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { checkNfrBaseline } from './nfr-baseline.js';

const root = new URL('../../../../research/baselines/rnf-v2/', import.meta.url);
const referenceText = await readFile(new URL('reference.json', root), 'utf8');
const manifestText = await readFile(new URL('manifest.json', root), 'utf8');

test('frozen RNF v2 results survive replay, reversed candidates and Windows line endings', () => {
  const reports = checkNfrBaseline(referenceText, manifestText);
  assert.equal(reports.length, 8);
  const cases = JSON.parse(referenceText).cases;
  const nearest = cases.find((item: { id: string }) => item.id === 'table-5-7-nearest').expected;
  const farther = cases.find((item: { id: string }) => item.id === 'table-5-7-distance-six').expected;
  assert.equal(nearest.dimensions.length, 9);
  assert.equal(nearest.neighbor.similarity, 1);
  assert.equal(farther.neighbor.similarity, 1 - 6 / 9);
  assert.deepEqual(checkNfrBaseline(referenceText.replace(/\r?\n/g, '\r\n'), manifestText), reports);
});

test('rejects a corrupted snapshot rather than silently accepting a new reference', () => {
  assert.throws(() => checkNfrBaseline(referenceText.replace('Synthetic sentence', 'Changed sentence'), manifestText), /hash/);
  const manifest = JSON.parse(manifestText);
  manifest.method = 'another_method';
  assert.throws(() => checkNfrBaseline(referenceText, JSON.stringify(manifest)), /Método/);
});

test('detects a changed recommendation even if its snapshot hash is consistent', () => {
  const reference = JSON.parse(referenceText);
  reference.cases[0].expected.neighbor.similarity = 0.99;
  const changed = JSON.stringify(reference);
  const manifest = JSON.parse(manifestText);
  manifest.referenceSha256 = createHash('sha256').update(changed).digest('hex');
  assert.throws(() => checkNfrBaseline(changed, JSON.stringify(manifest)), /Regressão RNF/);
});
