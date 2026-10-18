// Synthetic checks around the preserved public-data transformation; mutate only isolated temporary packages.
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
const directory = resolve('tmp', `testrec-transport-check-${randomUUID()}`);
await mkdir(directory, { recursive: true });
const first = resolve(directory, 'first'), second = resolve(directory, 'second');
const hash = value => createHash('sha256').update(value).digest('hex');
const read = path => readFile(path);
const json = async path => JSON.parse((await read(path)).toString('utf8'));
function cli(args, expected = 0) {
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/transform-testrec-source.ts', ...args],
    { cwd: resolve('.'), encoding: 'utf8', windowsHide: true, maxBuffer: 2_000_000 });
  if (result.error) throw result.error;
  assert.equal(result.status, expected, result.stderr || result.stdout);
  return expected ? result.stderr : result.stdout;
}
cli(['--output', first]);
assert.equal(JSON.parse(cli(['--replay', first])).originalRoundTripExact, true);
cli(['--output', second]);
const report = await read(resolve(first, 'report.json'));
assert.deepEqual(await read(resolve(second, 'report.json')), report);
assert.match(cli(['--output', first], 1), /EEXIST|exist/i);
assert.deepEqual(await read(resolve(first, 'report.json')), report);
const csvPath = resolve(second, 'test-cases.transport-view.csv'), changed = await read(csvPath);
changed[20] ^= 1;
await writeFile(csvPath, changed);
assert.match(cli(['--replay', second], 1), /Artifact differs: test-cases/);
const manifest = await json(resolve(second, 'manifest.json'));
manifest.artifacts['test-cases.transport-view.csv'] = hash(changed);
await writeFile(resolve(second, 'manifest.json'), JSON.stringify(manifest));
assert.match(cli(['--replay', second], 1), /Recomputed artifact differs: test-cases/);
await writeFile(csvPath, await read(resolve(first, 'test-cases.transport-view.csv')));
const clean = await json(resolve(first, 'manifest.json'));
clean.sources['research/transformations/testrec-e26-v1/encoding-plan.json'] = '0'.repeat(64);
await writeFile(resolve(second, 'manifest.json'), JSON.stringify(clean));
assert.match(cli(['--replay', second], 1), /Source bytes differ/);
console.log(JSON.stringify({ passed: true, directory, checks: ['exact_replay_and_inverse', 'independent_repeatability',
  'no_overwrite', 'derived_csv_corruption', 'forged_csv_with_updated_checksum', 'source_plan_mismatch'] }));
