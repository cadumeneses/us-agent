import type { ConfiguredInput, ConfiguredRun, ContentReference, DefinitionPublication, ImportPreview, ImportRecord, ImportSpec, JsonValue, Snapshot } from './configurable-recommendations';

export const TEST_CASE_METHOD = 'us_agent_e21_equations_demo_v1';
export type TestArtifact = { id: string; title: string; gherkin: string; purpose?: string;
  executionMode?: 'manual' | 'automated' | 'unspecified'; metadata?: Record<string, JsonValue> };
export type TestCaseCatalog = { schemaVersion: 1; id: string; version: string;
  source: { kind: 'synthetic' | 'source_example'; reference: string }; items: TestArtifact[] };
export type TestCasePublication = { schemaVersion: 1; importerVersion: string; id: string; version: string;
  catalog: Snapshot<TestCaseCatalog>; file: { name: string; byteLength: number; sha256: string; encoding: 'utf-8'; bom: boolean };
  authorization: { basis: ImportSpec['source']['authorization']['basis']; reference: string } };
export type TestCaseCatalogRecord = { state: 'published' | 'retired'; snapshot: Snapshot<TestCasePublication>;
  publishedBy: string; publishedAt: string; retiredAt: string | null };
export type TestCaseCatalogSummary = { id: string; version: string; state: 'published' | 'retired'; itemCount: number;
  source: TestCaseCatalog['source']; snapshot: Pick<Snapshot<unknown>, 'format' | 'sha256'> };
export type TestCaseImportSpec = Omit<ImportSpec, 'schemaVersion'> & { schemaVersion: 2; catalog: ContentReference };
export type TestCaseImportPreview = Omit<ImportPreview, 'schemaVersion' | 'importerVersion' | 'spec'> & {
  schemaVersion: 2; importerVersion: 'test-case-dataset-import-v1'; spec: TestCaseImportSpec; catalog: Snapshot<TestCasePublication> };
export type MethodImportSpec = ImportSpec | TestCaseImportSpec;
export type MethodImportRecord = ImportRecord | { id: string; snapshot: Snapshot<TestCaseImportPreview>; createdBy: string; createdAt: string };
export type TestCaseRequest = { id: string; definition: ContentReference; dataset: ContentReference; catalog: ContentReference; input: ConfiguredInput };
export type TestNeighbor = { recordId: string; vector: number[]; distance: number; similarity: number; testCaseIds: string[] };
export type TestCaseResult = { method: string; k: number; mode: 'equation_demonstration'; scientificReproduction: false;
  status: 'completed' | 'blocked' | 'no_items'; messages: string[]; neighbors: TestNeighbor[];
  items: Array<{ key: string; testCaseId: string; support: number; numerator: number; denominator: number; score: number;
    contributions: Array<{ recordId: string; similarity: number }>; artifact: TestArtifact }> };
export type TestCaseRun = Omit<ConfiguredRun, 'snapshot'> & { snapshot: Snapshot<{
  schemaVersion: 2; request: Snapshot<TestCaseRequest>; definition: Snapshot<DefinitionPublication>;
  dataset: Snapshot<ConfiguredRun['snapshot']['content']['dataset']['content'] & { schemaVersion: 2; catalog: ContentReference }>;
  catalog: Snapshot<TestCasePublication>; result: Snapshot<TestCaseResult>;
  projection: Snapshot<{ bridge: Snapshot<JsonValue>; representation: { dimensions: Array<{ slot: string; value: string; label: string }>; targetVector: number[];
    candidates: Array<{ recordId: string; vector: number[]; sameStory: boolean; tests: { state: string; ids: string[] | null } }> } }>;
  explanation: Snapshot<{ rules: Record<string, string>; issues: Array<{ code: string; recordIds: string[] }>;
    excluded: Array<{ recordId: string; code: string }>; ranked: TestNeighbor[] }>;
  software: ConfiguredRun['snapshot']['content']['software'];
}> };
export type MethodRun = ConfiguredRun | TestCaseRun;
export const isTestCaseRun = (run: MethodRun): run is TestCaseRun => run.snapshot.content.schemaVersion === 2;
