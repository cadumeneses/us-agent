export const KNN_KERNEL_VERSION = 'policy-knn-v1';
export type EligibilityIssue = { code: string; message: string };
export type KnnPolicy<T> = {
  dimensions: (target: T) => string[];
  eligibility: (target: T, candidate: T) => EligibilityIssue[];
  vector: (candidate: T, dimensions: string[]) => number[];
  measure: (vector: number[], dimensions: string[]) => { distance: number; similarity: number };
  compareTies: (left: T, right: T) => number;
};

/** The caller owns representation, filtering, distance, tie-breaking and item aggregation. */
export function rankNeighbors<T>(target: T, candidates: T[], k: number, policy: KnnPolicy<T>) {
  if (!Number.isInteger(k) || k < 1) throw new Error('k deve ser inteiro positivo.');
  const dimensions = policy.dimensions(target);
  const excluded: Array<{ candidate: T; issues: EligibilityIssue[] }> = [];
  const ranked: Array<{ candidate: T; vector: number[]; distance: number; similarity: number }> = [];
  for (const candidate of candidates) {
    const issues = policy.eligibility(target, candidate);
    if (issues.length) { excluded.push({ candidate, issues }); continue; }
    const vector = policy.vector(candidate, dimensions);
    if (vector.length !== dimensions.length || vector.some(value => !Number.isFinite(value))) throw new Error('Representação incompatível com as dimensões.');
    const measure = policy.measure(vector, dimensions);
    if (!Number.isFinite(measure.distance) || measure.distance < 0 || !Number.isFinite(measure.similarity)) throw new Error('Distância/similaridade inválida.');
    ranked.push({ candidate, vector, ...measure });
  }
  ranked.sort((a, b) => b.similarity - a.similarity || policy.compareTies(a.candidate, b.candidate));
  return { dimensions, ranked, neighbors: ranked.slice(0, k), excluded };
}
