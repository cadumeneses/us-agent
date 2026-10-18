import { z } from 'zod';
import { canonicalJson, snapshotContent } from '../domain/content-snapshot.js';
import { parseDefinitionPublication } from '../domain/definition-publication.js';
import { datasetPublicationSchema } from '../domain/dataset-publication.js';
import { executePublishedRecommendation } from '../services/recommendation-execution.js';
import { NFR_METHOD } from '../services/nfr-engine.js';
import { aggregateRecommendationMetrics, recommendationMetrics } from './recommendation-metrics.js';

export const RNF_EVALUATION_VERSION = 'rnf-evaluation-v1';
const nfr = z.strictObject({ type: z.string().min(1), attribute: z.string().min(1), sentence: z.string().min(1) });
const annotation = z.strictObject({ kind: z.literal('synthetic_annotation'), source: z.string().min(1), items: z.array(nfr) });
const scenario = z.strictObject({
  id: z.string().regex(/^[a-z0-9][a-z0-9._-]{0,119}$/), purpose: z.enum(['compatibility', 'synthetic_relevance']),
  expectedTechnicalFailure: z.boolean(),
  request: z.unknown(), definition: z.unknown(), dataset: z.unknown(),
  compatibility: z.strictObject({ resultSha256: z.string().regex(/^[a-f0-9]{64}$/), source: z.string().min(1) }).nullable(),
  relevance: annotation.nullable()
}).superRefine((value, context) => {
  if (value.purpose === 'compatibility' && (!value.compatibility || value.relevance)) context.addIssue({ code: 'custom', message: 'Compatibilidade exige oráculo técnico e não aceita relevância inferida.' });
  if (value.purpose === 'synthetic_relevance' && (!value.relevance || value.compatibility)) context.addIssue({ code: 'custom', message: 'Relevância sintética exige anotação separada do oráculo técnico.' });
});
export const rnfEvaluationBundleSchema = z.strictObject({
  schemaVersion: z.literal(1), id: z.string().min(1), kind: z.literal('synthetic_technical_pilot'),
  protocol: z.strictObject({ version: z.literal(RNF_EVALUATION_VERSION), method: z.literal(NFR_METHOD),
    repetitions: z.number().int().min(2).max(10), partition: z.literal('explicit_cases_record_holdout_for_relevance'),
    matching: z.literal('normalized_nfr_key'), undefinedRatio: z.literal('null'), failurePolicy: z.literal('empty_prediction_with_failure_status'),
    classification: z.literal('reference_labels_no_llm'), tuning: z.literal('none'), configurationStudy: z.literal('not_performed') }),
  source: z.strictObject({ description: z.string().min(1), authorization: z.literal('synthetic'),
    referenceSha256: z.string().regex(/^[a-f0-9]{64}$/), annotationSha256: z.string().regex(/^[a-f0-9]{64}$/) }),
  cases: z.array(scenario).min(1).max(1000)
});
export type RnfEvaluationBundle = z.infer<typeof rnfEvaluationBundleSchema>;

export class EvaluationPartitionError extends Error {}
function assertHoldout(item: RnfEvaluationBundle['cases'][number]) {
  if (item.purpose === 'compatibility') return;
  // Check the split even if some execution values are invalid: malformed cases cannot hide leakage.
  const definition = parseDefinitionPublication(item.definition).definition;
  const request = z.object({ input: z.object({ id: z.string(), values: z.record(z.string(), z.unknown()) }) }).parse(item.request);
  const dataset = datasetPublicationSchema.parse(item.dataset), bindings = definition.method.bindings;
  const input = request.input, values = input.values;
  if (!Array.isArray(values[bindings.nfrs]) || (values[bindings.nfrs] as unknown[]).length) throw new EvaluationPartitionError('A saída do alvo deve estar vazia antes da execução.');
  const identity = (value: unknown) => typeof value === 'string' && /^\d+$/.test(value) ? BigInt(value).toString() : value;
  const text = (value: unknown) => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').toLowerCase() : '';
  for (const candidate of dataset.records) {
    if (candidate.id === input.id || ['classification_id', 'story_id'].some(slot =>
      identity(candidate.values[bindings[slot]]) === identity(values[bindings[slot]]))) {
      throw new EvaluationPartitionError('O alvo está presente na base de referência.');
    }
    if (text(values[bindings.text]) && text(candidate.values[bindings.text]) === text(values[bindings.text])) {
      throw new EvaluationPartitionError('Texto duplicado do alvo na base de referência.');
    }
  }
}

function errorMessage(error: unknown) {
  // Zod diagnostics are stable JSON and retain field paths; do not include stacks or runtime paths.
  return error instanceof z.ZodError ? canonicalJson(error.issues.map(issue => ({ path: issue.path, code: issue.code, message: issue.message }))) : error instanceof Error ? error.message : String(error);
}
function execute(item: RnfEvaluationBundle['cases'][number]) {
  try {
    // Ground truth and compatibility oracles never enter the production executor's arguments.
    const execution = executePublishedRecommendation(item.request, item.definition, item.dataset);
    return { execution, error: null };
  } catch (error) { return { execution: null, error: { code: 'execution_error', message: errorMessage(error) } }; }
}
type Outcome = ReturnType<typeof execute>;

export function evaluateRnf(raw: unknown) {
  canonicalJson(raw);
  const bundle = rnfEvaluationBundleSchema.parse(raw);
  if (new Set(bundle.cases.map(item => item.id)).size !== bundle.cases.length) throw new Error('IDs de cenário duplicados.');
  // Invalid splits invalidate the entire experiment; do not reinterpret them as model failures.
  for (const item of bundle.cases) assertHoldout(item);
  const observations: Array<{ caseId: string; repetition: number; durationMs: number }> = [];
  const results = bundle.cases.map(item => {
    const outcomes: Outcome[] = [];
    for (let index = 0; index < bundle.protocol.repetitions; index++) {
      const started = performance.now(); const outcome = execute(item);
      observations.push({ caseId: item.id, repetition: index + 1, durationMs: performance.now() - started });
      outcomes.push(outcome);
    }
    const outcomeHashes = outcomes.map(outcome => snapshotContent(outcome).sha256);
    const first = outcomes[0], result = first.execution?.result;
    const compatibility = item.compatibility ? { ...item.compatibility, actualSha256: result?.sha256 ?? null, matches: result?.sha256 === item.compatibility.resultSha256 } : null;
    const metrics = item.relevance ? recommendationMetrics(result?.content.items ?? [], item.relevance.items) : null;
    return { caseId: item.id, purpose: item.purpose, status: result?.content.status ?? 'technical_failure',
      expectedTechnicalFailure: item.expectedTechnicalFailure,
      repeatable: new Set(outcomeHashes).size === 1, outcomeHashes,
      requestSha256: snapshotContent(item.request).sha256, definitionSha256: snapshotContent(item.definition).sha256, datasetSha256: snapshotContent(item.dataset).sha256,
      execution: first.execution, error: first.error, compatibility,
      relevance: item.relevance ? { annotation: snapshotContent(item.relevance), metrics: metrics! } : null };
  });
  const relevanceRows = results.filter(row => row.relevance !== null);
  const statuses = ['completed', 'blocked', 'no_candidates', 'no_items', 'technical_failure'] as const;
  const coverage = (rows: typeof results) => ({ targets: rows.length, withItems: rows.filter(row => (row.execution?.result.content.items.length ?? 0) > 0).length,
    ratio: rows.length ? rows.filter(row => (row.execution?.result.content.items.length ?? 0) > 0).length / rows.length : null });
  const summary = {
    unit: 'case_target_pair' as const, independentTargets: false,
    targets: results.length, repetitions: bundle.protocol.repetitions, allRepeatable: results.every(row => row.repeatable),
    statuses: Object.fromEntries(statuses.map(status => [status, results.filter(row => row.status === status).length])),
    compatibility: { targets: results.filter(row => row.compatibility).length, matched: results.filter(row => row.compatibility?.matches).length },
    unexpectedTechnicalFailures: results.filter(row => row.error !== null && !row.expectedTechnicalFailure).length,
    missingExpectedTechnicalFailures: results.filter(row => row.error === null && row.expectedTechnicalFailure).length,
    coverage: { allCases: coverage(results), relevanceCases: coverage(relevanceRows) },
    relevance: aggregateRecommendationMetrics(relevanceRows.map(row => row.relevance!.metrics))
  };
  return { schemaVersion: 1 as const, deterministic: snapshotContent({ evaluatorVersion: RNF_EVALUATION_VERSION, bundleSha256: snapshotContent(bundle).sha256, results, summary }),
    observations: { timingScope: 'in_process_execution_including_validation_and_snapshots' as const, runs: observations,
      totalDurationMs: observations.reduce((sum, row) => sum + row.durationMs, 0) } };
}
export type RnfEvaluationReport = ReturnType<typeof evaluateRnf>;

/** Quoted CSV with CRLF; IDs cannot contain spreadsheet formulas or arbitrary source text. */
export function evaluationCsv(report: RnfEvaluationReport) {
  const fields = ['case_id', 'purpose', 'status', 'repeatable', 'compatibility_match', 'returned_items', 'tp', 'fp', 'fn', 'precision', 'recall', 'f1', 'f2', 'request_sha256', 'definition_sha256', 'dataset_sha256', 'result_sha256'];
  const cell = (value: unknown) => value === null || value === undefined ? '' : `"${String(value).replaceAll('"', '""')}"`;
  const rows = report.deterministic.content.results.map(row => {
    const m = row.relevance?.metrics;
    return [row.caseId, row.purpose, row.status, row.repeatable, row.compatibility?.matches, row.execution?.result.content.items.length ?? 0,
      m?.tp, m?.fp, m?.fn, m?.precision, m?.recall, m?.f1, m?.f2, row.requestSha256, row.definitionSha256, row.datasetSha256, row.execution?.result.sha256];
  });
  return [fields, ...rows].map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
}
