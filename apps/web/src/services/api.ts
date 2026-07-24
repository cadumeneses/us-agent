import type { ApplicationContext, Classification, Dashboard, QualityPlan, Story, Taxonomy } from '../types/models';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? 'Falha na comunicação com a API');
  }
  return response.json() as Promise<T>;
}

export const api = {
  dashboard: () => request<Dashboard>('/api/dashboard'),
  stories: () => request<Story[]>('/api/stories'),
  taxonomy: () => request<Taxonomy>('/api/taxonomy'),
  context: () => request<ApplicationContext>('/api/context'),
  qualityPlans: () => request<QualityPlan[]>('/api/quality-plans'),
  saveQualityPlan: (plan: QualityPlan, status: 'draft' | 'approved') =>
    request<{ id: string; status: string; updatedAt: string; updatedBy: string }>(`/api/quality-plans/${plan.story.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status,
        questions: plan.questions,
        acceptanceCriteria: plan.acceptanceCriteria,
        testCases: plan.testCases
      })
    }),
  classify: (stories: string[], project: string) => request<{ runId: string; results: Classification[] }>(
    '/api/classify',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stories, project })
    }
  ),
  importFile: (file: File) => {
    const body = new FormData();
    body.append('file', file);
    return request<{ filename: string; stories: string[] }>('/api/import', { method: 'POST', body });
  },
  review: (id: string, input: { action: 'approve'; module: string; operation: string; notes?: string } | { action: 'taxonomy_gap'; notes?: string }) =>
    request<{ id: string; status: string }>(`/api/classifications/${id}/review`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    })
};
