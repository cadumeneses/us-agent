import { z } from 'zod';
import { canonicalJson, snapshotContent } from '../domain/content-snapshot.js';
import { contentReferenceSchema } from '../domain/dataset-import.js';
import { datasetPublicationSchema } from '../domain/dataset-publication.js';
import { parseDefinitionPublication } from '../domain/definition-publication.js';
import { createRecommendationInputValidator, parseRecommenderDefinition, recommendationInputSchema, type AttributeDefinition, type RecommendationInput } from '../domain/recommender-definition.js';
import { KNN_KERNEL_VERSION, rankNeighbors } from './knn.js';

export const CONFIGURABLE_KNN = 'configurable_project_knn_v1';
export const CONFIGURABLE_KNN_ADAPTER = 'configurable-project-knn-v1';
const profileSource = z.enum(['platforms', 'applicationDomains', 'architectures', 'objective', 'technologies.languages', 'technologies.frameworks', 'technologies.apis', 'technologies.dataPersistence']);
export const configurableParameters = z.strictObject({
  k: z.number().int().min(1).max(100),
  representation: z.literal('symmetric_binary_presence'), distance: z.literal('weighted_manhattan'),
  vocabulary: z.literal('target_and_dataset'), missing_features: z.literal('reject'),
  tie_break: z.literal('record_id'), aggregation: z.literal('neighbor_union'),
  weights: z.record(z.string(), z.number().positive().max(1000)),
  profile_sources: z.record(z.string(), profileSource)
});
export const configurableRequestSchema = z.strictObject({ id: z.uuid(), definition: contentReferenceSchema,
  dataset: contentReferenceSchema, input: recommendationInputSchema });

export function validateConfigurableDefinition(raw: unknown, taxonomies?: readonly unknown[]) {
  const definition = parseRecommenderDefinition(raw);
  if (definition.method.id !== CONFIGURABLE_KNN || definition.method.version !== '1') throw new Error('Unsupported configurable method version.');
  const parameters = configurableParameters.parse(definition.method.parameters);
  if (Object.keys(definition.method.bindings).length) throw new Error('This method uses attribute roles; fixed method bindings are not supported.');
  const features = definition.attributes.filter(attribute => attribute.role === 'feature');
  const outputs = definition.attributes.filter(attribute => attribute.role === 'output');
  if (!features.length || !outputs.length) throw new Error('Declare at least one feature and one output.');
  for (const attribute of definition.attributes) {
    if (attribute.scope !== 'project' || attribute.role === 'filter') throw new Error('This method accepts project attributes with feature, context, or output roles.');
    if (attribute.role === 'feature' && (!attribute.required || attribute.valueType.type === 'record')) throw new Error('Features must be required categorical, enum, or taxonomy values; records are not supported.');
    if (attribute.role === 'output' && (!attribute.required || attribute.cardinality !== 'many' || attribute.valueType.type !== 'text')) throw new Error('Outputs must be required lists of text. A known empty list is allowed.');
  }
  if (Object.keys(parameters.weights).length !== features.length || features.some(attribute => !Object.hasOwn(parameters.weights, attribute.id))) throw new Error('Declare exactly one positive weight for each feature.');
  for (const id of Object.keys(parameters.profile_sources)) {
    const attribute = definition.attributes.find(item => item.id === id);
    if (!attribute || attribute.role === 'output' || attribute.valueType.type !== 'category') throw new Error('Profile sources require a category attribute; taxonomy IDs need explicit user selection.');
    const single = parameters.profile_sources[id] === 'objective';
    if ((attribute.cardinality === 'single') !== single) throw new Error('The profile source cardinality differs from its attribute.');
  }
  if (taxonomies !== undefined) createRecommendationInputValidator(definition, taxonomies);
  return { definition, parameters, features, outputs };
}

function categories(attribute: AttributeDefinition, input: RecommendationInput): string[] {
  const raw = input.values[attribute.id];
  const values = (attribute.cardinality === 'many' ? raw : [raw]) as string[];
  if (!values.length || values.some(value => typeof value !== 'string' || !value.trim())) throw new Error(`Complete the feature: ${attribute.name}. Empty does not mean a known absence.`);
  return [...new Set(values)].sort();
}

/** Symmetric binary representation; all feature IDs, values, and weights come from configuration. */
export function executeConfigurableRecommendation(rawRequest: unknown, rawPublication: unknown, rawDataset: unknown) {
  canonicalJson(rawRequest);
  const request = configurableRequestSchema.parse(rawRequest);
  const definition = snapshotContent(parseDefinitionPublication(rawPublication));
  const dataset = snapshotContent(datasetPublicationSchema.parse(rawDataset));
  const { parameters, features, outputs } = validateConfigurableDefinition(definition.content.definition, definition.content.taxonomies);
  if (definition.content.implementation.adapterVersion !== CONFIGURABLE_KNN_ADAPTER) throw new Error('The published adapter is not installed.');
  const ref = (id: string, version: string, snapshot: { format: string; sha256: string }) => ({ id, version, format: snapshot.format, sha256: snapshot.sha256 });
  if (canonicalJson(request.definition) !== canonicalJson(ref(definition.content.definition.id, definition.content.definition.version, definition)) ||
      canonicalJson(request.dataset) !== canonicalJson(ref(dataset.content.id, dataset.content.version, dataset)) ||
      canonicalJson(dataset.content.definition) !== canonicalJson(request.definition)) throw new Error('The selected versions or publication hashes differ.');
  const validate = createRecommendationInputValidator(definition.content.definition, definition.content.taxonomies);
  const input = validate(request.input);
  if (outputs.some(attribute => !Array.isArray(input.values[attribute.id]) || (input.values[attribute.id] as unknown[]).length)) throw new Error('Query outputs must be empty lists; they are recommendations, not comparison features.');
  if (dataset.content.records.length > 10_000) throw new Error('The dataset exceeds 10,000 records.');
  const records = dataset.content.records.map(row => validate(row));
  if (new Set(records.map(row => row.id)).size !== records.length) throw new Error('Dataset record IDs must be unique.');
  for (const row of records) for (const attribute of outputs) {
    if ((row.values[attribute.id] as string[]).some(value => !value.trim())) throw new Error(`Empty output text in record ${row.id}.`);
  }
  const target = new Map(features.map(attribute => [attribute.id, categories(attribute, input)]));
  const candidates = records.map(row => ({ row, values: new Map(features.map(attribute => [attribute.id, categories(attribute, row)])) }));
  // Freeze the vocabulary with the execution. Extras in a candidate count as mismatches too.
  const dimensions = features.flatMap(attribute => {
    const vocabulary = new Set(target.get(attribute.id));
    for (const candidate of candidates) for (const value of candidate.values.get(attribute.id)!) vocabulary.add(value);
    return [...vocabulary].sort().map(value => ({ attributeId: attribute.id, value, weight: parameters.weights[attribute.id] }));
  });
  if (dimensions.length * (records.length + 1) > 2_000_000) throw new Error('Execution exceeds 2,000,000 dimension comparisons.');
  const vector = (values: Map<string, string[]>) => dimensions.map(dimension => values.get(dimension.attributeId)!.includes(dimension.value) ? 1 : 0);
  const targetVector = vector(target);
  const totalWeight = dimensions.reduce((sum, dimension) => sum + dimension.weight, 0);
  const ranking = rankNeighbors({ row: input, values: target }, candidates, parameters.k, {
    dimensions: () => dimensions.map((_, index) => String(index)),
    eligibility: (query, candidate) => query.row.id === candidate.row.id ? [{ code: 'same_record', message: 'The query record is excluded.' }] : [],
    vector: candidate => vector(candidate.values),
    measure: candidateVector => {
      const distance = dimensions.reduce((sum, dimension, index) => sum + Math.abs(targetVector[index] - candidateVector[index]) * dimension.weight, 0);
      return { distance, similarity: 1 - distance / totalWeight };
    },
    compareTies: (a, b) => a.row.id < b.row.id ? -1 : a.row.id > b.row.id ? 1 : 0
  });
  const excluded = ranking.excluded.map(({ candidate }) => ({ recordId: candidate.row.id, reason: 'same_record' }));
  const ranked = ranking.ranked.map(({ candidate, vector: candidateVector, distance, similarity }) => {
    const contributions = features.map(attribute => {
      const indexes = dimensions.flatMap((dimension, index) => dimension.attributeId === attribute.id ? [index] : []);
      const distance = indexes.reduce((sum, index) => sum + Math.abs(targetVector[index] - candidateVector[index]) * dimensions[index].weight, 0);
      return { attributeId: attribute.id, weight: parameters.weights[attribute.id], distance };
    });
    return { recordId: candidate.row.id, vector: candidateVector, distance, similarity, contributions };
  });
  const neighbors = ranked.slice(0, parameters.k);
  const items = new Map<string, { key: string; attributeId: string; text: string; support: number; recordIds: string[] }>();
  for (const neighbor of neighbors) {
    const row = records.find(record => record.id === neighbor.recordId)!;
    for (const attribute of outputs) for (const text of new Set(row.values[attribute.id] as string[])) {
      const key = snapshotContent({ attributeId: attribute.id, text }).sha256;
      const item = items.get(key) ?? { key, attributeId: attribute.id, text, support: 0, recordIds: [] };
      item.support++; item.recordIds.push(row.id); items.set(key, item);
    }
  }
  const resultItems = [...items.values()].sort((a, b) => b.support - a.support || (a.key < b.key ? -1 : 1));
  return { schemaVersion: 3 as const, request: snapshotContent(request), definition, dataset,
    projection: snapshotContent({ dimensions, targetVector, totalWeight }),
    result: snapshotContent({ method: CONFIGURABLE_KNN, k: parameters.k, scientificReproduction: false,
      status: !neighbors.length ? 'no_candidates' as const : !items.size ? 'no_items' as const : 'completed' as const,
      neighbors, items: resultItems }),
    explanation: snapshotContent({ policy: { distance: 'weighted-binary-manhattan', normalization: 'sum-of-dimension-weights',
      vocabulary: 'target-and-complete-dataset', tieBreak: 'record-id-codepoint-ascending', aggregation: 'union-of-neighbor-outputs',
      emptyFeatures: 'reject', missingOutputs: 'reject', selfExclusion: 'exact-record-id' }, ranked, excluded }),
    software: { adapterVersion: CONFIGURABLE_KNN_ADAPTER, definitionAdapterVersion: CONFIGURABLE_KNN_ADAPTER,
      policyVersion: 'weighted-presence-union-v1', kernelVersion: KNN_KERNEL_VERSION } };
}
export type ConfigurableRecommendationContent = ReturnType<typeof executeConfigurableRecommendation>;
