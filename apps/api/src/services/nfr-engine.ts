import { createHash } from 'node:crypto';
import type { ProjectResearchProfile } from './research-inputs.js';

export const NFR_METHOD = 'ramos_2019_manhattan_k1_v1';
export const NFR_ATTRIBUTES: Record<string, string[]> = {
  Performance: ['response_time', 'capacity', 'transit_delay', 'efficiency_compliance'],
  Reliability: ['availability', 'integrity', 'fault_tolerance', 'recoverability'],
  Security: ['confidentiality', 'access_control', 'authentication']
};
export type Nfr = { type: string; attribute: string; sentence: string };
export type Label = { module: string; operation: string };
export type NfrProfile = {
  classificationId: string; storyId: string; text: string; project: string;
  taxonomyVersion: string; reviewStatus: string; labels: Label[];
  projectProfile: ProjectResearchProfile;
  tasks: Array<{ category: string }>;
  nfrs: Nfr[];
};
export type NfrSuggestion = Nfr & { key: string; score: number; alreadyLinked: boolean };
export type NfrResult = {
  method: string; k: 1; status: 'blocked' | 'no_candidates' | 'no_items' | 'completed';
  messages: string[]; label: Label | null; dimensions: string[];
  eligibleCount: number; excludedCount: number;
  neighbor: null | { classificationId: string; storyId: string; project: string; text: string; similarity: number; vector: number[]; matched: string[]; missing: string[] };
  items: NfrSuggestion[];
};

export function normalizeNfr(nfr: Nfr): Nfr {
  return { type: nfr.type.trim(), attribute: nfr.attribute.trim().toLowerCase().replace(/\s+/g, '_'), sentence: nfr.sentence.trim() };
}
export function nfrKey(nfr: Nfr): string {
  const value = normalizeNfr(nfr);
  return createHash('sha256').update(JSON.stringify([value.type, value.attribute, value.sentence])).digest('hex');
}
export const usableClassification = (profile: NfrProfile) => ['accepted_auto', 'reviewed', 'reclassified'].includes(profile.reviewStatus);

// Dimensions come ONLY from the target. Namespaces prevent e.g. a language
// matching an identically named framework. Objective is a pre-filter, not a dimension.
export function profileFeatures(profile: NfrProfile): string[] {
  const p = profile.projectProfile;
  const fields: Record<string, string[]> = {
    platform: p.platforms, applicationDomain: p.applicationDomains, architecture: p.architectures,
    language: p.technologies.languages, framework: p.technologies.frameworks,
    api: p.technologies.apis, persistence: p.technologies.dataPersistence,
    task: profile.tasks.map(task => task.category)
  };
  return [...new Set(Object.entries(fields).flatMap(([field, values]) => values.map(value => value.trim()).filter(Boolean).map(value => `${field}:${value}`)))].sort();
}

export function profileIssues(profile: NfrProfile): string[] {
  const issues: string[] = [];
  if (!usableClassification(profile)) issues.push('A classificação precisa ser aceita ou revisada antes da recomendação.');
  if (!profile.taxonomyVersion) issues.push('A classificação precisa identificar a versão da taxonomia.');
  const p = profile.projectProfile;
  if (!p.platforms.length) issues.push('Informe a plataforma do projeto.');
  if (!p.applicationDomains.length) issues.push('Informe o domínio de aplicação do projeto.');
  if (!p.architectures.length) issues.push('Informe a arquitetura do projeto.');
  if (!p.objective) issues.push('Informe o objetivo do projeto (produto ou protótipo).');
  if (profile.tasks.some(task => !task.category.trim())) issues.push('Classifique as tarefas cadastradas com uma categoria antes de recomendar.');
  return issues;
}

export function recommendNfr(target: NfrProfile, history: NfrProfile[], labelIndex: number): NfrResult {
  const label = target.labels[labelIndex] ?? null;
  const result: NfrResult = {
    method: NFR_METHOD, k: 1, status: 'blocked', messages: profileIssues(target),
    label, dimensions: profileFeatures(target), eligibleCount: 0, excludedCount: 0, neighbor: null, items: []
  };
  if (!Number.isInteger(labelIndex) || labelIndex < 0 || !label || [label.module, label.operation].some(value => !value || value === 'n/a')) result.messages.push('Selecione um par módulo/operação válido da classificação.');
  if (result.messages.length || !label) return result;
  const candidates = history.filter(candidate =>
    candidate.storyId !== target.storyId && candidate.projectProfile.objective === 'product' &&
    candidate.taxonomyVersion === target.taxonomyVersion && !profileIssues(candidate).length &&
    candidate.labels.some(item => item.module === label.module && item.operation === label.operation)
  );
  result.eligibleCount = candidates.length;
  result.excludedCount = history.length - candidates.length;
  if (!candidates.length) {
    result.status = 'no_candidates';
    result.messages.push('Nenhuma US histórica compatível: verifique perfis, classificação aceita, versão da taxonomia e módulo/operação. Projetos de protótipo e a própria US são excluídos.');
    return result;
  }
  const ranked = candidates.map(profile => {
    const features = new Set(profileFeatures(profile));
    const vector = result.dimensions.map(value => features.has(value) ? 1 : 0);
    const distance = vector.reduce<number>((sum, value) => sum + (1 - value), 0);
    return { profile, vector, similarity: 1 - distance / result.dimensions.length };
  }).sort((a, b) => b.similarity - a.similarity || compareId(a.profile.classificationId, b.profile.classificationId));
  const best = ranked[0];
  if (ranked.length > 1 && best.similarity === ranked[1].similarity) result.messages.push('Empate: selecionada a classificação de menor identificador. Política determinística do US-Agent; k permanece igual a 1.');
  result.neighbor = {
    classificationId: best.profile.classificationId, storyId: best.profile.storyId,
    project: best.profile.project, text: best.profile.text, similarity: best.similarity, vector: best.vector,
    matched: result.dimensions.filter((_, index) => best.vector[index] === 1),
    missing: result.dimensions.filter((_, index) => best.vector[index] === 0)
  };
  const linked = new Set(target.nfrs.map(nfrKey));
  const unique = new Map<string, NfrSuggestion>();
  for (const raw of best.profile.nfrs) {
    const nfr = normalizeNfr(raw);
    if (!nfr.sentence || !NFR_ATTRIBUTES[nfr.type]?.includes(nfr.attribute)) continue;
    const key = nfrKey(nfr);
    // Binary co-occurrence: duplicate links in one neighbor do not increase utility.
    unique.set(key, { ...nfr, key, score: best.similarity, alreadyLinked: linked.has(key) });
  }
  result.items = [...unique.values()].sort((a, b) => a.key.localeCompare(b.key));
  result.status = result.items.length ? 'completed' : 'no_items';
  if (!result.items.length) result.messages.push('O vizinho mais próximo não possui RNFs no recorte de Felipe. O motor mantém k=1 e não substitui esse vizinho por outro.');
  if (best.similarity === 0) result.messages.push('O vizinho não compartilha características com o alvo: similaridade e utilidade iguais a zero.');
  return result;
}

function compareId(a: string, b: string): number {
  if (/^\d+$/.test(a) && /^\d+$/.test(b)) return BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0;
  return a.localeCompare(b);
}
