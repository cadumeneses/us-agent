export type Story = { id: string; text: string; project: string; module: string; operation: string; confidence: number; uncertainty: number; consensus: number; status: string };
export type Dashboard = { total: number; pending: number; accepted: number; confidence: number; modules: { name: string; count: number }[] };
async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error ?? 'Falha na comunicação com a API');
  return response.json();
}
export const api = {
  dashboard: () => request<Dashboard>('/api/dashboard'),
  stories: () => request<Story[]>('/api/stories'),
  taxonomy: () => request<{ version: string; modules: Record<string, string[]> }>('/api/taxonomy'),
  classify: (stories: string[], project: string) => request<{ runId: string; results: Array<{ id: string; text: string; module: string; operation: string; confidence: number; needsReview: boolean }> }>('/api/classify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stories, project }) }),
  importFile: async (file: File) => { const body = new FormData(); body.append('file', file); return request<{ stories: string[] }>('/api/import', { method: 'POST', body }); }
};
