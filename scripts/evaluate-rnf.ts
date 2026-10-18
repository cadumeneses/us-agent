import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { arch, cpus, platform } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { snapshotContent } from '../apps/api/src/domain/content-snapshot.js';
import { evaluateRnf, evaluationCsv, rnfEvaluationBundleSchema, type RnfEvaluationReport } from '../apps/api/src/evaluation/rnf-evaluation.js';
import { buildRnfPilot } from '../apps/api/src/evaluation/rnf-pilot.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const sources = ['scripts/evaluate-rnf.ts', 'apps/api/src/evaluation/rnf-evaluation.ts', 'apps/api/src/evaluation/rnf-pilot.ts',
  'apps/api/src/evaluation/recommendation-metrics.ts', 'apps/api/src/domain/content-snapshot.ts', 'apps/api/src/domain/dataset-import.ts',
  'apps/api/src/domain/import-formats.ts', 'apps/api/src/domain/dataset-publication.ts', 'apps/api/src/domain/definition-publication.ts',
  'apps/api/src/domain/recommender-definition.ts', 'apps/api/src/domain/recommender-taxonomy.ts', 'apps/api/src/services/recommendation-execution.ts',
  'apps/api/src/services/configured-nfr.ts', 'apps/api/src/services/rnf-policy.ts', 'apps/api/src/services/knn.ts', 'apps/api/src/services/nfr-engine.ts',
  'apps/api/src/evaluation/nfr-baseline.ts', 'config/recommenders/rnf-v2.draft.json', 'research/baselines/rnf-v2/reference.json',
  'research/baselines/rnf-v2/manifest.json', 'research/pilots/rnf-v1/annotations.json', 'research/pilots/rnf-v1/protocol.md', 'package-lock.json'];
const hash = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
const read = (name: string) => readFile(resolve(root, name), 'utf8');
function technicalGate(report: RnfEvaluationReport) {
  const summary = report.deterministic.content.summary;
  return summary.allRepeatable && summary.compatibility.targets === summary.compatibility.matched &&
    summary.unexpectedTechnicalFailures === 0 && summary.missingExpectedTechnicalFailures === 0;
}
async function sourceHashes() {
  return Object.fromEntries(await Promise.all(sources.map(async name => [name, hash(await readFile(resolve(root, name)))])));
}
async function main() {
  const args = process.argv.slice(2), options: Record<string, string> = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    if (!['--input', '--output', '--replay'].includes(key) || options[key] || !args[index + 1] || args[index + 1].startsWith('--')) throw new Error('Uso: evaluate:rnf [--input bundle.json] [--output diretório-novo] OU --replay diretório-existente');
    options[key] = args[index + 1];
  }
  if (options['--replay']) {
    if (Object.keys(options).length !== 1) throw new Error('Replay aceita somente o diretório exportado.');
    const directory = resolve(options['--replay']);
    const manifest = JSON.parse(await readFile(resolve(directory, 'manifest.json'), 'utf8'));
    // Fixed filenames: never follow paths taken from an untrusted manifest.
    const content = Object.fromEntries(await Promise.all(['bundle.json', 'report.json', 'targets.csv'].map(async name => {
      const bytes = await readFile(resolve(directory, name)); assert.equal(hash(bytes), manifest.artifacts[name], `Arquivo divergente: ${name}`); return [name, bytes.toString('utf8')];
    })));
    assert.deepEqual(await sourceHashes(), manifest.sources, 'Fontes diferentes das registradas; use a versão do pacote para verificar este ensaio.');
    const original = JSON.parse(content['report.json']) as RnfEvaluationReport;
    assert.deepEqual(snapshotContent(original.deterministic.content), original.deterministic, 'Hash do relatório inválido.');
    const replay = evaluateRnf(JSON.parse(content['bundle.json']));
    assert.equal(replay.deterministic.sha256, original.deterministic.sha256, 'Replay determinístico divergiu.');
    assert.equal(evaluationCsv(replay), content['targets.csv'], 'CSV não corresponde ao relatório.');
    assert.ok(technicalGate(replay), 'O pacote preservado contém reprovação técnica.');
    console.log(`Replay verificado: ${replay.deterministic.content.summary.targets} cenários; SHA-256=${replay.deterministic.sha256}. Tempos não são comparados.`);
    return;
  }
  const bundle = options['--input'] ? rnfEvaluationBundleSchema.parse(JSON.parse(await readFile(resolve(options['--input']), 'utf8'))) : buildRnfPilot(
    await read('config/recommenders/rnf-v2.draft.json'), await read('research/baselines/rnf-v2/reference.json'),
    await read('research/baselines/rnf-v2/manifest.json'), await read('research/pilots/rnf-v1/annotations.json'));
  const report = evaluateRnf(bundle);
  const artifacts = { 'bundle.json': JSON.stringify(bundle, null, 2) + '\n', 'report.json': JSON.stringify(report, null, 2) + '\n', 'targets.csv': evaluationCsv(report) };
  const git = (args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
  const manifest = { schemaVersion: 1, recordedAt: new Date().toISOString(), timeZone: 'America/Sao_Paulo',
    kind: 'synthetic_technical_pilot', protocol: bundle.protocol, git: { head: git(['rev-parse', 'HEAD']), dirty: Boolean(git(['status', '--porcelain'])) },
    environment: { node: process.version, icu: process.versions.icu, locale: new Intl.Collator().resolvedOptions().locale, platform: platform(), arch: arch(), cpu: cpus()[0]?.model ?? 'unknown', logicalCpus: cpus().length },
    sources: await sourceHashes(), artifacts: Object.fromEntries(Object.entries(artifacts).map(([name, text]) => [name, hash(text)])),
    technicalGatePassed: technicalGate(report), limitations: ['Synthetic fixtures; no empirical quality claim.', 'No classification, configuration/usability study, HTTP/database benchmark or author dataset.', 'No inference from measured durations.'] };
  const directory = resolve(options['--output'] ?? resolve(root, 'tmp', `rnf-pilot-${Date.now()}`));
  await mkdir(dirname(directory), { recursive: true });
  await mkdir(directory); // Existing evidence must never be overwritten, even if the new gate fails.
  for (const [name, text] of Object.entries({ ...artifacts, 'manifest.json': JSON.stringify(manifest, null, 2) + '\n' })) await writeFile(resolve(directory, name), text, { flag: 'wx' });
  const summary = report.deterministic.content.summary;
  console.log(JSON.stringify({ output: directory, technicalGatePassed: technicalGate(report), targets: summary.targets,
    compatibility: summary.compatibility, statuses: summary.statuses, relevanceScope: 'Synthetic annotations only; not empirical performance.', reportSha256: report.deterministic.sha256 }, null, 2));
  if (!technicalGate(report)) process.exitCode = 1;
}
main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
