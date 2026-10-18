// Read-only verification of the exact Git blobs prepared for commit.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

if (process.argv.length !== 2) throw new Error('Usage: npm run check:scientific-index');
const git = (...args) => execFileSync('git', args, { maxBuffer: 20_000_000 });
const read = path => git('show', `:${path}`);
const json = path => JSON.parse(read(path).toString('utf8'));
const expected = new Map();
function add(path, sha256) {
  assert.ok(!path.startsWith('/') && !path.split('/').includes('..'), 'Invalid inventory path.');
  assert.match(sha256, /^[a-f0-9]{64}$/);
  if (expected.has(path)) assert.equal(expected.get(path), sha256, `Conflicting source inventories: ${path}`);
  expected.set(path, sha256);
}
const baseline = json('research/baselines/rnf-v2/manifest.json');
const pilot = json('docs/evidencias/b14a/manifest.json');
const equations = json('docs/evidencias/b16a/equations-demo.json');
const publishedEquations = json('docs/evidencias/b16b/published-runs.json');
for (const inventory of [baseline.sourceHashes, pilot.sources, equations.content.sourceHashes, publishedEquations.content.sourceHashes]) {
  for (const [path, sha256] of Object.entries(inventory)) add(path, sha256);
}
const sourceCount = expected.size;
for (const [name, sha256] of Object.entries(pilot.artifacts)) add(`docs/evidencias/b14a/${name}`, sha256);
for (const [path, sha256] of expected) {
  assert.equal(createHash('sha256').update(read(path)).digest('hex'), sha256, `Staged scientific bytes differ: ${path}`);
}
const attributes = git('check-attr', '--cached', '-z', 'text', '--', ...expected.keys()).toString('utf8').split('\0');
for (let index = 0; index < attributes.length - 1; index += 3) {
  assert.equal(attributes[index + 2], 'unset', `Staged .gitattributes must preserve bytes: ${attributes[index]}`);
}
console.log(JSON.stringify({ sourceFiles: sourceCount, artifactFiles: expected.size - sourceCount,
  stagedHashesMatched: expected.size, lineEndingsPreserved: true, readOnly: true }, null, 2));
