import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildConfigurationTaskPack, CONFIGURATION_TASK_PACK_VERSION } from '../apps/api/src/evaluation/configuration-task-materials.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path: string) => readFile(resolve(root, path));
const json = async (path: string) => JSON.parse((await read(path)).toString('utf8'));
const sha = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
const text = (value: unknown) => Buffer.from(JSON.stringify(value, null, 2) + '\n');
const base = 'research/configuration-tasks-v1';
async function main() {
  const args = process.argv.slice(2);
  let namespace: string | undefined, outputPath: string | undefined, replayPath: string | undefined;
  for (let i = 0; i < args.length; i += 2) {
    if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error('Uso: prepare:configuration-tasks --namespace identificador [--output diretório-novo] | --replay diretório');
    if (args[i] === '--namespace' && !namespace) namespace = args[i + 1];
    else if (args[i] === '--output' && !outputPath) outputPath = args[i + 1];
    else if (args[i] === '--replay' && !replayPath) replayPath = args[i + 1];
    else throw new Error('Argumento desconhecido ou repetido.');
  }
  if (replayPath && (namespace || outputPath)) throw new Error('Replay não aceita namespace/output.');
  const preserved = replayPath ? JSON.parse(await readFile(resolve(replayPath, 'manifest.json'), 'utf8')) : null;
  namespace ??= preserved?.namespace;
  if (!namespace) throw new Error('Namespace explícito é obrigatório para um lote novo.');
  const effort = await json('docs/evidencias/b18b/manifest.json'), execution = await json('docs/evidencias/b16b/published-runs.json');
  const prior: Record<string, string> = { ...effort.sources };
  for (const [path, hash] of Object.entries(execution.content.sourceHashes) as Array<[string, string]>) {
    if (prior[path]) assert.equal(prior[path], hash, `Conflicting preserved source: ${path}`);
    prior[path] = hash;
  }
  const paths = [...new Set([...Object.keys(prior), 'docs/evidencias/b18b/manifest.json',
    'apps/api/src/evaluation/configuration-task-materials.ts', 'scripts/prepare-configuration-tasks.ts', 'scripts/check-configuration-tasks.mjs',
    `${base}/participant-rnf.md`, `${base}/participant-tests.md`, `${base}/facilitator.md`])].sort();
  const sources: Record<string, string> = {};
  for (const path of paths) {
    assert.ok(!path.startsWith('/') && !path.includes('\\') && !path.includes(':') && !path.split('/').includes('..'), 'Invalid source path.');
    sources[path] = sha(await read(path));
    if (prior[path]) assert.equal(sources[path], prior[path], `Preserved source differs: ${path}`);
  }
  const pack = buildConfigurationTaskPack(namespace, { rnfDefinition: await json('config/recommenders/rnf-v2.draft.json'),
    testDefinition: await json('config/recommenders/testrec-equations.draft.json'), baseline: await json('research/baselines/rnf-v2/reference.json'),
    equations: await json('research/examples/testrec-e21/equations-synthetic.json'), catalog: await json('research/examples/testrec-e21/synthetic-catalog.json') });
  const files: Record<string, Buffer> = Object.fromEntries(Object.entries(pack.files).map(([path, content]) => [path, Buffer.from(content)]));
  for (const [path, template] of Object.entries({ 'participant/rnf.md': 'participant-rnf.md', 'participant/tests.md': 'participant-tests.md', 'facilitator/guide.md': 'facilitator.md' })) {
    files[path] = Buffer.from((await read(`${base}/${template}`)).toString('utf8').replaceAll('{{NAMESPACE}}', namespace));
  }
  files['verification.json'] = text(pack.verification);
  files['materials.json'] = text({ schemaVersion: 1, id: 'configuration-task-materials', version: CONFIGURATION_TASK_PACK_VERSION,
    namespace, status: 'proposal_for_methodological_review', participantStudyPerformed: false,
    collectionReadiness: 'requires_final_study_protocol_and_instrument_binding',
    instrumentProtocolSeed: { version: 'configuration-effort-v1', sha256: sources['research/configuration-effort-v1/protocol.md'] },
    files: Object.entries(files).map(([path, bytes]) => ({ path, sha256: sha(bytes), audience: path.startsWith('participant/') ? 'participant' : 'facilitator' })) });
  if (replayPath) {
    assert.equal(preserved.schemaVersion, 1); assert.equal(preserved.kind, 'configuration_task_materials'); assert.equal(preserved.empiricalClaim, false);
    assert.deepEqual(preserved.sources, sources, 'Source bytes differ.');
    assert.deepEqual(Object.keys(preserved.artifacts).sort(), Object.keys(files).sort());
    for (const [path, expected] of Object.entries(files)) {
      const bytes = await readFile(resolve(replayPath, path));
      assert.equal(sha(bytes), preserved.artifacts[path], 'Artifact bytes differ.');
      assert.ok(bytes.equals(expected), 'Recomputed task materials differ.');
    }
    assert.equal(preserved.verificationSha256, pack.verification.sha256);
    console.log(JSON.stringify({ replayMatched: true, namespace, verificationSha256: pack.verification.sha256, participantStudyPerformed: false })); return;
  }
  const output = resolve(outputPath ?? resolve(root, 'tmp', `configuration-tasks-${namespace}-${Date.now()}`));
  await mkdir(dirname(output), { recursive: true }); await mkdir(output);
  for (const [path, bytes] of Object.entries(files)) { await mkdir(dirname(resolve(output, path)), { recursive: true }); await writeFile(resolve(output, path), bytes, { flag: 'wx' }); }
  await writeFile(resolve(output, 'manifest.json'), text({ schemaVersion: 1, kind: 'configuration_task_materials', recordedAt: new Date().toISOString(),
    namespace, empiricalClaim: false, sources, artifacts: Object.fromEntries(Object.entries(files).map(([path, bytes]) => [path, sha(bytes)])),
    verificationSha256: pack.verification.sha256 }), { flag: 'wx' });
  console.log(JSON.stringify({ output, namespace, files: Object.keys(files).length, verificationSha256: pack.verification.sha256, participantStudyPerformed: false }));
}
main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
