import { useEffect, useRef, useState } from 'react';
import '../recommender-creation.css';
import { Link, useBeforeUnload } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Plus, Trash2 } from 'lucide-react';
import { RecommenderNavigation } from '../components/RecommenderNavigation';
import { PageTitle } from '../components/ui';
import { CatalogState, useCatalog, versionKey } from '../components/VersionCatalog';
import { synchronizeFeatureWeights } from '../components/ConfigurableMethodEditor';
import { customDefinitionIssues, newCustomAttribute, newCustomRecommender, type CreationSection } from '../services/custom-recommender';
import { recommenderApi } from '../services/recommender-api';
import type { ConfiguredAttribute, ConfiguredDefinition, DefinitionRecord } from '../types/configurable-recommendations';

const steps = [
  { id: 'basics', label: 'Name', title: 'What would you like to recommend?', description: 'Give your recommender a name that explains what it helps people choose.' },
  { id: 'inputs', label: 'Inputs', title: 'What should we compare?', description: 'Choose the project characteristics people will enter. KNN uses these to find similar reference projects.' },
  { id: 'outputs', label: 'Recommendations', title: 'What should the results contain?', description: 'Name the items associated with your reference projects, such as architectures, risks or practices.' },
  { id: 'matching', label: 'Matching', title: 'How should similar projects be matched?', description: 'Start with the defaults, or adjust the number of reference projects and the importance of each input.' },
  { id: 'review', label: 'Review', title: 'Review your recommender', description: 'Check the questions, results and matching settings before creating it. You will add reference data next.' }
] as const;
const sources: Record<string, string> = { platforms: 'Platforms', applicationDomains: 'Application domains', architectures: 'Architectures', objective: 'Objective', 'technologies.languages': 'Languages', 'technologies.frameworks': 'Frameworks', 'technologies.apis': 'APIs', 'technologies.dataPersistence': 'Data persistence' };
const types: Record<string, string> = { category: 'Category', enum: 'Options list', taxonomy_node: 'Published taxonomy', text: 'Text', number: 'Number', boolean: 'Yes or no' };

export function NewRecommenderPage() {
  const [suffix] = useState(() => crypto.randomUUID().slice(0, 8));
  const [draft, setDraft] = useState<ConfiguredDefinition>(() => { const value = newCustomRecommender(); value.id = `custom-${suffix}`; value.attributes.forEach(attribute => { attribute.name = ''; }); return value; });
  const [customId, setCustomId] = useState(false), [step, setStep] = useState(0), [furthest, setFurthest] = useState(0);
  const [busy, setBusy] = useState(false), [errors, setErrors] = useState<string[]>([]), [requestError, setRequestError] = useState('');
  const [created, setCreated] = useState<DefinitionRecord>();
  const taxonomies = useCatalog(recommenderApi.taxonomyVersions, 0);
  const heading = useRef<HTMLHeadingElement>(null), errorSummary = useRef<HTMLDivElement>(null), running = useRef(false);
  const preparedDraft = useRef<{ signature: string; record: DefinitionRecord } | undefined>(undefined);
  const dirty = !created && (!!draft.name || draft.attributes.some(attribute => !!attribute.name));
  useBeforeUnload(event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [step, created]);
  useEffect(() => { if (errors.length) errorSummary.current?.focus(); }, [errors]);
  const weights = draft.method.parameters.weights as Record<string, number>;
  const profileSources = draft.method.parameters.profile_sources as Record<string, string>;
  const features = draft.attributes.filter(attribute => attribute.role === 'feature');
  const outputs = draft.attributes.filter(attribute => attribute.role === 'output');

  function update(next: ConfiguredDefinition) { setDraft(synchronizeFeatureWeights(next)); setErrors([]); setRequestError(''); }
  function edit(index: number, next: ConfiguredAttribute) {
    const source = profileSources[next.id];
    const nextSources = { ...profileSources };
    if (source && (next.valueType.type !== 'category' || (source === 'objective') !== (next.cardinality === 'single'))) delete nextSources[next.id];
    update({ ...draft, attributes: draft.attributes.map((attribute, position) => position === index ? next : attribute), method: { ...draft.method, parameters: { ...draft.method.parameters, profile_sources: nextSources } } });
  }
  function add(role: 'feature' | 'output' | 'context') {
    let next = 1; while (draft.attributes.some(attribute => attribute.id === `${role}_${next}`)) next++;
    update({ ...draft, attributes: [...draft.attributes, { ...newCustomAttribute(role, `${role}_${next}`), name: '' }] });
  }
  function go(next: number) {
    if (next > step) {
      const issues = customDefinitionIssues(draft, steps[step].id === 'review' ? undefined : steps[step].id as CreationSection);
      if (issues.length) { setErrors(issues); return; }
    }
    setStep(next); setFurthest(current => Math.max(current, next)); setErrors([]); setRequestError('');
  }
  function errorTarget(message: string) {
    if (message.includes('recommender name')) return 'recommender-name';
    if (message.startsWith('Choose an ID')) return 'recommender-id';
    if (message.startsWith('Enter a version')) return 'recommender-version';
    if (message.includes('whole number')) return 'neighbors';
    if (message.startsWith('Add at least one comparison')) return 'add-comparison-input';
    if (message.startsWith('Add at least one recommendation')) return 'add-output';
    const index = draft.attributes.findIndex(attribute => message.startsWith(`${attribute.name || 'Attribute'}:`) || message.startsWith(`${attribute.id}:`));
    if (index >= 0) return message.includes('weight') ? `weight-${index}` : message.includes('published taxonomy') ? `taxonomy-${index}` : message.includes('options') ? `options-${index}` : `name-${index}`;
    return 'creation-heading';
  }
  function fieldErrors(id: string) {
    const messages = errors.filter(message => errorTarget(message) === id);
    return messages.length ? <span id={`${id}-error`} className="creation-field-error">{messages.join(' ')}</span> : null;
  }
  const errorProps = (id: string) => errors.some(message => errorTarget(message) === id) ? { 'aria-invalid': true as const, 'aria-describedby': `${id}-error` } : {};
  function focusError(message: string) {
    const id = errorTarget(message);
    // A server-side validation failure can point to an earlier step.
    const targetStep = id.startsWith('recommender-') ? 0 : id === 'neighbors' || id.startsWith('weight-') ? 3 : id === 'add-output' ? 2 : id === 'add-comparison-input' ? 1 : draft.attributes[Number(id.split('-').at(-1))]?.role === 'output' ? 2 : 1;
    if (targetStep !== step) setStep(targetStep);
    setTimeout(() => { const target = document.getElementById(id); let parent = target?.parentElement; while (parent) { if (parent instanceof HTMLDetailsElement) parent.open = true; parent = parent.parentElement; } target?.focus(); }, 0);
  }
  async function create() {
    if (running.current) return;
    const issues = customDefinitionIssues(draft);
    if (issues.length) { setErrors(issues); return; }
    running.current = true; setBusy(true); setRequestError('');
    try {
      const signature = JSON.stringify(draft);
      const saved = preparedDraft.current?.signature === signature ? preparedDraft.current.record : await recommenderApi.saveDefinition(draft);
      preparedDraft.current = { signature, record: saved };
      if (!saved.draftSha256) throw new Error('The draft could not be verified. Try creating the recommender again.');
      const publication = await recommenderApi.publishDefinition(saved.definition.id, saved.definition.version, saved.draftSha256);
      setCreated(publication);
    } catch (reason) { setRequestError((reason as Error).message); }
    finally { running.current = false; setBusy(false); }
  }

  function attributeCard(attribute: ConfiguredAttribute, index: number) {
    const isOutput = attribute.role === 'output';
    const groupIndex = draft.attributes.filter((item, position) => position <= index && item.role === attribute.role).length;
    const title = isOutput ? `Recommendation ${groupIndex}` : attribute.role === 'context' ? `Additional field ${groupIndex}` : `Comparison input ${groupIndex}`;
    return <fieldset key={attribute.id} className="creation-field" aria-label={title}><legend>{title}</legend>
      <div className="creation-field-top"><label htmlFor={`name-${index}`}>{isOutput ? 'Recommendation name' : 'Input name'}<input id={`name-${index}`} maxLength={160} value={attribute.name} placeholder={isOutput ? 'e.g. Architectures' : 'e.g. Technology'} onChange={event => edit(index, { ...attribute, name: event.target.value })} {...errorProps(`name-${index}`)}/>{fieldErrors(`name-${index}`)}</label>
        <button type="button" className="creation-remove" aria-label={`Remove ${title.toLowerCase()}`} onClick={() => update({ ...draft, attributes: draft.attributes.filter((_, position) => position !== index) })}><Trash2 size={18} aria-hidden="true"/></button></div>
      {isOutput ? <p>Reference projects will contain a list of these items. The results will suggest items associated with similar projects.</p> : <>
        <div className="creation-pair"><label>Answer format<select value={attribute.valueType.type} onChange={event => {
          const type = event.target.value as Exclude<ConfiguredAttribute['valueType']['type'], 'record'>;
          edit(index, { ...attribute, valueType: type === 'enum' ? { type, values: [] } : type === 'taxonomy_node' ? { type, taxonomy: { id: '', version: '', format: 'us-agent-json-v1', sha256: '' } } : { type } });
        }}>{(attribute.role === 'feature' ? ['category', 'enum', 'taxonomy_node'] : ['text', 'number', 'boolean', 'category', 'enum', 'taxonomy_node']).map(type => <option key={type} value={type}>{types[type]}</option>)}</select></label>
          <label>How many values?<select value={attribute.cardinality} onChange={event => edit(index, { ...attribute, cardinality: event.target.value as ConfiguredAttribute['cardinality'] })}><option value="single">One value</option><option value="many">Multiple values</option></select></label></div>
        {attribute.valueType.type === 'enum' && <label htmlFor={`options-${index}`}>Allowed answers<textarea id={`options-${index}`} value={attribute.valueType.values.join('\n')} placeholder={'Web\nMobile\nDesktop'} onChange={event => edit(index, { ...attribute, valueType: { type: 'enum', values: event.target.value.split('\n') } })} {...errorProps(`options-${index}`)}/><small>Enter one option per line.</small>{fieldErrors(`options-${index}`)}</label>}
        {attribute.valueType.type === 'taxonomy_node' && <label htmlFor={`taxonomy-${index}`}>Taxonomy<select id={`taxonomy-${index}`} value={versionKey(attribute.valueType.taxonomy)} onChange={event => {
          const selected = taxonomies.rows.find(row => versionKey(row) === event.target.value);
          if (selected) edit(index, { ...attribute, valueType: { type: 'taxonomy_node', taxonomy: { id: selected.id, version: selected.version, format: selected.snapshot.format, sha256: selected.snapshot.sha256 } } });
        }} {...errorProps(`taxonomy-${index}`)}><option value={versionKey({ id: '', version: '' })}>Choose a published taxonomy</option>{taxonomies.rows.filter(row => row.state === 'published').map(row => <option key={versionKey(row)} value={versionKey(row)}>{row.name} · {row.version}</option>)}</select>{fieldErrors(`taxonomy-${index}`)}{!taxonomies.loading && !taxonomies.error && !taxonomies.rows.some(row => row.state === 'published') && <small>No published taxonomy is loaded. Load more if available, or <Link to="/taxonomy" target="_blank" rel="noreferrer">prepare a taxonomy in a new tab</Link>.</small>}</label>}
        {attribute.valueType.type === 'category' && <label>Fill from an existing project<select value={profileSources[attribute.id] ?? ''} onChange={event => {
          const next = { ...profileSources }; if (event.target.value) next[attribute.id] = event.target.value; else delete next[attribute.id];
          update({ ...draft, attributes: draft.attributes.map((item, position) => position === index ? { ...item, cardinality: event.target.value ? event.target.value === 'objective' ? 'single' : 'many' : item.cardinality } : item), method: { ...draft.method, parameters: { ...draft.method.parameters, profile_sources: next } } });
        }}><option value="">Enter manually or import from a file</option>{Object.entries(sources).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select><small>Prefill can be reviewed before running.</small></label>}
        {attribute.role === 'context' ? <label className="creation-checkbox"><input type="checkbox" checked={attribute.required} onChange={event => edit(index, { ...attribute, required: event.target.checked })}/>Require this information before running</label> : <p>Required for comparison. Use the same categories in your reference data.</p>}
      </>}
      <details className="creation-advanced"><summary>Dataset field key</summary><code>{attribute.id}</code><p>Use this key when mapping columns in an imported file.</p></details>
    </fieldset>;
  }

  return <section className="page configured-page creation-page"><PageTitle eyebrow="RECOMMENDERS" title="New recommender">Choose what to compare and what to recommend. We will guide you through the setup.</PageTitle>
    <RecommenderNavigation busy={busy}/>
    {created ? <section className="card creation-success"><span className="creation-success-icon"><Check size={24} aria-hidden="true"/></span><h2 ref={heading} tabIndex={-1}>{created.definition.name} is created</h2><p>Your configuration is published. Add reference projects and their associated items to start recommending.</p><ol><li><strong>Configuration ready</strong><span>Your inputs, results and KNN settings are saved.</span></li><li><strong>Next: add reference data</strong><span>Import a file or build a reviewed dataset from registered projects.</span></li><li><strong>Run your recommender</strong><span>Complete the generated form and inspect the results.</span></li></ol><div className="creation-actions"><Link className="creation-primary-link" to={`/recommender-setup?tab=import&definitionId=${encodeURIComponent(created.definition.id)}&definitionVersion=${encodeURIComponent(created.definition.version)}`}>Add reference data<ArrowRight size={18} aria-hidden="true"/></Link><Link to="/recommendations">View my recommenders</Link></div></section> : <div className="creation-layout">
      <nav className="creation-progress" aria-label="Creation steps"><p>Step {step + 1} of {steps.length}<span className="creation-step-name"> · {steps[step].label}</span></p><ol>{steps.map((item, index) => <li key={item.id}><button type="button" disabled={busy || index > furthest} aria-label={`${index + 1}. ${item.label}`} aria-current={index === step ? 'step' : undefined} onClick={() => go(index)}><span>{index < step ? <Check size={16} aria-hidden="true"/> : index + 1}</span>{item.label}</button></li>)}</ol><p className="creation-progress-note">KNN finds similar projects and suggests their associated items.</p></nav>
      <form className="card creation-form" noValidate onSubmit={event => { event.preventDefault(); if (step === steps.length - 1) void create(); else go(step + 1); }} aria-labelledby="creation-heading">
        <div className="creation-step-heading"><span className="creation-kicker">STEP {step + 1} / {steps.length}</span><h2 id="creation-heading" ref={heading} tabIndex={-1}>{steps[step].title}</h2><p>{steps[step].description}</p></div>
        {!!errors.length && <div className="creation-error-summary" role="alert" tabIndex={-1} ref={errorSummary}><h3>Check these fields to continue</h3><ul>{errors.map((message, index) => <li key={index}><a href={`#${errorTarget(message)}`} onClick={event => { event.preventDefault(); focusError(message); }}>{message}</a></li>)}</ul></div>}
        <fieldset className="creation-body" disabled={busy}>
          {step === 0 && <><label htmlFor="recommender-name">Recommender name<input id="recommender-name" maxLength={160} value={draft.name} placeholder="e.g. Architecture recommender" onChange={event => {
            const name = event.target.value;
            const slug = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
            update({ ...draft, name, ...(!customId ? { id: `${/^[a-z]/.test(slug) ? slug : `custom-${slug}`}-${suffix}` } : {}) });
          }} {...errorProps('recommender-name')}/><small>A clear name helps people find the right recommender.</small>{fieldErrors('recommender-name')}</label>
            <div className="creation-example"><strong>Example</strong><p>Compare technology and project scope to recommend suitable architectures.</p></div>
            <details className="creation-advanced"><summary>Advanced: identifier and version</summary><p>An identifier is generated for you. Change it only if you need a specific integration key.</p><div className="creation-pair"><label htmlFor="recommender-id">ID<input id="recommender-id" value={draft.id} maxLength={80} onChange={event => { setCustomId(true); update({ ...draft, id: event.target.value }); }} {...errorProps('recommender-id')}/>{fieldErrors('recommender-id')}</label><label htmlFor="recommender-version">Version<input id="recommender-version" value={draft.version} maxLength={80} onChange={event => update({ ...draft, version: event.target.value })} {...errorProps('recommender-version')}/>{fieldErrors('recommender-version')}</label></div></details></>}
          {step === 1 && <><div className="creation-fields">{draft.attributes.map((attribute, index) => attribute.role === 'feature' ? attributeCard(attribute, index) : null)}</div><button id="add-comparison-input" type="button" className="creation-add" disabled={draft.attributes.length >= 100} onClick={() => add('feature')}><Plus size={18} aria-hidden="true"/>Add comparison input</button>{fieldErrors('add-comparison-input')}
            <details className="creation-advanced"><summary>Additional information (optional)</summary><p>Collect details such as a description or budget. These fields are saved with the query and do not affect similarity.</p>{draft.attributes.map((attribute, index) => attribute.role === 'context' ? attributeCard(attribute, index) : null)}<button type="button" disabled={draft.attributes.length >= 100} onClick={() => add('context')}><Plus size={18} aria-hidden="true"/>Add information field</button></details><CatalogState catalog={taxonomies} title="input taxonomies"/></>}
          {step === 2 && <><div className="creation-fields">{draft.attributes.map((attribute, index) => attribute.role === 'output' ? attributeCard(attribute, index) : null)}</div><button id="add-output" type="button" className="creation-add" disabled={draft.attributes.length >= 100} onClick={() => add('output')}><Plus size={18} aria-hidden="true"/>Add recommendation type</button>{fieldErrors('add-output')}<div className="creation-example"><strong>Where do recommendations come from?</strong><p>Your reference data must say which items are associated with each project. A list of projects or a taxonomy alone does not supply those associations.</p></div></>}
          {step === 3 && <><div className="creation-method"><strong>K-nearest neighbors (KNN)</strong><p>Compare categorical characteristics and combine the items associated with the nearest reference projects.</p></div><label htmlFor="neighbors">Number of neighbors (k)<input id="neighbors" type="number" min={1} max={100} step={1} value={String(draft.method.parameters.k)} onChange={event => update({ ...draft, method: { ...draft.method, parameters: { ...draft.method.parameters, k: Number(event.target.value) } } })} {...errorProps('neighbors')}/><small>Use 1–100 reference projects. If fewer are available, KNN uses the available neighbors.</small>{fieldErrors('neighbors')}</label><h3>Input importance</h3><p>A weight of 2 makes a category difference count twice as much as a weight of 1.</p><div className="creation-pair">{features.map(attribute => { const index = draft.attributes.indexOf(attribute); return <label key={attribute.id} htmlFor={`weight-${index}`}>Weight for {attribute.name}<input id={`weight-${index}`} type="number" min="0.001" max="1000" step="any" value={weights[attribute.id]} onChange={event => update({ ...draft, method: { ...draft.method, parameters: { ...draft.method.parameters, weights: { ...weights, [attribute.id]: Number(event.target.value) } } } })} {...errorProps(`weight-${index}`)}/>{fieldErrors(`weight-${index}`)}</label>; })}</div><details className="creation-advanced"><summary>How similarity is calculated</summary><p>Weighted Manhattan distance over categorical presence. Exact category and taxonomy IDs are compared; extra candidate categories also count as differences. Results combine the selected neighbors' associated items.</p></details></>}
          {step === 4 && <><div className="creation-review-title"><h3>{draft.name}</h3><button type="button" onClick={() => go(0)}>Edit name</button></div><section className="creation-review-block"><div><h3>People will enter</h3><button type="button" onClick={() => go(1)}>Edit inputs</button></div><ul>{draft.attributes.filter(attribute => attribute.role !== 'output').map(attribute => <li key={attribute.id}><strong>{attribute.name}</strong><span>{types[attribute.valueType.type] ?? attribute.valueType.type} · {attribute.cardinality === 'many' ? 'Multiple values' : 'One value'} · {attribute.required ? 'Required' : 'Optional'}{attribute.role === 'context' ? ' · Additional information' : ''}</span></li>)}</ul></section><section className="creation-review-block"><div><h3>They will receive</h3><button type="button" onClick={() => go(2)}>Edit recommendations</button></div><ul>{outputs.map(attribute => <li key={attribute.id}><strong>{attribute.name}</strong><span>A list of items from similar reference projects</span></li>)}</ul></section><section className="creation-review-block"><div><h3>Matching settings</h3><button type="button" onClick={() => go(3)}>Edit matching</button></div><p>KNN · Up to {String(draft.method.parameters.k)} neighbors</p><ul>{features.map(attribute => <li key={attribute.id}>{attribute.name}<span>Weight {weights[attribute.id]}</span></li>)}</ul></section><div className="creation-example"><strong>Next: add your knowledge base</strong><p>After creation, import CSV/JSON or select registered projects and review their associated items. The recommender will appear in your main list.</p></div></>}
        </fieldset>
        {requestError && <p role="alert" className="creation-field-error">{requestError} Your configuration is preserved. Try again or go back to edit it.</p>}
        <footer className="creation-footer"><button type="button" disabled={busy || step === 0} onClick={() => go(step - 1)}><ArrowLeft size={18} aria-hidden="true"/>Back</button><button className="primary" type="submit" disabled={busy}>{busy ? 'Creating recommender…' : step === 4 ? 'Create recommender' : 'Continue'}{!busy && <ArrowRight size={18} aria-hidden="true"/>}</button></footer>
      </form>
    </div>}
  </section>;
}
