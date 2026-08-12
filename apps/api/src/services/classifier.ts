import type { Taxonomy } from '../domain/models.js';

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

  return {
    module: match?.[1] ?? 'n/a',
    operation: match?.[2] ?? 'n/a',
    confidence: match ? 0.86 : 0.35,
    needsReview: !match,
    finalReason: match
      ? `A regra local identificou a intenção compatível com ${match[1]} / ${match[2]}.`
      : 'Nenhuma regra da pré-classificação encontrou uma operação equivalente na taxonomia ativa.',
    notesForHuman: match ? undefined : 'Confirme a classificação ou registre uma lacuna da taxonomia.',
    disagreementCause: match ? undefined : 'taxonomy_gap',
    finalAction: match ? 'none' : 'ask_human',
    fallbackSuggestions: match ? [] : [{
      source: 'preview_rules',
      type: 'clarify_story' as const,
      reason: 'A pré-classificação não encontrou cobertura suficiente para classificar a história com segurança.',
      evidence: [text]
    }]
  };
}

export function parseImportedStories(content: string): string[] {
  return content
    .split(/\r?\n|;/)
    .map(story => story.trim())
    .filter(story => story.length >= 10)
    .slice(0, 100);
}
