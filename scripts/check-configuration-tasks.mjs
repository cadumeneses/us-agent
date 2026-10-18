import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const directory = resolve('tmp', `configuration-tasks-check-${randomUUID()}`);
await mkdir(directory, { recursive: true });
const first = resolve(directory, 'first'), second = resolve(directory, 'second');
const json = async path => JSON.parse(await readFile(path, 'utf8'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function cli(args, expected = 0) {
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/prepare-configuration-tasks.ts', ...args],
    { cwd: resolve('.'), encoding: 'utf8', windowsHide: true, maxBuffer: 1_000_000 });
  if (result.error) throw result.error;
  assert.equal(result.status, expected, result.stderr || result.stdout); return expected ? result.stderr : result.stdout;
}
cli(['--namespace', 'task-check', '--output', first]); cli(['--namespace', 'task-check', '--output', second]);
assert.equal(JSON.parse(cli(['--replay', first])).replayMatched, true);
const manifest = await json(resolve(first, 'manifest.json'));
for (const path of Object.keys(manifest.artifacts)) assert.ok((await readFile(resolve(first, path))).equals(await readFile(resolve(second, path))));
assert.match(cli(['--namespace', 'task-check', '--output', first], 1), /EEXIST|exist/i);
const keyPath = resolve(second, 'facilitator/answer-key.json'), changed = await json(keyPath);
changed.rnf.expectedValidRows = 42;
const bytes = Buffer.from(JSON.stringify(changed)); await writeFile(keyPath, bytes);
assert.match(cli(['--replay', second], 1), /Artifact bytes differ/);
const forged = await json(resolve(second, 'manifest.json')); forged.artifacts['facilitator/answer-key.json'] = sha(bytes);
await writeFile(resolve(second, 'manifest.json'), JSON.stringify(forged));
assert.match(cli(['--replay', second], 1), /Recomputed task materials differ/);
assert.match(cli(['--namespace', '../outside', '--output', resolve(directory, 'invalid')], 1), /namespace/i);
assert.match(cli(['--replay', first, '--namespace', 'other'], 1), /Replay/);
console.log(JSON.stringify({ passed: true, checks: ['exact_replay', 'all_files_repeatable', 'no_overwrite', 'answer_key_corruption',
  'rehash_does_not_approve_an_altered_oracle', 'namespace_validation', 'argument_exclusivity'], directory }));
