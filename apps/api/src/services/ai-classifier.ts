import { z } from 'zod';
import type { FallbackSuggestion, ProviderVote, Taxonomy } from '../domain/models.js';

const fallbackSuggestion = z.object({
  type: z.enum(['new_domain', 'new_module', 'new_operation', 'clarify_story', 'classification']),
  proposed_domain: z.string().trim().min(1).max(120).optional(),
  target_domain: z.string().trim().min(1).max(120).optional(),
  proposed_module: z.string().trim().min(1).max(120).optional(),
  target_module: z.string().trim().min(1).max(120).optional(),
  proposed_operation: z.string().trim().min(1).max(180).optional(),
  reason: z.string().trim().min(1).max(2_000),
  evidence: z.array(z.string().trim().min(1).max(1_000)).max(8).default([])
});

const aiOutput = z.object({
  rows: z.array(z.object({ module: z.string(), operation: z.string() })).min(1).max(8),
  confidence: z.number().min(0).max(1),
  rationale: z.string().trim().max(2_000).default(''),
  evidence: z.array(z.string().trim().min(1).max(1_000)).max(8).default([]),
  needs_review: z.boolean().default(false),
  issues: z.array(z.string().trim().min(1).max(1_000)).max(8).default([]),
  suggested_questions: z.array(z.string().trim().min(1).max(1_000)).max(8).default([]),
  fallback_suggestions: z.array(fallbackSuggestion).max(4).default([])
});

type Vote = z.infer<typeof aiOutput>;
type Provider = { name: string; call: (system: string, user: string) => Promise<string> };

export function chatRequestBody(name: string, model: string, system: string, user: string) {
  return {
    model,
    ...(name === 'openai' ? {} : { temperature: 0 }),
    response_format: { type: 'json_object' },
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }]
  };
}

const timeoutMs = Number(process.env.AI_PROVIDER_TIMEOUT_MS ?? 45_000);

function taxonomyText(taxonomy: Taxonomy) {
  if (taxonomy.domains && Object.keys(taxonomy.domains).length) {
    return Object.entries(taxonomy.domains).map(([domain, value]) => [
      domain,
      ...Object.entries(value.modules).map(([module, operations]) =>
        `- ${module}: ${operations.map(operation => `${operation}${taxonomy.descriptions?.[module]?.[operation] ? ` (${taxonomy.descriptions[module][operation]})` : ''}`).join(', ')}`
      )
    ].join('\n')).join('\n\n');
  }
  return Object.entries(taxonomy.modules).map(([module, operations]) => `${module}: ${operations.map(operation => `${operation}${taxonomy.descriptions?.[module]?.[operation] ? ` (${taxonomy.descriptions[module][operation]})` : ''}`).join(', ')}`).join('\n');
}

function prompt(taxonomy: Taxonomy, story: string) {
  const system = 'You classify user stories. Return valid JSON only, without Markdown.';
  const user = `Classify the story exclusively within the taxonomy below. Do not invent labels. If there is no coverage, use exactly one row {"module":"n/a","operation":"n/a"}, confidence at most 0.5, and needs_review true. In that case, or when context is missing, fill fallback_suggestions with up to 4 structured proposals. The hierarchy is domain (a new area such as Mobile or IoT) > module > operation: use new_domain with proposed_domain when the area does not exist; new_module with target_domain and proposed_module when a module is missing from that area; and new_operation with target_domain, target_module, and proposed_operation when only the operation is missing. A new_domain or new_module suggestion may also include child levels in proposed_module and proposed_operation. Always explain reason and include evidence when available. Write all explanatory text in English.\n\nTaxonomy:\n${taxonomyText(taxonomy)}\n\nStory:\n${story}\n\nJSON format: {"rows":[{"module":"...","operation":"..."}],"confidence":0.0,"rationale":"...","evidence":["..."],"needs_review":false,"issues":["..."],"suggested_questions":["..."],"fallback_suggestions":[{"type":"new_domain","proposed_domain":"Mobile","proposed_module":"Synchronization","proposed_operation":"Sync offline","reason":"...","evidence":["..."]}]}`;
  return { system, user };
}

async function postJson(url: string, headers: Record<string, string>, body: unknown) {
  const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
  return response.json() as Promise<unknown>;
}

function chatProvider(name: string, apiKey: string | undefined, baseUrl: string | undefined, model: string | undefined): Provider | undefined {
  if (!apiKey || !model) return undefined;
  const url = baseUrl?.replace(/\/$/, '') || 'https://api.openai.com/v1/chat/completions';
  return { name, call: async (system, user) => {
    // Current OpenAI reasoning models reject temperature=0 and only accept their
    // default sampling value. OpenAI therefore receives no temperature override;
    // compatible OpenAI-style providers keep deterministic sampling.
    const body = chatRequestBody(name, model, system, user);
    const data = await postJson(url, { authorization: `Bearer ${apiKey}` }, body) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('The provider returned no content.');
    return content;
  }};
}

function geminiProvider(): Provider | undefined {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL;
  if (!apiKey || !model) return undefined;
  return { name: 'gemini', call: async (system, user) => {
    const data = await postJson(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {}, { systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: user }] }], generationConfig: { temperature: 0, responseMimeType: 'application/json' } }) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) throw new Error('The provider returned no content.');
    return content;
  }};
}

function configuredProviders() {
  return [
    chatProvider('openai', process.env.OPENAI_API_KEY, undefined, process.env.OPENAI_MODEL),
    chatProvider('deepseek', process.env.DEEPSEEK_API_KEY, process.env.DEEPSEEK_BASE_URL, process.env.DEEPSEEK_MODEL),
    chatProvider('groq', process.env.GROQ_API_KEY, process.env.GROQ_BASE_URL, process.env.GROQ_MODEL),
    geminiProvider()
  ].filter((provider): provider is Provider => Boolean(provider));
}

function parseVote(raw: string, taxonomy: Taxonomy): Vote {
  const parsed = aiOutput.parse(JSON.parse(raw.replace(/^```json\s*|```$/g, '').trim()));
  const rows = parsed.rows.filter(row => row.module === 'n/a' && row.operation === 'n/a' || taxonomy.modules[row.module]?.includes(row.operation));
  if (!rows.length) throw new Error('The AI returned labels outside the taxonomy.');
  return { ...parsed, rows };
}

function normalizeFallbackSuggestions(provider: string, suggestions: Vote['fallback_suggestions']): FallbackSuggestion[] {
  return suggestions.map(suggestion => ({
    source: provider,
    type: suggestion.type,
    proposedDomain: suggestion.proposed_domain,
    targetDomain: suggestion.target_domain,
    proposedModule: suggestion.proposed_module,
    targetModule: suggestion.target_module,
    proposedOperation: suggestion.proposed_operation,
    reason: suggestion.reason,
    evidence: suggestion.evidence
  }));
}

function dedupeFallbackSuggestions(suggestions: FallbackSuggestion[]) {
  const seen = new Set<string>();
  return suggestions.filter(suggestion => {
    const key = [suggestion.type, suggestion.proposedDomain, suggestion.targetDomain, suggestion.proposedModule, suggestion.targetModule, suggestion.proposedOperation, suggestion.reason].join('\u0000');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function classifyWithAi(story: string, taxonomy: Taxonomy) {
  const providers = configuredProviders();
  if (!providers.length) throw new Error('No AI provider is configured. Set at least one API key in the environment.');
  const { system, user } = prompt(taxonomy, story);
  const settled = await Promise.allSettled(providers.map(async provider => ({ provider: provider.name, vote: parseVote(await provider.call(system, user), taxonomy) })));
  settled.forEach((result, index) => {
    if (result.status === 'rejected') {
      const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
      console.error(`AI provider "${providers[index].name}" failed: ${reason}`);
    }
  });
  const successes = settled.filter((item): item is PromiseFulfilledResult<{ provider: string; vote: Vote }> => item.status === 'fulfilled').map(item => item.value);
  if (!successes.length) throw new Error('All AI providers failed to classify this story.');
  const frequency = new Map<string, { count: number; row: { module: string; operation: string } }>();
  for (const { vote } of successes) for (const row of vote.rows) {
    const key = `${row.module}\u0000${row.operation}`;
    const current = frequency.get(key);
    frequency.set(key, { count: (current?.count ?? 0) + 1, row });
  }
  const winner = [...frequency.values()].sort((a, b) => b.count - a.count)[0];
  const consensus = winner.count / successes.length;
  const averageConfidence = successes.reduce((total, result) => total + result.vote.confidence, 0) / successes.length;
  const needsReview = consensus < 0.5 || successes.some(result => result.vote.needs_review);
  const providerVotes: ProviderVote[] = settled.map((result, index) => {
    const provider = providers[index].name;
    if (result.status === 'rejected') {
      return {
        provider,
        status: 'error',
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        needsReview: true,
        rows: [],
        evidence: [],
        issues: [],
        suggestedQuestions: []
      };
    }
    const { vote } = result.value;
    return {
      provider,
      status: 'success',
      confidence: vote.confidence,
      rationale: vote.rationale,
      needsReview: vote.needs_review,
      rows: vote.rows,
      evidence: vote.evidence,
      issues: vote.issues,
      suggestedQuestions: vote.suggested_questions
    };
  });
  const fallbackSuggestions = dedupeFallbackSuggestions(successes.flatMap(result => normalizeFallbackSuggestions(result.provider, result.vote.fallback_suggestions)));
  if (needsReview && !fallbackSuggestions.length) {
    fallbackSuggestions.push({
      source: 'committee',
      type: 'clarify_story',
      reason: 'The committee was not confident enough to decide automatically; this story requires human validation.',
      evidence: [story]
    });
  }
  const finalConfidence = Number((averageConfidence * consensus).toFixed(2));
  const hasNotCoveredRow = winner.row.module === 'n/a' || winner.row.operation === 'n/a';
  return {
    module: winner.row.module,
    operation: winner.row.operation,
    confidence: finalConfidence,
    needsReview,
    providers: successes.map(result => result.provider),
    providerVotes,
    fallbackSuggestions,
    finalReason: `The committee selected this suggestion with ${Math.round(consensus * 100)}% consensus across ${successes.length} valid response(s).`,
    notesForHuman: needsReview ? 'Review the suggestions, rationales, and classifier questions before deciding.' : undefined,
    disagreementCause: hasNotCoveredRow ? 'taxonomy_gap' : needsReview ? 'model_instability' : undefined,
    finalAction: needsReview ? (hasNotCoveredRow ? 'extend_taxonomy' : 'ask_human') : 'none'
  };
}
