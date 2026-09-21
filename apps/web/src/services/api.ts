import type { ApplicationContext, Classification, Dashboard, ProjectSprint, ReviewContext, Story, StoryDetails, Taxonomy } from '../types/models';
import type { ProjectResearchProfile } from '../types/models';
import type { NfrContext, NfrRun } from '../types/nfr';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? 'Falha na comunicação com a API');
  }
  return response.json() as Promise<T>;
}

export const api = {
  nfrContext: (id: string) => request<NfrContext>(`/api/classifications/${id}/nfr-context`),
  nfrRuns: (id: string) => request<NfrRun[]>(`/api/classifications/${id}/nfr-runs`),
  recommendNfr: (id: string, labelIndex: number) => request<NfrRun>(`/api/classifications/${id}/nfr-runs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ labelIndex }) }),
  decideNfr: (runId: string, itemKey: string, decision: 'accepted' | 'rejected') => request<{ decision: string }>(`/api/nfr-runs/${runId}/decisions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemKey, decision }) }),
  projectResearchProfile: (project: string) => request<ProjectResearchProfile>(`/api/project-research-profile?project=${encodeURIComponent(project)}`),
  saveProjectResearchProfile: (project: string, profile: ProjectResearchProfile) => request<ProjectResearchProfile>(`/api/project-research-profile?project=${encodeURIComponent(project)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profile) }),
  dashboard: () => request<Dashboard>('/api/dashboard'),
  stories: () => request<Story[]>('/api/stories?limit=10000'),
  sprints: () => request<ProjectSprint[]>('/api/sprints'),
  createSprint: (input: { project: string; name: string; status?: ProjectSprint['status'] }) => request<ProjectSprint>('/api/sprints', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }),
  updateSprintStatus: (id: string, status: ProjectSprint['status']) => request<ProjectSprint>(`/api/sprints/${id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) }),
  assignStoriesToSprint: (id: string, classificationIds: string[]) => request<{ sprintId: string; classificationIds: string[] }>(`/api/sprints/${id}/stories`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ classificationIds }) }),
  taxonomy: (version?: string) => request<Taxonomy>(`/api/taxonomy${version ? `?version=${encodeURIComponent(version)}` : ''}`),
  addTaxonomyOperation: (input: { domain?: string; module: string; operation: string; description: string; version?: string }) => request<Taxonomy>('/api/taxonomy/operations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }),
  addTaxonomyDomain: (input: { domain: string; description: string; version?: string }) => request<Taxonomy>('/api/taxonomy/domains', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }),
  applyFallbackSuggestion: (id: string) => request<{ status: 'applied' | 'already_applied'; taxonomy: Taxonomy }>(`/api/taxonomy/fallback-suggestions/${id}/apply`, { method: 'POST' }),
  applyTaxonomyFeedback: (id: string) => request<{ status: 'applied' | 'already_applied'; taxonomy: Taxonomy }>(`/api/taxonomy/feedback/${id}/apply`, { method: 'POST' }),
  createTaxonomyVersion: (version: string) => request<Taxonomy>('/api/taxonomy/versions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version }) }),
  context: () => request<ApplicationContext>('/api/context'),
  storyDetails: (id: string) => request<StoryDetails>(`/api/classifications/${id}/details`),
  reviewContext: (id: string) => request<ReviewContext>(`/api/classifications/${id}/review-context`),
  saveTaxonomyFeedback: (id: string, input: {
    proposalType: 'new_domain' | 'new_module' | 'new_operation' | 'clarify_story';
    proposedDomain?: string;
    targetDomain?: string;
    proposedModule?: string;
    targetModule?: string;
    proposedOperation?: string;
    justification: string;
  }) => request<{ id: string; status: 'applied' | 'needs_clarification'; taxonomy: Taxonomy }>(`/api/classifications/${id}/taxonomy-feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  }),
  saveStoryDetails: (id: string, details: StoryDetails) => request<StoryDetails>(`/api/classifications/${id}/details`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(details) }),
  classify: (stories: string[], project: string, sprint: string, mode: string, taxonomyVersion: string) => request<{ runId: string; results: Classification[] }>(
    '/api/classify',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stories, project, sprint, mode, taxonomyVersion })
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
  }) =>
    request<{ id: string; status: string }>(`/api/classifications/${id}/review`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    })
};
