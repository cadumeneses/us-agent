import { rankNeighbors, KNN_KERNEL_VERSION, type EligibilityIssue, type KnnPolicy } from './knn.js';
import { NFR_METHOD, NFR_ATTRIBUTES, nfrKey, normalizeNfr, profileFeatures, profileIssues, type Label, type NfrProfile, type NfrResult, type NfrSuggestion } from './nfr-engine.js';

export const RNF_POLICY_VERSION = 'ramos-v2-policy-v1';
export const RNF_POLICY = {
  id: RNF_POLICY_VERSION, kernel: KNN_KERNEL_VERSION, method: NFR_METHOD, k: 1,
  representation: 'target_binary_presence', distance: 'manhattan', similarity: '1-distance/target-dimensions',
  eligibility: 'accepted-profile_product_same-module-operation_exclude-same-story',
  taxonomyComparison: 'exact-legacy-names_without-version-filter',
  identity: 'declared-story-id', tieBreak: 'classification-id_numeric-then-locale',
  aggregation: 'binary-cooccurrence_similarity_k1', emptyNeighbor: 'retain-neighbor-without-fallback'
} as const;

function eligibility(target: NfrProfile, candidate: NfrProfile, label: Label): EligibilityIssue[] {
  const issues: EligibilityIssue[] = [];
  if (candidate.storyId === target.storyId) issues.push({ code: 'self', message: 'A própria história é excluída.' });
  if (candidate.projectProfile.objective !== 'product') issues.push({ code: 'objective', message: 'O candidato precisa ter objetivo de produto.' });
  const profile = profileIssues(candidate);
  if (profile.length) issues.push({ code: 'profile', message: profile.join(' ') });
  if (!candidate.labels.some(item => item.module === label.module && item.operation === label.operation)) issues.push({ code: 'label', message: 'O candidato não possui o par módulo/operação selecionado.' });
  return issues;
}
export function compareRnfClassificationIds(left: string, right: string): number {
  if (/^\d+$/.test(left) && /^\d+$/.test(right)) return BigInt(left) < BigInt(right) ? -1 : BigInt(left) > BigInt(right) ? 1 : 0;
  return left.localeCompare(right);
}

export function recommendWithRnfPolicy(target: NfrProfile, history: NfrProfile[], labelIndex: number) {
  const label = target.labels[labelIndex] ?? null;
  const result: NfrResult = { method: NFR_METHOD, k: 1, status: 'blocked', messages: profileIssues(target), label,
    dimensions: profileFeatures(target), eligibleCount: 0, excludedCount: 0, neighbor: null, items: [] };
  const explanation = { policy: RNF_POLICY,
    candidates: [] as Array<{ classificationId: string; storyId: string; eligible: boolean; issues: EligibilityIssue[];
      rank: number | null; vector: number[]; distance: number | null; similarity: number | null }> };
  if (!Number.isInteger(labelIndex) || labelIndex < 0 || !label || [label.module, label.operation].some(value => !value || value === 'n/a')) result.messages.push('Selecione um par módulo/operação válido da classificação.');
  if (result.messages.length || !label) return { result, explanation };
  // Legacy HTTP profile validation already rejects blank category values; guard generic input too.
  if (!result.dimensions.length) {
    result.messages.push('Informe ao menos uma característica não vazia para calcular a similaridade.');
    return { result, explanation };
  }
  const policy: KnnPolicy<NfrProfile> = {
    dimensions: profileFeatures, eligibility: (target, candidate) => eligibility(target, candidate, label),
    vector: (candidate, dimensions) => { const features = new Set(profileFeatures(candidate)); return dimensions.map(value => features.has(value) ? 1 : 0); },
    measure: (vector, dimensions) => { const distance = vector.reduce((sum, value) => sum + 1 - value, 0); return { distance, similarity: 1 - distance / dimensions.length }; },
    compareTies: (left, right) => compareRnfClassificationIds(left.classificationId, right.classificationId)
  };
  const ranking = rankNeighbors(target, history, 1, policy);
  result.eligibleCount = ranking.ranked.length; result.excludedCount = ranking.excluded.length;
  explanation.candidates = [
    ...ranking.ranked.map((candidate, index) => ({ classificationId: candidate.candidate.classificationId, storyId: candidate.candidate.storyId,
      eligible: true, issues: [], rank: index + 1, vector: candidate.vector, distance: candidate.distance, similarity: candidate.similarity })),
    ...ranking.excluded.map(candidate => ({ classificationId: candidate.candidate.classificationId, storyId: candidate.candidate.storyId,
      eligible: false, issues: candidate.issues, rank: null, vector: [], distance: null, similarity: null }))
  ];
  if (!ranking.neighbors.length) {
    result.status = 'no_candidates';
    result.messages.push('Nenhuma US histórica compatível: verifique perfis, classificação aceita e módulo/operação. Projetos de protótipo e a própria US são excluídos.');
    return { result, explanation };
  }
  const best = ranking.neighbors[0], profile = best.candidate;
  if (ranking.ranked.length > 1 && best.similarity === ranking.ranked[1].similarity) result.messages.push('Empate: selecionada a classificação de menor identificador. Política determinística do US-Agent; k permanece igual a 1.');
  result.neighbor = { classificationId: profile.classificationId, storyId: profile.storyId, project: profile.project, text: profile.text,
    similarity: best.similarity, vector: best.vector, matched: result.dimensions.filter((_, index) => best.vector[index] === 1), missing: result.dimensions.filter((_, index) => best.vector[index] === 0) };
  const linked = new Set(target.nfrs.map(nfrKey)), unique = new Map<string, NfrSuggestion>();
  for (const raw of profile.nfrs) {
    const nfr = normalizeNfr(raw);
    if (!nfr.sentence || !NFR_ATTRIBUTES[nfr.type]?.includes(nfr.attribute)) continue;
    const key = nfrKey(nfr); unique.set(key, { ...nfr, key, score: best.similarity, alreadyLinked: linked.has(key) });
  }
  result.items = [...unique.values()].sort((a, b) => a.key.localeCompare(b.key));
  result.status = result.items.length ? 'completed' : 'no_items';
  if (!result.items.length) result.messages.push('O vizinho mais próximo não possui RNFs no recorte de Felipe. O motor mantém k=1 e não substitui esse vizinho por outro.');
  if (best.similarity === 0) result.messages.push('O vizinho não compartilha características com o alvo: similaridade e utilidade iguais a zero.');
  return { result, explanation };
}
