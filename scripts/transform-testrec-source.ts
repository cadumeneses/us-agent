import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { snapshotContent } from '../apps/api/src/domain/content-snapshot.js';
import { applyE26TransportPlan, reconstructE26Source } from '../apps/api/src/evaluation/testrec-source-transport.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path: string) => readFile(resolve(root, path));
const sha = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
const names = ['report.json', 'test-cases.transport-view.csv'] as const;
async function main() {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || !['--output', '--replay'].includes(args[0]) || !args[1] || args[1].startsWith('--'))) throw new Error('Uso: transform:testrec-source [--output diretório-novo | --replay diretório-existente]');
  const upstream = JSON.parse((await read('docs/evidencias/b02d/manifest.json')).toString('utf8'));
  const paths = [...new Set([...Object.keys(upstream.sources), 'docs/evidencias/b02d/manifest.json', 'docs/evidencias/b02d/report.json',
    'apps/api/src/evaluation/testrec-source-transport.ts', 'scripts/transform-testrec-source.ts',
    'research/transformations/testrec-e26-v1/encoding-plan.json', 'research/transformations/testrec-e26-v1/protocol.md'])].sort();
  const sources: Record<string, string> = {};
  for (const path of paths) {
    assert.ok(!path.startsWith('/') && !path.includes('\\') && !path.includes(':') && !path.split('/').includes('..'), 'Invalid inventoried path.');
    sources[path] = sha(await read(path));
    if (upstream.sources[path]) assert.equal(sources[path], upstream.sources[path], `Preserved preparation source differs: ${path}`);
  }
  const preparedBytes = await read('docs/evidencias/b02d/report.json');
  assert.equal(sha(preparedBytes), upstream.artifacts['report.json']);
  const preparation = JSON.parse(preparedBytes.toString('utf8'));
  assert.deepEqual(snapshotContent(preparation.content), preparation);
  const input = await read('research/sources/testrec-e26/zenodo-16133793/test_cases_for_user_stories.csv');
  const plan = JSON.parse((await read('research/transformations/testrec-e26-v1/encoding-plan.json')).toString('utf8'));
  const result = applyE26TransportPlan(input, plan);
  assert.deepEqual(reconstructE26Source(result.bytes, result.report), input, 'Inverse did not recover exact original bytes.');
  assert.equal(result.report.content.sourceSha256, preparation.content.inputHashes['test_cases_for_user_stories.csv']);
  const artifacts = { 'report.json': Buffer.from(JSON.stringify(result.report, null, 2) + '\n'), 'test-cases.transport-view.csv': result.bytes };
  if (args[0] === '--replay') {
    const directory = resolve(args[1]), manifest = JSON.parse(await readFile(resolve(directory, 'manifest.json'), 'utf8'));
    assert.equal(manifest.schemaVersion, 1); assert.equal(manifest.kind, 'e26_literal_cells_transport_view');
    assert.equal(manifest.scientificReproduction, false); assert.equal(manifest.originalRoundTripExact, true);
    assert.deepEqual(manifest.sources, sources, 'Source bytes differ.');
    for (const name of names) {
      const bytes = await readFile(resolve(directory, name));
      assert.equal(sha(bytes), manifest.artifacts[name], `Artifact differs: ${name}`);
      assert.deepEqual(bytes, artifacts[name], `Recomputed artifact differs: ${name}`);
    }
    assert.equal(manifest.reportSha256, result.report.sha256);
    console.log(JSON.stringify({ replayMatched: true, originalRoundTripExact: true, reportSha256: result.report.sha256, scientificReproduction: false }));
    return;
  }
  const manifest = { schemaVersion: 1, kind: 'e26_literal_cells_transport_view', recordedAt: new Date().toISOString(),
    scientificReproduction: false, originalRoundTripExact: true, reportSha256: result.report.sha256, sources,
    artifacts: Object.fromEntries(names.map(name => [name, sha(artifacts[name])])), limitations: result.report.content.limits };
  const directory = resolve(args[0] === '--output' ? args[1] : resolve(root, 'tmp', `testrec-transport-${Date.now()}`));
  await mkdir(dirname(directory), { recursive: true }); await mkdir(directory);
  for (const name of names) await writeFile(resolve(directory, name), artifacts[name], { flag: 'wx' });
  await writeFile(resolve(directory, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ output: directory, encodedTitleCells: result.report.content.changes.encodedTitleCells,
    remainingPhysicalUnitsToReview: result.report.content.after.requiringReview, originalRoundTripExact: true,
    wholeFileStatus: result.report.content.wholeFileAfter.state, readyForScientificExecution: false, reportSha256: result.report.sha256 }, null, 2));
}
main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
