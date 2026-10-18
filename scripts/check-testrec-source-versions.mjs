// Verify exported comparisons without modifying any public source or preserved package.
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const directory = resolve('tmp', `testrec-versions-check-${randomUUID()}`);
await mkdir(directory, { recursive: true });
const first = resolve(directory, 'first'), second = resolve(directory, 'second');
const read = path => readFile(path);
const json = async path => JSON.parse((await read(path)).toString('utf8'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function cli(args, expected = 0) {
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/compare-testrec-sources.ts', ...args],
    { cwd: resolve('.'), encoding: 'utf8', windowsHide: true, maxBuffer: 2_000_000 });
  if (result.error) throw result.error;
  assert.equal(result.status, expected, result.stderr || result.stdout);
  return expected ? result.stderr : result.stdout;
}
cli(['--output', first]);
assert.equal(JSON.parse(cli(['--replay', first])).replayMatched, true);
cli(['--output', second]);
const report = await read(resolve(first, 'report.json'));
assert.deepEqual(await read(resolve(second, 'report.json')), report);
assert.match(cli(['--output', first], 1), /EEXIST|exist/i);
assert.deepEqual(await read(resolve(first, 'report.json')), report);
const changed = await json(resolve(second, 'report.json'));
changed.content.comparison.content.summary.appliedReplacements = 20;
const bytes = Buffer.from(JSON.stringify(changed));
await writeFile(resolve(second, 'report.json'), bytes);
assert.match(cli(['--replay', second], 1), /Report bytes differ/);
const manifest = await json(resolve(second, 'manifest.json'));
manifest.artifacts['report.json'] = sha(bytes);
await writeFile(resolve(second, 'manifest.json'), JSON.stringify(manifest));
assert.match(cli(['--replay', second], 1), /Recomputed comparison differs/);
await writeFile(resolve(second, 'report.json'), report);
const clean = await json(resolve(first, 'manifest.json'));
clean.sources['research/sources/testrec-e26/zenodo-16133229/tcs.csv'] = '0'.repeat(64);
await writeFile(resolve(second, 'manifest.json'), JSON.stringify(clean));
assert.match(cli(['--replay', second], 1), /Source bytes differ/);
console.log(JSON.stringify({ passed: true, checks: ['exact_replay', 'independent_repeatability', 'no_overwrite',
  'report_corruption', 'fabricated_applied_decisions_with_updated_checksum', 'earlier_source_mismatch'], directory }));
