import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalJson, snapshotContent } from './content-snapshot.js';

test('hashes JSON independently of object insertion order, including integer and Unicode keys', () => {
  assert.equal(canonicalJson({ 2: 'two', 10: 'ten' }), '{"10":"ten","2":"two"}');
  assert.equal(canonicalJson({ '\u{10000}': 1, '\uE000': 2 }), '{"\uE000":2,"\u{10000}":1}');
  const left = { b: { z: 1, a: 'é' }, a: [2, 1] };
  const right = { a: [2, 1], b: { a: 'é', z: 1 } };
  assert.equal(snapshotContent(left).sha256, snapshotContent(right).sha256);
  assert.notEqual(snapshotContent([1, 2]).sha256, snapshotContent([2, 1]).sha256);
  assert.notEqual(snapshotContent('é').sha256, snapshotContent('e\u0301').sha256);
});

test('rejects values that JSON.stringify would lose, transform or execute', () => {
  const cycle: { self?: unknown } = {}; cycle.self = cycle;
  const withGetter = Object.defineProperty({}, 'secret', { enumerable: true, get() { throw new Error('Getter must never execute'); } });
  const invalid = [undefined, NaN, Infinity, -Infinity, 1n, () => 1, Symbol('x'), new Date(), new Map(),
    { bad: undefined }, [undefined], new Array(1), Object.assign([1], { extra: 2 }), { [Symbol('x')]: 1 },
    Object.defineProperty({}, 'hidden', { value: 1 }), cycle, withGetter];
  for (const value of invalid) assert.throws(() => canonicalJson(value));
  assert.throws(() => canonicalJson(withGetter), /getters/);
});

test('snapshots detach and freeze nested evidence without freezing or changing caller input', () => {
  const source = { records: [{ score: 1 }] };
  const snapshot = snapshotContent(source);
  source.records[0].score = 2;
  assert.equal(snapshot.content.records[0].score, 1);
  assert.throws(() => { snapshot.content.records[0].score = 3; }, TypeError);
  assert.throws(() => { snapshot.content.records.push({ score: 4 }); }, TypeError);
  assert.equal(snapshotContent(snapshot.content).sha256, snapshot.sha256);
  assert.equal(Object.isFrozen(source), false);
});
