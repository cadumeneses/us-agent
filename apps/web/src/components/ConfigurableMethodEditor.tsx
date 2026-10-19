import type { ConfiguredDefinition } from '../types/configurable-recommendations';
export function synchronizeFeatureWeights(definition: ConfiguredDefinition): ConfiguredDefinition {
  const previous = (definition.method.parameters.weights ?? {}) as Record<string, number>;
  const sources = (definition.method.parameters.profile_sources ?? {}) as Record<string, string>;
  return { ...definition, method: { ...definition.method, parameters: { ...definition.method.parameters,
    weights: Object.fromEntries(definition.attributes.filter(attribute => attribute.role === 'feature').map(attribute => [attribute.id, previous[attribute.id] ?? 1])),
    profile_sources: Object.fromEntries(Object.entries(sources).filter(([id]) => definition.attributes.some(attribute => attribute.id === id && attribute.role !== 'output' && attribute.valueType.type === 'category')))
  } } };
}
export function ConfigurableMethodEditor({ value, onChange }: { value: ConfiguredDefinition; onChange: (value: ConfiguredDefinition) => void }) {
  const weights = value.method.parameters.weights as Record<string, number>;
  const sources = value.method.parameters.profile_sources as Record<string, string>;
  const update = (parameters: ConfiguredDefinition['method']['parameters']) => onChange({ ...value, method: { ...value.method, parameters } });
  const sourceOptions = { platforms: 'Platforms', applicationDomains: 'Application domains', architectures: 'Architectures', objective: 'Objective', 'technologies.languages': 'Languages', 'technologies.frameworks': 'Frameworks', 'technologies.apis': 'APIs', 'technologies.dataPersistence': 'Data persistence' };
  return <section className="configured-subeditor"><h3>Calculation settings</h3><label>Number of neighbors (k)<input type="number" min="1" max="100" step="1" value={String(value.method.parameters.k)} onChange={event => update({ ...value.method.parameters, k: event.target.value === '' ? 0 : Number(event.target.value) })}/></label>
    <p>Features use binary categorical presence and weighted Manhattan distance. All reference values contribute to the vocabulary. Ties use record IDs; results combine the items associated with the nearest projects. Empty features are rejected.</p>
    {value.attributes.filter(attribute => attribute.role === 'feature').map(attribute => <label key={attribute.id}>Weight for {attribute.name || attribute.id}<input type="number" min="0.001" max="1000" step="any" value={weights[attribute.id] ?? 1} onChange={event => update({ ...value.method.parameters, weights: { ...weights, [attribute.id]: Number(event.target.value) } })}/></label>)}
    <details><summary>Prefill from the project profile</summary><p>Choose a compatible source or enter the value in this recommender's profile. New attributes need no source mapping.</p>{value.attributes.filter(attribute => attribute.role !== 'output' && attribute.valueType.type === 'category').map(attribute => <label key={attribute.id}>{attribute.name}<select value={sources[attribute.id] ?? ''} onChange={event => { const next = { ...sources }; if (event.target.value) next[attribute.id] = event.target.value; else delete next[attribute.id]; update({ ...value.method.parameters, profile_sources: next }); }}><option value="">Enter in recommender profile</option>{Object.entries(sourceOptions).filter(([key]) => (key === 'objective') === (attribute.cardinality === 'single')).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>)}</details>
  </section>;
}
