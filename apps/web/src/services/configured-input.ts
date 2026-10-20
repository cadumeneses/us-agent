import type { ConfiguredDefinition, ConfiguredInput, JsonValue, ScalarType, TaxonomyDependency, ValueType } from '../types/configurable-recommendations';

export function emptyValue(type: ValueType): JsonValue {
  if (type.type === 'record') return Object.fromEntries(Object.entries(type.fields).map(([id, field]) => [id, emptyValue(field)]));
  if (type.type === 'number') return null;
  if (type.type === 'boolean') return false;
  return '';
}
export function initialValues(definition: ConfiguredDefinition): ConfiguredInput['values'] {
  return Object.fromEntries(definition.attributes.filter(attribute => attribute.required)
    .map(attribute => [attribute.id, attribute.cardinality === 'many' ? [] : emptyValue(attribute.valueType)]));
}

export function taxonomyOptions(type: Extract<ScalarType, { type: 'taxonomy_node' }>, dependencies: TaxonomyDependency[]) {
  const dependency = dependencies.find(item => item.snapshot.content.id === type.taxonomy.id && item.snapshot.content.version === type.taxonomy.version
    && item.snapshot.format === type.taxonomy.format && item.snapshot.sha256 === type.taxonomy.sha256);
  if (!dependency) return [];
  const { content } = dependency.snapshot;
  const parents = new Set(content.nodes.map(node => node.parentId));
  const nodes = new Map(content.nodes.map(node => [node.id, node]));
  return content.nodes.filter(node => node.selectable !== false && (content.selection === 'any' || !parents.has(node.id))).map(node => {
    const path = [node.name];
    const seen = new Set([node.id]);
    let parent = node.parentId;
    while (parent !== null && nodes.has(parent) && !seen.has(parent)) {
      seen.add(parent); const ancestor = nodes.get(parent)!; path.unshift(ancestor.name); parent = ancestor.parentId;
    }
    return { id: node.id, label: path.join(' / '), description: node.description };
  });
}

/** UI feedback only. Published schemas and method completeness remain authoritative in the API. */
export function inputIssues(definition: ConfiguredDefinition, values: ConfiguredInput['values'], dependencies: TaxonomyDependency[]) {
  const issues: string[] = [];
  const check = (type: ValueType, value: JsonValue | undefined, path: string) => {
    if (type.type === 'record') {
      if (!value || typeof value !== 'object' || Array.isArray(value)) { issues.push(`${path}: enter the record fields.`); return; }
      for (const [id, field] of Object.entries(type.fields)) check(field, value[id], `${path} / ${id}`);
      return;
    }
    if (type.type === 'number' && (typeof value !== 'number' || !Number.isFinite(value))) issues.push(`${path}: enter a finite number.`);
    if (type.type === 'boolean' && typeof value !== 'boolean') issues.push(`${path}: choose yes or no.`);
    if (['text', 'category'].includes(type.type) && typeof value !== 'string') issues.push(`${path}: enter text.`);
    if (type.type === 'enum' && (typeof value !== 'string' || !type.values.includes(value))) issues.push(`${path}: choose a valid option.`);
    if (type.type === 'taxonomy_node' && !taxonomyOptions(type, dependencies).some(option => option.id === value)) issues.push(`${path}: choose a node from the published taxonomy.`);
  };
  for (const attribute of definition.attributes) {
    if (!Object.hasOwn(values, attribute.id)) {
      if (attribute.required) issues.push(`${attribute.name}: required attribute is missing.`);
      continue;
    }
    const value = values[attribute.id];
    if (attribute.cardinality === 'many') {
      if (!Array.isArray(value)) issues.push(`${attribute.name}: enter a list.`);
      else value.forEach((item, index) => check(attribute.valueType, item, `${attribute.name} ${index + 1}`));
    } else check(attribute.valueType, value, attribute.name);
  }
  return issues;
}
