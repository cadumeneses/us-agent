import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const directory = resolve('tmp', `testrec-reconciliation-check-${randomUUID()}`);
await mkdir(directory, { recursive: true });
const first = resolve(directory, 'first'), second = resolve(directory, 'second');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const json = async path => JSON.parse(await readFile(path, 'utf8'));
function cli(args, expected = 0) {
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/reconcile-testrec-data.ts', ...args],
    { cwd: resolve('.'), encoding: 'utf8', windowsHide: true, maxBuffer: 2_000_000 });
  if (result.error) throw result.error;
  assert.equal(result.status, expected, result.stderr || result.stdout);
  return expected ? result.stderr : result.stdout;
}
cli(['--output', first]); cli(['--output', second]);
assert.equal(JSON.parse(cli(['--replay', first])).replayMatched, true);
for (const name of ['report.json', 'review.csv']) assert.ok((await readFile(resolve(first, name))).equals(await readFile(resolve(second, name))));
assert.match(cli(['--output', first], 1), /EEXIST|exist/i);
const reportPath = resolve(second, 'report.json'), manifestPath = resolve(second, 'manifest.json');
const cleanReport = await readFile(reportPath), cleanManifest = await readFile(manifestPath);
const forged = await json(reportPath); forged.content.summary.filledStandardIds = 18;
const forgedBytes = Buffer.from(JSON.stringify(forged)); await writeFile(reportPath, forgedBytes);
assert.match(cli(['--replay', second], 1), /Artifact bytes differ/);
const manifest = await json(manifestPath); manifest.artifacts['report.json'] = sha(forgedBytes);
await writeFile(manifestPath, JSON.stringify(manifest));
assert.match(cli(['--replay', second], 1), /Recomputed reconciliation differs/);
await writeFile(reportPath, cleanReport); await writeFile(manifestPath, cleanManifest);
const csvPath = resolve(second, 'review.csv'), csv = await readFile(csvPath); csv[100] ^= 1; await writeFile(csvPath, csv);
assert.match(cli(['--replay', second], 1), /Artifact bytes differ/);
await writeFile(csvPath, await readFile(resolve(first, 'review.csv')));
const alteredRoles = await json(manifestPath); alteredRoles.inputRoles.associations = 'unverified.csv';
await writeFile(manifestPath, JSON.stringify(alteredRoles));
assert.match(cli(['--replay', second], 1), /inputRoles|unverified|Expected values/);
console.log(JSON.stringify({ passed: true, checks: ['exact_replay', 'independent_repeatability', 'no_overwrite',
  'report_corruption', 'rehash_does_not_authorize_ID_inference', 'review_csv_corruption', 'source_role_substitution'], directory }));
