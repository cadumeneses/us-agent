import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { reconcileE26Data } from '../apps/api/src/evaluation/testrec-data-reconciliation.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path: string) => readFile(resolve(root, path));
const json = async (path: string) => JSON.parse((await read(path)).toString('utf8'));
const sha = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
const b = 'research/sources/testrec-e26/zenodo-16133793';
const roles = { profiles: `${b}/categorized_user_stories.csv`, associations: 'docs/evidencias/b02g/test-cases.reviewed-candidate.csv', criteriaLinks: `${b}/user_stories_test_cases.csv` };
const csvCell = (value: unknown) => '"' + String(value).replaceAll('"', '""') + '"';
async function main() {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || !['--output', '--replay'].includes(args[0]) || !args[1] || args[1].startsWith('--'))) throw new Error('Uso: reconcile:testrec-data [--output diretório-novo | --replay diretório-existente]');
  const upstream = await json('docs/evidencias/b02g/manifest.json');
  const paths = [...new Set([...Object.keys(upstream.sources), 'docs/evidencias/b02g/manifest.json',
    ...Object.keys(upstream.artifacts).map(name => `docs/evidencias/b02g/${name}`),
    'apps/api/src/evaluation/testrec-data-reconciliation.ts', 'scripts/reconcile-testrec-data.ts', 'research/preparations/testrec-e26-reconciliation-v1/protocol.md'])].sort();
  const sources: Record<string, string> = {};
  for (const path of paths) {
    assert.ok(!path.startsWith('/') && !path.includes('\\') && !path.includes(':') && !path.split('/').includes('..'), 'Invalid inventoried path.');
    sources[path] = sha(await read(path));
    if (upstream.sources[path]) assert.equal(sources[path], upstream.sources[path], `Preserved source differs: ${path}`);
  }
  for (const [name, expected] of Object.entries(upstream.artifacts)) assert.equal(sources[`docs/evidencias/b02g/${name}`], expected);
  const input = { profiles: await read(roles.profiles), associations: await read(roles.associations), criteriaLinks: await read(roles.criteriaLinks) };
  const report = reconcileE26Data(input), data = report.content;
  const rows: unknown[][] = [ ['kind', 'project', 'story_id', 'source_record_id', 'title', 'evidence', 'candidate_evidence', 'decision'] ];
  for (const row of data.unmatchedAssociationProfiles) rows.push(['missing_profile', row.identity.project, row.identity.storyId, '', '',
    JSON.stringify(row.associationEvidence), JSON.stringify({ suffixCandidates: row.suffixCandidates, differentProjectCandidates: row.differentProjectCandidates }), row.decision]);
  for (const row of data.missingStandardIds) rows.push(['missing_standard_test_id', row.rawProject, row.rawStoryId, row.sourceRecordId, row.title,
    JSON.stringify({ ordinal: row.ordinal, physicalLine: row.physicalLine, rawStandardTestId: row.rawStandardTestId }), JSON.stringify(row.titleCandidates), row.decision]);
  for (const row of data.conflictingTitleIds) rows.push(['same_title_different_standard_ids', '', '', '', row.title,
    JSON.stringify(row.observations), JSON.stringify(row.observedIds), row.decision]);
  for (const row of data.unmatchedCriteriaProfiles) rows.push(['criteria_without_profile', row.identity.project, row.identity.storyId, '', '',
    JSON.stringify(row.evidence), '', 'unresolved_no_profile_created_or_alias_applied']);
  const csv = rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
  const artifacts: Record<string, Buffer> = { 'report.json': Buffer.from(JSON.stringify(report, null, 2) + '\n'), 'review.csv': Buffer.from(csv) };
  if (args[0] === '--replay') {
    const directory = resolve(args[1]), manifest = JSON.parse(await readFile(resolve(directory, 'manifest.json'), 'utf8'));
    assert.equal(manifest.schemaVersion, 1); assert.equal(manifest.kind, 'e26_conservative_data_reconciliation');
    assert.equal(manifest.scientificReproduction, false); assert.deepEqual(manifest.sources, sources, 'Source bytes differ.');
    assert.deepEqual(manifest.inputRoles, roles); assert.deepEqual(Object.keys(manifest.artifacts).sort(), Object.keys(artifacts).sort());
    for (const [name, expected] of Object.entries(artifacts)) {
      const bytes = await readFile(resolve(directory, name)); assert.equal(sha(bytes), manifest.artifacts[name], 'Artifact bytes differ.');
      assert.ok(bytes.equals(expected), 'Recomputed reconciliation differs.');
    }
    assert.equal(manifest.reportSha256, report.sha256);
    console.log(JSON.stringify({ replayMatched: true, reportSha256: report.sha256, scientificReproduction: false })); return;
  }
  const directory = resolve(args[0] === '--output' ? args[1] : resolve(root, 'tmp', `testrec-reconciliation-${Date.now()}`));
  await mkdir(dirname(directory), { recursive: true }); await mkdir(directory);
  for (const [name, bytes] of Object.entries(artifacts)) await writeFile(resolve(directory, name), bytes, { flag: 'wx' });
  await writeFile(resolve(directory, 'manifest.json'), JSON.stringify({ schemaVersion: 1, kind: 'e26_conservative_data_reconciliation', recordedAt: new Date().toISOString(),
    scientificReproduction: false, inputRoles: roles, sources, artifacts: Object.fromEntries(Object.entries(artifacts).map(([name, bytes]) => [name, sha(bytes)])),
    reportSha256: report.sha256, limitations: data.limits }, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ output: directory, summary: data.summary, reviewEntries: rows.length - 1, reportSha256: report.sha256, scientificReproduction: false }, null, 2));
}
main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
