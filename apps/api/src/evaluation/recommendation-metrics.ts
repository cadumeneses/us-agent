import { nfrKey, type Nfr } from '../services/nfr-engine.js';

export function countsMetrics(tp: number, fp: number, fn: number) {
  for (const value of [tp, fp, fn]) if (!Number.isSafeInteger(value) || value < 0) throw new Error('Contagens devem ser inteiros não negativos.');
  const ratio = (numerator: number, denominator: number) => denominator === 0 ? null : numerator / denominator;
  return { tp, fp, fn, precision: ratio(tp, tp + fp), recall: ratio(tp, tp + fn),
    f1: ratio(2 * tp, 2 * tp + fp + fn), f2: ratio(5 * tp, 5 * tp + fp + 4 * fn) };
}

/** Set matching by the existing normalized identity. Scores and acceptance are not relevance. */
export function recommendationMetrics(predicted: readonly Nfr[], relevant: readonly Nfr[]) {
  const predictions = new Set(predicted.map(nfrKey)), reference = new Set(relevant.map(nfrKey));
  const tp = [...predictions].filter(key => reference.has(key)).length;
  return countsMetrics(tp, predictions.size - tp, reference.size - tp);
}
export type RecommendationMetrics = ReturnType<typeof countsMetrics>;

export function aggregateRecommendationMetrics(rows: readonly RecommendationMetrics[]) {
  const totals = rows.reduce((sum, row) => ({ tp: sum.tp + row.tp, fp: sum.fp + row.fp, fn: sum.fn + row.fn }), { tp: 0, fp: 0, fn: 0 });
  const fields = ['precision', 'recall', 'f1', 'f2'] as const;
  return { targets: rows.length, micro: rows.length ? countsMetrics(totals.tp, totals.fp, totals.fn) : null,
    macro: Object.fromEntries(fields.map(field => {
      const values = rows.map(row => row[field]).filter((value): value is number => value !== null);
      return [field, { value: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null,
        definedTargets: values.length, undefinedTargets: rows.length - values.length }];
    })) as Record<typeof fields[number], { value: number | null; definedTargets: number; undefinedTargets: number }> };
}
