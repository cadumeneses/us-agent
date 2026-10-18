import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { snapshotContent } from '../apps/api/src/domain/content-snapshot.js';
import { aggregateE21Equation43, runTestrecEquationDemo } from '../apps/api/src/services/testrec-equations.js';

const root = new URL('../', import.meta.url);
const read = async (file: string) => JSON.parse(await readFile(new URL(file, root), 'utf8'));
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || !['--output', '--replay'].includes(args[0]))) throw new Error('Uso: check:testrec-equations [--output arquivo-novo.json | --replay evidencia.json]');
const definition = await read('config/recommenders/testrec-e21.draft.json');
const source = await read('research/examples/testrec-e21/equations-synthetic.json');
const catalog = await read('research/examples/testrec-e21/synthetic-catalog.json');
const illustration = await read('research/examples/testrec-e21/table-4-5.json');
const result = runTestrecEquationDemo(definition, source.target, source.dataset, catalog);
assert.equal(result.content.status, 'completed');
assert.equal(result.content.scientificReproduction, false);
assert.equal(result.content.input.content.representation.dimensions.length, source.expected.dimensions);
assert.deepEqual(result.content.ranked.map(row => row.recordId), source.expected.rankedIds);
assert.deepEqual(result.content.neighbors.map(row => row.recordId), source.expected.neighborIds);
for (const item of result.content.items) assert.equal(item.score, source.expected.scores[item.testCaseId]);
assert.equal(result.content.items.length, Object.keys(source.expected.scores).length);
const target = illustration.dataset.records.find((row: { id: string }) => row.id === illustration.targetId);
const dataset = { ...illustration.dataset, records: illustration.dataset.records.filter((row: { id: string }) => illustration.candidateIds.includes(row.id)) };
const incomplete = runTestrecEquationDemo(definition, target, dataset);
assert.equal(incomplete.content.status, 'blocked');
assert.deepEqual(incomplete.content.issues.map(row => row.code), ['unknown_test_associations']);
const arithmetic = aggregateE21Equation43([
  { recordId: 'e1', similarity: 0.5, testCaseIds: ['CT03'] },
  { recordId: 'e5', similarity: 0.87, testCaseIds: ['CT03', 'CT04'] },
  { recordId: 'e6', similarity: 0.75, testCaseIds: ['CT03', 'CT04', 'CT01'] }
]);
assert.ok(Math.abs(arithmetic[0].score - 0.7066666666666667) < 1e-12);
assert.equal(arithmetic[1].score, 0.54); assert.equal(arithmetic[2].score, 0.25);
const paths = ['apps/api/src/services/testrec-equations.ts', 'apps/api/src/services/testrec-contract.ts',
  'apps/api/src/services/knn.ts', 'apps/api/src/domain/test-case-catalog.ts', 'apps/api/src/domain/content-snapshot.ts',
  'apps/api/src/domain/recommender-definition.ts', 'apps/api/src/domain/recommender-taxonomy.ts',
  'config/recommenders/testrec-e21.draft.json', 'research/examples/testrec-e21/equations-synthetic.json',
  'research/examples/testrec-e21/table-4-5.json', 'research/examples/testrec-e21/synthetic-catalog.json', 'scripts/check-testrec-equations.ts'];
const sourceHashes: Record<string, string> = {};
for (const path of paths) sourceHashes[path] = createHash('sha256').update(await readFile(new URL(path, root))).digest('hex');
const pdf = (await readdir(root)).find(file => file.startsWith('2021_Ednaldo') && file.endsWith('.pdf'));
const sourceVerified = pdf !== undefined;
if (pdf) assert.equal(createHash('sha256').update(await readFile(new URL(pdf, root))).digest('hex'), illustration.source.sha256);
const evidence = snapshotContent({ schemaVersion: 1, sourceHashes, sourceVerified, sourceSha256: illustration.source.sha256,
  fixture: snapshotContent(source), result, incompleteIllustration: incomplete,
  arithmeticAudit: { reference: 'E21 p.58 (PDF 72), textual associations only; not a full reconstruction of figures 4.8/4.9',
    computed: arithmetic, reportedCT01: 0.42, computedCT01: 0.25, unresolved: 'Q02_CT01' },
  limits: ['Q01_Euclidean_similarity_unresolved', 'Q02_CT01_unresolved', 'synthetic_only', 'no_API_or_UI_integration', 'not_an_empirical_evaluation'] });
if (args[0] === '--output') {
  const path = resolve(args[1]); await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx' });
} else if (args[0] === '--replay') {
  const previous = JSON.parse(await readFile(resolve(args[1]), 'utf8'));
  assert.equal(snapshotContent(previous.content).sha256, previous.sha256, 'Evidência corrompida.');
  assert.equal(previous.format, evidence.format);
  // Availability of a local PDF can differ; its expected hash and all computational content cannot.
  assert.equal(snapshotContent({ ...previous.content, sourceVerified }).sha256, evidence.sha256, 'Replay divergiu dos dados, regras ou fontes preservados.');
}
console.log(JSON.stringify({ status: result.content.status, syntheticNeighbors: result.content.neighbors.map(row => row.recordId),
  syntheticItems: result.content.items.length, incompleteIllustration: incomplete.content.status,
  sourceVerified, scientificReproduction: false, ct01: { reported: 0.42, calculated: 0.25 },
  replayMatched: args[0] === '--replay', evidenceSha256: evidence.sha256 }, null, 2));
