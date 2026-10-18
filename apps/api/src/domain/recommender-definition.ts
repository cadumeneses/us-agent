import { z } from 'zod';
import { canonicalJson } from './content-snapshot.js';
import { resolveTaxonomies, taxonomyNodeValidator, taxonomyReferenceSchema, type TaxonomyDependency, type TaxonomyReference } from './recommender-taxonomy.js';

const identifier = z.string().regex(/^[a-z][a-z0-9_-]{0,79}$/);
const version = z.string().min(1).max(80).regex(/^\S+$/);
export const definitionIdentitySchema = z.strictObject({ id: identifier, version });
const scalarType = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('text') }),
  z.strictObject({ type: z.literal('category') }),
  z.strictObject({ type: z.literal('taxonomy_node'), taxonomy: taxonomyReferenceSchema }),
  z.strictObject({ type: z.literal('number') }),
  z.strictObject({ type: z.literal('boolean') }),
  z.strictObject({ type: z.literal('enum'), values: z.array(z.string()).min(1).max(100) })
]);
const valueType = z.union([scalarType,
  z.strictObject({ type: z.literal('record'), fields: z.record(identifier, scalarType) })
]);

export const attributeDefinitionSchema = z.strictObject({
  id: identifier, name: z.string().min(1).max(160), valueType,
  scope: z.enum(['project', 'artifact']), cardinality: z.enum(['single', 'many']),
  required: z.boolean(), role: z.enum(['feature', 'filter', 'output', 'context']),
  representation: z.enum(['none', 'presence'])
}).superRefine((attribute, context) => {
  const issue = (message: string) => context.addIssue({ code: 'custom', message });
  const types = attribute.valueType.type === 'record' ? Object.values(attribute.valueType.fields) : [attribute.valueType];
  if (!types.length) issue('Registro requer campos declarados.');
  for (const type of types) {
    if (type.type === 'enum' && new Set(type.values).size !== type.values.length) issue('Enum contém opções duplicadas.');
  }
  if (attribute.role === 'feature') {
    if (attribute.representation !== 'presence' || types.some(type => !['category', 'enum', 'taxonomy_node'].includes(type.type))) {
      issue('Característica requer categorias com representação explícita de presença; texto livre e números não têm codificação implementada.');
    }
  } else if (attribute.representation !== 'none') issue('Somente características podem declarar representação de presença.');
});
export type AttributeDefinition = z.infer<typeof attributeDefinitionSchema>;

export const recommenderDefinitionSchema = z.strictObject({
  schemaVersion: z.literal(1), id: identifier, version, name: z.string().min(1).max(160),
  state: z.enum(['draft', 'published', 'retired']),
  attributes: z.array(attributeDefinitionSchema).min(1).max(100),
  method: z.strictObject({
    id: z.string().min(1).max(120), version,
    parameters: z.record(identifier, z.json()), bindings: z.record(identifier, identifier)
  })
}).superRefine((definition, context) => {
  const ids = new Set<string>();
  for (const attribute of definition.attributes) {
    if (ids.has(attribute.id)) context.addIssue({ code: 'custom', message: `Atributo duplicado: ${attribute.id}` });
    ids.add(attribute.id);
  }
  for (const [slot, id] of Object.entries(definition.method.bindings)) {
    if (!ids.has(id)) context.addIssue({ code: 'custom', message: `Vínculo ${slot} aponta para atributo inexistente: ${id}` });
  }
});
export type RecommenderDefinitionVersion = z.infer<typeof recommenderDefinitionSchema>;

// No implicit US/project identifiers: each method declares what its values need.
export const recommendationInputSchema = z.strictObject({
  id: z.string().min(1).max(160), values: z.record(identifier, z.json()),
  provenance: z.strictObject({ source: z.string().min(1).max(500), sourceRecordId: z.string().min(1).max(160).optional() })
});
export type RecommendationInput = z.infer<typeof recommendationInputSchema>;
export const memoryDatasetSchema = z.strictObject({
  id: identifier, version, source: z.string().min(1).max(500),
  records: z.array(recommendationInputSchema)
}).superRefine((dataset, context) => {
  if (new Set(dataset.records.map(record => record.id)).size !== dataset.records.length) {
    context.addIssue({ code: 'custom', message: 'Base contém IDs de registro duplicados.' });
  }
});
export type MemoryDataset = z.infer<typeof memoryDatasetSchema>;

export function parseRecommenderDefinition(raw: unknown): RecommenderDefinitionVersion {
  canonicalJson(raw); // Reject silent losses (undefined, accessors, non-finite values) before parsing.
  return recommenderDefinitionSchema.parse(raw);
}

export function definitionTaxonomyReferences(definition: RecommenderDefinitionVersion): TaxonomyReference[] {
  return definition.attributes.flatMap(attribute => {
    const types = attribute.valueType.type === 'record' ? Object.values(attribute.valueType.fields) : [attribute.valueType];
    return types.flatMap(type => type.type === 'taxonomy_node' ? [type.taxonomy] : []);
  });
}

function valueSchema(type: AttributeDefinition['valueType'], taxonomies: readonly TaxonomyDependency[]): z.ZodType {
  switch (type.type) {
    case 'text': case 'category': return z.string();
    case 'number': return z.number();
    case 'boolean': return z.boolean();
    case 'taxonomy_node': return taxonomyNodeValidator(type.taxonomy, taxonomies);
    case 'enum': return z.string().refine(value => type.values.includes(value), 'Valor fora das opções declaradas.');
    case 'record': return z.strictObject(Object.fromEntries(Object.entries(type.fields).map(([id, field]) => [id, valueSchema(field, taxonomies)])));
  }
}

export function createRecommendationInputValidator(definition: RecommenderDefinitionVersion, rawTaxonomies: readonly unknown[] = []) {
  const taxonomies = resolveTaxonomies(definitionTaxonomyReferences(definition), rawTaxonomies);
  const shape = Object.fromEntries(definition.attributes.map(attribute => {
    const scalar = valueSchema(attribute.valueType, taxonomies);
    const schema = attribute.cardinality === 'many' ? z.array(scalar) : scalar;
    return [attribute.id, attribute.required ? schema : schema.optional()];
  }));
  const valuesSchema = z.strictObject(shape);
  return (raw: unknown): RecommendationInput => {
    canonicalJson(raw);
    const input = recommendationInputSchema.parse(raw);
    // Required means a key must exist; empty arrays/text are left for method-specific completeness checks.
    return { ...input, values: valuesSchema.parse(input.values) as RecommendationInput['values'] };
  };
}

export function validateRecommendationInput(definition: RecommenderDefinitionVersion, raw: unknown, rawTaxonomies: readonly unknown[] = []): RecommendationInput {
  return createRecommendationInputValidator(definition, rawTaxonomies)(raw);
}
