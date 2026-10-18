import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { snapshotContent } from '../apps/api/src/domain/content-snapshot.js';
import { snapshotTestCaseCatalog } from '../apps/api/src/domain/test-case-catalog.js';
import { inspectTestrecData } from '../apps/api/src/services/testrec-contract.js';
const root = new URL('../', import.meta.url);
const read = async (path: string) => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const definition = await read('config/recommenders/testrec-e21.draft.json');
const illustration = await read('research/examples/testrec-e21/table-4-5.json');
const target = illustration.dataset.records.find((row: { id: string }) => row.id === illustration.targetId);
const dataset = { ...illustration.dataset, records: illustration.dataset.records.filter((row: { id: string }) => illustration.candidateIds.includes(row.id)) };
const contract = inspectTestrecData(definition, target, dataset);
assert.deepEqual(contract.content.representation.dimensions.map(item => item.label), illustration.expected.dimensions);
assert.deepEqual(contract.content.representation.targetVector, illustration.expected.targetVector);
for (const candidate of contract.content.representation.candidates) assert.deepEqual(candidate.vector, illustration.expected.candidateVectors[candidate.recordId]);
assert.equal(contract.content.representation.candidates.length, illustration.candidateIds.length);
assert.ok(contract.content.representation.candidates.every(row => row.tests.state === 'not_provided'));
const catalog = snapshotTestCaseCatalog(await read('research/examples/testrec-e21/synthetic-catalog.json'));
const pdf = (await readdir(root)).find(file => file.startsWith('2021_Ednaldo') && file.endsWith('.pdf'));
const sourceVerified = pdf !== undefined;
if (pdf) assert.equal(createHash('sha256').update(await readFile(new URL(pdf, root))).digest('hex'), illustration.source.sha256, 'PDF E21 difere da fonte da ilustração.');
const evidence = snapshotContent({ schemaVersion: 1, sourceVerified, sourceSha256: illustration.source.sha256, source: illustration.source,
  definition: snapshotContent(definition), illustration: snapshotContent(illustration), contract, catalog,
  scope: 'Data contract and table 4.6 representation only; no TestRec ranking, scores, original associations or empirical evaluation.' });
const args = process.argv.slice(2);
if (args.length) {
  if (args.length !== 2 || args[0] !== '--output') throw new Error('Uso: check:testrec-contract [--output arquivo-novo.json]');
  const path = resolve(args[1]); await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx' });
}
console.log(JSON.stringify({ vectorsMatched: 4, targetDimensions: 8, sourceVerified, catalogItems: catalog.content.items.length,
  canRecommend: contract.content.canRecommend, evidenceSha256: evidence.sha256, pending: contract.content.pending }, null, 2));
