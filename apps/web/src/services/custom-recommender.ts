import { CONFIGURABLE_KNN } from '../types/project-recommendations';
import type { ConfiguredAttribute, ConfiguredDefinition, DefinitionPublication, JsonValue, ValueType } from '../types/configurable-recommendations';
import { taxonomyOptions } from './configured-input';

export function newCustomRecommender(): ConfiguredDefinition {
  return {
    schemaVersion: 1, id: '', version: '1', name: '', state: 'draft',
    attributes: [newCustomAttribute('feature', 'characteristics'), newCustomAttribute('output', 'recommendations')],
    method: { id: CONFIGURABLE_KNN, version: '1', bindings: {}, parameters: {
      k: 3, representation: 'symmetric_binary_presence', distance: 'weighted_manhattan',
      vocabulary: 'target_and_dataset', missing_features: 'reject', tie_break: 'record_id',
      aggregation: 'neighbor_union', weights: { characteristics: 1 }, profile_sources: {}
    } }
  };
}

export function newCustomAttribute(role: 'feature' | 'output' | 'context', id: string): ConfiguredAttribute {
  return { id, name: role === 'feature' ? 'Characteristics' : role === 'output' ? 'Recommendations' : 'Additional context',
    scope: 'project', cardinality: role === 'context' ? 'single' : 'many', required: role !== 'context',
    role, representation: role === 'feature' ? 'presence' : 'none', valueType: { type: role === 'feature' ? 'category' : 'text' } };
}

/** Early form feedback; publication still validates the complete contract in the API. */
export type CreationSection = 'basics' | 'inputs' | 'outputs' | 'matching';
export function customDefinitionIssues(value: ConfiguredDefinition, section?: CreationSection): string[] {
  const issues: string[] = [];
  const add = (group: CreationSection, message: string) => { if (!section || section === group) issues.push(message); };
  const identifier = /^[a-z][a-z0-9_-]{0,79}$/;
  if (!identifier.test(value.id)) add('basics', 'Choose an ID starting with a lowercase letter, using letters, digits, hyphens or underscores (up to 80 characters).');
  if (!value.name.trim() || value.name.length > 160) add('basics', 'Enter a recommender name (up to 160 characters).');
  if (!value.version || value.version.length > 80 || /\s/.test(value.version)) add('basics', 'Enter a version without spaces (up to 80 characters).');
  if (!value.attributes.some(attribute => attribute.role === 'feature')) add('inputs', 'Add at least one comparison feature.');
  if (!value.attributes.some(attribute => attribute.role === 'output')) add('outputs', 'Add at least one recommendation output.');
  const ids = new Set<string>();
  for (const attribute of value.attributes) {
    const group = attribute.role === 'output' ? 'outputs' : 'inputs';
    if (!identifier.test(attribute.id) || ids.has(attribute.id)) add(group, `${attribute.name || 'Attribute'}: enter a valid, unique attribute ID.`);
    ids.add(attribute.id);
    if (!attribute.name.trim() || attribute.name.length > 160) add(group, `${attribute.id}: enter an attribute name (up to 160 characters).`);
    const types = attribute.valueType.type === 'record' ? Object.values(attribute.valueType.fields) : [attribute.valueType];
    if (attribute.valueType.type === 'record' && !types.length) add(group, `${attribute.name}: declare record fields.`);
    for (const type of types) {
      if (type.type === 'enum' && (!type.values.length || type.values.length > 100 || new Set(type.values).size !== type.values.length || type.values.some(option => !option.trim()))) add(group, `${attribute.name}: enter 1–100 distinct, nonempty options.`);
      if (type.type === 'taxonomy_node' && (!type.taxonomy.id || !type.taxonomy.version || !/^[a-f0-9]{64}$/.test(type.taxonomy.sha256))) add(group, `${attribute.name}: select a published taxonomy.`);
    }
    if (attribute.scope !== 'project' || attribute.role === 'filter') add(group, `${attribute.name}: use a project feature, output or context.`);
    if (attribute.role === 'feature' && (!attribute.required || attribute.representation !== 'presence' || !['category', 'enum', 'taxonomy_node'].includes(attribute.valueType.type))) add(group, `${attribute.name}: comparison features must be required categories, options or taxonomy nodes.`);
    if (attribute.role === 'output' && (!attribute.required || attribute.cardinality !== 'many' || attribute.valueType.type !== 'text')) add(group, `${attribute.name}: outputs must be required lists of text.`);
    if (attribute.role === 'feature') {
      const weight = ((value.method.parameters.weights ?? {}) as Record<string, number>)[attribute.id];
      if (!Number.isFinite(weight) || weight <= 0 || weight > 1000) add('matching', `${attribute.name}: enter a weight greater than 0 and at most 1000.`);
    }
  }
  const k = value.method.parameters.k;
  if (typeof k !== 'number' || !Number.isInteger(k) || k < 1 || k > 100) add('matching', 'Choose a whole number of neighbors from 1 to 100.');
  return issues;
}

/** Examples follow the published schema, including actual selectable taxonomy IDs. */
export function customDatasetExample(publication: DefinitionPublication) {
  function sample(type: ValueType, index: number): JsonValue {
    switch (type.type) {
      case 'enum': return type.values[index % type.values.length];
      case 'taxonomy_node': {
        const options = taxonomyOptions(type, publication.taxonomies);
        if (!options.length) throw new Error('This taxonomy has no selectable nodes. Create a new configuration version using a taxonomy with selectable nodes.');
        return options[index % options.length].id;
      }
      case 'record': return Object.fromEntries(Object.entries(type.fields).map(([id, field]) => [id, sample(field, index)]));
      case 'number': return index + 1;
      case 'boolean': return index === 0;
      default: return `Example ${index + 1}`;
    }
  }
  return [0, 1].map(index => ({ id: `example-${index + 1}`, values: Object.fromEntries(publication.definition.attributes.filter(attribute => attribute.required).map(attribute => {
    const value = attribute.role === 'output' ? `Example recommendation ${index + 1} for ${attribute.name} (${attribute.id})` : sample(attribute.valueType, index);
    return [attribute.id, attribute.cardinality === 'many' ? [value] : value];
  })) }));
}

export function downloadJson(value: unknown, name: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
