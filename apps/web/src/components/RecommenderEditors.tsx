import { useRef, useState } from 'react';
import template from '../../../../config/recommenders/rnf-v2.draft.json';
import { recommenderApi, supportsWebMethod } from '../services/recommender-api';
import riskSample from '../../../../config/recommenders/examples/project-risks.synthetic.json';
import riskTemplate from '../../../../config/recommenders/project-risks.draft.json';
import { CONFIGURABLE_KNN } from '../types/project-recommendations';
import { ConfigurableMethodEditor, synchronizeFeatureWeights } from './ConfigurableMethodEditor';
import testTemplate from '../../../../config/recommenders/testrec-equations.draft.json';
import { TEST_CASE_METHOD } from '../types/test-case-recommendations';
import type { ConfiguredAttribute, ConfiguredDefinition, ConfiguredTaxonomy, DefinitionRecord, ScalarType, TaxonomyRecord, TaxonomySummary, ValueType } from '../types/configurable-recommendations';
import { ReferenceDetails } from './ConfiguredRunDetails';
import { CatalogState, useCatalog, versionKey } from './VersionCatalog';

const clone = <T,>(value: T): T => structuredClone(value);
export function IdentityFields({ value, onChange }: { value: { id: string; version: string; name: string }; onChange: (key: 'id' | 'version' | 'name', value: string) => void }) {
  return <div className="configured-editor-grid"><label>ID<input value={value.id} maxLength={80} onChange={event => onChange('id', event.target.value)}/></label><label>Version<input value={value.version} maxLength={80} onChange={event => onChange('version', event.target.value)}/></label><label>Name<input value={value.name} maxLength={160} onChange={event => onChange('name', event.target.value)}/></label></div>;
}

function ScalarEditor({ value, onChange, taxonomies, allowedTypes }: { value: ScalarType; onChange: (value: ScalarType) => void; taxonomies: TaxonomySummary[]; allowedTypes?: string[] }) {
  return <div className="configured-editor-grid"><label>Type<select value={value.type} onChange={event => {
    const type = event.target.value as ScalarType['type'];
    onChange(type === 'enum' ? { type, values: [] } : type === 'taxonomy_node' ? { type, taxonomy: { id: '', version: '', format: 'us-agent-json-v1', sha256: '' } } : { type });
  }}>{['text', 'category', 'number', 'boolean', 'enum', 'taxonomy_node'].map(type => <option key={type} value={type} disabled={!!allowedTypes && !allowedTypes.includes(type)}>{({ text: "Text", category: 'Category', number: "Number", boolean: "Yes/no", enum: "Enumeration", taxonomy_node: "Taxonomy node" })[type]}</option>)}</select></label>
    {value.type === 'enum' && <label>Options (one per line)<textarea value={value.values.join('\n')} onChange={event => onChange({ type: 'enum', values: event.target.value.split('\n') })}/><small>An empty line represents an empty option when supported by the method.</small></label>}
    {value.type === 'taxonomy_node' && <label>Published taxonomy<select value={versionKey(value.taxonomy)} onChange={event => {
      const selected = taxonomies.find(item => versionKey(item) === event.target.value);
      if (selected) onChange({ type: 'taxonomy_node', taxonomy: { id: selected.id, version: selected.version, format: selected.snapshot.format, sha256: selected.snapshot.sha256 } });
    }}><option value={versionKey({ id: '', version: '' })}>Select</option>{taxonomies.filter(item => item.state === 'published').map(item => <option key={versionKey(item)} value={versionKey(item)}>{item.name} · {item.id} · {item.version}</option>)}</select><small>{value.taxonomy.id && `${value.taxonomy.id} · ${value.taxonomy.version} · ${value.taxonomy.sha256}`}</small></label>}
  </div>;
}
function ValueTypeEditor({ value, onChange, taxonomies, allowedTypes }: { value: ValueType; onChange: (value: ValueType) => void; taxonomies: TaxonomySummary[]; allowedTypes?: string[] }) {
  const [fieldId, setFieldId] = useState(''), [error, setError] = useState('');
  if (value.type !== 'record') return <><ScalarEditor value={value} onChange={onChange} taxonomies={taxonomies} allowedTypes={allowedTypes}/><button type="button" disabled={!!allowedTypes} onClick={() => onChange({ type: 'record', fields: {} })}>Use a record with fields</button></>;
  return <div><p>Record with fields</p>{Object.entries(value.fields).map(([id, field]) => <fieldset key={id} className="configured-record configured-subeditor"><legend>{id}</legend><ScalarEditor value={field} onChange={next => onChange({ type: 'record', fields: { ...value.fields, [id]: next } })} taxonomies={taxonomies}/><button type="button" onClick={() => { const fields = { ...value.fields }; delete fields[id]; onChange({ type: 'record', fields }); }}>Remove field {id}</button></fieldset>)}
    <label>New field ID<input value={fieldId} onChange={event => setFieldId(event.target.value)}/></label><button type="button" onClick={() => {
      if (!/^[a-z][a-z0-9_-]{0,79}$/.test(fieldId) || Object.hasOwn(value.fields, fieldId)) { setError("Enter a valid, unique field ID."); return; }
      onChange({ type: 'record', fields: { ...value.fields, [fieldId]: { type: 'text' } } }); setFieldId(''); setError('');
    }}>Add field</button>{error && <p role="alert">{error}</p>}<button type="button" onClick={() => onChange({ type: 'text' })}>Use a scalar value</button>
  </div>;
}

function LegacyMapping({ value, onChange }: { value: ConfiguredDefinition; onChange: (value: ConfiguredDefinition) => void }) {
  const [path, setPath] = useState(''), [node, setNode] = useState(''), [error, setError] = useState('');
  const mapping = (value.method.parameters.legacy_names ?? {}) as Record<string, Record<string, string>>;
  const update = (next: typeof mapping) => {
    const parameters = { ...value.method.parameters };
    if (Object.keys(next).length) parameters.legacy_names = next; else delete parameters.legacy_names;
    onChange({ ...value, method: { ...value.method, parameters } });
  };
  return <details><summary>Map taxonomy IDs to comparison values</summary><p>When using taxonomies in scientific attributes, map IDs to the names expected by this policy. Every selectable node needs a distinct mapped name.</p>
    {Object.entries(mapping).map(([key, entries]) => <fieldset className="configured-subeditor" key={key}><legend>{key}</legend>{Object.entries(entries).map(([id, name]) => <div className="configured-editor-grid" key={id}><label>Comparison value for {id}<input value={name} onChange={event => update({ ...mapping, [key]: { ...entries, [id]: event.target.value } })}/></label><button type="button" onClick={() => { const next = { ...entries }; delete next[id]; update({ ...mapping, [key]: next }); }}>Remove mapping entry {key} / {id}</button></div>)}<button type="button" onClick={() => { const next = { ...mapping }; delete next[key]; update(next); }}>Remove mapping {key}</button></fieldset>)}
    <div className="configured-editor-grid"><label>Attribute path<input placeholder="platforms or tasks.category" value={path} onChange={event => setPath(event.target.value)}/></label><label>Node ID<input value={node} onChange={event => setNode(event.target.value)}/></label></div>
    <button type="button" onClick={() => {
      if (!/^[a-z][a-z0-9_-]*(\.[a-z][a-z0-9_-]*)?$/.test(path) || !/^[a-z][a-z0-9_-]{0,79}$/.test(node) || Object.hasOwn(mapping[path] ?? {}, node)) { setError("Enter a valid path and node without duplicating a mapping."); return; }
      update({ ...mapping, [path]: { ...mapping[path], [node]: '' } }); setNode(''); setError('');
    }}>Add mapping entry</button>{error && <p role="alert">{error}</p>}
  </details>;
}

export function DefinitionEditor({ refresh, changed, busy, setBusy }: { refresh: number; changed: () => void; busy: boolean; setBusy: (value: boolean) => void }) {
  const catalog = useCatalog(recommenderApi.definitionVersions, refresh), taxonomies = useCatalog(recommenderApi.taxonomyVersions, refresh);
  const [choice, setChoice] = useState(''), [draft, setDraft] = useState<ConfiguredDefinition>();
  const [saved, setSaved] = useState<DefinitionRecord>(), [signature, setSignature] = useState('');
  const [error, setError] = useState(''), [message, setMessage] = useState('');
  const running = useRef(false);
  const selection = catalog.rows.find(item => versionKey(item) === choice);
  const readonly = !!draft && draft.state !== 'draft';
  const clean = !!draft && JSON.stringify(draft) === signature;
  async function action(task: () => Promise<void>) {
    if (running.current) return; running.current = true; setBusy(true); setError(''); setMessage('');
    try { await task(); } catch (reason) { setError((reason as Error).message); } finally { running.current = false; setBusy(false); }
  }
  const receive = (record: DefinitionRecord) => { setDraft(clone(record.definition)); setSaved(record); setSignature(JSON.stringify(record.definition)); };
  const changeDraft = (next: ConfiguredDefinition) => setDraft(next.method.id === CONFIGURABLE_KNN ? synchronizeFeatureWeights(next) : next);
  const editAttribute = (index: number, value: ConfiguredAttribute) => {
    if (!draft) return;
    const previous = draft.attributes[index];
    let method = draft.method;
    if (method.id === CONFIGURABLE_KNN && previous.id !== value.id) {
      const weights = { ...method.parameters.weights as Record<string, number> };
      const sources = { ...method.parameters.profile_sources as Record<string, string> };
      if (Object.hasOwn(weights, previous.id)) { weights[value.id] = weights[previous.id]; delete weights[previous.id]; }
      if (Object.hasOwn(sources, previous.id)) { sources[value.id] = sources[previous.id]; delete sources[previous.id]; }
      method = { ...method, parameters: { ...method.parameters, weights, profile_sources: sources } };
    }
    changeDraft({ ...draft, method, attributes: draft.attributes.map((item, position) => position === index ? value : item) });
  };
  function loadTemplate(value: ConfiguredDefinition) { const next = clone(value); if (next.method.id !== CONFIGURABLE_KNN) { next.name = next.method.id === TEST_CASE_METHOD ? 'Test cases' : 'Non-functional requirements'; next.id = next.method.id === TEST_CASE_METHOD ? 'test-cases' : 'nfr-recommender'; next.attributes = next.attributes.map(attribute => ({ ...attribute, name: attribute.id.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') })); } setDraft({ ...next, version: '' }); setSaved(undefined); setSignature(''); setError(''); setMessage('Template loaded. Choose an ID and version before saving.'); }
  return <section className="card configured-panel" aria-label="Definition editor"><h2>Definitions and attributes</h2><p>Start from a template or load a version. Published versions are read-only; changes require a new draft version.</p>
    <fieldset disabled={busy} className="configured-form-body"><label>Definition version<select value={choice} onChange={event => setChoice(event.target.value)}><option value="">Select</option>{catalog.rows.map(item => <option disabled={!supportsWebMethod(item.method)} key={versionKey(item)} value={versionKey(item)}>{item.name} · {item.id} · {item.version} · {item.state}{!supportsWebMethod(item.method) && ' · API only'}</option>)}</select></label>
      <div className="configured-actions"><button type="button" disabled={catalog.loading || !selection} onClick={() => void action(async () => { if (selection) receive(await recommenderApi.definition(selection.id, selection.version)); })}>Load definition</button><button type="button" onClick={() => loadTemplate(template as ConfiguredDefinition)}>New NFR from template</button><button type="button" onClick={() => loadTemplate(testTemplate as ConfiguredDefinition)}>New test-case demonstration</button><button type="button" onClick={() => loadTemplate(riskTemplate as ConfiguredDefinition)}>New project-risk recommender</button><button type="button" onClick={() => { const url = URL.createObjectURL(new Blob([JSON.stringify(riskSample, null, 2)], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = 'project-risks.synthetic.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }}>Download risk sample dataset</button></div><CatalogState catalog={catalog} title="definition versions"/>
    </fieldset>
    {draft && <>
      <p role="status">State: {readonly ? saved?.state ?? draft.state : draft.state}{!readonly && (clean ? " · Draft saved" : " · Unsaved changes")}</p>
      {readonly && <button type="button" disabled={busy} onClick={() => { setDraft({ ...clone(draft), version: '', state: 'draft' }); setSaved(undefined); setSignature(''); }}>Create a new definition version</button>}
      <fieldset className="configured-form-body" disabled={busy || readonly}><IdentityFields value={draft} onChange={(key, value) => setDraft({ ...draft, [key]: value })}/>
        <p>Method: {draft.method.id} · version {draft.method.version} · k={String(draft.method.parameters.k)}. {draft.method.id === TEST_CASE_METHOD ? 'Demonstration using synthetic test associations.' : draft.method.id === CONFIGURABLE_KNN ? 'Project comparison using the configured features.' : 'Fixed nearest-neighbor policy for non-functional requirements.'}</p>
        {draft.method.id === CONFIGURABLE_KNN && <ConfigurableMethodEditor value={draft} onChange={changeDraft}/>}<h3>Attributes ({draft.attributes.length})</h3>{draft.attributes.map((attribute, index) => <details key={index} className="configured-subeditor"><summary>{attribute.name || `Attribute ${index + 1}`} · {attribute.id}</summary>
          <div className="configured-editor-grid"><label>Attribute ID<input value={attribute.id} onChange={event => editAttribute(index, { ...attribute, id: event.target.value })}/></label><label>Attribute name<input value={attribute.name} onChange={event => editAttribute(index, { ...attribute, name: event.target.value })}/></label>
          <label>Scope<select value={attribute.scope} onChange={event => editAttribute(index, { ...attribute, scope: event.target.value as ConfiguredAttribute['scope'] })}><option value="artifact" disabled={draft.method.id === CONFIGURABLE_KNN}>Artifact</option><option value="project">Project</option></select></label>
          <label>Cardinality<select value={attribute.cardinality} onChange={event => editAttribute(index, { ...attribute, cardinality: event.target.value as ConfiguredAttribute['cardinality'] })}><option value="single">One value</option><option value="many">List</option></select></label>
          <label>Required value<select value={String(attribute.required)} onChange={event => editAttribute(index, { ...attribute, required: event.target.value === 'true' })}><option value="true">Required</option><option value="false">Optional</option></select></label>
          <label>Role<select value={attribute.role} onChange={event => editAttribute(index, { ...attribute, role: event.target.value as ConfiguredAttribute['role'], ...(draft.method.id === CONFIGURABLE_KNN && event.target.value === 'feature' ? { required: true, representation: 'presence', valueType: attribute.valueType.type === 'text' ? { type: 'category' } : attribute.valueType } : draft.method.id === CONFIGURABLE_KNN ? { representation: 'none', ...(event.target.value === 'output' ? { valueType: { type: 'text' }, cardinality: 'many', required: true } : {}) } : {}) })}>{Object.entries({ feature: "Feature", filter: "Filter", output: "Output", context: "Context" }).map(([key, name]) => <option key={key} value={key} disabled={draft.method.id === CONFIGURABLE_KNN && key === 'filter'}>{name}</option>)}</select></label>
          <label>Representation<select value={attribute.representation} onChange={event => editAttribute(index, { ...attribute, representation: event.target.value as ConfiguredAttribute['representation'] })}><option value="none">Excluded from vector</option><option value="presence">Binary presence</option></select></label></div>
          <ValueTypeEditor value={attribute.valueType} onChange={valueType => editAttribute(index, { ...attribute, valueType })} taxonomies={taxonomies.rows} allowedTypes={draft.method.id === CONFIGURABLE_KNN ? attribute.role === 'feature' ? ['category', 'enum', 'taxonomy_node'] : attribute.role === 'output' ? ['text'] : undefined : undefined}/><button type="button" onClick={() => changeDraft({ ...draft, attributes: draft.attributes.filter((_, position) => position !== index) })}>Remove attribute {attribute.id}</button><button type="button" disabled={index === 0} onClick={() => { const attributes = [...draft.attributes]; [attributes[index - 1], attributes[index]] = [attributes[index], attributes[index - 1]]; changeDraft({ ...draft, attributes }); }}>Move attribute up</button><button type="button" disabled={index === draft.attributes.length - 1} onClick={() => { const attributes = [...draft.attributes]; [attributes[index + 1], attributes[index]] = [attributes[index], attributes[index + 1]]; changeDraft({ ...draft, attributes }); }}>Move attribute down</button>
        </details>)}<button type="button" disabled={draft.attributes.length >= 100} onClick={() => changeDraft({ ...draft, attributes: [...draft.attributes, { id: '', name: '', valueType: { type: 'text' }, scope: draft.method.id === CONFIGURABLE_KNN ? 'project' : 'artifact', cardinality: 'single', required: false, role: 'context', representation: 'none' }] })}>Add attribute</button>
        <CatalogState catalog={taxonomies} title="attribute taxonomies"/>
        <details><summary>Method attribute bindings</summary>{Object.entries(draft.method.bindings).map(([slot, id]) => <label key={slot}>{slot}<select value={id} onChange={event => setDraft({ ...draft, method: { ...draft.method, bindings: { ...draft.method.bindings, [slot]: event.target.value } } })}>{draft.attributes.map((item, index) => <option key={index} value={item.id}>{item.name} · {item.id}</option>)}</select></label>)}</details>
        {draft.method.id !== TEST_CASE_METHOD && draft.method.id !== CONFIGURABLE_KNN && <LegacyMapping value={draft} onChange={setDraft}/>}
      </fieldset>
      <details><summary>Review complete configuration</summary><pre className="configured-value">{JSON.stringify(draft, null, 2)}</pre></details>
      {saved?.snapshot && <ReferenceDetails title="Published definition" reference={{ id: saved.definition.id, version: saved.definition.version, format: saved.snapshot.format, sha256: saved.snapshot.sha256 }}/>}
      <div className="configured-actions"><button type="button" disabled={busy || readonly} onClick={() => void action(async () => { receive(await recommenderApi.saveDefinition(draft)); setMessage("Draft saved. Review the configuration before publishing."); changed(); })}>Save definition draft</button>
        <button type="button" className="primary" disabled={busy || readonly || !clean || !saved?.draftSha256} onClick={() => void action(async () => { receive(await recommenderApi.publishDefinition(draft.id, draft.version, saved!.draftSha256!)); setMessage("Definition published with immutable dependencies."); changed(); })}>Publish reviewed definition</button></div>
    </>}{error && <p role="alert" className="inline-error">{error}</p>}{message && <p role="status">{message}</p>}
  </section>;
}

const emptyTaxonomy = (): ConfiguredTaxonomy => ({ schemaVersion: 1, id: '', version: '', name: '', kind: 'list', selection: 'any', source: '', nodes: [{ id: '', name: '', description: '', parentId: null }] });
export function TaxonomyEditor({ refresh, changed, busy, setBusy }: { refresh: number; changed: () => void; busy: boolean; setBusy: (value: boolean) => void }) {
  const catalog = useCatalog(recommenderApi.taxonomyVersions, refresh);
  const [choice, setChoice] = useState(''), [draft, setDraft] = useState<ConfiguredTaxonomy>();
  const [saved, setSaved] = useState<TaxonomyRecord>(), [signature, setSignature] = useState('');
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [page, setPage] = useState(0);
  const running = useRef(false), readonly = !!saved && saved.state !== 'draft';
  const selection = catalog.rows.find(item => versionKey(item) === choice);
  async function action(task: () => Promise<void>) {
    if (running.current) return; running.current = true; setBusy(true); setError(''); setMessage('');
    try { await task(); } catch (reason) { setError((reason as Error).message); } finally { running.current = false; setBusy(false); }
  }
  const receive = (record: TaxonomyRecord) => { setDraft(clone(record.snapshot.content)); setSaved(record); setSignature(JSON.stringify(record.snapshot.content)); setPage(0); };
  const editNode = (index: number, key: keyof ConfiguredTaxonomy['nodes'][number], value: string | boolean | null) => setDraft(current => current && ({ ...current, nodes: current.nodes.map((node, position) => position === index ? { ...node, [key]: value } : node) }));
  return <section className="card configured-panel" aria-label="Taxonomy editor"><h2>Taxonomies</h2><p>Lists and trees have their own IDs, source, and selection rules. The backend checks parents, duplicates, and cycles before saving.</p>
    <fieldset disabled={busy} className="configured-form-body"><label>Taxonomy version<select value={choice} onChange={event => setChoice(event.target.value)}><option value="">Select</option>{catalog.rows.map(item => <option key={versionKey(item)} value={versionKey(item)}>{item.name} · {item.id} · {item.version} · {item.state}</option>)}</select></label><div className="configured-actions"><button type="button" disabled={catalog.loading || !selection} onClick={() => void action(async () => { if (selection) receive(await recommenderApi.taxonomyVersion(selection.id, selection.version)); })}>Load taxonomy</button><button type="button" onClick={() => { setDraft(emptyTaxonomy()); setSaved(undefined); setSignature(''); setPage(0); setError(''); setMessage(''); }}>New taxonomy</button></div><CatalogState catalog={catalog} title="taxonomy versions"/></fieldset>
    {draft && <><p role="status">State: {saved?.state ?? 'draft'}{!readonly && (signature === JSON.stringify(draft) ? " · Draft saved" : " · Unsaved changes")}</p>
      {readonly && <button type="button" disabled={busy} onClick={() => { setDraft({ ...clone(draft), version: '' }); setSaved(undefined); setSignature(''); }}>Create a new taxonomy version</button>}
      <fieldset disabled={busy || readonly} className="configured-form-body"><IdentityFields value={draft} onChange={(key, value) => setDraft({ ...draft, [key]: value })}/><label>Taxonomy source<textarea maxLength={2000} value={draft.source} onChange={event => setDraft({ ...draft, source: event.target.value })}/></label>
        <div className="configured-editor-grid"><label>Structure<select value={draft.kind} onChange={event => setDraft({ ...draft, kind: event.target.value as ConfiguredTaxonomy['kind'] })}><option value="list">List</option><option value="tree">Tree</option></select></label><label>Selectable nodes<select value={draft.selection} onChange={event => setDraft({ ...draft, selection: event.target.value as ConfiguredTaxonomy['selection'] })}><option value="any">Any node</option><option value="leaf">Leaves only</option></select></label></div>
        <h3>Nodes ({draft.nodes.length})</h3>{draft.nodes.slice(page * 30, (page + 1) * 30).map((node, local) => { const index = page * 30 + local; return <fieldset className="configured-subeditor" key={index}><legend>Node {index + 1}</legend><div className="configured-editor-grid"><label>Node ID<input value={node.id} onChange={event => editNode(index, 'id', event.target.value)}/></label><label>Node name<input value={node.name} onChange={event => editNode(index, 'name', event.target.value)}/></label><label>Parent ID (empty for root)<input value={node.parentId ?? ''} onChange={event => editNode(index, 'parentId', event.target.value || null)}/></label><label><input type="checkbox" checked={node.selectable !== false} onChange={event => editNode(index, 'selectable', event.target.checked)}/>Selectable node</label><label>Node description<textarea value={node.description} onChange={event => editNode(index, 'description', event.target.value)}/></label></div><button type="button" onClick={() => { setDraft({ ...draft, nodes: draft.nodes.filter((_, position) => position !== index) }); setPage(0); }}>Remove node {index + 1}</button></fieldset>; })}
        <div className="configured-actions"><button type="button" disabled={page === 0} onClick={() => setPage(value => value - 1)}>Previous nodes</button><span>Page {page + 1}</span><button type="button" disabled={(page + 1) * 30 >= draft.nodes.length} onClick={() => setPage(value => value + 1)}>Next nodes</button><button type="button" disabled={draft.nodes.length >= 5000} onClick={() => { setDraft({ ...draft, nodes: [...draft.nodes, { id: '', name: '', description: '', parentId: null }] }); setPage(Math.floor(draft.nodes.length / 30)); }}>Add node</button></div>
      </fieldset><details><summary>Review complete taxonomy</summary><pre className="configured-value">{JSON.stringify(draft, null, 2)}</pre></details>
      {saved && <ReferenceDetails title={readonly ? "Published taxonomy" : "Reviewable draft"} reference={{ id: saved.snapshot.content.id, version: saved.snapshot.content.version, format: saved.snapshot.format, sha256: saved.snapshot.sha256 }}/>}
      <div className="configured-actions"><button type="button" disabled={busy || readonly} onClick={() => void action(async () => { receive(await recommenderApi.saveTaxonomy(draft)); setMessage("Draft saved. Review the nodes before publishing."); changed(); })}>Save taxonomy draft</button><button type="button" className="primary" disabled={busy || readonly || !saved || signature !== JSON.stringify(draft)} onClick={() => void action(async () => { receive(await recommenderApi.publishTaxonomy(draft.id, draft.version, saved!.snapshot.sha256)); setMessage("Taxonomy published with immutable content."); changed(); })}>Publish reviewed taxonomy</button></div>
    </>}{error && <p role="alert" className="inline-error">{error}</p>}{message && <p role="status">{message}</p>}
  </section>;
}
