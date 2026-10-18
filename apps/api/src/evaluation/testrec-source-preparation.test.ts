import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { E26_SOURCE_FILES } from './testrec-source-audit.js';
import { prepareE26Sources, reviewAssociationLines } from './testrec-source-preparation.js';

const base = new URL('../../../../research/sources/testrec-e26/zenodo-16133793/', import.meta.url);
const source = () => Object.fromEntries(E26_SOURCE_FILES.map(name => [name, readFileSync(new URL(name, base))])) as Record<typeof E26_SOURCE_FILES[number], Buffer>;
const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

test('preparation preserves original bytes and criteria text, maps numeric IDs explicitly and publishes nothing', () => {
  const input = source(), hashes = Object.fromEntries(E26_SOURCE_FILES.map(name => [name, digest(input[name])]));
  const { taxonomy, report } = prepareE26Sources(input), again = prepareE26Sources(input);
  assert.deepEqual(report, again.report);
  assert.deepEqual(report.content.inputHashes, hashes);
  assert.deepEqual(Object.fromEntries(E26_SOURCE_FILES.map(name => [name, digest(input[name])])), hashes);
  assert.equal(taxonomy.kind, 'list'); assert.equal(taxonomy.nodes.length, 59);
  for (const row of report.content.transformation.taxonomy.mapping) {
    const node = taxonomy.nodes.find(node => node.id === row.nodeId)!;
    assert.equal(node.name, row.description); assert.equal(node.description, row.description);
    assert.equal(node.parentId, null); assert.equal(row.nodeId, `ca_${row.sourceId}`);
  }
  assert.equal(report.content.transformation.taxonomy.state, 'draft_not_published');
  assert.equal(report.content.transformation.correctedCells, 0);
  assert.equal(report.content.transformation.excludedRecords, 0);
  assert.equal(report.content.readyForScientificExecution, false);
});

test('source-specific diagnostics expose all physical units, byte coverage, adjacent context and unresolved boundaries', () => {
  const input = source(), result = reviewAssociationLines(input['test_cases_for_user_stories.csv']);
  assert.equal(result.wholeFile.state, 'blocked'); assert.equal(result.wholeFile.error!.line, 86);
  assert.equal(result.summary.physicalUnits, 1363);
  assert.equal(result.summary.requiringReview, 57); assert.equal(result.summary.parseableInIsolation, 1306);
  assert.equal(result.summary.recoveredRecords, null); assert.equal(result.recordBoundariesConfirmed, false);
  const all = [result.header, ...result.units];
  assert.equal(all[0].startByte, 0);
  assert.equal(all.at(-1)!.endByteExclusive, input['test_cases_for_user_stories.csv'].length);
  all.forEach((span, index) => {
    if (index) assert.equal(span.startByte, all[index - 1].endByteExclusive);
    assert.equal(span.sha256, digest(input['test_cases_for_user_stories.csv'].subarray(span.startByte, span.endByteExclusive)));
  });
  const split = result.review.find(row => row.physicalLine === 876)!;
  assert.ok(split.context.some(row => row.physicalLine === 877));
  assert.equal(result.review.find(row => row.physicalLine === 86)!.rawText,
    input['test_cases_for_user_stories.csv'].subarray(result.units[84].startByte, result.units[84].endByteExclusive).toString('utf8'));
});

test('valid multiline CSV is never treated as recoverable independent physical records', () => {
  const bytes = Buffer.from('\uFEFFProjeto;ID_US;ID;ID_TC;ID_STD_TC\r\nP;#1;1;"linha\r\nseguinte";a\r\n');
  const result = reviewAssociationLines(bytes);
  assert.equal(result.wholeFile.state, 'parseable');
  assert.equal(result.summary.physicalUnits, 2);
  assert.equal(result.summary.requiringReview, 2);
  assert.equal(result.summary.acceptedRecords, null);
  assert.ok(result.header.rawText.startsWith('\uFEFF'));
  assert.equal(result.summary.excludedRecords, 0);
  assert.equal(result.units[1].endByteExclusive, bytes.length);
});

test('missing fields and multiple values stay unresolved with observed pairs and source row locations', () => {
  const result = prepareE26Sources(source()).report.content;
  assert.equal(result.profiles.uniqueComparisonIdentities, 304);
  assert.equal(result.profiles.missingFields, 51); assert.equal(result.profiles.multipleValues, 13);
  assert.equal(result.links.unmatchedComparisonIdentities, 2);
  for (const profile of result.profiles.review) {
    for (const pair of profile.observedClassificationPairs) {
      assert.ok(profile.sourceRows.some(row => row.module === pair.module && row.operation === pair.operation));
      assert.ok(pair.lines.every(line => profile.sourceRows.some(row => row.line === line && row.module === pair.module && row.operation === pair.operation)));
    }
    for (const row of profile.sourceRows) assert.ok(row.line >= 2 && row.ordinal >= 1);
  }
});

test('unknown schemas, duplicate acceptance IDs, invalid UTF-8 and empty sources require explicit review', () => {
  const input = source(); input['acceptance_criteria_data.csv'] = Buffer.from('ID;Descrição\n1;A\n1;B\n');
  assert.throws(() => prepareE26Sources(input), /unique literal numeric/);
  input['acceptance_criteria_data.csv'] = Buffer.from('Identifier;Description\n1;A\n');
  assert.throws(() => prepareE26Sources(input), /headers differ/);
  assert.throws(() => reviewAssociationLines(Buffer.from([0xff])), /encoded data|encoding/i);
  assert.throws(() => reviewAssociationLines(Buffer.from('')), /empty/);
  assert.throws(() => reviewAssociationLines(Buffer.from('A;B\n1;2\n')), /headers differ/);
});
