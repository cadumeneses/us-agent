import type { ConfiguredRun, DatasetSummary, DefinitionRecord, DefinitionSummary, RecommendationRequest, ReplayResult, RunSummary } from '../types/configurable-recommendations';
import type { ConfiguredDefinition, ConfiguredTaxonomy, DatasetRecord, ImportRecord, ImportSpec, TaxonomyRecord, TaxonomySummary } from '../types/configurable-recommendations';
import type { BindTargetRequest, ClassificationDestination, ItemDecision, ItemDecisionRequest, RecommendationReview, RunTarget, Snapshot } from '../types/configurable-recommendations';

export class RecommenderApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api/internal/${path}`, { ...options, credentials: 'same-origin' });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string; issues?: Array<{ path?: Array<string | number>; message: string }> };
    const details = body.issues?.slice(0, 12).map(issue => `${issue.path?.join('.') || 'Input'}: ${issue.message}`).join('\n');
    const message = response.status === 401
      ? 'Restricted access: this environment requires authorization for configurable recommenders.'
      : body.error ?? 'Could not communicate with the recommenders.';
    throw new RecommenderApiError(response.status, details ? `${message}\n${details}` : message);
  }
  return response.json() as Promise<T>;
}
const versionPath = (id: string, version: string) => `${encodeURIComponent(id)}/versions/${encodeURIComponent(version)}`;
const PAGE_SIZE = 50;
const json = (method: string, body: unknown): RequestInit => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
export const supportsWebMethod = (method: string) => method === 'ramos_2019_manhattan_k1_v2';
const apiOnly = () => new RecommenderApiError(422, 'This method is currently available through the API. Its web interface is pending implementation.');
export const recommenderApi = {
  pageSize: PAGE_SIZE,
  definitions: (offset = 0, signal?: AbortSignal) => request<DefinitionSummary[]>(`recommender-definitions?state=published&limit=${PAGE_SIZE}&offset=${offset}`, { signal }),
  definition: async (id: string, version: string, signal?: AbortSignal) => {
    const record = await request<DefinitionRecord>(`recommender-definitions/${versionPath(id, version)}`, { signal });
    if (!supportsWebMethod(record.definition.method.id)) throw apiOnly();
    return record;
  },
  datasets: (offset = 0, signal?: AbortSignal) => request<DatasetSummary[]>(`recommender-datasets?state=published&limit=${PAGE_SIZE}&offset=${offset}`, { signal }),
  execute: (input: RecommendationRequest) => request<ConfiguredRun>('recommendation-runs', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input)
  }),
  runs: (offset = 0, signal?: AbortSignal) => request<RunSummary[]>(`recommendation-runs?limit=${PAGE_SIZE}&offset=${offset}`, { signal }),
  run: async (id: string, signal?: AbortSignal) => {
    const record = await request<ConfiguredRun>(`recommendation-runs/${encodeURIComponent(id)}`, { signal });
    if (record.snapshot.content.schemaVersion !== 1) throw apiOnly();
    return record;
  },
  replay: (id: string) => request<ReplayResult>(`recommendation-runs/${encodeURIComponent(id)}/replay`, { method: 'POST' }),
  definitionVersions: (offset = 0, signal?: AbortSignal) => request<DefinitionSummary[]>(`recommender-definitions?limit=${PAGE_SIZE}&offset=${offset}`, { signal }),
  saveDefinition: (definition: ConfiguredDefinition) => request<DefinitionRecord>(`recommender-definitions/${versionPath(definition.id, definition.version)}`, json('PUT', definition)),
  publishDefinition: (id: string, version: string, expectedDraftSha256: string) => request<DefinitionRecord>(`recommender-definitions/${versionPath(id, version)}/publish`, json('POST', { expectedDraftSha256 })),
  taxonomyVersions: (offset = 0, signal?: AbortSignal) => request<TaxonomySummary[]>(`recommender-taxonomies?limit=${PAGE_SIZE}&offset=${offset}`, { signal }),
  taxonomyVersion: (id: string, version: string, signal?: AbortSignal) => request<TaxonomyRecord>(`recommender-taxonomies/${versionPath(id, version)}`, { signal }),
  saveTaxonomy: (taxonomy: ConfiguredTaxonomy) => request<TaxonomyRecord>(`recommender-taxonomies/${versionPath(taxonomy.id, taxonomy.version)}`, json('PUT', taxonomy)),
  publishTaxonomy: (id: string, version: string, expectedDraftSha256: string) => request<TaxonomyRecord>(`recommender-taxonomies/${versionPath(id, version)}/publish`, json('POST', { expectedDraftSha256 })),
  previewDataset: (spec: ImportSpec, file: File) => {
    const body = new FormData(); body.set('spec', JSON.stringify(spec)); body.set('file', file);
    return request<ImportRecord>('recommender-datasets/imports/preview', { method: 'POST', body });
  },
  datasetImport: async (id: string) => {
    const record = await request<ImportRecord>(`recommender-datasets/imports/${encodeURIComponent(id)}`);
    if (record.snapshot.content.schemaVersion !== 1) throw apiOnly();
    return record;
  },
  publishDataset: (id: string, version: string, importId: string, previewSha256: string, excludedOrdinals: number[]) => request<DatasetRecord>(`recommender-datasets/${versionPath(id, version)}/publish`, json('POST', { importId, previewSha256, excludedOrdinals })),
  review: (id: string, signal?: AbortSignal) => request<RecommendationReview>(`recommendation-runs/${encodeURIComponent(id)}/review`, { signal }),
  destination: (id: string, classificationId: string) => request<Snapshot<ClassificationDestination>>(`recommendation-runs/${encodeURIComponent(id)}/destinations/${encodeURIComponent(classificationId)}`),
  bindTarget: (id: string, input: BindTargetRequest) => request<RunTarget>(`recommendation-runs/${encodeURIComponent(id)}/target`, json('POST', input)),
  decideItem: (id: string, input: ItemDecisionRequest) => request<ItemDecision>(`recommendation-runs/${encodeURIComponent(id)}/decisions`, json('POST', input))
};
