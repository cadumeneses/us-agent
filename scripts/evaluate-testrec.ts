import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { snapshotContent } from '../apps/api/src/domain/content-snapshot.js';
import { evaluateTestrec, testrecEvaluationCsv, type TestrecEvaluationReport } from '../apps/api/src/evaluation/testrec-evaluation.js';
import { buildTestrecPilot } from '../apps/api/src/evaluation/testrec-pilot.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path: string) => readFile(resolve(root, path), 'utf8');
const hash = (value: Uint8Array | string) => createHash('sha256').update(value).digest('hex');
const names = ['bundle.json', 'report.json', 'targets.csv'] as const;
const gate = (report: TestrecEvaluationReport) => report.deterministic.content.summary.allRepeatable && report.deterministic.content.summary.unexpectedStatuses === 0;

async function sources() {
  const sourceEvidence = JSON.parse(await read('docs/evidencias/b16b/published-runs.json'));
  const paths = [...new Set([...Object.keys(sourceEvidence.content.sourceHashes),
    'docs/evidencias/b16b/published-runs.json', 'scripts/evaluate-testrec.ts', 'scripts/check-testrec-evaluation.mjs',
    'apps/api/src/evaluation/testrec-evaluation.ts', 'apps/api/src/evaluation/testrec-pilot.ts',
    'apps/api/src/evaluation/recommendation-metrics.ts', 'research/pilots/testrec-v1/annotations.json', 'research/pilots/testrec-v1/protocol.md'])].sort();
  for (const path of paths) assert.ok(!path.startsWith('/') && !path.includes('\\') && !path.includes(':') && !path.split('/').includes('..'), 'Invalid inventoried path.');
  return Object.fromEntries(await Promise.all(paths.map(async path => [path, hash(await readFile(resolve(root, path)))])));
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || !['--output', '--replay'].includes(args[0]) || !args[1] || args[1].startsWith('--'))) throw new Error('Uso: evaluate:testrec [--output diretório-novo | --replay diretório-existente]');
  if (args[0] === '--replay') {
    const directory = resolve(args[1]);
    const manifest = JSON.parse(await readFile(resolve(directory, 'manifest.json'), 'utf8'));
    assert.equal(manifest.schemaVersion, 1);
    assert.equal(manifest.kind, 'synthetic_technical_pilot');
    assert.equal(manifest.scientificReproduction, false);
    assert.deepEqual(await sources(), manifest.sources, 'Inventoried source bytes differ.');
    const artifacts = Object.fromEntries(await Promise.all(names.map(async name => {
      const bytes = await readFile(resolve(directory, name));
      assert.equal(hash(bytes), manifest.artifacts[name], `Artifact differs: ${name}`);
      return [name, bytes.toString('utf8')];
    })));
    const original = JSON.parse(artifacts['report.json']) as TestrecEvaluationReport;
    assert.deepEqual(snapshotContent(original.deterministic.content), original.deterministic, 'Invalid report snapshot.');
    const bundle = JSON.parse(artifacts['bundle.json']);
    assert.deepEqual(manifest.protocol, bundle.protocol, 'Manifest protocol differs from bundle.');
    const replay = evaluateTestrec(bundle);
    assert.deepEqual(replay.deterministic, original.deterministic, 'Deterministic replay differs.');
    assert.equal(testrecEvaluationCsv(replay), artifacts['targets.csv'], 'CSV differs from report.');
    assert.ok(gate(replay), 'Technical gate failed.');
    assert.equal(manifest.technicalGatePassed, gate(replay), 'Manifest gate differs from results.');
    console.log(JSON.stringify({ replayMatched: true, reportSha256: replay.deterministic.sha256, targets: replay.deterministic.content.summary.targets, scientificReproduction: false }));
    return;
  }
  const bundle = buildTestrecPilot(await read('docs/evidencias/b16b/published-runs.json'), await read('research/pilots/testrec-v1/annotations.json'));
  const report = evaluateTestrec(bundle);
  const artifacts = { 'bundle.json': JSON.stringify(bundle, null, 2) + '\n', 'report.json': JSON.stringify(report, null, 2) + '\n', 'targets.csv': testrecEvaluationCsv(report) };
  const git = (...values: string[]) => execFileSync('git', values, { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
  const manifest = { schemaVersion: 1, kind: 'synthetic_technical_pilot', recordedAt: new Date().toISOString(),
    scientificReproduction: false, protocol: bundle.protocol, git: { head: git('rev-parse', 'HEAD'), dirty: Boolean(git('status', '--porcelain')) },
    environment: { node: process.version, icu: process.versions.icu, platform: process.platform, arch: process.arch, locale: new Intl.Collator().resolvedOptions().locale },
    sources: await sources(), artifacts: Object.fromEntries(Object.entries(artifacts).map(([name, value]) => [name, hash(value)])),
    technicalGatePassed: gate(report), limitations: ['Synthetic evaluator verification only; no empirical quality claim.',
      'Declared groups do not establish real-world independence.', 'Q01/Q02/Q03 and author data/protocol remain unresolved.', 'No participant configuration study or performance benchmark.'] };
  const directory = resolve(args[0] === '--output' ? args[1] : resolve(root, 'tmp', `testrec-pilot-${Date.now()}`));
  await mkdir(dirname(directory), { recursive: true });
  await mkdir(directory); // A reviewable evidence package is never overwritten.
  for (const [name, value] of Object.entries({ ...artifacts, 'manifest.json': JSON.stringify(manifest, null, 2) + '\n' })) await writeFile(resolve(directory, name), value, { flag: 'wx' });
  console.log(JSON.stringify({ output: directory, technicalGatePassed: gate(report), summary: report.deterministic.content.summary,
    reportSha256: report.deterministic.sha256, scientificReproduction: false }, null, 2));
  if (!gate(report)) process.exitCode = 1;
}
main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
