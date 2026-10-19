import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseImportJson } from '../apps/api/src/domain/import-formats.js';
import { configurationEffortCsv } from '../apps/api/src/evaluation/configuration-effort.js';
import { analyzeConfigurationEffortV2, configurationEffortV2Schema } from '../apps/api/src/evaluation/configuration-effort-v2.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const base = 'research/configuration-effort-v2';
const sha = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
const parse = (bytes: Uint8Array) => parseImportJson(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as any;
const jsonBytes = (value: unknown) => Buffer.from(JSON.stringify(value, null, 2) + '\n');
function safePath(path: string) {
  assert.ok(typeof path === 'string' && /^[a-zA-Z0-9_./-]+$/.test(path) && !path.startsWith('/') &&
    !path.split('/').some(part => part === '..' || part === ''), 'Invalid package path.');
  return path;
}
async function main() {
  const options: Record<string, string> = {}, taskDirs: string[] = [];
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i += 2) {
    const [key, value] = args.slice(i, i + 2);
    assert.ok(value && !value.startsWith('--'), 'Expected option value.');
    if (key === '--tasks') taskDirs.push(resolve(value));
    else { assert.ok(['--input', '--output', '--replay'].includes(key) && !options[key], 'Unknown or repeated option.'); options[key] = value; }
  }
  const replay = options['--replay'] ? resolve(options['--replay']) : null;
  assert.ok(replay ? !options['--input'] && !options['--output'] && !taskDirs.length : options['--input'] && options['--output'] && taskDirs.length,
    'Use --input observations.json --tasks task-directory [--tasks another-directory] --output new-directory | --replay directory.');
  const protocol = await readFile(resolve(root, base, 'protocol.md'));
  const materialBytes = await readFile(resolve(root, base, 'materials.json')), materials = parse(materialBytes);
  const inputBytes = await readFile(replay ? resolve(replay, 'input.json') : resolve(options['--input']));
  assert.ok(inputBytes.length <= 5_000_000, 'Observations exceed 5 MB.');
  const input = configurationEffortV2Schema.parse(parse(inputBytes));
  assert.equal(input.protocol.sha256, sha(protocol), 'Protocol bytes differ.');
  assert.deepEqual(input.materials, { id: materials.id, version: materials.version, sha256: sha(materialBytes) }, 'Binding materials differ.');
  const report = analyzeConfigurationEffortV2(input);
  if (replay) for (const row of input.sessions) taskDirs.push(resolve(replay, 'tasks', row.taskBatch.namespace));
  const artifacts: Record<string, Buffer> = { 'input.json': inputBytes, 'report.json': jsonBytes(report) };
  const sources: Record<string, string> = {};
  async function source(path: string, expected?: string) {
    const hash = sha(await readFile(resolve(root, safePath(path))));
    if (expected) assert.equal(hash, expected, `Source differs: ${path}`);
    if (sources[path]) assert.equal(sources[path], hash, 'Conflicting source hash.');
    sources[path] = hash;
  }
  for (const path of [`${base}/protocol.md`, `${base}/materials.json`, 'scripts/measure-configuration-v2.ts',
    'apps/api/src/evaluation/configuration-effort-v2.ts', 'scripts/check-configuration-binding.mjs']) await source(path);
  const found = new Set<string>();
  for (const directory of taskDirs) {
    const manifestBytes = await readFile(resolve(directory, 'manifest.json')), manifest = parse(manifestBytes);
    assert.match(manifest.namespace, /^[a-z][a-z0-9_-]{0,23}$/);
    const session = input.sessions.find(row => row.taskBatch.namespace === manifest.namespace);
    assert.ok(session && !found.has(manifest.namespace), 'Unused or duplicate task batch.');
    found.add(manifest.namespace);
    const bytes = await readFile(resolve(directory, 'materials.json')), batch = parse(bytes);
    assert.equal(sha(bytes), session.taskBatch.sha256, 'Task batch bytes differ from session.');
    assert.equal(batch.namespace, manifest.namespace, 'Task namespace differs.');
    assert.equal(batch.version, materials.taskPackVersion, 'Task pack version differs.');
    const check = spawnSync(process.execPath, ['--import', 'tsx', materials.taskGenerator, '--replay', directory],
      { cwd: root, encoding: 'utf8', windowsHide: true, maxBuffer: 1_000_000 });
    if (check.error) throw check.error;
    assert.equal(check.status, 0, check.stderr || check.stdout);
    for (const [path, hash] of Object.entries(manifest.sources)) await source(path, hash as string);
    const prefix = `tasks/${manifest.namespace}/`;
    artifacts[prefix + 'manifest.json'] = manifestBytes;
    for (const [path, hash] of Object.entries(manifest.artifacts)) {
      const bytes = await readFile(resolve(directory, safePath(path)));
      assert.equal(sha(bytes), hash, 'Task artifact differs.');
      artifacts[prefix + path] = bytes;
    }
  }
  assert.equal(found.size, input.sessions.length, 'Missing task batch.');
  const csv = configurationEffortCsv({ ...report, content: { ...report.content, version: 'configuration-effort-v1' } }).trimEnd().split('\r\n');
  artifacts['sessions.csv'] = Buffer.from(csv.map((line, index) => index === 0 ? line + ',"task_namespace","task_materials_sha256"' :
    line + `,"${input.sessions[index - 1].taskBatch.namespace}","${input.sessions[index - 1].taskBatch.sha256}"`).join('\r\n') + '\r\n');
  const artifactHashes = Object.fromEntries(Object.keys(artifacts).sort().map(path => [path, sha(artifacts[path])]));
  if (replay) {
    const manifest = parse(await readFile(resolve(replay, 'manifest.json')));
    assert.equal(manifest.schemaVersion, 2); assert.equal(manifest.kind, 'configuration_effort_bound_tasks');
    assert.equal(manifest.empiricalClaim, false); assert.equal(manifest.inputKind, input.kind);
    assert.deepEqual(manifest.sources, sources, 'Source bytes differ.');
    assert.deepEqual(manifest.artifacts, artifactHashes, 'Artifact inventory differs.');
    assert.equal(manifest.reportSha256, report.sha256);
    for (const [path, bytes] of Object.entries(artifacts)) assert.ok((await readFile(resolve(replay, path))).equals(bytes), `Recomputed artifact differs: ${path}`);
    console.log(JSON.stringify({ replayMatched: true, reportSha256: report.sha256, empiricalClaim: false })); return;
  }
  const output = resolve(options['--output']);
  await mkdir(dirname(output), { recursive: true }); await mkdir(output);
  for (const [path, bytes] of Object.entries(artifacts)) {
    await mkdir(dirname(resolve(output, path)), { recursive: true }); await writeFile(resolve(output, path), bytes, { flag: 'wx' });
  }
  await writeFile(resolve(output, 'manifest.json'), jsonBytes({ schemaVersion: 2, kind: 'configuration_effort_bound_tasks',
    inputKind: input.kind, empiricalClaim: false, sources, artifacts: artifactHashes, reportSha256: report.sha256 }), { flag: 'wx' });
  console.log(JSON.stringify({ output, sessions: input.sessions.length, taskBatches: found.size, reportSha256: report.sha256, empiricalClaim: false }));
}
main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
