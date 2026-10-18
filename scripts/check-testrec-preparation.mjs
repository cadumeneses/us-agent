// Verify local file flow using isolated temporary packages. Never change the source data or preserved evidence.
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const directory = resolve('tmp', `testrec-preparation-check-${randomUUID()}`);
await mkdir(directory, { recursive: true });
const first = resolve(directory, 'first'), second = resolve(directory, 'second');
function cli(args, status = 0) {
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/prepare-testrec-source.ts', ...args],
    { cwd: resolve('.'), encoding: 'utf8', windowsHide: true, maxBuffer: 2_000_000 });
  if (result.error) throw result.error;
  assert.equal(result.status, status, result.stderr || result.stdout);
  return status ? result.stderr : result.stdout;
}
const read = path => readFile(path, 'utf8');
const json = async path => JSON.parse(await read(path));
const hash = value => createHash('sha256').update(value).digest('hex');
cli(['--output', first]);
assert.equal(JSON.parse(cli(['--replay', first])).replayMatched, true);
cli(['--output', second]);
const original = await read(resolve(first, 'report.json'));
assert.equal(hash(original), hash(await read(resolve(second, 'report.json'))));
assert.match(cli(['--output', first], 1), /EEXIST|exist/i);
assert.equal(await read(resolve(first, 'report.json')), original);
const draftPath = resolve(second, 'acceptance-taxonomy.draft.json');
await writeFile(draftPath, (await read(draftPath)) + 'corrupted');
assert.match(cli(['--replay', second], 1), /Artifact bytes differ: acceptance-taxonomy/);
// A modified file and repaired checksum still cannot pass recomputation against original source text.
const draft = await json(resolve(first, 'acceptance-taxonomy.draft.json'));
draft.nodes[0].name = 'fabricated description';
const modified = JSON.stringify(draft), manifest = await json(resolve(second, 'manifest.json'));
await writeFile(draftPath, modified);
manifest.artifacts['acceptance-taxonomy.draft.json'] = hash(modified);
await writeFile(resolve(second, 'manifest.json'), JSON.stringify(manifest));
assert.match(cli(['--replay', second], 1), /Recomputed artifact differs: acceptance-taxonomy/);
await writeFile(draftPath, await read(resolve(first, 'acceptance-taxonomy.draft.json')));
const clean = await json(resolve(first, 'manifest.json'));
clean.sources['scripts/prepare-testrec-source.ts'] = '0'.repeat(64);
await writeFile(resolve(second, 'manifest.json'), JSON.stringify(clean));
assert.match(cli(['--replay', second], 1), /Source bytes differ/);
console.log(JSON.stringify({ passed: true, checks: ['export', 'exact_replay', 'independent_repeatability', 'no_overwrite',
  'draft_corruption', 'forged_description_with_repaired_checksum', 'source_mismatch'], directory }));
