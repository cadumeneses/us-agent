import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { snapshotContent } from '../apps/api/src/domain/content-snapshot.js';
import { auditE26Sources, E26_SOURCE_FILES } from '../apps/api/src/evaluation/testrec-source-audit.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const base = 'research/sources/testrec-e26/zenodo-16133793';
const read = (name: string) => readFile(resolve(root, name));
const digest = (bytes: Uint8Array, algorithm = 'sha256') => createHash(algorithm).update(bytes).digest('hex');
async function main() {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || !['--output', '--replay'].includes(args[0]) || !args[1] || args[1].startsWith('--'))) throw new Error('Uso: audit:testrec-source [--output arquivo-novo.json | --replay evidencia.json]');
  const inventory = JSON.parse((await read(`${base}/inventory.json`)).toString('utf8'));
  const metadataBytes = await read(`${base}/record-metadata.json`), metadata = JSON.parse(metadataBytes.toString('utf8'));
  assert.equal(digest(metadataBytes), inventory.metadataSha256);
  assert.equal(inventory.license, 'cc-by-4.0'); assert.equal(metadata.metadata.license.id, inventory.license);
  assert.equal(metadata.id, 16133793); assert.equal(metadata.doi, inventory.versionDoi);
  assert.equal(metadata.links.parent_doi, 'https://doi.org/10.5281/zenodo.16131516');
  assert.deepEqual(metadata.files.map((file: { key: string }) => file.key).sort(), [...E26_SOURCE_FILES].sort());
  const sources = {} as Record<typeof E26_SOURCE_FILES[number], string>;
  for (const name of E26_SOURCE_FILES) {
    const bytes = await read(`${base}/${name}`), expected = inventory.files[name];
    assert.equal(bytes.length, expected.bytes, `Size differs: ${name}`);
    assert.equal(digest(bytes), expected.sha256, `SHA-256 differs: ${name}`);
    assert.equal(digest(bytes, 'md5'), expected.md5, `MD5 differs: ${name}`);
    assert.equal(metadata.files.find((file: { key: string }) => file.key === name).checksum, `md5:${expected.md5}`);
    sources[name] = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  }
  const paths = ['scripts/audit-testrec-source.ts', 'apps/api/src/evaluation/testrec-source-audit.ts',
    'apps/api/src/domain/import-formats.ts', 'apps/api/src/domain/content-snapshot.ts', 'package-lock.json',
    `${base}/inventory.json`, `${base}/record-metadata.json`, ...E26_SOURCE_FILES.map(name => `${base}/${name}`)];
  const sourceHashes = Object.fromEntries(await Promise.all(paths.map(async path => [path, digest(await read(path))])));
  // The user-provided PDF is evidence to consult, not a required redistributed artifact.
  const evidence = snapshotContent({ schemaVersion: 1, kind: 'e26_public_source_audit', sourceHashes,
    source: inventory, audit: auditE26Sources(sources),
    articleArithmetic: { reference: 'E26 PDF p.4 eqs.2–4; p.6 Table 3 and offline results',
      displayedTC04: { similarities: [0.50, 0.87, 0.75], k: 3, calculated: (0.50 + 0.87 + 0.75) / 3, reported: 0.71 },
      reportedOffline: { precision: 0.378, recall: 0.675, f2: 0.510 },
      f2OfReportedPrecisionRecall: 5 * 0.378 * 0.675 / (4 * 0.378 + 0.675),
      aggregationConfirmed: false, note: 'F2 of mean precision/recall is not necessarily mean F2; per-target/fold outputs still required.' },
    limits: ['Q01_Euclidean_transform_unconfirmed', 'Q02_illustrative_test_ids_differ_between_versions',
      'Q03_metric_aggregation_unconfirmed', 'source_subset_and_code_not_confirmed', 'no_operational_import_or_empirical_reproduction'] });
  if (args[0] === '--output') {
    const target = resolve(args[1]); await mkdir(dirname(target), { recursive: true });
    await writeFile(target, JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx' });
  } else if (args[0] === '--replay') {
    const previous = JSON.parse(await readFile(resolve(args[1]), 'utf8'));
    assert.deepEqual(snapshotContent(previous.content), previous, 'Invalid evidence snapshot.');
    assert.deepEqual(evidence, previous, 'Source audit replay differs.');
  }
  console.log(JSON.stringify({ verifiedFiles: E26_SOURCE_FILES.length, recordId: metadata.id,
    files: evidence.content.audit.content.files.map(row => ({ name: row.name, rows: row.rows, validRows: row.validRows, formatError: row.formatError,
      malformedRows: row.formatError ? null : row.malformedRows.length, uniqueStoryKeys: row.uniqueStoryKeys, uniqueProjects: row.uniqueProjects })),
    profile: evidence.content.audit.content.profile, joins: evidence.content.audit.content.joins,
    readyForScientificExecution: false, scientificReproduction: false,
    replayMatched: args[0] === '--replay', evidenceSha256: evidence.sha256 }, null, 2));
}
main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
