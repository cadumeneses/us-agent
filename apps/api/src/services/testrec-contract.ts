import { canonicalJson, snapshotContent } from '../domain/content-snapshot.js';
import { createRecommendationInputValidator, definitionTaxonomyReferences, memoryDatasetSchema, parseRecommenderDefinition,
  type RecommendationInput, type RecommenderDefinitionVersion } from '../domain/recommender-definition.js';
import { resolveTaxonomies } from '../domain/recommender-taxonomy.js';
import { snapshotTestCaseCatalog } from '../domain/test-case-catalog.js';

export const TESTREC_CONTRACT = 'testrec_e21_data_contract_v1';
const slots = {
  story_id: { type: 'text', scope: 'artifact', cardinality: 'single', required: true, role: 'context', representation: 'none' },
  module: { type: 'category', scope: 'artifact', cardinality: 'single', required: true, role: 'feature', representation: 'presence' },
  operation: { type: 'category', scope: 'artifact', cardinality: 'single', required: true, role: 'feature', representation: 'presence' },
  platforms: { type: 'category', scope: 'project', cardinality: 'many', required: true, role: 'feature', representation: 'presence' },
  application_domain: { type: 'category', scope: 'project', cardinality: 'single', required: true, role: 'feature', representation: 'presence' },
  acceptance_criteria: { type: 'category', scope: 'artifact', cardinality: 'many', required: true, role: 'feature', representation: 'presence' },
  nfrs: { type: 'category', scope: 'project', cardinality: 'many', required: true, role: 'feature', representation: 'presence' },
  test_case_ids: { type: 'category', scope: 'artifact', cardinality: 'many', required: false, role: 'output', representation: 'none' }
} as const;
type Slot = keyof typeof slots;
const parameters = { status: 'data_contract_only', reference: 'E21', representation: 'target_binary_presence', k: 3, similarity: 'pending_Q01', aggregation: 'pending_Q02' };

function definitionContract(raw: unknown) {
  const definition = parseRecommenderDefinition(raw);
  if (definition.state !== 'draft' || definition.method.id !== TESTREC_CONTRACT || definition.method.version !== 'contract.1' || canonicalJson(definition.method.parameters) !== canonicalJson(parameters)) {
    throw new Error('Somente o contrato de rascunho E21 é suportado; a recomendação aguarda Q01/Q02.');
  }
  const bindings = definition.method.bindings;
  if (Object.keys(bindings).length !== Object.keys(slots).length || new Set(Object.values(bindings)).size !== Object.keys(slots).length) throw new Error('Vínculos do contrato E21 devem ser completos e distintos.');
  for (const [slot, expected] of Object.entries(slots)) {
    const attribute = definition.attributes.find(item => item.id === bindings[slot]);
    if (!attribute) throw new Error(`Vínculo E21 ausente: ${slot}`);
    const type = attribute.valueType.type === 'taxonomy_node' ? 'category' : attribute.valueType.type;
    const { scope, cardinality, required, role, representation } = attribute;
    if (canonicalJson({ type, scope, cardinality, required, role, representation }) !== canonicalJson(expected)) throw new Error(`Atributo incompatível com o vínculo E21: ${slot}`);
    if (slot === 'test_case_ids' && attribute.valueType.type !== 'category') throw new Error('IDs de testes apontam ao catálogo de artefatos, não a uma taxonomia.');
  }
  const bound = new Set(Object.values(bindings));
  for (const attribute of definition.attributes) if (!bound.has(attribute.id) && attribute.role !== 'context') throw new Error(`Cálculo adicional E21 não implementado: ${attribute.id}`);
  return definition;
}

function values(input: RecommendationInput, definition: RecommenderDefinitionVersion, slot: Slot): string[] {
  const raw = input.values[definition.method.bindings[slot]];
  if (raw === undefined && slot === 'test_case_ids') return [];
  const items = Array.isArray(raw) ? raw as string[] : [raw as string];
  if (items.some(value => typeof value !== 'string' || !value.trim() || value !== value.trim())) throw new Error(`Valores E21 inválidos em ${slot}.`);
  return items;
}

/** Shared definition/input/taxonomy contracts; no ranking, eligibility, distance or item aggregation. */
export function inspectTestrecData(rawDefinition: unknown, rawTarget: unknown, rawDataset: unknown, rawCatalog?: unknown, rawTaxonomies: readonly unknown[] = []) {
  const definition = definitionContract(rawDefinition);
  const dependencies = resolveTaxonomies(definitionTaxonomyReferences(definition), rawTaxonomies);
  const validate = createRecommendationInputValidator(definition, dependencies);
  const target = validate(rawTarget);
  canonicalJson(rawDataset);
  const parsed = memoryDatasetSchema.parse(rawDataset);
  const dataset = { ...parsed, records: parsed.records.map(record => validate(record)) };
  const catalog = rawCatalog === undefined ? null : snapshotTestCaseCatalog(rawCatalog);
  const catalogIds = new Set(catalog?.content.items.map(item => item.id) ?? []);
  const profiles = [target, ...dataset.records];
  const associations = (input: RecommendationInput) => {
    const raw = input.values[definition.method.bindings.test_case_ids];
    if (raw === undefined) return { state: 'not_provided' as const, ids: null };
    const ids = values(input, definition, 'test_case_ids');
    if (new Set(ids).size !== ids.length) throw new Error('Associação de caso de teste duplicada.');
    if (ids.some(id => !catalogIds.has(id))) throw new Error('Caso de teste sem catálogo ou ID de origem inexistente.');
    return { state: 'known' as const, ids };
  };
  const featureSlots = ['module', 'operation', 'platforms', 'application_domain', 'acceptance_criteria', 'nfrs'] as const;
  for (const input of profiles) {
    values(input, definition, 'story_id');
    for (const slot of featureSlots) values(input, definition, slot);
    if (!values(input, definition, 'platforms').length) throw new Error('Informe ao menos uma plataforma E21.');
    associations(input);
  }
  const storyIds = dataset.records.map(input => values(input, definition, 'story_id')[0]);
  if (new Set(storyIds).size !== storyIds.length) throw new Error('História duplicada na base E21.');
  const dimensions = featureSlots.flatMap(slot => [...new Set(values(target, definition, slot))].map(value => ({ slot, value,
    label: slots[slot].cardinality === 'single' ? slot : `${slot}:${value}` })));
  const vector = (input: RecommendationInput) => dimensions.map(dimension => values(input, definition, dimension.slot).includes(dimension.value) ? 1 : 0);
  return snapshotContent({ schemaVersion: 1, mode: 'data_contract_only', canRecommend: false, definition: snapshotContent(definition),
    taxonomies: snapshotContent(dependencies), target: snapshotContent(target), dataset: snapshotContent(dataset), catalog,
    representation: { dimensions, targetVector: vector(target), candidates: dataset.records.map(input => ({ recordId: input.id,
      sameStory: values(input, definition, 'story_id')[0] === values(target, definition, 'story_id')[0], vector: vector(input), tests: associations(input) })) },
    pending: ['Q01_similarity', 'Q02_aggregation', 'original_associations_and_catalogs', 'execution_policy_not_implemented'] });
}
