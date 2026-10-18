import type { NfrRun } from './nfr';

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type Snapshot<T> = { format: 'us-agent-json-v1'; sha256: string; content: T };
export type ContentReference = Pick<Snapshot<unknown>, 'format' | 'sha256'> & { id: string; version: string };
export type ScalarType = { type: 'text' | 'category' | 'number' | 'boolean' }
  | { type: 'enum'; values: string[] } | { type: 'taxonomy_node'; taxonomy: ContentReference };
export type ValueType = ScalarType | { type: 'record'; fields: Record<string, ScalarType> };
export type ConfiguredAttribute = {
  id: string; name: string; valueType: ValueType; scope: 'project' | 'artifact'; cardinality: 'single' | 'many';
  required: boolean; role: 'feature' | 'filter' | 'output' | 'context'; representation: 'none' | 'presence';
};
export type ConfiguredDefinition = {
  schemaVersion: 1; id: string; version: string; name: string; state: 'draft' | 'published' | 'retired';
  attributes: ConfiguredAttribute[];
  method: { id: string; version: string; parameters: Record<string, JsonValue>; bindings: Record<string, string> };
};
export type TaxonomyDependency = {
  state: 'published' | 'retired';
  snapshot: Snapshot<{ schemaVersion: 1; id: string; version: string; name: string; kind: 'list' | 'tree';
    selection: 'any' | 'leaf'; source: string; nodes: Array<{ id: string; name: string; description: string; parentId: string | null }> }>;
};
export type DefinitionPublication = { schemaVersion: 1; definition: ConfiguredDefinition; taxonomies: TaxonomyDependency[];
  implementation: { methodId: string; adapterVersion: string } };
export type DefinitionSummary = {
  id: string; version: string; name: string; state: 'draft' | 'published' | 'retired'; method: string;
  attributeCount: number; snapshot: Pick<Snapshot<unknown>, 'format' | 'sha256'> | null;
};
export type DefinitionRecord = { state: DefinitionSummary['state']; definition: ConfiguredDefinition;
  snapshot: Snapshot<DefinitionPublication> | null; draftSha256?: string };
export type DatasetSummary = {
  id: string; version: string; state: 'published' | 'retired'; definition: ContentReference; recordCount: number;
  snapshot: Pick<Snapshot<unknown>, 'format' | 'sha256'>; publishedBy: string; publishedAt: string;
};
export type ConfiguredInput = { id: string; values: Record<string, JsonValue>;
  provenance: { source: string; sourceRecordId?: string } };
export type RecommendationRequest = { id: string; definition: ContentReference; dataset: ContentReference;
  input: ConfiguredInput; selection: { labelIndex: number } };
export type RecommendationResult = Pick<NfrRun, 'method' | 'k' | 'status' | 'label' | 'messages' | 'dimensions' | 'eligibleCount' | 'excludedCount' | 'neighbor' | 'items'>;
export type ConfiguredRun = {
  id: string; createdBy: string; createdAt: string; durationMs: number;
  snapshot: Snapshot<{
    schemaVersion: 1; request: Snapshot<RecommendationRequest>; definition: Snapshot<DefinitionPublication>;
    dataset: Snapshot<{ id: string; version: string; definition: ContentReference;
      source: { description: string; authorization: { basis: string; reference: string } };
      import: { id: string; previewSha256: string; fileSha256: string }; records: ConfiguredInput[] }>;
    projection: Snapshot<JsonValue>; result: Snapshot<RecommendationResult>;
    explanation: Snapshot<{ policy: { id: string; method: string; k: number };
      candidates: Array<{ datasetRecordId: string; classificationId: string; storyId: string; eligible: boolean;
        rank: number | null; vector: number[]; distance: number | null; similarity: number | null;
        issues: Array<{ code: string; message: string }> }> }>;
    software: { adapterVersion: string; definitionAdapterVersion: string; policyVersion: string; kernelVersion: string;
      runtime: { node: string; icu: string; locale: string } };
  }>;
};
export type RunSummary = { id: string; definition: { id: string; version: string }; dataset: { id: string; version: string };
  status: RecommendationResult['status']; durationMs: number; snapshot: Pick<Snapshot<unknown>, 'format' | 'sha256'>;
  createdBy: string; createdAt: string };
export type ReplayResult = { id: string; originalSha256: string; verified: boolean;
  resultMatches: boolean; explanationMatches: boolean; projectionMatches: boolean };

export type ConfiguredTaxonomy = TaxonomyDependency['snapshot']['content'];
export type TaxonomyRecord = { state: 'draft' | 'published' | 'retired'; snapshot: Snapshot<ConfiguredTaxonomy> };
export type TaxonomySummary = { id: string; version: string; name: string; state: TaxonomyRecord['state'];
  kind: 'list' | 'tree'; nodeCount: number; snapshot: Pick<Snapshot<unknown>, 'format' | 'sha256'> };
export type ImportSpec = {
  schemaVersion: 1; id: string; version: string; definition: ContentReference; format: 'csv' | 'json'; delimiter?: ',' | ';' | '\t';
  source: { description: string; authorization: { basis: 'synthetic' | 'public-license' | 'permission' | 'owned'; reference: string } };
  mapping: { recordId: string[]; attributes: Record<string, { path: string[]; encoding: 'value' | 'json' }> };
};
export type ImportIssue = { path: Array<string | number>; code: string; message: string };
export type ImportPreview = {
  schemaVersion: 1; importerVersion: 'structured-import-v1'; spec: ImportSpec;
  file: { name: string; byteLength: number; sha256: string; encoding: 'utf-8'; bom: boolean };
  definition: Snapshot<DefinitionPublication>;
  fields: Array<{ id: string; role: string; required: boolean; cardinality: string; path: string[] | null }>;
  report: { fatal: ImportIssue[]; sourceFields: string[]; unmappedSourceFields: string[]; total: number; valid: number; invalid: number; duplicate: number;
    rows: Array<{ ordinal: number; line: number | null; id: string | null; status: 'valid' | 'invalid' | 'duplicate'; issues: ImportIssue[]; input: ConfiguredInput | null }> };
};
export type ImportRecord = { id: string; snapshot: Snapshot<ImportPreview>; createdBy: string; createdAt: string };
export type DatasetRecord = { state: 'published' | 'retired'; snapshot: ConfiguredRun['snapshot']['content']['dataset'] };

export type ClassificationDestination = { classificationId: string; storyId: string; projectId: string; project: string; text: string;
  reviewStatus: string; taxonomyVersion: string; latest: boolean; labels: Array<{ module: string; operation: string }>; projectProfile: unknown; tasks: unknown[] };
export type BindTargetRequest = { runSha256: string; target: { kind: 'input' } | { kind: 'classification'; classificationId: string; expectedSha256: string; justification: string } };
export type RunTarget = { snapshot: Snapshot<{ schemaVersion: 1; run: { id: string; format: 'us-agent-json-v1'; sha256: string };
  request: BindTargetRequest; input: Snapshot<ConfiguredInput>; destination: { kind: 'input'; scopeSha256: string } |
  { kind: 'classification'; snapshot: Snapshot<ClassificationDestination>; justification: string } }>; createdBy: string; createdAt: string };
export type ItemDecisionRequest = { id: string; runSha256: string; targetSha256: string; itemKey: string; decision: 'accepted' | 'rejected'; notes: string };
export type ItemDecision = { id: string; snapshot: Snapshot<{ schemaVersion: 1; run: { id: string; format: 'us-agent-json-v1'; sha256: string };
  target: { format: 'us-agent-json-v1'; sha256: string }; request: Snapshot<ItemDecisionRequest>; originalItem: RecommendationResult['items'][number];
  association: null | { identitySha256: string; materialization: 'input_only' | 'created' | 'already_present' } }>; createdBy: string; createdAt: string };
export type RecommendationReview = { runId: string; runSha256: string; target: RunTarget | null; decisions: ItemDecision[] };
