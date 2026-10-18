import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { snapshotContent } from '../apps/api/src/domain/content-snapshot.js';
import { E26_SOURCE_FILES } from '../apps/api/src/evaluation/testrec-source-audit.js';
import { prepareE26Sources } from '../apps/api/src/evaluation/testrec-source-preparation.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const base = 'research/sources/testrec-e26/zenodo-16133793';
const read = (path: string) => readFile(resolve(root, path));
const sha = (value: Uint8Array | string) => createHash('sha256').update(value).digest('hex');
const artifacts = ['report.json', 'acceptance-taxonomy.draft.json'] as const;
async function main() {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || !['--output', '--replay'].includes(args[0]) || !args[1] || args[1].startsWith('--'))) throw new Error('Uso: prepare:testrec-source [--output diretório-novo | --replay diretório-existente]');
  const upstream = JSON.parse((await read('docs/evidencias/b02c/source-audit.json')).toString('utf8'));
  assert.deepEqual(snapshotContent(upstream.content), upstream, 'Invalid upstream audit snapshot.');
  const paths = [...new Set([...Object.keys(upstream.content.sourceHashes), 'docs/evidencias/b02c/source-audit.json',
    'scripts/prepare-testrec-source.ts', 'apps/api/src/evaluation/testrec-source-preparation.ts',
    'apps/api/src/domain/recommender-taxonomy.ts', 'research/preparations/testrec-e26-v1/protocol.md'])].sort();
  const sources: Record<string, string> = {};
  for (const path of paths) {
    assert.ok(!path.startsWith('/') && !path.includes('\\') && !path.includes(':') && !path.split('/').includes('..'), 'Invalid source path.');
    sources[path] = sha(await read(path));
    if (upstream.content.sourceHashes[path]) assert.equal(sources[path], upstream.content.sourceHashes[path], `Source differs from preserved audit: ${path}`);
  }
  const inventory = upstream.content.source;
  assert.equal(inventory.license, 'cc-by-4.0'); assert.equal(inventory.recordId, 16133793);
  const inputs = {} as Record<typeof E26_SOURCE_FILES[number], Buffer>;
  for (const name of E26_SOURCE_FILES) {
    const bytes = await read(`${base}/${name}`), expected = inventory.files[name];
    assert.equal(bytes.length, expected.bytes); assert.equal(sha(bytes), expected.sha256);
    inputs[name] = bytes;
  }
  const preparation = prepareE26Sources(inputs);
  const output = { 'report.json': JSON.stringify(preparation.report, null, 2) + '\n',
    'acceptance-taxonomy.draft.json': JSON.stringify(preparation.taxonomy, null, 2) + '\n' };
  if (args[0] === '--replay') {
    const directory = resolve(args[1]), manifest = JSON.parse(await readFile(resolve(directory, 'manifest.json'), 'utf8'));
    assert.equal(manifest.schemaVersion, 1); assert.equal(manifest.kind, 'e26_source_review_preparation');
    assert.equal(manifest.scientificReproduction, false);
    assert.deepEqual(manifest.sources, sources, 'Source bytes differ.');
    for (const name of artifacts) {
      const bytes = await readFile(resolve(directory, name));
      assert.equal(sha(bytes), manifest.artifacts[name], `Artifact bytes differ: ${name}`);
      assert.equal(bytes.toString('utf8'), output[name], `Recomputed artifact differs: ${name}`);
    }
    assert.equal(manifest.reportSha256, preparation.report.sha256);
    console.log(JSON.stringify({ replayMatched: true, reportSha256: preparation.report.sha256, scientificReproduction: false }));
    return;
  }
  const manifest = { schemaVersion: 1, kind: 'e26_source_review_preparation', scientificReproduction: false,
    recordedAt: new Date().toISOString(), environment: { node: process.version },
    sourceRecord: { conceptDoi: inventory.conceptDoi, versionDoi: inventory.versionDoi, license: inventory.license },
    sources, artifacts: Object.fromEntries(artifacts.map(name => [name, sha(output[name])])), reportSha256: preparation.report.sha256,
    limitations: preparation.report.content.limits };
  const directory = resolve(args[0] === '--output' ? args[1] : resolve(root, 'tmp', `testrec-preparation-${Date.now()}`));
  await mkdir(dirname(directory), { recursive: true }); await mkdir(directory);
  for (const [name, text] of Object.entries({ ...output, 'manifest.json': JSON.stringify(manifest, null, 2) + '\n' })) await writeFile(resolve(directory, name), text, { flag: 'wx' });
  console.log(JSON.stringify({ output: directory, criteria: preparation.taxonomy.nodes.length,
    physicalUnits: preparation.report.content.associations.summary, profiles: {
      missingFields: preparation.report.content.profiles.missingFields, multipleValues: preparation.report.content.profiles.multipleValues },
    reportSha256: preparation.report.sha256, readyForScientificExecution: false }, null, 2));
}
main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
