import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { compareE26Versions, E26_EARLIER_FILES } from './testrec-source-versions.js';
import { E26_SOURCE_FILES } from './testrec-source-audit.js';

const root = new URL('../../../../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root));
const selection = () => JSON.parse(read('research/comparisons/testrec-e26-v1/comparison-plan.json').toString('utf8'));
const inputs = () => ({
  earlier: Object.fromEntries(E26_EARLIER_FILES.map(name => [name, read(`research/sources/testrec-e26/zenodo-16133229/${name}`)])) as Record<typeof E26_EARLIER_FILES[number], Buffer>,
  latest: Object.fromEntries(E26_SOURCE_FILES.map(name => [name, read(`research/sources/testrec-e26/zenodo-16133793/${name}`)])) as Record<typeof E26_SOURCE_FILES[number], Buffer>
});
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

test('version comparison distinguishes real byte equality from file-role correspondence and preserves every source', () => {
  const source = inputs(), before = Object.values(source).flatMap(group => Object.values(group).map(sha));
  const report = compareE26Versions(source.earlier, source.latest, selection());
  assert.deepEqual(report, compareE26Versions(source.earlier, source.latest, selection()));
  assert.deepEqual(Object.values(source).flatMap(group => Object.values(group).map(sha)), before);
  assert.equal(report.content.files.find(row => row.role === 'acceptance_criteria')!.identicalBytes, true);
  assert.ok(report.content.files.filter(row => row.role !== 'acceptance_criteria').every(row => !row.identicalBytes));
  assert.equal(report.content.files.find(row => row.role === 'profiles')!.earlier.parse.firstError!.line, 48);
  assert.equal(report.content.files.find(row => row.role === 'story_criteria_links')!.earlier.parse.firstError!.line, 100);
  assert.equal(report.content.files.find(row => row.role === 'profiles')!.latest.parse.rows, 568);
  assert.equal(report.content.summary.appliedReplacements, 0);
  assert.equal(report.content.readyForScientificExecution, false);
});

test('aligned literal segments support twenty review candidates without choosing an authoritative version', () => {
  const { earlier, latest } = inputs(), report = compareE26Versions(earlier, latest, selection()).content;
  assert.equal(report.summary.reviewedPhysicalPositions, 57);
  assert.equal(report.summary.pendingPhysicalPositions, 51);
  assert.equal(report.summary.earlierPlainIdCandidatesPending, 20);
  assert.deepEqual(report.summary.states, { aligned_literal_segments: 28, identity_differs: 11, ambiguous_boundaries: 18 });
  const line86 = report.comparisons.find(row => row.physicalLine === 86)!;
  assert.equal(line86.literalSegments!.earlier[4], '16');
  assert.match(line86.literalSegments!.latest[4], /^16"/);
  assert.equal(line86.decision, 'pending_no_replacement_applied');
  assert.equal(report.comparisons.find(row => row.physicalLine === 668)!.state, 'identity_differs');
});

test('nine earlier multiline groups decode with source context while the latest source stays unresolved', () => {
  const { earlier, latest } = inputs(), report = compareE26Versions(earlier, latest, selection()).content;
  assert.equal(report.multilineComparisons.length, 9);
  assert.equal(report.summary.earlierMultilineGroupsDecoded, 9);
  assert.equal(report.summary.earlierMultilineGroupsWithConsecutiveAnchors, 9);
  const group = report.multilineComparisons[0];
  assert.equal(group.startPhysicalLine, 876); assert.equal(group.endPhysicalLine, 877);
  assert.equal(group.earlier.decoded!.ID, '875'); assert.equal(group.earlier.decoded!.ID_STD_TC, '27');
  assert.match(group.earlier.decoded!.ID_TC, /\n$/);
  assert.equal(group.latest.decoded, null);
  const span = earlier['tcs.csv'].subarray(group.earlier.startByte, group.earlier.endByteExclusive);
  assert.equal(sha(span), group.earlier.sha256); assert.equal(span.toString('utf8'), group.earlier.rawText);
  assert.equal(report.summary.logicalRecordsRecovered, null);
});

test('unsupported selections, overlapping groups and unknown headers are rejected rather than silently realigned', () => {
  const { earlier, latest } = inputs();
  for (const mutate of [
    (plan: any) => plan.flaggedPhysicalLines.push(plan.flaggedPhysicalLines[0]),
    (plan: any) => plan.locallyEncodedLines.push(2),
    (plan: any) => plan.multilineGroups.push(plan.multilineGroups[0]),
    (plan: any) => { plan.multilineGroups[0].endPhysicalLine += 1; }
  ]) {
    const plan = selection(); mutate(plan);
    assert.throws(() => compareE26Versions(earlier, latest, plan), /Invalid|overlapping/);
  }
  const changed = { ...earlier, 'tcs.csv': Buffer.from('A;B\n1;2\n') };
  assert.throws(() => compareE26Versions(changed, latest, selection()), /headers differ/);
});
