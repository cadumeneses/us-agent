// Read-only verification of exact bytes in the index, or explicitly in the worktree.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const worktree = process.argv.length === 3 && process.argv[2] === '--worktree';
if (process.argv.length !== 2 && !worktree) throw new Error('Usage: npm run check:scientific-index [-- --worktree]');
const git = (...args) => execFileSync('git', args, { maxBuffer: 20_000_000 });
const read = path => worktree ? readFileSync(path) : git('show', `:${path}`);
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
const assessments = json('docs/evidencias/b17b/assessment-integration.json');
const testPilot = json('docs/evidencias/b18a/manifest.json');
const sourceAudit = json('docs/evidencias/b02c/source-audit.json');
const sourceAuditManifest = json('docs/evidencias/b02c/manifest.json');
const sourcePreparation = json('docs/evidencias/b02d/manifest.json');
const sourceTransport = json('docs/evidencias/b02e/manifest.json');
const sourceVersions = json('docs/evidencias/b02f/manifest.json');
const reviewedAssociations = json('docs/evidencias/b02g/manifest.json');
const reconciledData = json('docs/evidencias/b02h/manifest.json');
const configurationEffort = json('docs/evidencias/b18b/manifest.json');
const configurationTasks = json('docs/evidencias/b18c/manifest.json');
const configurationBrowser = json('docs/evidencias/b18d/manifest.json');
const configurationBinding = json('docs/evidencias/b18e/manifest.json');
for (const inventory of [baseline.sourceHashes, pilot.sources, equations.content.sourceHashes, publishedEquations.content.sourceHashes, assessments.content.sourceHashes, testPilot.sources, sourceAudit.content.sourceHashes, sourcePreparation.sources, sourceTransport.sources, sourceVersions.sources, reviewedAssociations.sources, reconciledData.sources, configurationEffort.sources, configurationTasks.sources, configurationBrowser.sources, configurationBinding.sources]) {
  for (const [path, sha256] of Object.entries(inventory)) add(path, sha256);
}
const sourceCount = expected.size;
for (const [name, sha256] of Object.entries(pilot.artifacts)) add(`docs/evidencias/b14a/${name}`, sha256);
for (const [name, sha256] of Object.entries(testPilot.artifacts)) add(`docs/evidencias/b18a/${name}`, sha256);
for (const [name, sha256] of Object.entries(sourceAuditManifest.artifacts)) add(`docs/evidencias/b02c/${name}`, sha256);
for (const [name, sha256] of Object.entries(sourcePreparation.artifacts)) add(`docs/evidencias/b02d/${name}`, sha256);
for (const [name, sha256] of Object.entries(sourceTransport.artifacts)) add(`docs/evidencias/b02e/${name}`, sha256);
for (const [name, sha256] of Object.entries(sourceVersions.artifacts)) add(`docs/evidencias/b02f/${name}`, sha256);
for (const [name, sha256] of Object.entries(reviewedAssociations.artifacts)) add(`docs/evidencias/b02g/${name}`, sha256);
for (const [name, sha256] of Object.entries(reconciledData.artifacts)) add(`docs/evidencias/b02h/${name}`, sha256);
for (const [name, sha256] of Object.entries(configurationEffort.artifacts)) add(`docs/evidencias/b18b/${name}`, sha256);
for (const [name, sha256] of Object.entries(configurationTasks.artifacts)) add(`docs/evidencias/b18c/${name}`, sha256);
for (const [name, sha256] of Object.entries(configurationBrowser.artifacts)) add(`docs/evidencias/b18d/${name}`, sha256);
for (const [name, sha256] of Object.entries(configurationBinding.artifacts)) add(`docs/evidencias/b18e/${name}`, sha256);
for (const [path, sha256] of expected) {
  assert.equal(createHash('sha256').update(read(path)).digest('hex'), sha256, `Scientific bytes differ (${worktree ? 'worktree' : 'index'}): ${path}`);
}
const attributes = git('check-attr', ...(worktree ? [] : ['--cached']), '-z', 'text', '--', ...expected.keys()).toString('utf8').split('\0');
for (let index = 0; index < attributes.length - 1; index += 3) {
  assert.equal(attributes[index + 2], 'unset', `.gitattributes must preserve bytes: ${attributes[index]}`);
}
console.log(JSON.stringify({ sourceFiles: sourceCount, artifactFiles: expected.size - sourceCount,
  checkedTree: worktree ? 'worktree' : 'index', ...(worktree ? { worktreeHashesMatched: expected.size } : { stagedHashesMatched: expected.size }),
  lineEndingsPreserved: true, readOnly: true }, null, 2));
