import { canonicalJson } from '../domain/content-snapshot.js';
import { definitionTaxonomyReferences, parseRecommenderDefinition, type RecommendationInput } from '../domain/recommender-definition.js';
import { resolveTaxonomies } from '../domain/recommender-taxonomy.js';
import { TESTREC_CONTRACT } from './testrec-contract.js';
import { E21_EQUATIONS_DEMO } from './testrec-equations.js';

export const TESTREC_ADAPTER_VERSION = 'e21-equations-adapter-v1';
export const TESTREC_POLICY_VERSION = 'e21-equations-policy-v1';
export const TESTREC_PARAMETERS = {
  mode: 'equation_demonstration', reference: 'E21', scientific_reproduction: false, sources: 'synthetic_only',
  representation: 'target_binary_presence', k: 3, similarity: 'normalized_manhattan_eq4_2',
  aggregation: 'sum_similarity_over_k_eq4_3', tie: 'more_test_ids_then_ascending_record_id',
  eligibility: 'exclude_target_record_or_story', insufficient_candidates: 'block', unknown_associations: 'block',
  zero_similarity: 'keep', item_tie: 'ascending_test_id'
} as const;

// Explicit contract for the publishable demonstration; historical B15a remains unchanged.
const slots = {
  story_id: ['text', 'artifact', 'single', true, 'context', 'none'],
  module: ['category', 'artifact', 'single', true, 'feature', 'presence'],
  operation: ['category', 'artifact', 'single', true, 'feature', 'presence'],
  platforms: ['category', 'project', 'many', true, 'feature', 'presence'],
  application_domain: ['category', 'project', 'single', true, 'feature', 'presence'],
  acceptance_criteria: ['category', 'artifact', 'many', true, 'feature', 'presence'],
  nfrs: ['category', 'project', 'many', true, 'feature', 'presence'],
  test_case_ids: ['category', 'artifact', 'many', false, 'output', 'none']
};
export function validateTestrecDefinition(raw: unknown, rawTaxonomies?: readonly unknown[]) {
  const definition = parseRecommenderDefinition(raw);
  if (definition.method.id !== E21_EQUATIONS_DEMO || definition.method.version !== '1' ||
      canonicalJson(definition.method.parameters) !== canonicalJson(TESTREC_PARAMETERS)) throw new Error('Unsupported E21 demonstration method or parameters.');
  const bindings = definition.method.bindings;
  if (Object.keys(bindings).length !== Object.keys(slots).length || new Set(Object.values(bindings)).size !== Object.keys(slots).length) throw new Error('E21 bindings must be complete and distinct.');
  for (const [slot, expected] of Object.entries(slots)) {
    const attribute = definition.attributes.find(item => item.id === bindings[slot]);
    if (!attribute) throw new Error(`Missing E21 binding: ${slot}.`);
    const type = attribute.valueType.type === 'taxonomy_node' && slot !== 'test_case_ids' ? 'category' : attribute.valueType.type;
    if (canonicalJson([type, attribute.scope, attribute.cardinality, attribute.required, attribute.role, attribute.representation]) !== canonicalJson(expected)) throw new Error(`Incompatible E21 binding: ${slot}.`);
  }
  const bound = new Set(Object.values(bindings));
  for (const attribute of definition.attributes) if (!bound.has(attribute.id) && attribute.role !== 'context') throw new Error('Additional E21 calculation attributes are not implemented.');
  if (rawTaxonomies !== undefined) resolveTaxonomies(definitionTaxonomyReferences(definition), rawTaxonomies);
  return definition;
}

export class TestrecProfileError extends Error {
  constructor(public slot: string, message: string) { super(message); }
}
/** Per-row checks after generic input validation; the catalog index is built once per import. */
export function validateTestrecProfile(definition: ReturnType<typeof validateTestrecDefinition>, input: RecommendationInput, catalogIds: ReadonlySet<string>) {
  for (const slot of Object.keys(slots)) {
    const raw = input.values[definition.method.bindings[slot]];
    if (raw === undefined && slot === 'test_case_ids') throw new TestrecProfileError(slot, 'Test associations are unknown; provide an explicit list, including [] when known empty.');
    const values = Array.isArray(raw) ? raw : [raw];
    if (values.some(value => typeof value !== 'string' || !value.trim() || value !== value.trim())) throw new TestrecProfileError(slot, `Invalid E21 values in ${slot}.`);
    if (slot === 'platforms' && !values.length) throw new TestrecProfileError(slot, 'Provide at least one E21 platform.');
    if (slot === 'test_case_ids' && (new Set(values).size !== values.length || values.some(value => !catalogIds.has(value as string)))) {
      throw new TestrecProfileError(slot, 'Test associations must contain distinct IDs from the selected catalog.');
    }
  }
}

/** Internal bridge to the frozen data/vector/equation implementation, never a published identity. */
export function testrecContractProjection(raw: unknown, rawTaxonomies?: readonly unknown[]) {
  const definition = validateTestrecDefinition(raw, rawTaxonomies);
  return { ...definition, state: 'draft', method: { ...definition.method, id: TESTREC_CONTRACT, version: 'contract.1',
    parameters: { status: 'data_contract_only', reference: 'E21', representation: 'target_binary_presence', k: 3,
      similarity: 'pending_Q01', aggregation: 'pending_Q02' } } };
}
