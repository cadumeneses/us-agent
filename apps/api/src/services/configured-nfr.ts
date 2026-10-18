import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { canonicalJson, freezeJson, snapshotContent } from '../domain/content-snapshot.js';
import {
  createRecommendationInputValidator, definitionTaxonomyReferences, memoryDatasetSchema, parseRecommenderDefinition, validateRecommendationInput,
  type AttributeDefinition, type RecommendationInput
} from '../domain/recommender-definition.js';
import { resolveTaxonomies, taxonomyIdSchema, type TaxonomyDependency } from '../domain/recommender-taxonomy.js';
import { NFR_METHOD, recommendNfr, type Label, type Nfr, type NfrProfile } from './nfr-engine.js';
import { compareRnfClassificationIds } from './rnf-policy.js';

export const RNF_ADAPTER_VERSION = 'rnf-v2-profile-adapter-v3';

type SlotContract = Pick<AttributeDefinition, 'valueType' | 'scope' | 'cardinality' | 'role' | 'representation'>;
const singleText = { valueType: { type: 'text' }, scope: 'artifact', cardinality: 'single', role: 'context', representation: 'none' } as const;
const projectFeature = { valueType: { type: 'category' }, scope: 'project', cardinality: 'many', role: 'feature', representation: 'presence' } as const;
// These semantic slots are the contract of this scientific method, not a universal vector.
const slots = {
  classification_id: singleText, story_id: singleText, text: singleText, project: { ...singleText, scope: 'project' },
  taxonomy_version: singleText, review_status: { ...singleText, role: 'filter' },
  project_taxonomy_version: { ...singleText, scope: 'project' },
  labels: { valueType: { type: 'record', fields: { module: { type: 'category' }, operation: { type: 'category' } } },
    scope: 'artifact', cardinality: 'many', role: 'filter', representation: 'none' },
  platforms: projectFeature, application_domains: projectFeature, architectures: projectFeature,
  languages: projectFeature, frameworks: projectFeature, apis: projectFeature, data_persistence: projectFeature,
  objective: { valueType: { type: 'enum', values: ['', 'product', 'prototype'] }, scope: 'project', cardinality: 'single', role: 'filter', representation: 'none' },
  tasks: { valueType: { type: 'record', fields: { category: { type: 'category' } } },
    scope: 'artifact', cardinality: 'many', role: 'feature', representation: 'presence' },
  nfrs: { valueType: { type: 'record', fields: { type: { type: 'category' }, attribute: { type: 'category' }, sentence: { type: 'text' } } },
    scope: 'artifact', cardinality: 'many', role: 'output', representation: 'none' }
} satisfies Record<string, SlotContract>;
type Slot = keyof typeof slots;
const methodSchema = z.strictObject({
  id: z.literal(NFR_METHOD), version: z.literal('2'), parameters: z.strictObject({ k: z.literal(1),
    legacy_names: z.record(z.string().regex(/^[a-z][a-z0-9_-]*(\.[a-z][a-z0-9_-]*)?$/), z.record(taxonomyIdSchema,
      z.string().min(1).refine(value => value.trim() === value, 'Nome legado não pode ter espaços externos.'))).optional() }),
  bindings: z.strictObject(Object.fromEntries(Object.keys(slots).map(slot => [slot, z.string()])) as Record<Slot, z.ZodString>)
});

function prepareDefinition(raw: unknown) {
  const definition = parseRecommenderDefinition(raw);
  const method = methodSchema.parse(definition.method);
  if (new Set(Object.values(method.bindings)).size !== Object.keys(slots).length) {
    throw new Error('Cada vínculo RNF deve usar um atributo distinto.');
  }
  const bound = new Set(Object.values(method.bindings));
  const mappedTypes = new Map<string, Extract<AttributeDefinition['valueType'], { type: 'taxonomy_node' }>>();
  for (const [slot, contract] of Object.entries(slots)) {
    const attribute = definition.attributes.find(item => item.id === method.bindings[slot as Slot])!;
    const { valueType, scope, cardinality, role, representation } = attribute;
    const projectType = (type: AttributeDefinition['valueType'], path: string): AttributeDefinition['valueType'] => {
      if (type.type === 'taxonomy_node') { mappedTypes.set(path, type); return { type: 'category' }; }
      if (type.type === 'record') return { type: 'record', fields: Object.fromEntries(Object.entries(type.fields).map(([field, value]) => [field, projectType(value, `${path}.${field}`)])) as Extract<AttributeDefinition['valueType'], { type: 'record' }>['fields'] };
      return type;
    };
    if (!attribute.required || canonicalJson({ valueType: projectType(valueType, attribute.id), scope, cardinality, role, representation }) !== canonicalJson(contract)) {
      throw new Error(`Atributo incompatível com o vínculo ${slot} do método ${NFR_METHOD}.`);
    }
  }
  const legacyNames = method.parameters.legacy_names ?? {};
  for (const path of Object.keys(legacyNames)) if (!mappedTypes.has(path)) throw new Error(`Mapeamento legado sem campo científico taxonômico: ${path}`);
  for (const path of mappedTypes.keys()) {
    const mapping = legacyNames[path];
    if (!mapping || !Object.keys(mapping).length) throw new Error(`Informe o mapeamento explícito legacy_names para ${path}.`);
    if (new Set(Object.values(mapping)).size !== Object.values(mapping).length) throw new Error(`Mapeamento ambíguo de nomes legados: ${path}`);
  }
  for (const attribute of definition.attributes) {
    if (!bound.has(attribute.id) && (attribute.role !== 'context' || attribute.representation !== 'none')) {
      throw new Error(`O método RNF v2 não implementa o atributo de cálculo adicional ${attribute.id}; configure-o como contexto ou implemente outro método versionado.`);
    }
  }
  return { definition, bindings: method.bindings, mappedTypes, legacyNames };
}

/** Validate implemented method semantics independently from the publication lifecycle. */
export function validateConfiguredNfrDefinition(raw: unknown, rawTaxonomies?: readonly unknown[]) {
  const prepared = prepareDefinition(raw);
  if (rawTaxonomies !== undefined) {
    const dependencies = resolveTaxonomies(definitionTaxonomyReferences(prepared.definition), rawTaxonomies);
    validateMappings(prepared, dependencies);
  }
  return prepared.definition;
}

function validateMappings(prepared: ReturnType<typeof prepareDefinition>, dependencies: TaxonomyDependency[]) {
  for (const [path, type] of prepared.mappedTypes) {
    const content = dependencies.find(dependency => dependency.snapshot.content.id === type.taxonomy.id && dependency.snapshot.content.version === type.taxonomy.version)!.snapshot.content;
    const parents = new Set(content.nodes.map(node => node.parentId));
    const selectable = new Set(content.nodes.filter(node => content.selection === 'any' || !parents.has(node.id)).map(node => node.id));
    const mapping = prepared.legacyNames[path];
    if (Object.keys(mapping).length !== selectable.size || Object.keys(mapping).some(id => !selectable.has(id))) throw new Error(`Mapeamento ${path} deve cobrir exatamente os nós selecionáveis da taxonomia.`);
  }
}

function prepareDraft(raw: unknown) {
  const prepared = prepareDefinition(raw);
  if (prepared.definition.state !== 'draft') throw new Error('Simulação aceita somente rascunhos; consulta de publicações e reexecução histórica usam serviços próprios.');
  return prepared;
}

function projectAttribute(attribute: AttributeDefinition, raw: unknown, mapping: Record<string, Record<string, string>>, inverse = false): unknown {
  const scalar = (type: AttributeDefinition['valueType'], value: unknown, path: string): unknown => {
    if (type.type === 'taxonomy_node') {
      const converted = inverse ? Object.entries(mapping[path]).find(([, name]) => name === value)?.[0] : mapping[path][String(value)];
      if (converted === undefined) throw new Error(`Valor sem correspondência explícita em ${path}: ${String(value)}`);
      return converted;
    }
    if (type.type === 'record') return Object.fromEntries(Object.entries(type.fields).map(([field, fieldType]) => [field, scalar(fieldType, (value as Record<string, unknown>)[field], `${path}.${field}`)]));
    return value;
  };
  return attribute.cardinality === 'many' ? (raw as unknown[]).map(value => scalar(attribute.valueType, value, attribute.id)) : scalar(attribute.valueType, raw, attribute.id);
}

function toProfile(input: RecommendationInput, prepared: ReturnType<typeof prepareDefinition>): NfrProfile {
  const { definition, bindings, legacyNames } = prepared;
  const projected = Object.fromEntries(Object.values(bindings).map(id => [id, projectAttribute(definition.attributes.find(attribute => attribute.id === id)!, input.values[id], legacyNames)]));
  // Types/shapes were validated against every semantic slot before this conversion.
  const read = <T>(slot: Slot) => projected[bindings[slot]] as T;
  return {
    classificationId: read<string>('classification_id'), storyId: read<string>('story_id'),
    text: read<string>('text'), project: read<string>('project'), taxonomyVersion: read<string>('taxonomy_version'),
    reviewStatus: read<string>('review_status'), labels: read<Label[]>('labels'),
    projectProfile: {
      taxonomyVersion: read<string>('project_taxonomy_version'), platforms: read<string[]>('platforms'),
      applicationDomains: read<string[]>('application_domains'), architectures: read<string[]>('architectures'),
      objective: read<'' | 'product' | 'prototype'>('objective'),
      technologies: { languages: read<string[]>('languages'), frameworks: read<string[]>('frameworks'),
        apis: read<string[]>('apis'), dataPersistence: read<string[]>('data_persistence') }
    }, tasks: read<{ category: string }[]>('tasks'), nfrs: read<Nfr[]>('nfrs')
  };
}

/** Compatibility bridge for existing snapshots. New input can be constructed directly from attributes. */
export function legacyNfrInput(rawDefinition: unknown, profile: NfrProfile, id: string, source: string, rawTaxonomies: readonly unknown[] = []): RecommendationInput {
  const prepared = prepareDraft(rawDefinition);
  const { definition, bindings, legacyNames } = prepared;
  validateMappings(prepared, resolveTaxonomies(definitionTaxonomyReferences(definition), rawTaxonomies));
  const p = profile.projectProfile;
  const values: Record<Slot, RecommendationInput['values'][string]> = {
    classification_id: profile.classificationId, story_id: profile.storyId, text: profile.text,
    project: profile.project, taxonomy_version: profile.taxonomyVersion, review_status: profile.reviewStatus,
    project_taxonomy_version: p.taxonomyVersion, platforms: p.platforms, application_domains: p.applicationDomains,
    objective: p.objective, architectures: p.architectures, languages: p.technologies.languages,
    frameworks: p.technologies.frameworks, apis: p.technologies.apis, data_persistence: p.technologies.dataPersistence,
    tasks: profile.tasks, nfrs: profile.nfrs, labels: profile.labels
  };
  return validateRecommendationInput(definition, { id, provenance: { source },
    values: Object.fromEntries(Object.entries(bindings).map(([slot, attributeId]) => [attributeId,
      projectAttribute(definition.attributes.find(attribute => attribute.id === attributeId)!, values[slot as Slot], legacyNames, true)])) }, rawTaxonomies);
}

/** Pure validation/projection used by both simulation and published execution. Lifecycle is checked by the caller. */
export function prepareConfiguredNfr(rawDefinition: unknown, rawInput: unknown, rawDataset: unknown, rawTaxonomies: readonly unknown[] = []) {
  const prepared = prepareDefinition(rawDefinition), { definition } = prepared;
  const taxonomies = resolveTaxonomies(definitionTaxonomyReferences(definition), rawTaxonomies);
  validateMappings(prepared, taxonomies);
  const validateInput = createRecommendationInputValidator(definition, taxonomies);
  const input = validateInput(rawInput);
  canonicalJson(rawDataset);
  const parsed = memoryDatasetSchema.parse(rawDataset);
  const dataset = { ...parsed, records: parsed.records.map(record => validateInput(record)) };
  const target = toProfile(input, prepared), history = dataset.records.map(record => toProfile(record, prepared));
  if (new Set(history.map(profile => profile.classificationId)).size !== history.length || new Set(history.map(profile => profile.storyId)).size !== history.length) throw new Error('Base RNF requer uma única classificação por história e IDs de classificação distintos.');
  const tieIds = history.map(profile => profile.classificationId).sort(compareRnfClassificationIds);
  if (tieIds.some((id, index) => index > 0 && compareRnfClassificationIds(tieIds[index - 1], id) === 0)) throw new Error('IDs de classificação ambíguos para o desempate legado; use identificadores distintos também na comparação numérica/textual.');
  return { definition, input, dataset, taxonomies, target, history };
}

/** In-memory simulation only: no database access, publication, provider or implicit reference base. */
export function simulateConfiguredNfr(rawDefinition: unknown, rawInput: unknown, rawDataset: unknown, labelIndex: number, rawTaxonomies: readonly unknown[] = []) {
  const started = performance.now();
  z.number().parse(labelIndex);
  prepareDraft(rawDefinition);
  const { definition, taxonomies, input, dataset, target, history } = prepareConfiguredNfr(rawDefinition, rawInput, rawDataset, rawTaxonomies);
  const result = recommendNfr(target, history, labelIndex);
  const snapshots = {
    definition: snapshotContent(definition), input: snapshotContent(input), dataset: snapshotContent(dataset),
    selection: snapshotContent({ labelIndex }), result: snapshotContent(result)
  };
  return freezeJson({
    schemaVersion: 1 as const, id: randomUUID(), mode: 'simulation' as const,
    recordedAt: new Date().toISOString(), durationMs: performance.now() - started,
    software: { adapterVersion: RNF_ADAPTER_VERSION, engineMethod: NFR_METHOD },
    normalization: 'preserve-values-v1' as const,
    taxonomies: snapshotContent(taxonomies),
    ...snapshots
  });
}

export type ConfiguredNfrSimulation = ReturnType<typeof simulateConfiguredNfr>;
