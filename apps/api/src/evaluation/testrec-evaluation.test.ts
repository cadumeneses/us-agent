import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { snapshotContent } from '../domain/content-snapshot.js';
import { evaluateTestrec, testrecEvaluationCsv, type TestrecEvaluationBundle } from './testrec-evaluation.js';
import { buildTestrecPilot } from './testrec-pilot.js';

const root = new URL('../../../../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');
const bundle = () => buildTestrecPilot(read('docs/evidencias/b16b/published-runs.json'), read('research/pilots/testrec-v1/annotations.json'));

test('synthetic test evaluator preserves inputs, repeats, counts failures and distinguishes unjudged from empty relevance', () => {
  const input = bundle(), before = snapshotContent(input).sha256;
  const report = evaluateTestrec(input), again = evaluateTestrec(input);
  assert.equal(snapshotContent(input).sha256, before);
  assert.deepEqual(report.deterministic, again.deterministic);
  const { results, summary } = report.deterministic.content;
  assert.equal(summary.targets, 6);
  assert.equal(summary.independentTargets, false);
  assert.equal(summary.allRepeatable, true);
  assert.equal(summary.unexpectedStatuses, 0);
  assert.deepEqual(summary.statuses, { completed: 3, no_items: 1, blocked: 1, technical_failure: 1 });
  assert.equal(summary.unjudgedTargets, 1);
  assert.equal(summary.relevance.targets, 5);
  assert.deepEqual(summary.relevance.micro, { tp: 3, fp: 1, fn: 2, precision: 3 / 4, recall: 3 / 5, f1: 2 / 3, f2: 5 / 8 });
  assert.equal(summary.relevance.macro.precision.undefinedTargets, 3);
  assert.equal(summary.relevance.macro.recall.undefinedTargets, 1);
  assert.equal(summary.coverage.judgedCases.ratio, 2 / 5);
  const empty = results.find(row => row.caseId === 'known-empty')!;
  assert.deepEqual(empty.relevance!.metrics, { tp: 0, fp: 0, fn: 0, precision: null, recall: null, f1: null, f2: null });
  assert.equal(results.find(row => row.caseId === 'invalid-input')!.relevance!.metrics.fn, 1);
  assert.equal(results.find(row => row.caseId === 'insufficient')!.relevance!.metrics.fn, 1);
  assert.equal(report.observations.runs.length, 12);
  assert.ok(report.observations.runs.every(row => row.durationMs >= 0));
});

test('relevance judgments cannot change executor results and are not inferred from recommendations', () => {
  const a = bundle(); a.cases = [a.cases[0]];
  const b = structuredClone(a); b.cases[0].relevance!.testCaseIds = [];
  const first = evaluateTestrec(a).deterministic.content.results[0];
  const second = evaluateTestrec(b).deterministic.content.results[0];
  assert.deepEqual(first.execution, second.execution);
  assert.equal(first.relevance!.metrics.tp, 1);
  assert.equal(second.relevance!.metrics.fp, 2);
});

test('output, story, record and declared group leakage invalidate the experiment before execution', () => {
  const changes: Array<(item: TestrecEvaluationBundle['cases'][number]) => void> = [
    item => { (item.request as any).input.values.test_case_ids = ['demo-create']; },
    item => { (item.dataset as any).records[0].values.story_id = ' ' + (item.request as any).input.values.story_id + ' '; },
    item => { (item.dataset as any).records[0].id = (item.request as any).input.id; item.partition.history[0].recordId = (item.request as any).input.id; },
    item => { item.partition.history[0].group = item.partition.targetGroup; }
  ];
  for (const change of changes) {
    const input = structuredClone(bundle()); input.cases = [input.cases[0]]; change(input.cases[0]);
    assert.throws(() => evaluateTestrec(input), /withheld|leaked/);
  }
});

test('partition declarations must cover history exactly; feature equality alone does not imply identity', () => {
  for (const variant of ['missing', 'duplicate', 'extra']) {
    const input = bundle(), history = input.cases[0].partition.history;
    if (variant === 'missing') history.pop();
    if (variant === 'duplicate') history.push(history[0]);
    if (variant === 'extra') history.push({ recordId: 'absent', group: 'other' });
    assert.throws(() => evaluateTestrec(input), /cover every/);
  }
  assert.equal(evaluateTestrec(bundle()).deterministic.content.summary.unexpectedStatuses, 0);
});

test('judgments require unique known test IDs bound to the exact catalog hash', () => {
  for (const variant of ['unknown', 'duplicate', 'catalog']) {
    const input = bundle(), relevance = input.cases[0].relevance!;
    if (variant === 'unknown') relevance.testCaseIds = ['not-in-catalog'];
    if (variant === 'duplicate') relevance.testCaseIds.push(relevance.testCaseIds[0]);
    if (variant === 'catalog') relevance.catalog.sha256 = '0'.repeat(64);
    assert.throws(() => evaluateTestrec(input), /Relevance/);
  }
});

test('unexpected statuses are visible and CSV retains every scenario including undefined metrics', () => {
  const input = bundle(); input.cases[0].expectedStatus = 'blocked';
  const report = evaluateTestrec(input);
  assert.equal(report.deterministic.content.summary.unexpectedStatuses, 1);
  const csv = testrecEvaluationCsv(report);
  assert.equal(csv.split('\r\n').filter(Boolean).length, 7);
  assert.match(csv, /"invalid-input","technical_failure"/);
  assert.match(csv, /"unjudged","completed","completed","true","false"/);
  assert.doesNotMatch(csv, /NaN|Infinity|Gherkin/);
});

test('duplicate scenarios and corrupted seed evidence are rejected', () => {
  const input = bundle(); input.cases.push(input.cases[0]);
  assert.throws(() => evaluateTestrec(input), /Duplicate case/);
  const evidence = JSON.parse(read('docs/evidencias/b16b/published-runs.json'));
  evidence.content.scientificReproduction = true;
  assert.throws(() => buildTestrecPilot(JSON.stringify(evidence), read('research/pilots/testrec-v1/annotations.json')), /source evidence hash/);
});
