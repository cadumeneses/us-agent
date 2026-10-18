import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { snapshotContent } from '../domain/content-snapshot.js';
import { evaluateRnf, evaluationCsv, type RnfEvaluationBundle, EvaluationPartitionError } from './rnf-evaluation.js';
import { buildRnfPilot } from './rnf-pilot.js';

const root = new URL('../../../../', import.meta.url);
const read = (file: string) => readFileSync(new URL(file, root), 'utf8');
function bundle() { return buildRnfPilot(read('config/recommenders/rnf-v2.draft.json'), read('research/baselines/rnf-v2/reference.json'),
  read('research/baselines/rnf-v2/manifest.json'), read('research/pilots/rnf-v1/annotations.json')); }

test('published-executor pilot preserves eight compatibility results and separately measures five synthetic relevance cases including failure', () => {
  const input = bundle(), before = snapshotContent(input).sha256;
  const first = evaluateRnf(input), second = evaluateRnf(input);
  assert.equal(snapshotContent(input).sha256, before);
  assert.deepEqual(first.deterministic, second.deterministic);
  const { results, summary } = first.deterministic.content;
  assert.equal(summary.targets, 13);
  assert.deepEqual(summary.compatibility, { targets: 8, matched: 8 });
  assert.deepEqual(summary.statuses, { completed: 8, blocked: 1, no_candidates: 1, no_items: 2, technical_failure: 1 });
  assert.equal(summary.allRepeatable, true);
  assert.equal(summary.relevance.targets, 5);
  assert.deepEqual(summary.relevance.micro, { tp: 1, fp: 2, fn: 3, precision: 1 / 3, recall: 1 / 4, f1: 2 / 7, f2: 5 / 19 });
  assert.equal(summary.coverage.relevanceCases.ratio, 3 / 5);
  assert.equal(first.observations.runs.length, 26);
  assert.ok(first.observations.runs.every(row => row.durationMs >= 0));
  assert.ok(results.filter(row => row.purpose === 'compatibility').every(row => row.relevance === null));
  const failed = results.find(row => row.caseId === 'synthetic-invalid-input')!;
  assert.equal(failed.execution, null); assert.match(failed.error!.message, /platforms/);
  assert.equal(failed.relevance!.metrics.fn, 1);
  const csv = evaluationCsv(first);
  assert.equal(csv.split('\r\n').filter(Boolean).length, 14);
  assert.match(csv, /"synthetic-invalid-input","synthetic_relevance","technical_failure"/);
  assert.doesNotMatch(csv, /NaN|Infinity|Synthetic sentence/);
});

test('target identities, normalized numeric aliases, cloned text and output leakage invalidate a relevance split', () => {
  for (const alter of [
    (item: RnfEvaluationBundle['cases'][number]) => { const r = item.request as any, d = item.dataset as any; d.records[0].id = r.input.id; },
    (item: RnfEvaluationBundle['cases'][number]) => { const r = item.request as any, d = item.dataset as any; d.records[0].values.story_id = r.input.values.story_id; },
    (item: RnfEvaluationBundle['cases'][number]) => { const d = item.dataset as any; d.records[0].values.classification_id = '01'; },
    (item: RnfEvaluationBundle['cases'][number]) => { const r = item.request as any, d = item.dataset as any; d.records[0].values.text = '  ' + r.input.values.text.toUpperCase() + ' '; },
    (item: RnfEvaluationBundle['cases'][number]) => { const r = item.request as any; r.input.values.nfrs = [{ type: 'Performance', attribute: 'response_time', sentence: 'Leaked' }]; }
  ]) {
    const input = structuredClone(bundle()); input.cases = [input.cases.find(row => row.id === 'synthetic-one-hit')!]; alter(input.cases[0]);
    assert.throws(() => evaluateRnf(input), EvaluationPartitionError);
  }
});

test('missing relevance is distinct from an explicitly empty annotation and compatibility drift cannot pass silently', () => {
  const input = bundle();
  input.cases[0].compatibility!.resultSha256 = '0'.repeat(64);
  const report = evaluateRnf(input);
  assert.equal(report.deterministic.content.summary.compatibility.matched, 7);
  const noReference = report.deterministic.content.results.find(row => row.caseId === 'synthetic-no-reference')!;
  assert.equal(noReference.relevance!.metrics.recall, null);
  const invalid = structuredClone(input); invalid.cases.find(row => row.id === 'synthetic-no-reference')!.relevance = null;
  assert.throws(() => evaluateRnf(invalid));
  const duplicate = bundle(); duplicate.cases.push(duplicate.cases[0]); assert.throws(() => evaluateRnf(duplicate), /duplicados/);
  const formula = bundle(); formula.cases[0].id = '=FORMULA'; assert.throws(() => evaluateRnf(formula));
});

test('changing the relevance judgment changes metrics without changing the recommendation, and unannotated cases have no relevance score', () => {
  const input = structuredClone(bundle()); input.cases = [input.cases.find(row => row.id === 'synthetic-one-hit')!];
  const original = evaluateRnf(input).deterministic.content.results[0];
  input.cases[0].relevance!.items = [];
  const changed = evaluateRnf(input).deterministic.content.results[0];
  assert.equal(changed.execution!.result.sha256, original.execution!.result.sha256);
  assert.equal(original.relevance!.metrics.tp, 1); assert.equal(changed.relevance!.metrics.fp, 1);
  assert.deepEqual(changed.execution!.projection.content.target.nfrs, []);
  const onlyCompatibility = bundle(); onlyCompatibility.cases = onlyCompatibility.cases.filter(row => row.purpose === 'compatibility');
  const summary = evaluateRnf(onlyCompatibility).deterministic.content.summary;
  assert.equal(summary.relevance.micro, null); assert.equal(summary.relevance.targets, 0);
  assert.equal(summary.coverage.relevanceCases.ratio, null);
});
