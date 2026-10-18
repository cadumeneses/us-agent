// CLI export/replay checks using only synthetic files, without database, browser or providers.
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = resolve('.'), directory = resolve('tmp', `evaluation_check_${randomUUID().replaceAll('-', '')}`);
await mkdir(directory, { recursive: true });
const first = resolve(directory, 'first'), second = resolve(directory, 'second');
function cli(args, expectedExit = 0) {
  try {
    const output = execFileSync(process.execPath, [resolve('node_modules/tsx/dist/cli.mjs'), 'scripts/evaluate-rnf.ts', ...args], { cwd: root, encoding: 'utf8', windowsHide: true, stdio: 'pipe' });
    assert.equal(expectedExit, 0, output); return output;
  } catch (error) {
    if (error.code === 'EPERM' || error.code === 'EACCES') throw error;
    assert.equal(error.status, expectedExit, String(error.stderr)); return String(error.stderr);
  }
}
const read = path => readFile(path, 'utf8');
const json = async path => JSON.parse(await read(path));
const digest = value => createHash('sha256').update(value).digest('hex');
cli(['--output', first]);
assert.match(cli(['--replay', first]), /Replay verificado: 13/);
cli(['--input', resolve(first, 'bundle.json'), '--output', second]);
assert.equal((await json(resolve(first, 'report.json'))).deterministic.sha256, (await json(resolve(second, 'report.json'))).deterministic.sha256);
const preserved = digest(await read(resolve(first, 'report.json')));
assert.match(cli(['--output', first], 1), /EEXIST|exist/i);
assert.equal(digest(await read(resolve(first, 'report.json'))), preserved);
await writeFile(resolve(second, 'targets.csv'), (await read(resolve(second, 'targets.csv'))) + 'corrupted\r\n');
assert.match(cli(['--replay', second], 1), /Arquivo divergente: targets.csv/);
const changed = await json(resolve(first, 'bundle.json'));
changed.cases[0].compatibility.resultSha256 = '0'.repeat(64);
const changedPath = resolve(directory, 'regression.json'), failedOutput = resolve(directory, 'regression-output');
await writeFile(changedPath, JSON.stringify(changed));
cli(['--input', changedPath, '--output', failedOutput], 1);
assert.equal((await json(resolve(failedOutput, 'manifest.json'))).technicalGatePassed, false);
assert.equal((await json(resolve(failedOutput, 'report.json'))).deterministic.content.summary.compatibility.matched, 7);
const leaky = await json(resolve(first, 'bundle.json'));
leaky.cases.find(item => item.purpose === 'synthetic_relevance').request.input.values.nfrs = [{ type: 'Security', attribute: 'access_control', sentence: 'Leaked target output' }];
const leakyPath = resolve(directory, 'leakage.json'), leakyOutput = resolve(directory, 'leakage-output');
await writeFile(leakyPath, JSON.stringify(leaky));
assert.match(cli(['--input', leakyPath, '--output', leakyOutput], 1), /saída do alvo/);
await assert.rejects(stat(leakyOutput), error => error.code === 'ENOENT');
console.log('RNF evaluation CLI: export, exact replay, explicit bundle, no overwrite, CSV corruption, compatibility regression and leaked target output checks OK.');
