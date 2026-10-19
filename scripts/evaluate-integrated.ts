import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalJson, snapshotContent } from '../apps/api/src/domain/content-snapshot.js';
import { evaluateRnf, type RnfEvaluationBundle } from '../apps/api/src/evaluation/rnf-evaluation.js';
import { evaluateTestrec, type TestrecEvaluationBundle } from '../apps/api/src/evaluation/testrec-evaluation.js';
import { executeConfigurableRecommendation, type ConfigurableRecommendationContent } from '../apps/api/src/services/configurable-knn.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const protocol = 'research/integrated-demonstration-v1/protocol.md';
const sha = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
const read = (path: string) => readFile(resolve(root, path));
const serialize = (value: unknown) => JSON.stringify(value, null, 2) + '\n';
const runtime = () => ({ node: process.version, icu: process.versions.icu ?? 'unknown', locale: new Intl.Collator().resolvedOptions().locale });
const riskNames = ['run-1-baseline.json', 'run-2-distributed.json', 'run-2-co-located.json', 'run-ui.json'] as const;
const inputs = [
  { name: 'nfr.json', path: 'docs/evidencias/b14a/bundle.json', manifest: 'docs/evidencias/b14a/manifest.json', key: 'bundle.json' },
  { name: 'tests.json', path: 'docs/evidencias/b18a/bundle.json', manifest: 'docs/evidencias/b18a/manifest.json', key: 'bundle.json' },
  ...riskNames.map(name => ({ name, path: `docs/evidencias/project-risks-2026-10-19/${name}`, manifest: 'docs/evidencias/project-risks-2026-10-19/manifest.json', key: name }))
];
type InputFiles = Record<string, string>;
type RiskRun = { id: string; snapshot: ReturnType<typeof snapshotContent<ConfigurableRecommendationContent>> };
type Row = { example: string; scenario: string; status: string; repeatable: boolean; returnedItems: number;
  expectedFailure: boolean; comparison: boolean | null; resultSha256: string | null };

function requireCondition(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
function assertSnapshot(snapshot: { format: string; sha256: string; content: unknown }) {
  requireCondition(canonicalJson(snapshotContent(snapshot.content)) === canonicalJson(snapshot), 'Stored snapshot integrity mismatch.');
}

function evaluate(files: InputFiles) {
  const started = performance.now();
  const nfrBundle = JSON.parse(files['nfr.json']) as RnfEvaluationBundle;
  const testBundle = JSON.parse(files['tests.json']) as TestrecEvaluationBundle;
  requireCondition(nfrBundle.protocol.repetitions === 2 && testBundle.protocol.repetitions === 2, 'This protocol requires two repetitions.');
  const nfr = evaluateRnf(nfrBundle), tests = evaluateTestrec(testBundle);
  const risks = riskNames.map(name => {
    const original = JSON.parse(files[name]) as RiskRun, content = original.snapshot.content;
    assertSnapshot(original.snapshot);
    for (const child of [content.request, content.definition, content.dataset, content.result, content.explanation, content.projection]) assertSnapshot(child);
    requireCondition(content.schemaVersion === 3 && original.id === content.request.content.id, 'Invalid project-run identity.');
    const observations: number[] = [], executions: ConfigurableRecommendationContent[] = [];
    for (let index = 0; index < 2; index++) {
      const before = performance.now();
      executions.push(executeConfigurableRecommendation(content.request.content, content.definition.content, content.dataset.content));
      observations.push(performance.now() - before);
    }
    const comparisons = executions.map(execution => Object.fromEntries(['result', 'explanation', 'projection'].map(key => [key,
      execution[key as 'result'].sha256 === content[key as 'result'].sha256])));
    return { name, sourceRunSha256: original.snapshot.sha256, execution: executions[0], repeatable: snapshotContent(executions[0]).sha256 === snapshotContent(executions[1]).sha256,
      matchesPreserved: comparisons.every(comparison => Object.values(comparison).every(Boolean)), comparisons, observations };
  });
  const ns = nfr.deterministic.content.summary, ts = tests.deterministic.content.summary;
  const rows: Row[] = [
    ...nfr.deterministic.content.results.map(row => ({ example: 'nfr', scenario: row.caseId, status: row.status, repeatable: row.repeatable,
      returnedItems: row.execution?.result.content.items.length ?? 0, expectedFailure: row.expectedTechnicalFailure,
      comparison: row.compatibility?.matches ?? null, resultSha256: row.execution?.result.sha256 ?? null })),
    ...tests.deterministic.content.results.map(row => ({ example: 'tests', scenario: row.caseId, status: row.status, repeatable: row.repeatable,
      returnedItems: row.execution?.result.content.items.length ?? 0, expectedFailure: row.expectedStatus === 'technical_failure',
      comparison: row.status === row.expectedStatus, resultSha256: row.execution?.result.sha256 ?? null })),
    ...risks.map(row => ({ example: 'risks', scenario: row.name.replace('.json', ''), status: row.execution.result.content.status,
      repeatable: row.repeatable, returnedItems: row.execution.result.content.items.length, expectedFailure: false,
      comparison: row.matchesPreserved, resultSha256: row.execution.result.sha256 }))
  ];
  const gate = ns.allRepeatable && ns.compatibility.targets === ns.compatibility.matched && ns.unexpectedTechnicalFailures === 0 && ns.missingExpectedTechnicalFailures === 0 &&
    ts.allRepeatable && ts.unexpectedStatuses === 0 && risks.every(row => row.repeatable && row.matchesPreserved);
  const conditions = risks.filter(row => row.name.startsWith('run-2-'));
  const shared = conditions.map(row => row.execution.request.content);
  const controlledFeature = shared.length === 2 && canonicalJson(shared[0].definition) === canonicalJson(shared[1].definition) && canonicalJson(shared[0].dataset) === canonicalJson(shared[1].dataset);
  const changedKeys = shared.length === 2 ? [...new Set([...Object.keys(shared[0].input.values), ...Object.keys(shared[1].input.values)])].filter(key => canonicalJson(shared[0].input.values[key]) !== canonicalJson(shared[1].input.values[key])) : [];
  requireCondition(controlledFeature && changedKeys.length === 1 && shared[0].input.id === shared[1].input.id &&
    canonicalJson(shared[0].input.provenance) === canonicalJson(shared[1].input.provenance), 'The feature illustration is not a controlled pair.');
  const deterministic = snapshotContent({ schemaVersion: 1, protocol: { id: 'integrated-demonstration-v1', sha256: sha(files['protocol.md']) },
    empiricalClaim: false, independentSamples: false, technicalGatePassed: gate,
    examples: { nfr: nfr.deterministic, tests: tests.deterministic, risks: risks.map(({ observations: _timings, ...row }) => row) }, rows,
    configuredFeature: { attributeId: changedKeys[0], sameDefinitionAndDataset: controlledFeature,
      conditions: conditions.map(row => ({ source: row.name, value: row.execution.request.content.input.values[changedKeys[0]],
        neighbors: row.execution.result.content.neighbors.map(neighbor => ({ recordId: neighbor.recordId, distance: neighbor.distance, similarity: neighbor.similarity })) })) },
    evidenceLimits: { classificationQuality: 'not_measured', classificationErrorPropagation: 'not_measured',
      classificationForProjectRisks: 'not_applicable', recommendationQuality: 'synthetic_annotations_only_for_nfr_and_tests',
      riskRelevance: 'not_measured', participantConfigurationEffort: 'not_measured', productionAvailability: 'not_checked' } });
  return { deterministic, observations: { scope: 'local_in_process_execution_not_a_benchmark',
    nfr: nfr.observations, tests: tests.observations, risks: risks.map(row => ({ name: row.name, durationMs: row.observations })), totalDurationMs: performance.now() - started } };
}

function csv(rows: Row[]) {
  const fields: Array<keyof Row> = ['example', 'scenario', 'status', 'repeatable', 'returnedItems', 'expectedFailure', 'comparison', 'resultSha256'];
  const cell = (value: unknown) => value === null ? '' : `"${String(value).replaceAll('"', '""')}"`;
  return [fields.map(cell).join(','), ...rows.map(row => fields.map(field => cell(row[field])).join(','))].join('\r\n') + '\r\n';
}

function summary(report: ReturnType<typeof evaluate>['deterministic']) {
  const rows = report.content.rows;
  const table = ['nfr', 'tests', 'risks'].map(example => {
    const selected = rows.filter(row => row.example === example);
    const count = (status: string) => selected.filter(row => row.status === status).length;
    return `| ${example} | ${selected.length} | ${count('completed')} | ${count('blocked')} | ${count('no_candidates')} | ${count('no_items')} | ${count('technical_failure')} |`;
  });
  return ['# Integrated technical demonstration', '',
    `Technical gate: **${report.content.technicalGatePassed ? 'passed' : 'failed'}**. ${rows.length} preserved scenario conditions, two repetitions each; not independent samples.`, '',
    '| Example | Scenarios | Completed | Blocked | No candidates | No items | Technical failure |',
    '| --- | --- | --- | --- | --- | --- | --- |', ...table, '',
    'The two deliberate technical-failure scenarios remain in the report. NFR preserves 8/8 compatibility results; all four risk runs preserve result, explanation and projection. Other states are not discarded.', '',
    'Synthetic relevance metrics remain separate inside each original evaluator result in report.json. They are not empirical accuracy and must not be pooled or compared with article results. Risk relevance, observed classification quality/error propagation, participant effort, and production availability were not evaluated.', '',
    'The two version-2 risk conditions share the same definition, dataset and input identity. Changing one configured feature changes the selected neighbor. This is a calculation illustration, not a participant study or a result from an original research dataset.', '',
    'Use npm run evaluate:integrated -- --replay DIRECTORY from the matching repository and recorded runtime. observations.json contains local in-process timings only; times are excluded from the deterministic hash and are not a benchmark.', '',
    `Deterministic report SHA-256: ${report.sha256}`, ''].join('\n');
}

async function sourceInventory() {
  const manifests = ['docs/evidencias/b14a/manifest.json', 'docs/evidencias/b18a/manifest.json'];
  const prior = await Promise.all(manifests.map(async path => JSON.parse((await read(path)).toString('utf8'))));
  const paths = [...new Set([...prior.flatMap(manifest => Object.keys(manifest.sources)),
    'scripts/evaluate-integrated.ts', 'apps/api/src/services/configurable-knn.ts', protocol, 'package.json', 'package-lock.json'])].sort();
  const inventory: Record<string, { sha256: string; utf8LfSha256: string }> = {};
  for (const path of paths) {
    requireCondition(!path.startsWith('/') && !path.includes('\\') && !path.includes(':') && !path.split('/').includes('..'), 'Invalid source path.');
    const bytes = await read(path);
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    inventory[path] = { sha256: sha(bytes), utf8LfSha256: sha(text.replaceAll('\r\n', '\n')) };
  }
  return inventory;
}

async function main() {
  const args = process.argv.slice(2);
  requireCondition(args.length === 0 || args.length === 2 && ['--output', '--replay'].includes(args[0]) && !!args[1] && !args[1].startsWith('--'), 'Usage: evaluate:integrated [--output NEW_DIRECTORY | --replay DIRECTORY]');
  const replay = args[0] === '--replay', directory = resolve(args[1] ?? `tmp/integrated-demonstration-${Date.now()}`);
  const sources = await sourceInventory();
  if (replay) {
    const manifest = JSON.parse(await readFile(resolve(directory, 'manifest.json'), 'utf8'));
    requireCondition(manifest.schemaVersion === 1 && manifest.kind === 'integrated_technical_demonstration' && manifest.empiricalClaim === false, 'Unsupported package.');
    requireCondition(canonicalJson(manifest.runtime) === canonicalJson(runtime()), 'Runtime differs. Use the recorded Node, ICU and locale.');
    const sourceLf = (value: typeof sources) => Object.fromEntries(Object.entries(value).map(([path, identity]) => [path, identity.utf8LfSha256]));
    requireCondition(canonicalJson(sourceLf(manifest.sources)) === canonicalJson(sourceLf(sources)), 'Inventoried source contents differ.');
    const files: InputFiles = {};
    const names = [...inputs.map(input => `inputs/${input.name}`), 'inputs/protocol.md', 'report.json', 'scenarios.csv', 'observations.json', 'summary.md'];
    requireCondition(canonicalJson(Object.keys(manifest.artifacts).sort()) === canonicalJson([...names].sort()), 'Unexpected package artifact inventory.');
    for (const name of names) {
      const bytes = await readFile(resolve(directory, name));
      requireCondition(sha(bytes) === manifest.artifacts[name], `Artifact bytes differ: ${name}`);
      files[name.startsWith('inputs/') ? name.slice(7) : name] = bytes.toString('utf8');
    }
    requireCondition(canonicalJson(manifest.inputOrigins.map((origin: { name: string; sha256: string }) => ({ name: origin.name, sha256: origin.sha256 }))) === canonicalJson(inputs.map(input => ({ name: input.name, sha256: sha(files[input.name]) }))), 'Input provenance differs.');
    const report = evaluate(files), original = JSON.parse(files['report.json']);
    assertSnapshot(original);
    requireCondition(canonicalJson(report.deterministic) === canonicalJson(original), 'Deterministic replay differs.');
    requireCondition(csv(report.deterministic.content.rows) === files['scenarios.csv'], 'CSV differs from the report.');
    requireCondition(summary(report.deterministic) === files['summary.md'], 'Summary differs from the report.');
    requireCondition(report.deterministic.content.technicalGatePassed && manifest.technicalGatePassed === true && manifest.reportSha256 === report.deterministic.sha256, 'Technical gate or report reference differs.');
    console.log(serialize({ replayMatched: true, scenarios: report.deterministic.content.rows.length, reportSha256: report.deterministic.sha256, empiricalClaim: false }));
    return;
  }
  const files: InputFiles = { 'protocol.md': (await read(protocol)).toString('utf8') };
  const origins = [];
  for (const input of inputs) {
    const bytes = await read(input.path), manifest = JSON.parse((await read(input.manifest)).toString('utf8'));
    requireCondition(sha(bytes) === manifest.artifacts[input.key], `Preserved input bytes differ: ${input.path}`);
    files[input.name] = bytes.toString('utf8'); origins.push({ name: input.name, path: input.path, sha256: sha(bytes), manifest: input.manifest, manifestSha256: sha(await read(input.manifest)) });
  }
  const report = evaluate(files), artifacts: Record<string, string> = Object.fromEntries(Object.entries(files).map(([name, content]) => [`inputs/${name}`, content]));
  artifacts['report.json'] = serialize(report.deterministic); artifacts['scenarios.csv'] = csv(report.deterministic.content.rows); artifacts['observations.json'] = serialize(report.observations); artifacts['summary.md'] = summary(report.deterministic);
  const git = (...values: string[]) => execFileSync('git', values, { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
  const manifest = { schemaVersion: 1, kind: 'integrated_technical_demonstration', recordedAt: new Date().toISOString(), empiricalClaim: false,
    runtime: runtime(), git: { head: git('rev-parse', 'HEAD'), dirty: Boolean(git('status', '--porcelain')) },
    sourceIdentity: 'exact_bytes_for_audit_and_utf8_lf_for_replay_v1', sources, inputOrigins: origins,
    artifacts: Object.fromEntries(Object.entries(artifacts).map(([name, content]) => [name, sha(content)])),
    technicalGatePassed: report.deterministic.content.technicalGatePassed, reportSha256: report.deterministic.sha256 };
  await mkdir(dirname(directory), { recursive: true }); await mkdir(directory); await mkdir(resolve(directory, 'inputs'));
  for (const [name, content] of Object.entries({ ...artifacts, 'manifest.json': serialize(manifest) })) await writeFile(resolve(directory, name), content, { flag: 'wx' });
  console.log(serialize({ output: directory, scenarios: report.deterministic.content.rows.length, technicalGatePassed: manifest.technicalGatePassed,
    reportSha256: manifest.reportSha256, empiricalClaim: false, pending: report.deterministic.content.evidenceLimits }));
  if (!manifest.technicalGatePassed) process.exitCode = 1;
}
main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
