import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { snapshotContent } from '../domain/content-snapshot.js';
import { parseImportCsv } from '../domain/import-formats.js';
import { prepareReviewedE26Associations, reconstructReviewedE26Source } from './testrec-reviewed-associations.js';

const root = new URL('../../../../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root));
const latest = read('research/sources/testrec-e26/zenodo-16133793/test_cases_for_user_stories.csv');
const earlier = read('research/sources/testrec-e26/zenodo-16133229/tcs.csv');
const plan = () => JSON.parse(read('research/transformations/testrec-e26-reviewed-v1/association-plan.json').toString('utf8'));
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

test('reviewed candidate reads every association and reconstructs the exact latest bytes without silently selecting an author version', () => {
  const before = [sha(latest), sha(earlier)];
  const result = prepareReviewedE26Associations(latest, earlier, plan());
  assert.deepEqual(result, prepareReviewedE26Associations(latest, earlier, plan()));
  assert.deepEqual([sha(latest), sha(earlier)], before);
  assert.ok(reconstructReviewedE26Source(result.bytes, result.report).equals(latest));
  assert.equal(result.report.content.status, 'candidate_local_derivation');
  assert.equal(result.report.content.readyForScientificExecution, false);
  assert.equal(result.report.content.authorIntentConfirmed, false);
  const summary = result.report.content.summary;
  assert.equal(summary.logicalRecords, 1354);
  assert.equal(summary.reviewedPhysicalUnits, 57);
  assert.equal(summary.earlierRecordSubstitutions, 42);
  assert.equal(summary.earlierMultilineRecords, 9);
  assert.equal(summary.latestLiteralTitleEncodings, 6);
  assert.equal(summary.pendingSyntaxUnitsInThisDerivation, 0);
  assert.equal(summary.sourceRecordsExcluded, 0);
  assert.equal(summary.inferredFieldValues, 0);
});

test('adopted source cells preserve multiline titles, literal oddities, missing IDs and untouched latest bytes', () => {
  const result = prepareReviewedE26Associations(latest, earlier, plan());
  assert.equal(result.records.find(row => row.cells[2] === '875')!.cells[3], 'Cancelar exclusão da entidade\n');
  assert.match(result.records.find(row => row.cells[2] === '291')!.cells[3], /"Event Driven System for Business Services Integration$/);
  assert.equal(result.records[0].cells[4].trim(), '');
  const changedIds = new Set(result.report.content.patches.map(row => row.afterCells[2]));
  const firstNewline = latest.indexOf(10), header = latest.subarray(0, firstNewline).toString('utf8');
  for (const row of result.records.filter(row => !changedIds.has(row.cells[2]))) {
    const raw = latest.toString('utf8').split('\n')[row.physicalLine - 1];
    const original = parseImportCsv(header + '\n' + raw, ';');
    assert.deepEqual(original.fields.map(field => (original.rows[0].value as Record<string, string>)[field]), row.cells);
  }
});

test('new values, changed identities, omitted decisions and overlapping spans cannot become accepted repairs', () => {
  for (const mutate of [
    (p: any) => { p.decisions[0].afterCells[4] = 'invented'; },
    (p: any) => { p.decisions[0].supportingSource = 'latest'; },
    (p: any) => { p.decisions[0].target.startByte++; },
    (p: any) => { p.decisions[0].supporting.sha256 = '0'.repeat(64); },
    (p: any) => { p.decisions.pop(); },
    (p: any) => { p.decisions.push(p.decisions[0]); },
    (p: any) => { p.sources.latest.path = '../outside.csv'; }
  ]) {
    const value = plan(); mutate(value);
    assert.throws(() => prepareReviewedE26Associations(latest, earlier, value), /differ|mismatch|Overlapping|account|boundaries/i);
  }
  assert.throws(() => prepareReviewedE26Associations(Buffer.concat([latest, Buffer.from('x')]), earlier, plan()), /Source bytes/);
});

test('inverse checks reject both output corruption and a rehashed ledger with invalid byte ranges', () => {
  const result = prepareReviewedE26Associations(latest, earlier, plan());
  const corrupt = Buffer.from(result.bytes); corrupt[50] ^= 1;
  assert.throws(() => reconstructReviewedE26Source(corrupt, result.report), /differs/);
  const content = structuredClone(result.report.content);
  content.patches[0].outputStartByte = -1;
  assert.throws(() => reconstructReviewedE26Source(result.bytes, snapshotContent(content)), /Invalid inverse/);
});
