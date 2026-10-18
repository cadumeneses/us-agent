import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { snapshotContent } from '../apps/api/src/domain/content-snapshot.js';
import { E26_SOURCE_FILES } from '../apps/api/src/evaluation/testrec-source-audit.js';
import { compareE26Versions, E26_EARLIER_FILES, E26_VERSION_COMPARISON } from '../apps/api/src/evaluation/testrec-source-versions.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path: string) => readFile(resolve(root, path));
const json = async (path: string) => JSON.parse((await read(path)).toString('utf8'));
const sha = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
const oldBase = 'research/sources/testrec-e26/zenodo-16133229', latestBase = 'research/sources/testrec-e26/zenodo-16133793';
const planSchema = z.strictObject({ schemaVersion: z.literal(1), version: z.literal(E26_VERSION_COMPARISON),
  scope: z.literal('comparison_only_no_replacements'), earlierRecord: z.literal(16133229), latestRecord: z.literal(16133793),
  flaggedPhysicalLines: z.array(z.number().int().min(2)), locallyEncodedLines: z.array(z.number().int().min(2)),
  multilineGroups: z.array(z.strictObject({ startPhysicalLine: z.number().int().min(3), endPhysicalLine: z.number().int().min(4) })) });
async function main() {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || !['--output', '--replay'].includes(args[0]) || !args[1] || args[1].startsWith('--'))) throw new Error('Uso: compare:testrec-sources [--output diretório-novo | --replay diretório-existente]');
  const upstream = await json('docs/evidencias/b02e/manifest.json');
  const paths = [...new Set([...Object.keys(upstream.sources), 'docs/evidencias/b02e/manifest.json', 'docs/evidencias/b02e/report.json',
    'research/sources/testrec-e26/versions-response.json', `${oldBase}/inventory.json`, `${oldBase}/record-metadata.json`,
    ...E26_EARLIER_FILES.map(name => `${oldBase}/${name}`), 'apps/api/src/evaluation/testrec-source-versions.ts',
    'scripts/compare-testrec-sources.ts', 'research/comparisons/testrec-e26-v1/comparison-plan.json', 'research/comparisons/testrec-e26-v1/protocol.md'])].sort();
  const sources: Record<string, string> = {};
  for (const path of paths) {
    assert.ok(!path.startsWith('/') && !path.includes('\\') && !path.includes(':') && !path.split('/').includes('..'), 'Invalid inventoried path.');
    sources[path] = sha(await read(path));
    if (upstream.sources[path]) assert.equal(sources[path], upstream.sources[path], `Preserved source differs: ${path}`);
  }
  assert.equal(sources['docs/evidencias/b02e/report.json'], upstream.artifacts['report.json']);
  const inventory = await json(`${oldBase}/inventory.json`), metadata = await json(`${oldBase}/record-metadata.json`);
  assert.equal(sources[`${oldBase}/record-metadata.json`], inventory.metadataSha256);
  assert.equal(sources['research/sources/testrec-e26/versions-response.json'], inventory.versionsResponseSha256);
  assert.equal(inventory.recordId, 16133229); assert.equal(inventory.license, 'cc-by-4.0');
  assert.equal(metadata.metadata.license.id, inventory.license); assert.equal(metadata.doi, inventory.doi);
  const versions = await json('research/sources/testrec-e26/versions-response.json');
  assert.deepEqual(versions.hits.hits.find((row: { id: number }) => row.id === 16133229), metadata);
  assert.equal(metadata.links.parent_doi, 'https://doi.org/10.5281/zenodo.16131516');
  const earlier = {} as Record<typeof E26_EARLIER_FILES[number], Buffer>;
  for (const name of E26_EARLIER_FILES) {
    const bytes = await read(`${oldBase}/${name}`), expected = inventory.files[name];
    assert.equal(bytes.length, expected.bytes); assert.equal(sha(bytes), expected.sha256);
    assert.equal(createHash('md5').update(bytes).digest('hex'), expected.md5);
    assert.equal(metadata.files.find((file: { key: string }) => file.key === name).checksum, `md5:${expected.md5}`);
    earlier[name] = bytes;
  }
  const latest = Object.fromEntries(await Promise.all(E26_SOURCE_FILES.map(async name => [name, await read(`${latestBase}/${name}`)]))) as Record<typeof E26_SOURCE_FILES[number], Buffer>;
  const plan = planSchema.parse(await json('research/comparisons/testrec-e26-v1/comparison-plan.json'));
  const preparation = await json('docs/evidencias/b02d/report.json'), transport = await json('docs/evidencias/b02e/report.json');
  assert.deepEqual(snapshotContent(preparation.content), preparation); assert.deepEqual(snapshotContent(transport.content), transport);
  assert.deepEqual(plan.flaggedPhysicalLines, preparation.content.associations.review.map((row: { physicalLine: number }) => row.physicalLine));
  assert.deepEqual(plan.locallyEncodedLines, transport.content.patches.map((row: { physicalLine: number }) => row.physicalLine));
  const oldest = versions.hits.hits.find((row: { id: number }) => row.id === 16131517);
  const report = snapshotContent({ schemaVersion: 1, kind: 'e26_published_versions_comparison', plan: snapshotContent(plan),
    versionHistory: versions.hits.hits.map((row: any) => ({ id: row.id, doi: row.doi, title: row.metadata.title,
      license: row.metadata.license.id, files: row.files.map((file: any) => ({ name: file.key, checksum: file.checksum })) })),
    oldestComparison: { scope: 'published_MD5_only_bytes_not_downloaded', files: oldest.files.map((file: any) => ({ name: file.key,
      declaredChecksumMatchesEarlier: metadata.files.find((other: any) => other.key === file.key)?.checksum === file.checksum })) },
    comparison: compareE26Versions(earlier, latest, plan) });
  const reportBytes = Buffer.from(JSON.stringify(report, null, 2) + '\n');
  if (args[0] === '--replay') {
    const directory = resolve(args[1]), manifest = JSON.parse(await readFile(resolve(directory, 'manifest.json'), 'utf8'));
    assert.equal(manifest.schemaVersion, 1); assert.equal(manifest.kind, 'e26_published_versions_comparison');
    assert.equal(manifest.scientificReproduction, false); assert.deepEqual(manifest.sources, sources, 'Source bytes differ.');
    const bytes = await readFile(resolve(directory, 'report.json'));
    assert.equal(sha(bytes), manifest.artifacts['report.json'], 'Report bytes differ.');
    assert.ok(bytes.equals(reportBytes), 'Recomputed comparison differs.'); assert.equal(manifest.reportSha256, report.sha256);
    console.log(JSON.stringify({ replayMatched: true, reportSha256: report.sha256, scientificReproduction: false })); return;
  }
  const manifest = { schemaVersion: 1, kind: 'e26_published_versions_comparison', recordedAt: new Date().toISOString(),
    scientificReproduction: false, sources, artifacts: { 'report.json': sha(reportBytes) }, reportSha256: report.sha256,
    limitations: report.content.comparison.content.limits };
  const directory = resolve(args[0] === '--output' ? args[1] : resolve(root, 'tmp', `testrec-versions-${Date.now()}`));
  await mkdir(dirname(directory), { recursive: true }); await mkdir(directory);
  await writeFile(resolve(directory, 'report.json'), reportBytes, { flag: 'wx' });
  await writeFile(resolve(directory, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ output: directory, summary: report.content.comparison.content.summary, reportSha256: report.sha256,
    scientificReproduction: false }, null, 2));
}
main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
