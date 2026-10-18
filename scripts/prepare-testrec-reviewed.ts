import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { snapshotContent } from '../apps/api/src/domain/content-snapshot.js';
import { E26_SOURCE_FILES, auditE26Sources } from '../apps/api/src/evaluation/testrec-source-audit.js';
import { prepareReviewedE26Associations, reconstructReviewedE26Source } from '../apps/api/src/evaluation/testrec-reviewed-associations.js';
import { reviewTestrecFigures } from '../apps/api/src/evaluation/testrec-figure-review.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path: string) => readFile(resolve(root, path));
const json = async (path: string) => JSON.parse((await read(path)).toString('utf8'));
const sha = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
const latestBase = 'research/sources/testrec-e26/zenodo-16133793';
const associationPath = `${latestBase}/test_cases_for_user_stories.csv`;
const earlierPath = 'research/sources/testrec-e26/zenodo-16133229/tcs.csv';
const planPath = 'research/transformations/testrec-e26-reviewed-v1/association-plan.json';
const figurePath = 'research/examples/testrec-figures-v1/associations.json';
async function main() {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || !['--output', '--replay'].includes(args[0]) || !args[1] || args[1].startsWith('--'))) throw new Error('Uso: prepare:testrec-reviewed [--output diretório-novo | --replay diretório-existente]');
  const upstream = await json('docs/evidencias/b02f/manifest.json');
  const paths = [...new Set([...Object.keys(upstream.sources), 'docs/evidencias/b02f/manifest.json', 'docs/evidencias/b02f/report.json',
    planPath, figurePath, 'research/transformations/testrec-e26-reviewed-v1/protocol.md',
    'apps/api/src/evaluation/testrec-reviewed-associations.ts', 'apps/api/src/evaluation/testrec-figure-review.ts', 'scripts/prepare-testrec-reviewed.ts'])].sort();
  const sources: Record<string, string> = {};
  for (const path of paths) {
    assert.ok(!path.startsWith('/') && !path.includes('\\') && !path.includes(':') && !path.split('/').includes('..'), 'Invalid inventoried path.');
    sources[path] = sha(await read(path));
    if (upstream.sources[path]) assert.equal(sources[path], upstream.sources[path], `Preserved source differs: ${path}`);
  }
  assert.equal(sources['docs/evidencias/b02f/report.json'], upstream.artifacts['report.json']);
  const fixture = await json(figurePath);
  // Original PDFs remain outside Git. Verify them when available, independently from deterministic offline replay.
  const local = await readdir(root), sourcePdfsChecked: string[] = [];
  for (const [reference, filename] of Object.entries({ E21: local.find(file => file.startsWith('2021_Ednaldo') && file.endsWith('.pdf')), E26: local.find(file => file === '3748522.3779891.pdf') })) {
    if (filename) { assert.equal(sha(await read(filename)), fixture.sources[reference].sha256, `Local source PDF differs: ${reference}`); sourcePdfsChecked.push(reference); }
  }
  const result = prepareReviewedE26Associations(await read(associationPath), await read(earlierPath), await json(planPath));
  assert.ok(reconstructReviewedE26Source(result.bytes, result.report).equals(await read(associationPath)), 'Latest source inversion differs.');
  const derivedSources = Object.fromEntries(await Promise.all(E26_SOURCE_FILES.map(async name => [name,
    name === 'test_cases_for_user_stories.csv' ? result.bytes.toString('utf8') : (await read(`${latestBase}/${name}`)).toString('utf8')]))) as Record<typeof E26_SOURCE_FILES[number], string>;
  const report = snapshotContent({ schemaVersion: 1, kind: 'e26_reviewed_associations_candidate', scientificReproduction: false,
    derivation: result.report, auditOfExplicitDerivedCombination: auditE26Sources(derivedSources), figureReview: reviewTestrecFigures(fixture) });
  const artifacts: Record<string, Buffer> = { 'report.json': Buffer.from(JSON.stringify(report, null, 2) + '\n'), 'test-cases.reviewed-candidate.csv': result.bytes };
  if (args[0] === '--replay') {
    const directory = resolve(args[1]), manifest = JSON.parse(await readFile(resolve(directory, 'manifest.json'), 'utf8'));
    assert.equal(manifest.schemaVersion, 1); assert.equal(manifest.kind, report.content.kind); assert.equal(manifest.scientificReproduction, false);
    assert.deepEqual(manifest.sources, sources, 'Source bytes differ.');
    assert.deepEqual(Object.keys(manifest.artifacts).sort(), Object.keys(artifacts).sort());
    for (const [name, expected] of Object.entries(artifacts)) {
      const bytes = await readFile(resolve(directory, name));
      assert.equal(sha(bytes), manifest.artifacts[name], 'Artifact bytes differ.');
      assert.ok(bytes.equals(expected), 'Recomputed candidate differs.');
    }
    assert.equal(manifest.reportSha256, report.sha256);
    console.log(JSON.stringify({ replayMatched: true, reportSha256: report.sha256, sourcePdfsChecked, scientificReproduction: false })); return;
  }
  const manifest = { schemaVersion: 1, kind: report.content.kind, recordedAt: new Date().toISOString(), scientificReproduction: false, sources,
    artifacts: Object.fromEntries(Object.entries(artifacts).map(([name, bytes]) => [name, sha(bytes)])), reportSha256: report.sha256,
    limitations: result.report.content.limits };
  const directory = resolve(args[0] === '--output' ? args[1] : resolve(root, 'tmp', `testrec-reviewed-${Date.now()}`));
  await mkdir(dirname(directory), { recursive: true }); await mkdir(directory);
  for (const [name, bytes] of Object.entries(artifacts)) await writeFile(resolve(directory, name), bytes, { flag: 'wx' });
  await writeFile(resolve(directory, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ output: directory, summary: result.report.content.summary, joins: report.content.auditOfExplicitDerivedCombination.content.joins,
    figureMismatches: report.content.figureReview.content.mismatches, reportSha256: report.sha256, sourcePdfsChecked, scientificReproduction: false }, null, 2));
}
main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
