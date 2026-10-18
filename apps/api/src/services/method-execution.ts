import { z } from 'zod';
import { canonicalJson, snapshotContent } from '../domain/content-snapshot.js';
import { parseDefinitionPublication } from '../domain/definition-publication.js';
import { contentReferenceSchema } from '../domain/dataset-import.js';
import { recommendationInputSchema, validateRecommendationInput } from '../domain/recommender-definition.js';
import { snapshotTestCasePublication } from '../domain/test-case-publication-integrity.js';
import { testCaseDatasetSchema } from '../domain/test-case-dataset.js';
import { executePublishedRecommendation, recommendationRequestSchema, type RecommendationContent } from './recommendation-execution.js';
import { E21_EQUATIONS_DEMO, runTestrecEquationDemo } from './testrec-equations.js';
import { TESTREC_ADAPTER_VERSION, TESTREC_POLICY_VERSION, testrecContractProjection, validateTestrecDefinition } from './testrec-method.js';
import { KNN_KERNEL_VERSION } from './knn.js';
import { RNF_ADAPTER_VERSION } from './configured-nfr.js';
import { RNF_POLICY_VERSION } from './rnf-policy.js';

export const testCaseRecommendationRequestSchema = z.strictObject({ id: z.uuid(), definition: contentReferenceSchema,
  dataset: contentReferenceSchema, catalog: contentReferenceSchema, input: recommendationInputSchema });
export const methodRecommendationRequestSchema = z.union([recommendationRequestSchema, testCaseRecommendationRequestSchema]);

export function executeTestCaseRecommendation(rawRequest: unknown, rawDefinition: unknown, rawDataset: unknown, rawCatalog: unknown) {
  canonicalJson(rawRequest);
  const request = testCaseRecommendationRequestSchema.parse(rawRequest);
  const definition = snapshotContent(parseDefinitionPublication(rawDefinition));
  const dataset = snapshotContent(testCaseDatasetSchema.parse(rawDataset));
  const catalog = snapshotTestCasePublication(rawCatalog);
  const ref = (id: string, version: string, sha256: string, format: string) => ({ id, version, sha256, format });
  if (canonicalJson(request.definition) !== canonicalJson(ref(definition.content.definition.id, definition.content.definition.version, definition.sha256, definition.format))) throw new Error('Definition differs from the execution reference.');
  if (canonicalJson(request.dataset) !== canonicalJson(ref(dataset.content.id, dataset.content.version, dataset.sha256, dataset.format)) ||
      canonicalJson(dataset.content.definition) !== canonicalJson(request.definition)) throw new Error('Dataset does not belong to the selected definition publication.');
  if (canonicalJson(request.catalog) !== canonicalJson(ref(catalog.content.id, catalog.content.version, catalog.sha256, catalog.format)) ||
      canonicalJson(dataset.content.catalog) !== canonicalJson(request.catalog)) throw new Error('Catalog does not match the exact dataset dependency.');
  const configured = validateTestrecDefinition(definition.content.definition, definition.content.taxonomies);
  if (definition.content.implementation.adapterVersion !== TESTREC_ADAPTER_VERSION) throw new Error('Published E21 adapter is not installed.');
  if (dataset.content.source.authorization.basis !== 'synthetic' || catalog.content.catalog.content.source.kind !== 'synthetic') throw new Error('The E21 equation demonstration accepts synthetic data only.');
  const input = validateRecommendationInput(configured, request.input, definition.content.taxonomies);
  const dimensions = configured.attributes.filter(attribute => attribute.role === 'feature').reduce((sum, attribute) => {
    const value = input.values[attribute.id]; return sum + (Array.isArray(value) ? new Set(value).size : 1);
  }, 0);
  if (dataset.content.records.length > 10_000 || dimensions * dataset.content.records.length > 2_000_000) throw new Error('Execution exceeds 10,000 records or 2,000,000 dimension comparisons.');
  if (dataset.content.records.some(row => row.values[configured.method.bindings.test_case_ids] === undefined)) throw new Error('Published test associations must be known; missing output is not an empty list.');
  const demo = runTestrecEquationDemo(testrecContractProjection(configured), input, {
    id: dataset.content.id, version: dataset.content.version, source: dataset.content.source.description, records: dataset.content.records
  }, catalog.content.catalog.content, definition.content.taxonomies);
  const value = demo.content;
  const status = value.status === 'no_test_cases' ? 'no_items' : value.status;
  const result = snapshotContent({ method: E21_EQUATIONS_DEMO, k: 3, mode: 'equation_demonstration', scientificReproduction: false,
    status, messages: value.issues.map(issue => `${issue.code}: ${issue.recordIds.join(', ')}`),
    neighbors: value.neighbors, items: value.items.map(item => ({ ...item, key: snapshotContent({ catalog: request.catalog, testCaseId: item.testCaseId }).sha256 })) });
  return { schemaVersion: 2 as const, request: snapshotContent(request), definition, dataset, catalog,
    projection: snapshotContent({ bridge: value.input.content.definition, representation: value.input.content.representation }), result,
    explanation: snapshotContent({ rules: value.rules, issues: value.issues, excluded: value.excluded, ranked: value.ranked }),
    software: { adapterVersion: TESTREC_ADAPTER_VERSION, definitionAdapterVersion: definition.content.implementation.adapterVersion,
      policyVersion: TESTREC_POLICY_VERSION, kernelVersion: KNN_KERNEL_VERSION,
      runtime: { node: process.version, icu: process.versions.icu ?? 'unknown', locale: new Intl.Collator().resolvedOptions().locale } } };
}
export type TestCaseRecommendationContent = ReturnType<typeof executeTestCaseRecommendation>;
export type MethodRecommendationContent = RecommendationContent | TestCaseRecommendationContent;

/** Composition preserves the original RNF executor and its historical snapshots byte for byte. */
export function executeMethodRecommendation(request: unknown, rawDefinition: unknown, dataset: unknown, catalog?: unknown): MethodRecommendationContent {
  const definition = parseDefinitionPublication(rawDefinition);
  if (definition.definition.method.id === E21_EQUATIONS_DEMO) return executeTestCaseRecommendation(request, definition, dataset, catalog);
  if (catalog !== undefined) throw new Error('The RNF method does not accept a test catalog.');
  return executePublishedRecommendation(request, definition, dataset);
}
export function canReplayMethod(content: MethodRecommendationContent) {
  return content.software.kernelVersion === KNN_KERNEL_VERSION && (content.schemaVersion === 1
    ? content.software.adapterVersion === RNF_ADAPTER_VERSION && content.software.policyVersion === RNF_POLICY_VERSION
    : content.software.adapterVersion === TESTREC_ADAPTER_VERSION && content.software.policyVersion === TESTREC_POLICY_VERSION);
}
