import { snapshotContent } from '../domain/content-snapshot.js';
import { rankNeighbors } from './knn.js';
import { inspectTestrecData } from './testrec-contract.js';

export const E21_EQUATIONS_DEMO = 'us_agent_e21_equations_demo_v1';
const K = 3;

/** E21 equation 4.2 over the target-oriented binary representation; not Euclidean. */
export function measureE21Equation42(vector: readonly number[]) {
  if (!vector.length || vector.some(value => value !== 0 && value !== 1)) throw new Error('A equação 4.2 exige vetor binário não vazio.');
  const distance = vector.reduce((sum, value) => sum + Math.abs(1 - value), 0);
  return { distance, similarity: 1 - distance / vector.length };
}

type AssociatedNeighbor = { recordId: string; similarity: number; testCaseIds: readonly string[] };

/** E21 equation 4.3: one contribution per test ID per neighbor, divided by configured K. */
export function aggregateE21Equation43(neighbors: readonly AssociatedNeighbor[]) {
  if (neighbors.length !== K || new Set(neighbors.map(row => row.recordId)).size !== K) throw new Error('A demonstração exige três vizinhos distintos.');
  const contributions = new Map<string, Array<{ recordId: string; similarity: number }>>();
  for (const neighbor of neighbors) {
    if (!neighbor.recordId.trim() || !Number.isFinite(neighbor.similarity) || neighbor.similarity < 0 || neighbor.similarity > 1) throw new Error('Vizinho/similaridade inválido.');
    if (new Set(neighbor.testCaseIds).size !== neighbor.testCaseIds.length || neighbor.testCaseIds.some(id => !id.trim() || id !== id.trim())) throw new Error('IDs de testes inválidos ou duplicados.');
    for (const id of neighbor.testCaseIds) {
      const rows = contributions.get(id) ?? [];
      rows.push({ recordId: neighbor.recordId, similarity: neighbor.similarity });
      contributions.set(id, rows);
    }
  }
  return [...contributions].map(([testCaseId, rows]) => {
    const numerator = rows.reduce((sum, row) => sum + row.similarity, 0);
    return { testCaseId, support: rows.length, numerator, denominator: K, score: numerator / K, contributions: rows };
  }).sort((left, right) => right.score - left.score || compareIds(left.testCaseId, right.testCaseId));
}

// Explicit local adaptation for residual ties; independent of insertion order and locale.
function compareIds(left: string, right: string) { return left < right ? -1 : left > right ? 1 : 0; }

/** Offline illustration only. It deliberately does not register a publishable TestRec method. */
export function runTestrecEquationDemo(rawDefinition: unknown, rawTarget: unknown, rawDataset: unknown, rawCatalog?: unknown, rawTaxonomies: readonly unknown[] = []) {
  const input = inspectTestrecData(rawDefinition, rawTarget, rawDataset, rawCatalog, rawTaxonomies);
  const data = input.content;
  const candidates = data.representation.candidates;
  const targetId = data.target.content.id;
  const excluded = candidates.filter(row => row.sameStory || row.recordId === targetId).map(row => ({ recordId: row.recordId, code: 'target_identity' }));
  const eligible = candidates.filter(row => !row.sameStory && row.recordId !== targetId);
  const issues: Array<{ code: string; recordIds: string[] }> = [];
  if (eligible.length < K) issues.push({ code: 'fewer_than_three_candidates', recordIds: eligible.map(row => row.recordId) });
  const unknown = eligible.filter(row => row.tests.state === 'not_provided').map(row => row.recordId);
  if (unknown.length) issues.push({ code: 'unknown_test_associations', recordIds: unknown });
  const targetOutput = data.target.content.values[data.definition.content.method.bindings.test_case_ids];
  if (Array.isArray(targetOutput) && targetOutput.length) issues.push({ code: 'target_output_must_be_withheld', recordIds: [targetId] });
  const context = { schemaVersion: 1, mode: 'equation_demonstration', method: E21_EQUATIONS_DEMO,
    scientificReproduction: false, k: K, input,
    rules: { representation: 'E21_table_4_6_target_presence', similarity: 'E21_equation_4_2_normalized_manhattan',
      aggregation: 'E21_equation_4_3_sum_similarity_over_k', primaryTie: 'E21_section_4_5_5_more_associated_tests',
      residualTie: 'US-Agent_ascending_ID', eligibility: 'US-Agent_exclude_target_record_or_story',
      insufficientCandidates: 'US-Agent_block_below_configured_k', unknownAssociations: 'US-Agent_block_any_eligible_unknown',
      zeroSimilarity: 'US-Agent_keep_without_threshold', itemTie: 'US-Agent_ascending_test_ID' },
    excluded, issues };
  if (issues.length) return snapshotContent({ ...context, status: 'blocked', ranked: [], neighbors: [], items: [] });
  const target: typeof candidates[number] = { recordId: targetId, sameStory: true, vector: data.representation.targetVector, tests: { state: 'not_provided', ids: null } };
  const ranking = rankNeighbors(target, eligible, K, {
    dimensions: () => data.representation.dimensions.map(row => row.label), eligibility: () => [],
    vector: row => row.vector, measure: measureE21Equation42,
    compareTies: (left, right) => right.tests.ids!.length - left.tests.ids!.length || compareIds(left.recordId, right.recordId)
  });
  const ranked = ranking.ranked.map(row => ({ recordId: row.candidate.recordId, vector: row.vector, distance: row.distance,
    similarity: row.similarity, testCaseIds: row.candidate.tests.ids! }));
  const neighbors = ranked.slice(0, K);
  const catalog = new Map(data.catalog?.content.items.map(item => [item.id, item]) ?? []);
  const items = aggregateE21Equation43(neighbors).map(row => ({ ...row, artifact: catalog.get(row.testCaseId)! }));
  return snapshotContent({ ...context, status: items.length ? 'completed' : 'no_test_cases', ranked, neighbors, items });
}
