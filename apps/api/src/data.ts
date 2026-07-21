import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import path from 'node:path';

export type Story = {
  id: string; text: string; project: string; module: string; operation: string;
  confidence: number; uncertainty: number; status: string; consensus: number;
};

const root = path.resolve(process.cwd(), '../..');
const resultsPath = path.join(root, 'runs', 'results.jsonl');

export async function loadStories(): Promise<Story[]> {
  if (!existsSync(resultsPath)) return [];
  const stories: Story[] = [];
  const lines = createInterface({ input: createReadStream(resultsPath, { encoding: 'utf8' }), crlfDelay: Infinity });
  for await (const line of lines) {
    try {
      const item = JSON.parse(line);
      const row = item.final?.final_rows?.[0] ?? { module: 'n/a', operation: 'n/a' };
      stories.push({
        id: item.story_id ?? `story-${stories.length + 1}`,
        text: item.user_story ?? '', project: item.project ?? 'Unassigned',
        module: row.module, operation: row.operation,
        confidence: Number(item.final?.final_confidence ?? item.aggregate?.avg_confidence ?? 0),
        uncertainty: Number(item.uncertainty?.uncertainty_score ?? 0),
        consensus: Number(item.uncertainty?.consensus_ratio ?? 0),
        status: item.review_status ?? 'pending_review'
      });
    } catch { /* tolerate malformed historical records */ }
  }
  return stories.reverse();
}

export function loadTaxonomy() {
  const file = path.join(root, 'config', 'taxonomy.json');
  return JSON.parse(readFileSync(file, 'utf8'));
}

export function classifyPreview(text: string, taxonomy = loadTaxonomy()) {
  const normalized = text.toLowerCase();
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
  const match = rules.find(([pattern, mod, operation]) => pattern.test(normalized) && taxonomy.modules[mod]?.includes(operation));
  return { module: match?.[1] ?? 'n/a', operation: match?.[2] ?? 'n/a', confidence: match ? 0.86 : 0.35, needsReview: !match };
}
