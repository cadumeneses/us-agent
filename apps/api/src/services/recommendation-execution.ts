import { z } from 'zod';
import { canonicalJson, snapshotContent, type ContentSnapshot } from '../domain/content-snapshot.js';
import { parseDefinitionPublication } from '../domain/definition-publication.js';
import { contentReferenceSchema } from '../domain/dataset-import.js';
import { recommendationInputSchema } from '../domain/recommender-definition.js';
import { prepareConfiguredNfr, RNF_ADAPTER_VERSION, validateConfiguredNfrDefinition } from './configured-nfr.js';
import { datasetPublicationSchema } from '../domain/dataset-publication.js';
import { recommendWithRnfPolicy, RNF_POLICY_VERSION } from './rnf-policy.js';
import { KNN_KERNEL_VERSION } from './knn.js';
import { profileFeatures } from './nfr-engine.js';

export const recommendationRequestSchema = z.strictObject({
  id: z.uuid(), definition: contentReferenceSchema, dataset: contentReferenceSchema,
  input: recommendationInputSchema, selection: z.strictObject({ labelIndex: z.number() })
});
export type RecommendationRequest = z.infer<typeof recommendationRequestSchema>;

/** Pure published execution: all dependencies are passed explicitly; no history or database lookup. */
export function executePublishedRecommendation(rawRequest: unknown, rawDefinition: unknown, rawDataset: unknown) {
  canonicalJson(rawRequest);
  const request = recommendationRequestSchema.parse(rawRequest);
  const definition = snapshotContent(parseDefinitionPublication(rawDefinition));
  const dataset = snapshotContent(datasetPublicationSchema.parse(rawDataset));
  const refMatches = (ref: RecommendationRequest['definition'], snapshot: ContentSnapshot<{ id: string; version: string }>) =>
    ref.id === snapshot.content.id && ref.version === snapshot.content.version && ref.format === snapshot.format && ref.sha256 === snapshot.sha256;
  if (request.definition.id !== definition.content.definition.id || request.definition.version !== definition.content.definition.version ||
      request.definition.format !== definition.format || request.definition.sha256 !== definition.sha256) throw new Error('Definição não corresponde à referência da execução.');
  if (!refMatches(request.dataset, dataset) || canonicalJson(dataset.content.definition) !== canonicalJson(request.definition)) throw new Error('A base selecionada não pertence à publicação exata da definição.');
  const declaredAdapter = definition.content.implementation.adapterVersion;
  if (!['rnf-v2-profile-adapter-v2', RNF_ADAPTER_VERSION].includes(declaredAdapter)) throw new Error('Implementação publicada não é suportada por este executor.');
  if (declaredAdapter === 'rnf-v2-profile-adapter-v2' && definition.content.definition.method.parameters.legacy_names !== undefined) throw new Error('Adaptador v2 não suporta mapeamento científico de IDs.');
  validateConfiguredNfrDefinition(definition.content.definition, definition.content.taxonomies);
  const prepared = prepareConfiguredNfr(definition.content.definition, request.input, {
    id: dataset.content.id, version: dataset.content.version, source: dataset.content.source.description, records: dataset.content.records
  }, definition.content.taxonomies);
  if (profileFeatures(prepared.target).length * prepared.history.length > 2_000_000) throw new Error('Execução excede o limite explícito de 2.000.000 comparações de dimensões.');
  const { result, explanation } = recommendWithRnfPolicy(prepared.target, prepared.history, request.selection.labelIndex);
  const recordIds = new Map(prepared.history.map((profile, index) => [profile.classificationId, prepared.dataset.records[index].id]));
  const detailed = { ...explanation, candidates: explanation.candidates.map(candidate => ({ ...candidate, datasetRecordId: recordIds.get(candidate.classificationId)! })) };
  return {
    schemaVersion: 1 as const, request: snapshotContent(request), definition, dataset,
    projection: snapshotContent({ target: prepared.target, history: prepared.history }),
    result: snapshotContent(result), explanation: snapshotContent(detailed),
    software: { adapterVersion: RNF_ADAPTER_VERSION, definitionAdapterVersion: declaredAdapter, policyVersion: RNF_POLICY_VERSION, kernelVersion: KNN_KERNEL_VERSION,
      runtime: { node: process.version, icu: process.versions.icu ?? 'unknown', locale: new Intl.Collator().resolvedOptions().locale } }
  };
}
export type RecommendationContent = ReturnType<typeof executePublishedRecommendation>;
