import { z } from 'zod';
import { canonicalJson, snapshotContent } from '../domain/content-snapshot.js';
import { contentReferenceSchema } from '../domain/dataset-import.js';
import { parseDefinitionPublication } from '../domain/definition-publication.js';
import { testCaseDatasetSchema } from '../domain/test-case-dataset.js';
import { snapshotTestCasePublication } from '../domain/test-case-publication-integrity.js';
import { executeTestCaseRecommendation } from '../services/method-execution.js';
import { E21_EQUATIONS_DEMO } from '../services/testrec-equations.js';
import { aggregateRecommendationMetrics, countsMetrics } from './recommendation-metrics.js';

export const TESTREC_EVALUATION_VERSION = 'testrec-evaluation-v1';
const id = z.string().regex(/^[a-z0-9][a-z0-9._-]{0,119}$/);
const annotation = z.strictObject({ kind: z.literal('authored_synthetic_judgment'), source: z.string().min(1),
  catalog: contentReferenceSchema, testCaseIds: z.array(z.string().min(1)) });
export const testrecEvaluationBundleSchema = z.strictObject({
  schemaVersion: z.literal(1), id, kind: z.literal('synthetic_technical_pilot'),
  protocol: z.strictObject({ version: z.literal(TESTREC_EVALUATION_VERSION), method: z.literal(E21_EQUATIONS_DEMO),
    repetitions: z.number().int().min(2).max(10), partition: z.literal('declared_group_holdout'),
    matching: z.literal('exact_test_id_within_catalog_publication'), undefinedRatio: z.literal('null'),
    failurePolicy: z.literal('empty_prediction_with_failure_status'), returnedSet: z.literal('all_method_items'),
    tuning: z.literal('none'), configurationStudy: z.literal('not_performed'), scientificReproduction: z.literal(false) }),
  cases: z.array(z.strictObject({ id, request: z.unknown(), definition: z.unknown(), dataset: z.unknown(), catalog: z.unknown(),
    partition: z.strictObject({ source: z.string().min(1), targetGroup: id,
      history: z.array(z.strictObject({ recordId: z.string().min(1), group: id })) }),
    expectedStatus: z.enum(['completed', 'no_items', 'blocked', 'technical_failure']), relevance: annotation.nullable()
  })).min(1).max(1000)
});
export type TestrecEvaluationBundle = z.infer<typeof testrecEvaluationBundleSchema>;

/** Invalid experiments fail before execution; leakage is never counted as a model failure. */
function validateExperiment(item: TestrecEvaluationBundle['cases'][number]) {
  const definition = parseDefinitionPublication(item.definition).definition;
  if (definition.method.id !== E21_EQUATIONS_DEMO) throw new Error('Only the synthetic E21 equation demonstration is supported.');
  const dataset = testCaseDatasetSchema.parse(item.dataset);
  const catalog = snapshotTestCasePublication(item.catalog);
  const request = z.object({ catalog: contentReferenceSchema,
    input: z.object({ id: z.string(), values: z.record(z.string(), z.unknown()) }) }).parse(item.request);
  const catalogRef = { id: catalog.content.id, version: catalog.content.version, format: catalog.format, sha256: catalog.sha256 };
  if (canonicalJson(request.catalog) !== canonicalJson(catalogRef) || canonicalJson(dataset.catalog) !== canonicalJson(catalogRef)) throw new Error('Partition catalog dependency differs.');
  const bindings = definition.method.bindings, target = request.input;
  const answers = target.values[bindings.test_case_ids];
  if (answers !== undefined && (!Array.isArray(answers) || answers.length !== 0)) throw new Error('Target answers must be withheld.');
  const story = target.values[bindings.story_id];
  if (typeof story !== 'string' || !story.trim()) throw new Error('Target story identity is required for holdout.');
  const groups = new Map(item.partition.history.map(row => [row.recordId, row.group]));
  const records = new Set(dataset.records.map(row => row.id));
  if (groups.size !== item.partition.history.length || records.size !== dataset.records.length ||
      groups.size !== records.size || [...groups.keys()].some(key => !records.has(key))) throw new Error('Partition must cover every unique history record exactly once.');
  for (const row of dataset.records) {
    const candidateStory = row.values[bindings.story_id];
    if (typeof candidateStory !== 'string' || !candidateStory.trim()) throw new Error('History story identity is required for holdout.');
    if (row.id === target.id || candidateStory.trim() === story.trim() || groups.get(row.id) === item.partition.targetGroup) throw new Error('Target identity or declared group leaked into history.');
  }
  if (item.relevance) {
    if (canonicalJson(item.relevance.catalog) !== canonicalJson(catalogRef)) throw new Error('Relevance must name the exact catalog publication.');
    const known = new Set(catalog.content.catalog.content.items.map(row => row.id));
    if (new Set(item.relevance.testCaseIds).size !== item.relevance.testCaseIds.length || item.relevance.testCaseIds.some(key => !known.has(key))) throw new Error('Relevance IDs must be unique catalog IDs.');
  }
}

function execute(item: TestrecEvaluationBundle['cases'][number]) {
  try {
    // Neither relevance nor group declarations are arguments of the recommendation method.
    return { execution: executeTestCaseRecommendation(item.request, item.definition, item.dataset, item.catalog), error: null };
  } catch (error) {
    const message = error instanceof z.ZodError
      ? canonicalJson(error.issues.map(issue => ({ path: issue.path, code: issue.code, message: issue.message })))
      : error instanceof Error ? error.message : String(error);
    return { execution: null, error: { code: 'execution_error', message } };
  }
}

export function evaluateTestrec(raw: unknown) {
  canonicalJson(raw);
  const bundle = testrecEvaluationBundleSchema.parse(raw);
  if (new Set(bundle.cases.map(row => row.id)).size !== bundle.cases.length) throw new Error('Duplicate case IDs.');
  bundle.cases.forEach(validateExperiment);
  const timings: Array<{ caseId: string; repetition: number; durationMs: number }> = [];
  const results = bundle.cases.map(item => {
    const outcomes = Array.from({ length: bundle.protocol.repetitions }, (_, index) => {
      const start = performance.now(), outcome = execute(item);
      timings.push({ caseId: item.id, repetition: index + 1, durationMs: performance.now() - start });
      return outcome;
    });
    const hashes = outcomes.map(row => snapshotContent(row).sha256), first = outcomes[0];
    const predicted = new Set(first.execution?.result.content.items.map(row => row.testCaseId) ?? []);
    const relevant = new Set(item.relevance?.testCaseIds ?? []);
    const tp = [...predicted].filter(key => relevant.has(key)).length;
    const status = first.execution?.result.content.status ?? 'technical_failure';
    return { caseId: item.id, status, expectedStatus: item.expectedStatus, statusMatches: status === item.expectedStatus,
      repeatable: new Set(hashes).size === 1, outcomeHashes: hashes,
      execution: first.execution, error: first.error, partition: snapshotContent(item.partition),
      relevance: item.relevance ? { annotation: snapshotContent(item.relevance), metrics: countsMetrics(tp, predicted.size - tp, relevant.size - tp) } : null };
  });
  const judged = results.filter(row => row.relevance !== null);
  const coverage = (rows: typeof results) => ({ targets: rows.length,
    withItems: rows.filter(row => (row.execution?.result.content.items.length ?? 0) > 0).length,
    ratio: rows.length ? rows.filter(row => (row.execution?.result.content.items.length ?? 0) > 0).length / rows.length : null });
  const summary = { targets: results.length, independentTargets: false, repetitions: bundle.protocol.repetitions,
    allRepeatable: results.every(row => row.repeatable), unexpectedStatuses: results.filter(row => !row.statusMatches).length,
    statuses: Object.fromEntries(['completed', 'no_items', 'blocked', 'technical_failure'].map(status => [status, results.filter(row => row.status === status).length])),
    unjudgedTargets: results.length - judged.length, coverage: { allCases: coverage(results), judgedCases: coverage(judged) },
    relevance: aggregateRecommendationMetrics(judged.map(row => row.relevance!.metrics)) };
  return { schemaVersion: 1 as const,
    deterministic: snapshotContent({ evaluatorVersion: TESTREC_EVALUATION_VERSION, bundleSha256: snapshotContent(bundle).sha256, results, summary }),
    observations: { timingScope: 'in_process_execution_including_validation_and_snapshots', runs: timings } };
}
export type TestrecEvaluationReport = ReturnType<typeof evaluateTestrec>;

export function testrecEvaluationCsv(report: TestrecEvaluationReport) {
  const fields = ['case_id', 'status', 'expected_status', 'repeatable', 'judged', 'returned_items', 'tp', 'fp', 'fn', 'precision', 'recall', 'f1', 'f2', 'catalog_sha256', 'result_sha256'];
  const rows = report.deterministic.content.results.map(row => {
    const m = row.relevance?.metrics;
    return [row.caseId, row.status, row.expectedStatus, row.repeatable, row.relevance !== null, row.execution?.result.content.items.length ?? 0,
      m?.tp, m?.fp, m?.fn, m?.precision, m?.recall, m?.f1, m?.f2, row.execution?.catalog.sha256, row.execution?.result.sha256];
  });
  return [fields, ...rows].map(row => row.map(value => value === undefined || value === null ? '' : `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n') + '\r\n';
}
