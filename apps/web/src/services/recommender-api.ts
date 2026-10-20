import type { ConfiguredRun, DatasetSummary, DefinitionRecord, DefinitionSummary, RecommendationRequest, ReplayResult, RunSummary } from '../types/configurable-recommendations';
import type { ConfiguredDefinition, ConfiguredTaxonomy, DatasetRecord, TaxonomyRecord, TaxonomySummary } from '../types/configurable-recommendations';
import type { BindTargetRequest, ClassificationDestination, ItemDecision, ItemDecisionRequest, RecommendationReview, RunTarget, Snapshot, NfrCopy, NfrCopyRequest } from '../types/configurable-recommendations';
import { TEST_CASE_METHOD, type MethodRun, type MethodImportRecord, type MethodImportSpec, type TestCaseCatalogRecord, type TestCaseCatalogSummary, type TestCaseRequest, type TestCaseRun } from '../types/test-case-recommendations';
import type { TestReview, TestItemReview, TestTargetRecord, TestDecisionRequest, TestDecisionRecord, TestCopyRequest, TestCopyRecord } from '../types/test-case-assessments';
import { notifySessionExpired } from './web-session';
import { CONFIGURABLE_KNN, type ProjectRecommendationRequest, type ProjectRecommendationRun, type ProjectRecommenderProfile } from '../types/project-recommendations';
import { organizationOptions } from './organization';

export class RecommenderApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api/internal/${path}`, { ...organizationOptions(options), credentials: 'same-origin' });
  if (!response.ok) {
    notifySessionExpired(response.status);
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
export const supportsWebMethod = (method: string) => method === 'ramos_2019_manhattan_k1_v2' || method === TEST_CASE_METHOD || method === CONFIGURABLE_KNN;
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
  executeTestCases: (input: TestCaseRequest) => request<TestCaseRun>('recommendation-runs', json('POST', input)),
  executeProject: (input: ProjectRecommendationRequest) => request<ProjectRecommendationRun>('recommendation-runs', json('POST', input)),
  projectProfile: (project: string, definition: import('../types/configurable-recommendations').ContentReference, signal?: AbortSignal) => request<ProjectRecommenderProfile>('project-recommender-profile/load', { ...json('POST', { project, definition }), signal }),
  saveProjectProfile: (project: string, definition: import('../types/configurable-recommendations').ContentReference, revision: number, values: import('../types/configurable-recommendations').ConfiguredInput['values']) => request<ProjectRecommenderProfile>('project-recommender-profile', json('PUT', { project, definition, revision, values })),
  publishedRun: async (id: string, signal?: AbortSignal) => {
    const record = await request<MethodRun>(`recommendation-runs/${encodeURIComponent(id)}`, { signal });
    const content = record.snapshot.content;
    if (!(content.schemaVersion === 1 || content.schemaVersion === 2 && content.result.content.method === TEST_CASE_METHOD || content.schemaVersion === 3 && content.result.content.method === CONFIGURABLE_KNN)) throw apiOnly();
    return record;
  },
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
  previewDataset: (spec: MethodImportSpec, file: File) => {
    const body = new FormData(); body.set('spec', JSON.stringify(spec)); body.set('file', file);
    return request<MethodImportRecord>('recommender-datasets/imports/preview', { method: 'POST', body });
  },
  datasetImport: async (id: string) => {
    const record = await request<MethodImportRecord>(`recommender-datasets/imports/${encodeURIComponent(id)}`);
    if (!supportsWebMethod(record.snapshot.content.definition.content.definition.method.id)) throw apiOnly();
    return record;
  },
  publishDataset: (id: string, version: string, importId: string, previewSha256: string, excludedOrdinals: number[]) => request<DatasetRecord>(`recommender-datasets/${versionPath(id, version)}/publish`, json('POST', { importId, previewSha256, excludedOrdinals })),
  testCaseCatalogs: (offset = 0, signal?: AbortSignal) => request<TestCaseCatalogSummary[]>(`test-case-catalogs?limit=${PAGE_SIZE}&offset=${offset}`, { signal }),
  testCaseCatalog: (id: string, version: string, signal?: AbortSignal) => request<TestCaseCatalogRecord>(`test-case-catalogs/${versionPath(id, version)}`, { signal }),
  publishTestCaseCatalog: (id: string, version: string, file: File, expectedFileSha256: string, reference: string) => {
    const body = new FormData(); body.set('file', file);
    body.set('spec', JSON.stringify({ expectedFileSha256, authorization: { basis: 'synthetic', reference } }));
    return request<TestCaseCatalogRecord>(`test-case-catalogs/${versionPath(id, version)}/publish`, { method: 'POST', body });
  },
  review: (id: string, signal?: AbortSignal) => request<RecommendationReview>(`recommendation-runs/${encodeURIComponent(id)}/review`, { signal }),
  destination: (id: string, classificationId: string) => request<Snapshot<ClassificationDestination>>(`recommendation-runs/${encodeURIComponent(id)}/destinations/${encodeURIComponent(classificationId)}`),
  bindTarget: (id: string, input: BindTargetRequest) => request<RunTarget>(`recommendation-runs/${encodeURIComponent(id)}/target`, json('POST', input)),
  decideItem: (id: string, input: ItemDecisionRequest) => request<ItemDecision>(`recommendation-runs/${encodeURIComponent(id)}/decisions`, json('POST', input)),
  saveNfrCopy: (id: string, input: NfrCopyRequest) => request<NfrCopy>(`recommendation-runs/${encodeURIComponent(id)}/copies`, json('POST', input)),
  testReview: (id: string, signal?: AbortSignal) => request<TestReview>(`test-case-reviews/${encodeURIComponent(id)}`, { signal }),
  testItemReview: (id: string, itemKey: string, offset = 0, signal?: AbortSignal) => request<TestItemReview>(`test-case-reviews/${encodeURIComponent(id)}/items/${encodeURIComponent(itemKey)}?limit=5&offset=${offset}`, { signal }),
  confirmTestTarget: (id: string, runSha256: string) => request<TestTargetRecord>(`test-case-reviews/${encodeURIComponent(id)}/target`, json('POST', { runSha256, target: { kind: 'input' } })),
  decideTest: (id: string, input: TestDecisionRequest) => request<TestDecisionRecord>(`test-case-reviews/${encodeURIComponent(id)}/decisions`, json('POST', input)),
  saveTestCopy: (id: string, input: TestCopyRequest) => request<TestCopyRecord>(`test-case-reviews/${encodeURIComponent(id)}/copies`, json('POST', input))
};
