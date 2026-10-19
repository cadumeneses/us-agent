import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { recommenderApi } from '../services/recommender-api';
import { initialValues, inputIssues } from '../services/configured-input';
import { CONFIGURABLE_KNN, type ProjectRecommendationRequest } from '../types/project-recommendations';
import type { ConfiguredInput, ContentReference, DatasetSummary, DefinitionRecord } from '../types/configurable-recommendations';
import { ConfiguredInputFields } from './ConfiguredInputFields';
import { ConfiguredRunDetails } from './ConfiguredRunDetails';
import { CatalogState, useCatalog, versionKey } from './VersionCatalog';

export function ProjectRiskRecommendations({ project, busy, onBusy }: { project: string; busy: boolean; onBusy: (value: boolean) => void }) {
  const definitions = useCatalog(recommenderApi.definitions, 0), datasets = useCatalog(recommenderApi.datasets, 0);
  const [choice, setChoice] = useState(''), [record, setRecord] = useState<DefinitionRecord>(), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  const available = definitions.rows.filter(row => row.method === CONFIGURABLE_KNN);
  const selected = available.find(row => versionKey(row) === choice) ?? (!choice && available.length === 1 ? available[0] : undefined);
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    setRecord(undefined); setError('');
    if (selected) recommenderApi.definition(selected.id, selected.version, controller.signal).then(value => {
      if (value.state !== 'published' || value.snapshot?.sha256 !== selected.snapshot?.sha256) throw new Error('Configuration changed. Reload the available versions.');
      if (active) setRecord(value);
    }).catch((reason: Error) => { if (active) setError(reason.message); });
    return () => { active = false; controller.abort(); };
  }, [selected?.id, selected?.version, selected?.snapshot?.sha256, retry]);
  return <>
    <section className="card configured-panel"><h2>Project risks</h2><p>Compare your project profile with a selected reference dataset to find risks observed in similar projects.</p>
      <label>Recommender and version<select disabled={busy || definitions.loading} value={selected ? versionKey(selected) : ''} onChange={event => setChoice(event.target.value)}><option value="">Select a configuration</option>{available.map(row => <option key={versionKey(row)} value={versionKey(row)}>{row.name} · {row.version}</option>)}</select></label>
      <CatalogState catalog={definitions} title="recommenders"/>
      {!definitions.loading && !definitions.error && !available.length && <p>No project recommender has been published. <Link to="/recommender-setup">Create a project-risk configuration and import a reference dataset</Link></p>}
      {error && <div role="alert"><p>{error}</p><button disabled={busy} onClick={() => setRetry(value => value + 1)}>Retry loading configuration</button></div>}
      {selected && !record && !error && <p role="status">Loading configuration…</p>}
    </section>
    {record?.snapshot && <ProjectRecommendationForm key={`${record.snapshot.sha256}:${project}`} record={record as Publication} project={project} datasets={datasets.rows} busy={busy} onBusy={onBusy}/>}<CatalogState catalog={datasets} title="reference datasets"/>
  </>;
}

type Publication = DefinitionRecord & { snapshot: NonNullable<DefinitionRecord['snapshot']> };
export function ProjectRecommendationForm({ record, project, datasets, busy, onBusy, onCompleted }: {
  record: Publication; project?: string; datasets: DatasetSummary[]; busy: boolean; onBusy: (value: boolean) => void;
  onCompleted?: (run: import('../types/project-recommendations').ProjectRecommendationRun) => void;
}) {
  const definition = record.snapshot.content.definition;
  const reference: ContentReference = { id: definition.id, version: definition.version, format: record.snapshot.format, sha256: record.snapshot.sha256 };
  const compatible = datasets.filter(row => row.state === 'published' && row.definition.id === reference.id && row.definition.version === reference.version && row.definition.sha256 === reference.sha256 && row.definition.format === reference.format);
  const [datasetKey, setDatasetKey] = useState('');
  const dataset = compatible.find(row => versionKey(row) === datasetKey) ?? (!datasetKey && compatible.length === 1 ? compatible[0] : undefined);
  const [values, setValues] = useState<ConfiguredInput['values']>(() => initialValues(definition));
  const [inputId, setInputId] = useState(''), [source, setSource] = useState('Manual project profile');
  const [revision, setRevision] = useState(0), [savedSignature, setSavedSignature] = useState('');
  const [loading, setLoading] = useState(!!project), [loadError, setLoadError] = useState(''), [retry, setRetry] = useState(0);
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [runId, setRunId] = useState('');
  const [issues, setIssues] = useState<string[]>([]);
  const submitting = useRef(false), pending = useRef<ProjectRecommendationRequest | null>(null);
  const signature = JSON.stringify(values);
  useEffect(() => {
    if (!project) return;
    const controller = new AbortController(); let active = true; setLoading(true); setLoadError('');
    recommenderApi.projectProfile(project, reference, controller.signal).then(profile => {
      if (!active) return;
      const next = { ...initialValues(definition), ...profile.values };
      setValues(next); setRevision(profile.revision); setSavedSignature(profile.revision ? JSON.stringify(next) : '');
      setInputId(`project:${profile.projectId}`); setSource(`Project ${project}; saved profile`);
    }).catch((reason: Error) => { if (active) setLoadError(reason.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [project, record.snapshot.sha256, retry]);
  async function act(run: boolean) {
    if (submitting.current || loading || loadError) return;
    const nextIssues = inputIssues(definition, values, record.snapshot.content.taxonomies);
    for (const attribute of definition.attributes.filter(row => row.role === 'feature')) {
      const value = values[attribute.id];
      if (Array.isArray(value) ? !value.length || value.some(item => typeof item !== 'string' || !item.trim()) : typeof value !== 'string' || !value.trim()) nextIssues.push(`${attribute.name}: enter at least one category.`);
    }
    if (!inputId.trim() || !source.trim()) nextIssues.push('Enter the profile identifier and source.');
    if (run && !dataset) nextIssues.push('Choose a reference dataset.');
    setIssues(nextIssues); setError(''); setMessage('');
    if (nextIssues.length) return;
    submitting.current = true; onBusy(true);
    try {
      if (project && signature !== savedSignature) {
        const saved = await recommenderApi.saveProjectProfile(project, reference, revision, values);
        setRevision(saved.revision); setSavedSignature(signature);
      }
      if (!run || !dataset) { setMessage('Project profile saved.'); return; }
      const payload = { definition: reference, dataset: { id: dataset.id, version: dataset.version, ...dataset.snapshot }, input: { id: inputId, values, provenance: { source } } };
      if (!pending.current || JSON.stringify({ ...pending.current, id: undefined }) !== JSON.stringify(payload)) pending.current = { id: crypto.randomUUID(), ...payload };
      const result = await recommenderApi.executeProject(pending.current); pending.current = null;
      setRunId(result.id); onCompleted?.(result);
    } catch (reason) { setError((reason as Error).message); }
    finally { submitting.current = false; onBusy(false); }
  }
  return <section className="card configured-panel"><h2>Project profile</h2><p>Fields follow the selected configuration. The saved profile is specific to this project and configuration version.</p>
    {loading && <p role="status">Loading project profile…</p>}{loadError && <p role="alert">{loadError}</p>}
    <fieldset disabled={busy || loading || !!loadError} className="configured-form-body">
      {!project && <><label>Profile identifier<input value={inputId} onChange={event => setInputId(event.target.value)}/></label><label>Profile source<input value={source} onChange={event => setSource(event.target.value)}/></label></>}
      <ConfiguredInputFields attributes={definition.attributes.filter(attribute => attribute.role !== 'output')} values={values} taxonomies={record.snapshot.content.taxonomies} onChange={setValues}/>
      <label>Reference dataset<select value={dataset ? versionKey(dataset) : ''} onChange={event => setDatasetKey(event.target.value)}><option value="">Select a dataset</option>{compatible.map(row => <option key={versionKey(row)} value={versionKey(row)}>{row.id} · {row.version} · {row.recordCount} projects</option>)}</select></label>
      {!compatible.length && <p>No compatible reference dataset is available. <Link to="/recommender-setup">Import a dataset for this configuration version</Link></p>}
      <p>Compare categorical presence using weighted Manhattan distance and up to {String(definition.method.parameters.k)} neighbors. Empty features must be completed before running.</p>
      <div className="configured-actions">{project && <button type="button" disabled={signature === savedSignature} onClick={() => void act(false)}>Save profile</button>}<button type="button" className="primary" disabled={!dataset} onClick={() => void act(true)}>{busy ? 'Running…' : 'Recommend'}</button></div>
    </fieldset>
    {project && <div className="configured-actions"><span role="status">{savedSignature === signature ? 'Profile saved' : 'Unsaved profile changes'}</span><button disabled={busy || loading} onClick={() => setRetry(value => value + 1)}>Reload saved profile</button></div>}
    {issues.length > 0 && <ul role="alert">{issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul>}{error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    {runId && !onCompleted && <ConfiguredRunDetails key={runId} id={runId} compact/>}
  </section>;
}
