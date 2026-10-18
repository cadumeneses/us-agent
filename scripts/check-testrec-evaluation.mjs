// Local synthetic file-flow checks. Keep temporary packages for inspection; never use a database/provider.
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const directory = resolve('tmp', `testrec-evaluation-${randomUUID()}`);
await mkdir(directory, { recursive: true });
const first = resolve(directory, 'first'), second = resolve(directory, 'second');
function cli(args, expected = 0) {
  let result;
  try {
    result = execFileSync(process.execPath, [resolve('node_modules/tsx/dist/cli.mjs'), 'scripts/evaluate-testrec.ts', ...args],
      { cwd: resolve('.'), encoding: 'utf8', windowsHide: true, stdio: 'pipe' });
  } catch (error) {
    if (error.code === 'EPERM' || error.code === 'EACCES') throw error;
    assert.equal(error.status, expected, String(error.stderr));
    return String(error.stderr);
  }
  assert.equal(expected, 0, 'Command unexpectedly passed.');
  return result;
}
const read = name => readFile(name, 'utf8');
const json = async name => JSON.parse(await read(name));
const digest = value => createHash('sha256').update(value).digest('hex');
cli(['--output', first]);
assert.equal(JSON.parse(cli(['--replay', first])).replayMatched, true);
cli(['--output', second]);
const firstReport = await json(resolve(first, 'report.json'));
assert.equal(firstReport.deterministic.sha256, (await json(resolve(second, 'report.json'))).deterministic.sha256);
const preserved = digest(await read(resolve(first, 'report.json')));
assert.match(cli(['--output', first], 1), /EEXIST|exist/i);
assert.equal(digest(await read(resolve(first, 'report.json'))), preserved);
await writeFile(resolve(second, 'targets.csv'), (await read(resolve(second, 'targets.csv'))) + 'corrupted\r\n');
assert.match(cli(['--replay', second], 1), /Artifact differs: targets.csv/);
// Updating an artifact hash cannot conceal a changed deterministic result.
const report = structuredClone(firstReport);
report.deterministic.content.summary.targets = 99;
const reportText = JSON.stringify(report) + '\n';
await writeFile(resolve(second, 'report.json'), reportText);
await writeFile(resolve(second, 'targets.csv'), await read(resolve(first, 'targets.csv')));
const manifest = await json(resolve(second, 'manifest.json'));
manifest.artifacts['report.json'] = digest(reportText);
await writeFile(resolve(second, 'manifest.json'), JSON.stringify(manifest));
assert.match(cli(['--replay', second], 1), /Invalid report snapshot/);
// Repaired file hashes still cannot conceal output leakage in the bundle.
const bundle = await json(resolve(first, 'bundle.json'));
bundle.cases[0].request.input.values.test_case_ids = ['demo-create'];
const bundleText = JSON.stringify(bundle) + '\n';
await writeFile(resolve(second, 'bundle.json'), bundleText);
await writeFile(resolve(second, 'report.json'), await read(resolve(first, 'report.json')));
const clean = await json(resolve(first, 'manifest.json'));
clean.artifacts['bundle.json'] = digest(bundleText);
await writeFile(resolve(second, 'manifest.json'), JSON.stringify(clean));
assert.match(cli(['--replay', second], 1), /Target answers must be withheld/);
clean.sources['scripts/evaluate-testrec.ts'] = '0'.repeat(64);
await writeFile(resolve(second, 'manifest.json'), JSON.stringify(clean));
assert.match(cli(['--replay', second], 1), /Inventoried source bytes differ/);
console.log(JSON.stringify({ checks: ['export', 'exact_replay', 'independent_export_repeatability', 'no_overwrite', 'csv_corruption', 'report_corruption', 'target_output_leakage', 'source_mismatch'], passed: true, directory }));
