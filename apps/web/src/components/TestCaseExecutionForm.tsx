import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { recommenderApi } from '../services/recommender-api';
import { initialValues, inputIssues } from '../services/configured-input';
import type { ConfiguredInput, ContentReference, DatasetSummary, DefinitionRecord } from '../types/configurable-recommendations';
import type { MethodRun, TestCaseRequest } from '../types/test-case-recommendations';
import { ConfiguredInputFields } from './ConfiguredInputFields';
import { ReferenceDetails } from './ConfiguredRunDetails';
import { sameReference, TestCaseCatalogPicker } from './TestCaseCatalogPicker';
import { versionKey } from './VersionCatalog';

export function TestCaseExecutionForm({ record, datasets, busy, onBusy, onCompleted, children, initialInput }: {
  record: DefinitionRecord & { snapshot: NonNullable<DefinitionRecord['snapshot']> }; datasets: DatasetSummary[];
  busy: boolean; onBusy: (value: boolean) => void; onCompleted: (run: MethodRun) => void; children: React.ReactNode;
  initialInput?: ConfiguredInput;
  classificationId?: string;
}) {
  const definition = record.snapshot.content.definition, taxonomies = record.snapshot.content.taxonomies;
  const reference: ContentReference = { id: definition.id, version: definition.version, format: record.snapshot.format, sha256: record.snapshot.sha256 };
  const compatible = datasets.filter(row => row.state === 'published' && row.catalog && sameReference(row.definition, reference));
  const [choice, setChoice] = useState(''), [catalog, setCatalog] = useState<ContentReference>();
  const dataset = compatible.find(row => versionKey(row) === choice);
  const [inputId, setInputId] = useState(initialInput?.id ?? ''), [source, setSource] = useState(initialInput?.provenance.source ?? 'Manual synthetic input');
  const [values, setValues] = useState<ConfiguredInput['values']>(() => initialInput?.values ?? initialValues(definition));
  const [issues, setIssues] = useState<string[]>([]), [error, setError] = useState('');
  const submitting = useRef(false), pending = useRef<TestCaseRequest | null>(null);
  const selected = dataset?.catalog && catalog && sameReference(dataset.catalog, catalog);
  useEffect(() => {
    if (initialInput && !choice && compatible.length === 1) setChoice(versionKey(compatible[0]));
  }, [initialInput, choice, compatible]);
  async function execute() {
    if (submitting.current || !dataset || !catalog || !selected) return;
    const next = inputIssues(definition, values, taxonomies);
    if (!inputId.trim()) next.push('Enter the input identifier.');
    if (!source.trim()) next.push('Enter the input source.');
    for (const slot of ['story_id', 'module', 'operation', 'application_domain', 'platforms', 'acceptance_criteria', 'nfrs']) {
      const raw = values[definition.method.bindings[slot]], list = Array.isArray(raw) ? raw : [raw];
      if (list.some(value => typeof value !== 'string' || !value.trim() || value !== value.trim())) next.push(`${slot}: provide nonempty values without outer spaces.`);
      if (slot === 'platforms' && !list.length) next.push('Provide at least one platform.');
    }
    setIssues(next); setError(''); if (next.length) return;
    const payload = { definition: reference, dataset: { id: dataset.id, version: dataset.version, format: dataset.snapshot.format, sha256: dataset.snapshot.sha256 }, catalog,
      input: { id: inputId, values, provenance: { source, ...(initialInput?.provenance.sourceRecordId ? { sourceRecordId: initialInput.provenance.sourceRecordId } : {}) } } };
    if (!pending.current || JSON.stringify({ ...pending.current, id: undefined }) !== JSON.stringify(payload)) pending.current = { id: crypto.randomUUID(), ...payload };
    submitting.current = true; onBusy(true);
    try { const run = await recommenderApi.executeTestCases(pending.current); pending.current = null; onCompleted(run); }
    catch (reason) { setError((reason as Error).message); }
    finally { submitting.current = false; onBusy(false); }
  }
  return <form aria-label="Test-case execution" onSubmit={event => { event.preventDefault(); void execute(); }}>
    {initialInput ? <p className="configured-demo-notice">Demonstration using a synthetic dataset. Review whether the test cases fit your story before using them.</p> : <p className="configured-demo-notice">Synthetic demonstration using Manhattan similarity and three neighbors. Recommendation quality has not been empirically validated.</p>}
    <fieldset disabled={busy} className="configured-form-body"><section className="card configured-panel"><h2>{initialInput ? 'Reference dataset' : '2. Reference dataset and catalog'}</h2>
      {!initialInput && <ReferenceDetails title="Selected definition" reference={reference}/>}
      <label>{initialInput ? 'Reference dataset and version' : 'Dataset and version'}<select value={choice} onChange={event => { setChoice(event.target.value); setCatalog(undefined); }}><option value="">{initialInput ? 'Select a compatible dataset' : 'Select a compatible dataset'}</option>{compatible.map(row => <option key={versionKey(row)} value={versionKey(row)}>{row.id} · {row.version} · {row.recordCount} {initialInput ? 'records' : 'records'}</option>)}</select></label>
      {!compatible.length && (initialInput ? <p>No compatible dataset is loaded. Load more datasets or <Link to="/recommender-setup">import a dataset for this recommender</Link>.</p> : <p>No compatible test dataset is loaded. Load more datasets or publish one in configuration.</p>)}{children}
      {dataset?.catalog && <>{!initialInput && <ReferenceDetails title="Selected dataset" reference={{ id: dataset.id, version: dataset.version, ...dataset.snapshot }}/>}<TestCaseCatalogPicker key={versionKey(dataset)} value={catalog} required={dataset.catalog} onChange={setCatalog} autoSelect={!!initialInput}/></>}
      {initialInput ? <details><summary>Versions and method for this run</summary><ReferenceDetails title="Recommender" reference={reference}/>{dataset && <ReferenceDetails title="Dataset" reference={{ id: dataset.id, version: dataset.version, ...dataset.snapshot }}/>}<p>Demonstration using Manhattan similarity and three neighbors. The original experimental configuration has not been reproduced.</p></details> : <p>Only the selected dataset and its exact catalog publication are used. Availability and hashes are checked again when running.</p>}
    </section><section className="card configured-panel"><h2>{initialInput ? 'Test recommendation inputs' : '3. Input and execution'}</h2>
      {initialInput ? <details><summary>Input source</summary><p>{source}</p><p>Story: {inputId}</p></details> : <div className="configured-input-meta"><label>Input identifier<input maxLength={160} value={inputId} onChange={event => setInputId(event.target.value)}/></label><label>Input source<input maxLength={500} value={source} onChange={event => setSource(event.target.value)}/></label></div>}
      <p>{initialInput ? 'Review the fields and complete any missing values before recommending test cases.' : 'Enter the target characteristics. Test answers are withheld; no classification or label-pair selection is required.'}</p>
      <ConfiguredInputFields attributes={definition.attributes.filter(row => row.role !== 'output' && (!initialInput || row.id !== definition.method.bindings.story_id))} values={values} taxonomies={taxonomies} onChange={setValues}/>
      <div className="configured-actions"><button type="submit" className="primary" disabled={busy || !selected}>{initialInput ? busy ? 'Finding test cases…' : 'Recommend test cases' : busy ? 'Running…' : 'Run recommendation'}</button></div>
      {!selected && <p>{initialInput ? 'Select an available dataset to enable recommendations.' : 'Choose a compatible dataset and its catalog to run.'}</p>}
    </section></fieldset>
    {issues.length > 0 && <div role="alert" className="inline-error"><p>Check these fields before running:</p><ul>{issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul></div>}
    {error && <p role="alert" className="inline-error">{error} Your input was preserved for another attempt.</p>}
  </form>;
}
