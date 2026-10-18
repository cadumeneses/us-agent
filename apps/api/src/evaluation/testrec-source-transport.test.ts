import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { snapshotContent } from '../domain/content-snapshot.js';
import { parseImportCsv } from '../domain/import-formats.js';
import { reviewAssociationLines } from './testrec-source-preparation.js';
import { applyE26TransportPlan, reconstructE26Source, E26_TRANSPORT_VERSION } from './testrec-source-transport.js';

const root = new URL('../../../../', import.meta.url);
const source = () => readFileSync(new URL('research/sources/testrec-e26/zenodo-16133793/test_cases_for_user_stories.csv', root));
const plan = () => JSON.parse(readFileSync(new URL('research/transformations/testrec-e26-v1/encoding-plan.json', root), 'utf8'));
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

function selectLine(raw: Buffer, line: number) {
  const inspection = reviewAssociationLines(raw), units = inspection.units;
  const span = units.find(row => row.physicalLine === line)!;
  const original = plan(); original.source = { file: original.source.file, sha256: sha(raw), bytes: raw.length };
  original.decisions = [{ physicalLine: line, spanSha256: span.sha256,
    previousSpanSha256: units.find(row => row.physicalLine === line - 1)!.sha256,
    nextSpanSha256: units.find(row => row.physicalLine === line + 1)!.sha256,
    operation: 'quote_unquoted_title_preserving_literal_characters',
    beforeCells: raw.subarray(span.startByte, span.endByteExclusive).toString('utf8').replace(/[\r\n]+$/, '').split(';') }];
  return original;
}

test('six reviewed transport encodings preserve literal cell contents, all other source bytes and exact reversibility', () => {
  const input = source(), before = sha(input), selected = plan();
  const result = applyE26TransportPlan(input, selected), again = applyE26TransportPlan(input, selected);
  assert.equal(sha(input), before); assert.deepEqual(result.bytes, again.bytes); assert.deepEqual(result.report, again.report);
  assert.deepEqual(reconstructE26Source(result.bytes, result.report), input);
  const report = result.report.content;
  assert.equal(report.version, E26_TRANSPORT_VERSION);
  assert.equal(report.changes.encodedTitleCells, 6); assert.equal(report.changes.sourceCellCharactersChanged, 0);
  assert.equal(report.after.requiringReview, 51); assert.equal(report.before.requiringReview, 57);
  assert.equal(report.wholeFileAfter.state, 'blocked'); assert.equal(report.wholeFileAfter.error!.line, 86);
  assert.equal(report.authorIntentConfirmed, false); assert.equal(report.readyForScientificExecution, false);
  const header = reviewAssociationLines(input).header.rawText;
  let originalCursor = 0, outputCursor = 0;
  for (const patch of report.patches) {
    assert.deepEqual(input.subarray(originalCursor, patch.sourceStartByte), result.bytes.subarray(outputCursor, patch.outputStartByte));
    const parsed = parseImportCsv(header + result.bytes.subarray(patch.outputStartByte, patch.outputEndByteExclusive).toString('utf8'), ';');
    assert.deepEqual(Object.values(parsed.rows[0].value as object), patch.beforeCells);
    originalCursor = patch.sourceEndByteExclusive; outputCursor = patch.outputEndByteExclusive;
  }
  assert.deepEqual(input.subarray(originalCursor), result.bytes.subarray(outputCursor));
  // Odd repetitions and unmatched literal quotes are retained, not editorially corrected.
  assert.ok(report.patches.find(row => row.physicalLine === 292)!.beforeCells[3].endsWith('"Event Driven System for Business Services Integration'));
});

test('stale source, context, literal cells and duplicate decisions are rejected before creating a derived artifact', () => {
  const changed = source(); changed[10] ^= 1;
  assert.throws(() => applyE26TransportPlan(changed, plan()), /Source bytes differ/);
  for (const change of [
    (p: any) => { p.decisions[0].nextSpanSha256 = '0'.repeat(64); },
    (p: any) => { p.decisions[0].beforeCells[3] = 'invented replacement'; },
    (p: any) => { p.decisions.push(p.decisions[0]); }
  ]) {
    const value = plan(); change(value);
    assert.throws(() => applyE26TransportPlan(source(), value), /span differs|Literal cells differ|Duplicate/);
  }
});

test('ambiguous output IDs, multiline fragments and nonconsecutive anchors remain unsupported', () => {
  const raw = source();
  assert.throws(() => applyE26TransportPlan(raw, selectLine(raw, 86)), /Ambiguous/);
  const fragment = selectLine(raw, 876);
  while (fragment.decisions[0].beforeCells.length < 5) fragment.decisions[0].beforeCells.push('');
  assert.throws(() => applyE26TransportPlan(raw, fragment), /isolated/);
  const fixture = Buffer.from('Projeto;ID_US;ID;ID_TC;ID_STD_TC\nP;#1;1;ok;1\nP;#1;2;button "close";1\nP;#1;4;ok;1\n');
  assert.throws(() => applyE26TransportPlan(fixture, selectLine(fixture, 3)), /ID sequence/);
});

test('inverse rejects modified derived bytes, invalid snapshots and forged inverse bytes even after rehashing the ledger', () => {
  const result = applyE26TransportPlan(source(), plan()), changed = Buffer.from(result.bytes); changed[1] ^= 1;
  assert.throws(() => reconstructE26Source(changed, result.report), /Derived bytes differ/);
  const content = structuredClone(result.report.content);
  content.patches[0].beforeCells[3] = 'changed';
  assert.throws(() => reconstructE26Source(result.bytes, { ...result.report, content }), /Invalid transport ledger/);
  const original = Buffer.from(content.patches[0].beforeBase64, 'base64'); original[0] ^= 1;
  content.patches[0].beforeBase64 = original.toString('base64'); content.patches[0].beforeSha256 = sha(original);
  assert.throws(() => reconstructE26Source(result.bytes, snapshotContent(content)), /Original reconstruction differs/);
});
