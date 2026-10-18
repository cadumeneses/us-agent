import type { Taxonomy } from '../domain/models.js';
import { createClassificationProvenance } from './classification-provenance.js';

const rules: Array<[RegExp, string, string]> = [
  [/password|senha|reset/, 'Authentication', 'Password recovery'],
  [/oauth|google|microsoft|facebook/, 'Authentication', 'Login with OAuth'],
  [/login|sign in|entrar|autenticar/, 'Authentication', 'Login with username and password'],
  [/dashboard|painel/, 'Management', 'View dashboard'],
  [/pdf/, 'Management', 'Export report to PDF'],
  [/xls|excel/, 'Management', 'Export report to XLS'],
  [/email|e-mail/, 'Management', 'Notify by email'],
  [/delete|remove|excluir|remover/, 'Registry', 'Remove data'],
  [/update|edit|alterar|atualizar/, 'Registry', 'Update data'],
  [/create|register|add|cadastrar|criar/, 'Registry', 'Insert data'],
  [/view|list|search|consultar|listar/, 'Registry', 'Retrieve data']
];

export function classifyPreview(text: string, taxonomy: Taxonomy) {
  const match = rules.find(([pattern, module, operation]) =>
    pattern.test(text.toLowerCase()) && taxonomy.modules[module]?.includes(operation)
  );

  const result = {
    module: match?.[1] ?? 'n/a',
    operation: match?.[2] ?? 'n/a',
    labels: [{ module: match?.[1] ?? 'n/a', operation: match?.[2] ?? 'n/a' }],
    confidence: match ? 0.86 : 0.35,
    needsReview: !match,
    finalReason: match
      ? `The local rule identified an intent compatible with ${match[1]} / ${match[2]}.`
      : 'No pre-classification rule found an equivalent operation in the active taxonomy.',
    notesForHuman: match ? undefined : 'Confirm the classification or record a taxonomy gap.',
    disagreementCause: match ? undefined : 'taxonomy_gap',
    finalAction: match ? 'none' : 'ask_human',
    fallbackSuggestions: match ? [] : [{
      source: 'preview_rules',
      type: 'clarify_story' as const,
      reason: 'Pre-classification did not find enough coverage to classify the story safely.',
      evidence: [text]
    }]
  };
  return { ...result, provenance: createClassificationProvenance(text, taxonomy, {
    engine: 'web_preview_rules_v1', policyVersion: 'web_preview_rules_v1', promptVersion: null, prompt: null,
    decision: { labels: result.labels, confidence: result.confidence, needsReview: result.needsReview,
      consensusRatio: null, uncertainty: null, reviewReasons: match ? [] : ['no_rule_match'],
      reason: result.finalReason, providerHealth: { total: 0, successful: 0, failed: 0 } }
  }) };
}

export function parseImportedStories(content: string): string[] {
  return content
    .split(/\r?\n|;/)
    .map(story => story.trim())
    .filter(story => story.length >= 10)
    .slice(0, 100);
}
