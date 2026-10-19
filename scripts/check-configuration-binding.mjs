import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const directory = resolve('tmp', `configuration-binding-${randomUUID()}`);
await mkdir(directory, { recursive: true });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const json = async path => JSON.parse(await readFile(path, 'utf8'));
function cli(script, args, expected = 0) {
  const result = spawnSync(process.execPath, ['--import', 'tsx', `scripts/${script}.ts`, ...args],
    { encoding: 'utf8', windowsHide: true, maxBuffer: 1_000_000 });
  if (result.error) throw result.error;
  assert.equal(result.status, expected, result.stderr || result.stdout);
  return expected ? result.stderr : result.stdout;
}
const tasks = [resolve(directory, 'rnf'), resolve(directory, 'tests')];
for (const [index, task] of tasks.entries()) cli('prepare-configuration-tasks', ['--namespace', `binding-check-${index}`, '--output', task]);
const input = await json('research/configuration-effort-v1/rehearsal.json');
input.id = 'configuration-effort-binding-synthetic-v2'; input.schemaVersion = 2;
input.protocol = { version: 'configuration-effort-v2', sha256: sha(await readFile('research/configuration-effort-v2/protocol.md')) };
input.materials = { id: 'configuration-effort-task-binding', version: '2', sha256: sha(await readFile('research/configuration-effort-v2/materials.json')) };
input.sessions = input.sessions.slice(0, 2);
for (const [index, session] of input.sessions.entries()) session.taskBatch = {
  namespace: `binding-check-${index}`, sha256: sha(await readFile(resolve(tasks[index], 'materials.json'))) };
const inputPath = resolve(directory, 'observations.json');
await writeFile(inputPath, JSON.stringify(input, null, 2) + '\n');
const taskArgs = tasks.flatMap(task => ['--tasks', task]);
const run = (path, output, expected = 0, args = taskArgs) => cli('measure-configuration-v2', ['--input', path, ...args, '--output', output], expected);
const first = resolve(directory, 'first'), second = resolve(directory, 'second');
run(inputPath, first); run(inputPath, second);
if (process.argv[2] === '--evidence') {
  assert.ok(process.argv[3], 'Expected new evidence directory.');
  run(inputPath, resolve(process.argv[3]));
}
assert.equal(JSON.parse(cli('measure-configuration-v2', ['--replay', first])).replayMatched, true);
for (const name of ['input.json', 'report.json', 'sessions.csv', 'manifest.json']) {
  assert.ok((await readFile(resolve(first, name))).equals(await readFile(resolve(second, name))));
}
const report = await json(resolve(first, 'report.json'));
assert.equal(report.content.empiricalClaim, false);
assert.deepEqual(report.content.results.map(row => row.taskBatch), input.sessions.map(row => row.taskBatch));
const legacyReport = await json('docs/evidencias/b18b/report.json');
for (const [index, row] of report.content.results.entries()) {
  const { taskBatch, ...observations } = row;
  assert.deepEqual(observations, legacyReport.content.results[index]);
}
assert.match(await readFile(resolve(first, 'sessions.csv'), 'utf8'), /task_namespace.*task_materials_sha256/);
assert.match(run(inputPath, first, 1), /EEXIST|exist/i);
async function invalid(change, pattern, args = taskArgs) {
  const changed = structuredClone(input); change(changed);
  const path = resolve(directory, `invalid-${randomUUID()}.json`); await writeFile(path, JSON.stringify(changed));
  assert.match(run(path, resolve(directory, `rejected-${randomUUID()}`), 1, args), pattern);
}
await invalid(value => { value.protocol.sha256 = '0'.repeat(64); }, /Protocol bytes/);
await invalid(value => { value.materials.sha256 = '0'.repeat(64); }, /Binding materials/);
await invalid(value => { value.sessions[0].taskBatch.sha256 = '0'.repeat(64); }, /Task batch bytes/);
await invalid(value => { value.sessions[1].taskBatch = value.sessions[0].taskBatch; }, /distinct task namespace/);
await invalid(value => { value.protocol.version = 'configuration-effort-v1'; }, /configuration-effort-v2/);
await invalid(value => { value.sessions[0].events[1].atMs = -1; }, /Too small|>=0/);
await invalid(value => { value.kind = 'observed_sessions'; }, /provenance/);
assert.match(run(inputPath, resolve(directory, 'missing'), 1, taskArgs.slice(0, 2)), /Missing task batch/);
// Rehashing edited task files cannot pass the generator's semantic replay.
const taskManifestPath = resolve(tasks[0], 'manifest.json');
const taskManifest = await json(taskManifestPath);
const targetPath = resolve(tasks[0], 'participant/rnf/target.json');
const target = await json(targetPath); target.unexpected = true;
const edited = Buffer.from(JSON.stringify(target)); await writeFile(targetPath, edited);
taskManifest.artifacts['participant/rnf/target.json'] = sha(edited);
await writeFile(taskManifestPath, JSON.stringify(taskManifest));
assert.match(run(inputPath, resolve(directory, 'forged-tasks'), 1), /Recomputed task materials differ/);
// The preserved copy remains replayable without the supplied task directory.
assert.equal(JSON.parse(cli('measure-configuration-v2', ['--replay', first])).replayMatched, true);
const reportPath = resolve(first, 'report.json'), forged = await json(reportPath);
forged.content.empiricalClaim = true; const forgedBytes = Buffer.from(JSON.stringify(forged)); await writeFile(reportPath, forgedBytes);
const manifestPath = resolve(first, 'manifest.json'), manifest = await json(manifestPath);
manifest.artifacts['report.json'] = sha(forgedBytes); await writeFile(manifestPath, JSON.stringify(manifest));
assert.match(cli('measure-configuration-v2', ['--replay', first], 1), /Artifact inventory differs/);
console.log(JSON.stringify({ passed: true, directory, checks: ['two_methods', 'per_session_batch', 'timing_preserved', 'deterministic_replay',
  'self_contained_tasks', 'no_overwrite', 'protocol_mismatch', 'binding_mismatch', 'batch_mismatch', 'duplicate_namespace', 'old_version_rejected',
  'invalid_clock', 'invalid_provenance', 'missing_batch', 'rehashing_does_not_bypass_task_regeneration', 'forged_report_rejected'] }));
