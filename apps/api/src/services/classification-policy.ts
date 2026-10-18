import type { ProviderVote } from '../domain/models.js';
import type { ClassificationLabel, ClassificationUncertainty } from '../domain/classification.js';
export type { ClassificationLabel } from '../domain/classification.js';

// A US-Agent decision policy. It is not the RNF/TestRec method or Python arbitration.
export const WEB_CLASSIFICATION_POLICY = 'web_committee_multilabel_v1';
export type ReviewReason = 'no_valid_votes' | 'insufficient_quorum' | 'multiple_provider_failures'
  | 'no_strict_majority' | 'provider_requested_review' | 'taxonomy_gap'
  | 'low_confidence' | 'high_uncertainty' | 'medium_uncertainty_low_consensus';

export type CommitteeDecision = {
  policyVersion: typeof WEB_CLASSIFICATION_POLICY;
  rows: ClassificationLabel[];
  confidence: number; consensusRatio: number; needsReview: boolean;
  reviewReasons: ReviewReason[];
  providerHealth: { total: number; successful: number; failed: number };
  uncertainty: ClassificationUncertainty;
};

const round = (value: number) => Number(value.toFixed(4));
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const labelKey = (label: ClassificationLabel) => JSON.stringify([label.module, label.operation]);
const notCovered = (label: ClassificationLabel) => label.module === 'n/a' || label.operation === 'n/a';

/** Input votes must already have been validated against the selected taxonomy. */
export function canonicalLabels(rows: ClassificationLabel[]): ClassificationLabel[] {
  if (!rows.length) throw new Error('Um voto válido precisa conter ao menos um par.');
  const unique = new Map<string, ClassificationLabel>();
  for (const raw of rows) {
    const label = { module: raw.module.trim(), operation: raw.operation.trim() };
    if (!label.module || !label.operation) throw new Error('Rótulos vazios não são válidos.');
    if (notCovered(label) && (label.module !== 'n/a' || label.operation !== 'n/a')) {
      throw new Error('Ausência de cobertura exige o par n/a completo.');
    }
    unique.set(labelKey(label), label);
  }
  const labels = [...unique.values()].sort((a, b) => compare(labelKey(a), labelKey(b)));
  if (labels.length > 1 && labels.some(notCovered)) {
    throw new Error('Um voto não pode misturar n/a e rótulos classificados.');
  }
  return labels;
}

export function evaluateClassificationPolicy(votes: ProviderVote[]): CommitteeDecision {
  if (!votes.length) throw new Error('Informe os provedores participantes, incluindo suas falhas.');
  const providers = votes.map(vote => vote.provider.trim());
  if (providers.some(name => !name) || new Set(providers).size !== providers.length) {
    throw new Error('Cada provedor deve ter uma identificação única e não vazia.');
  }
  const successes = votes.filter(vote => vote.status === 'success').map(vote => {
    if (vote.confidence === undefined || !Number.isFinite(vote.confidence) || vote.confidence < 0 || vote.confidence > 1) {
      throw new Error('Confiança de um voto válido deve estar entre 0 e 1.');
    }
    return { ...vote, confidence: vote.confidence, rows: canonicalLabels(vote.rows) };
  });
  const total = votes.length;
  const successful = successes.length;
  const failed = total - successful;
  const denominator = Math.max(successful, 1);
  const hypotheses = new Map<string, { count: number; rows: ClassificationLabel[] }>();
  for (const vote of successes) {
    const key = JSON.stringify(vote.rows);
    const previous = hypotheses.get(key);
    hypotheses.set(key, { count: (previous?.count ?? 0) + 1, rows: vote.rows });
  }
  const ranked = [...hypotheses.entries()].sort(([a, left], [b, right]) => right.count - left.count || compare(a, b));
  const winner = ranked[0]?.[1];
  const consensus = (winner?.count ?? 0) / denominator;
  const averageConfidence = successes.reduce((sum, vote) => sum + vote.confidence, 0) / denominator;
  const sets = successes.map(vote => new Set(vote.rows.map(labelKey)));
  const overlaps: number[] = [];
  for (let i = 0; i < sets.length; i++) for (let j = i + 1; j < sets.length; j++) {
    const union = new Set([...sets[i], ...sets[j]]);
    const intersection = [...sets[i]].filter(key => sets[j].has(key)).length;
    overlaps.push(intersection / union.size);
  }
  const labelOverlap = overlaps.length ? overlaps.reduce((sum, value) => sum + value, 0) / overlaps.length : 1;
  const normalizedEntropy = hypotheses.size <= 1 ? 0 : -[...hypotheses.values()].reduce((sum, group) => {
    const probability = group.count / denominator;
    return sum + probability * Math.log2(probability);
  }, 0) / Math.log2(hypotheses.size);
  const disagreementRate = 1 - consensus;
  const disagreementLevel = disagreementRate === 0 ? 'none'
    : disagreementRate < 0.34 && labelOverlap >= 0.5 ? 'light' : 'strong';
  const disagreementRisk = disagreementLevel === 'light' ? disagreementRate * 0.55 : disagreementRate;
  const naRatio = successes.filter(vote => vote.rows.some(notCovered)).length / denominator;
  const taxonomyGapRatio = successes.filter(vote => vote.issues.some(issue => /taxonomy_gap|taxonomia|lacuna/i.test(issue))).length / denominator;
  const naGapPenalty = Math.min(1, 0.7 * naRatio + 0.3 * taxonomyGapRatio);
  const confidenceRisk = 1 - averageConfidence;
  const reviewRisk = !successful || successes.some(vote => vote.needsReview) ? 1 : 0;
  // Same composition as _assess_uncertainty in agent/orchestrator.py, with fixed thresholds.
  const score = 0.25 * confidenceRisk + 0.2 * normalizedEntropy + 0.25 * disagreementRisk
    + 0.15 * naGapPenalty + 0.15 * reviewRisk;
  const band = score >= 0.66 ? 'high' : score >= 0.33 ? 'medium' : 'low';
  const reviewReasons: ReviewReason[] = [];
  if (!successful) reviewReasons.push('no_valid_votes');
  if (successful < 2 || successful * 2 <= total) reviewReasons.push('insufficient_quorum');
  if (failed >= 2) reviewReasons.push('multiple_provider_failures');
  if (!winner || winner.count * 2 <= successful) reviewReasons.push('no_strict_majority');
  if (successes.some(vote => vote.needsReview)) reviewReasons.push('provider_requested_review');
  if (naRatio > 0 || taxonomyGapRatio > 0) reviewReasons.push('taxonomy_gap');
  // Unanimity alone must not approve votes that are uncertain about their own answer.
  if (successful && averageConfidence < 0.5) reviewReasons.push('low_confidence');
  if (band === 'high') reviewReasons.push('high_uncertainty');
  if (band === 'medium' && consensus < 0.67) reviewReasons.push('medium_uncertainty_low_consensus');

  return {
    policyVersion: WEB_CLASSIFICATION_POLICY,
    rows: winner?.rows ?? [{ module: 'n/a', operation: 'n/a' }],
    confidence: round(averageConfidence * consensus), consensusRatio: round(consensus),
    needsReview: reviewReasons.length > 0, reviewReasons,
    providerHealth: { total, successful, failed },
    uncertainty: {
      score: round(score), band, disagreementRate: round(disagreementRate), disagreementLevel,
      disagreementRisk: round(disagreementRisk), hypothesisCount: hypotheses.size,
      labelOverlap: round(labelOverlap), normalizedEntropy: round(normalizedEntropy),
      confidenceRisk: round(confidenceRisk), entropyRisk: round(normalizedEntropy),
      naGapPenalty: round(naGapPenalty), naRatio: round(naRatio),
      taxonomyGapRatio: round(taxonomyGapRatio), reviewRisk
    }
  };
}
