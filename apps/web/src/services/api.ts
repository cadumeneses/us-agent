import type { ApplicationContext, Classification, Dashboard, ProjectSprint, QualityPlan, ReviewContext, Story, StoryDetails, Taxonomy } from '../types/models';

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
  sprints: () => request<ProjectSprint[]>('/api/sprints'),
  taxonomy: (version?: string) => request<Taxonomy>(`/api/taxonomy${version ? `?version=${encodeURIComponent(version)}` : ''}`),
  addTaxonomyOperation: (input: { domain?: string; module: string; operation: string; description: string; version?: string }) => request<Taxonomy>('/api/taxonomy/operations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }),
  addTaxonomyDomain: (input: { domain: string; description: string; version?: string }) => request<Taxonomy>('/api/taxonomy/domains', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }),
  applyFallbackSuggestion: (id: string) => request<{ status: 'applied' | 'already_applied'; taxonomy: Taxonomy }>(`/api/taxonomy/fallback-suggestions/${id}/apply`, { method: 'POST' }),
  createTaxonomyVersion: (version: string) => request<Taxonomy>('/api/taxonomy/versions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version }) }),
  context: () => request<ApplicationContext>('/api/context'),
  qualityPlans: () => request<QualityPlan[]>('/api/quality-plans'),
  createQualityPlanScope: (project: string, sprint: string, storyIds: string[]) => request<QualityPlan>('/api/quality-plans/scopes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project, sprint, storyIds })
  }),
  saveQualityPlan: (plan: QualityPlan, status: 'draft' | 'approved') =>
    request<{ id: string; status: string; updatedAt: string; updatedBy: string }>(`/api/quality-plans/${plan.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status,
        storyIds: plan.stories.map(story => story.id),
        questions: plan.questions,
        acceptanceCriteria: plan.acceptanceCriteria,
        testCases: plan.testCases
      })
    }),
  storyDetails: (id: string) => request<StoryDetails>(`/api/classifications/${id}/details`),
  reviewContext: (id: string) => request<ReviewContext>(`/api/classifications/${id}/review-context`),
  saveStoryDetails: (id: string, details: StoryDetails) => request<StoryDetails>(`/api/classifications/${id}/details`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(details) }),
  classify: (stories: string[], project: string, sprint: string, mode: string) => request<{ runId: string; results: Classification[] }>(
    '/api/classify',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stories, project, sprint, mode })
    }
  ),
  importFile: (file: File) => {
    const body = new FormData();
    body.append('file', file);
    return request<{ filename: string; stories: string[] }>('/api/import', { method: 'POST', body });
  },
  review: (id: string, input: { action: 'approve'; module: string; operation: string; notes?: string } | {
    action: 'taxonomy_gap';
    notes?: string;
    taxonomyFeedback?: {
      proposalType: 'new_domain' | 'new_module' | 'new_operation' | 'clarify_story';
      proposedDomain?: string;
      targetDomain?: string;
      proposedModule?: string;
      targetModule?: string;
      proposedOperation?: string;
      justification: string;
    };
  }) =>
    request<{ id: string; status: string }>(`/api/classifications/${id}/review`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    })
};
