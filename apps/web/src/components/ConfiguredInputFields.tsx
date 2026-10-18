import { useId } from 'react';
import { emptyValue, taxonomyOptions } from '../services/configured-input';
import type { ConfiguredAttribute, ConfiguredInput, JsonValue, TaxonomyDependency, ValueType } from '../types/configurable-recommendations';

const roles = { feature: "Feature", filter: "Filter", output: "Associated output", context: "Context" };

function ValueField({ name, type, value, taxonomies, onChange }: { name: string; type: ValueType; value: JsonValue;
  taxonomies: TaxonomyDependency[]; onChange: (value: JsonValue) => void }) {
  const id = useId();
  if (type.type === 'record') {
    const record = (value ?? {}) as Record<string, JsonValue>;
    return <fieldset className="configured-record"><legend>{name}</legend>{Object.entries(type.fields).map(([key, field]) =>
      <ValueField key={key} name={key} type={field} value={record[key]} taxonomies={taxonomies} onChange={next => onChange({ ...record, [key]: next })}/>)}</fieldset>;
  }
  if (type.type === 'boolean') return <label htmlFor={id}>{name}<select id={id} value={String(value)} onChange={event => onChange(event.target.value === 'true')}><option value="false">No</option><option value="true">Yes</option></select></label>;
  if (type.type === 'enum') return <label htmlFor={id}>{name}<select id={id} value={String(value ?? '')} onChange={event => onChange(event.target.value)}>
    {!type.values.includes('') && <option value="">Select</option>}{type.values.map(option => <option key={option} value={option}>{option || "Not specified"}</option>)}
  </select></label>;
  if (type.type === 'taxonomy_node') return <label htmlFor={id}>{name}<select id={id} value={String(value ?? '')} onChange={event => onChange(event.target.value)}>
    <option value="">Select a node</option>{taxonomyOptions(type, taxonomies).map(option => <option key={option.id} value={option.id} title={option.description}>{option.label}</option>)}
  </select><small>{type.taxonomy.id} · {type.taxonomy.version}</small></label>;
  if (type.type === 'number') return <label htmlFor={id}>{name}<input id={id} type="number" step="any" value={value === null ? '' : String(value)} onChange={event => onChange(event.target.value === '' || !Number.isFinite(event.target.valueAsNumber) ? null : event.target.valueAsNumber)}/></label>;
  return <label htmlFor={id}>{name}<input id={id} type="text" value={String(value ?? '')} onChange={event => onChange(event.target.value)}/></label>;
}

export function ConfiguredInputFields({ attributes, values, taxonomies, onChange }: { attributes: ConfiguredAttribute[];
  values: ConfiguredInput['values']; taxonomies: TaxonomyDependency[]; onChange: (values: ConfiguredInput['values']) => void }) {
  return <div className="configured-fields">{attributes.map(attribute => {
    const included = Object.hasOwn(values, attribute.id);
    const update = (value: JsonValue) => onChange({ ...values, [attribute.id]: value });
    const items = Array.isArray(values[attribute.id]) ? values[attribute.id] as JsonValue[] : [];
    return <div key={attribute.id} className="configured-attribute">
      <p className="configured-field-meta">{roles[attribute.role]} · {attribute.scope === 'project' ? "Project" : "Artifact"} · {attribute.required ? "Required" : "Optional"}</p>
      {!attribute.required && <label className="configured-optional"><input type="checkbox" checked={included} onChange={event => {
        if (event.target.checked) update(attribute.cardinality === 'many' ? [] : emptyValue(attribute.valueType));
        else { const next = { ...values }; delete next[attribute.id]; onChange(next); }
      }}/> Enter {attribute.name}</label>}
      {included && (attribute.cardinality === 'many' ? <fieldset className="configured-many"><legend>{attribute.name}</legend>
        {items.length === 0 && <p>No values entered.</p>}{items.map((item, index) => <div className="configured-list-item" key={index}>
          <ValueField name={`${attribute.name} ${index + 1}`} type={attribute.valueType} value={item} taxonomies={taxonomies} onChange={next => update(items.map((value, position) => position === index ? next : value))}/>
          <button type="button" aria-label={`Remove ${attribute.name} ${index + 1}`} onClick={() => update(items.filter((_, position) => position !== index))}>Remove</button>
        </div>)}<button type="button" onClick={() => update([...items, emptyValue(attribute.valueType)])}>Add {attribute.name}</button>
      </fieldset> : <ValueField name={attribute.name} type={attribute.valueType} value={values[attribute.id]} taxonomies={taxonomies} onChange={update}/>)}
    </div>;
  })}</div>;
}
