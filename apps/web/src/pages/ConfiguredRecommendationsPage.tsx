import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ConfiguredInputFields } from '../components/ConfiguredInputFields';
import { ConfiguredRunDetails, ReferenceDetails, configuredStatus } from '../components/ConfiguredRunDetails';
import { PageTitle } from '../components/ui';
import { CatalogState, useCatalog } from '../components/VersionCatalog';
import { initialValues, inputIssues } from '../services/configured-input';
import { recommenderApi, supportsWebMethod } from '../services/recommender-api';
import type { ConfiguredInput, ConfiguredRun, ContentReference, DatasetSummary, DefinitionRecord, DefinitionSummary, RecommendationRequest } from '../types/configurable-recommendations';
import { TEST_CASE_METHOD, type MethodRun } from '../types/test-case-recommendations';
import { TestCaseExecutionForm } from '../components/TestCaseExecutionForm';

const identity = (value: { id: string; version: string }) => JSON.stringify([value.id, value.version]);
const matches = (left: ContentReference, right: ContentReference) => identity(left) === identity(right) && left.format === right.format && left.sha256 === right.sha256;

export function ConfiguredRecommendationsPage() {
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState(params.has('runId') ? 'history' : 'execute');
  const [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const definitions = useCatalog(recommenderApi.definitions, 0);
  const datasets = useCatalog(recommenderApi.datasets, 0);
  const selectedDefinition = definitions.rows.find(row => identity(row) === selected);
  const runId = params.get('runId');
  const history = useCatalog(recommenderApi.runs, refresh);
  useEffect(() => { if (runId) setTab('history'); }, [runId]);
  const openRun = (id: string) => { setParams({ runId: id }); setTab('history'); };
  function completed(run: MethodRun) { setRefresh(value => value + 1); openRun(run.id); }
  return <section className="page configured-page">
    <PageTitle eyebrow="RECOMMENDERS" title="Run with a published dataset">Choose versions, complete the input, and inspect the evidence for each recommendation.</PageTitle>
    <div className="configured-actions configured-tabs" role="group" aria-label="Recommender area"><button aria-pressed={tab === 'execute'} disabled={busy} onClick={() => setTab('execute')}>New run</button><button aria-pressed={tab === 'history'} disabled={busy} onClick={() => setTab('history')}>Run history</button>{!busy && <Link to="/recommender-setup">Configure and import datasets</Link>}<Link to="/recommendations">NFRs by story</Link></div>
    <div hidden={tab !== 'execute'}>
      <section className="card configured-panel"><h2>1. Published definition</h2><p>The form follows the published attributes and method: Felipe Ramos's NFR policy or the synthetic E21 test-case equation demonstration.</p>
        <label>Definition and version<select disabled={busy || definitions.loading} value={selected} onChange={event => setSelected(event.target.value)}><option value="">Select a version</option>{definitions.rows.map(row => <option disabled={!supportsWebMethod(row.method)} key={identity(row)} value={identity(row)}>{row.name} · {row.id} · {row.version}{!supportsWebMethod(row.method) && ' · API only'}</option>)}</select></label>
        {!definitions.loading && !definitions.error && !definitions.rows.length && <p>No published definition is available. Open “Configure and import datasets” to prepare the recommender.</p>}
        <CatalogState catalog={definitions} title="definitions"/>
      </section>
      {selectedDefinition && <DefinitionExecution key={identity(selectedDefinition)} summary={selectedDefinition} datasets={datasets.rows} busy={busy} onBusy={setBusy} onCompleted={completed}>
        <CatalogState catalog={datasets} title="datasets"/>
      </DefinitionExecution>}
    </div>
    <section className="card configured-panel" hidden={tab !== 'history'}><h2>Run history</h2><p>Evidence uses the recorded versions, including retired dependencies.</p>
      <div className="configured-actions"><button disabled={history.loading || busy} onClick={() => setRefresh(value => value + 1)}>Refresh history</button></div>
      <CatalogState catalog={history} title="runs"/>
      {!history.loading && !history.error && !history.rows.length && <p>No runs recorded.</p>}
      {history.rows.length > 0 && <div className="table-wrap"><table><thead><tr><th>Data</th><th>Definition / version</th><th>Dataset / version</th><th>Resultado</th><th>Evidence</th></tr></thead><tbody>{history.rows.map(row => <tr key={row.id}>
        <td>{new Date(row.createdAt).toLocaleString('en-US')}</td><td>{row.definition.id} · {row.definition.version}</td><td>{row.dataset.id} · {row.dataset.version}</td><td>{configuredStatus[row.status]}</td><td><button aria-label={`Open run ${row.id}`} onClick={() => openRun(row.id)} aria-pressed={runId === row.id}>Abrir</button></td>
      </tr>)}</tbody></table></div>}
      {runId && <ConfiguredRunDetails key={runId} id={runId}/>}
    </section>
  </section>;
}

function DefinitionExecution({ summary, datasets, busy, onBusy, onCompleted, children }: {
  summary: DefinitionSummary; datasets: DatasetSummary[]; busy: boolean; onBusy: (value: boolean) => void;
  onCompleted: (run: MethodRun) => void; children: React.ReactNode;
}) {
  const [record, setRecord] = useState<DefinitionRecord>();
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    setRecord(undefined); setError('');
    recommenderApi.definition(summary.id, summary.version, controller.signal).then(value => {
      if (!active) return;
      if (value.state !== 'published' || !value.snapshot || !summary.snapshot || value.snapshot.sha256 !== summary.snapshot.sha256 || value.snapshot.format !== summary.snapshot.format) throw new Error("This publication's availability has changed. Refresh the page and choose an available definition.");
      setRecord(value);
    }).catch((reason: Error) => { if (active) setError(reason.message); });
    return () => { active = false; controller.abort(); };
  }, [summary.id, summary.version, summary.snapshot?.sha256, summary.snapshot?.format, retry]);
  if (error) return <div className="card configured-panel" role="alert"><p>{error}</p><button onClick={() => setRetry(value => value + 1)}>Retry loading definition</button></div>;
  if (!record?.snapshot) return <p role="status">Loading definition attributes and taxonomies…</p>;
  const Form = record.definition.method.id === TEST_CASE_METHOD ? TestCaseExecutionForm : ExecutionForm;
  return <Form key={record.snapshot.sha256} record={record as DefinitionRecord & { snapshot: NonNullable<DefinitionRecord['snapshot']> }} datasets={datasets} busy={busy} onBusy={onBusy} onCompleted={onCompleted}>{children}</Form>;
}

function ExecutionForm({ record, datasets, busy, onBusy, onCompleted, children }: {
  record: DefinitionRecord & { snapshot: NonNullable<DefinitionRecord['snapshot']> }; datasets: DatasetSummary[];
  busy: boolean; onBusy: (value: boolean) => void; onCompleted: (run: ConfiguredRun) => void; children: React.ReactNode;
}) {
  const definition = record.snapshot.content.definition, taxonomies = record.snapshot.content.taxonomies;
  const reference: ContentReference = { id: definition.id, version: definition.version, format: record.snapshot.format, sha256: record.snapshot.sha256 };
  const compatible = datasets.filter(dataset => dataset.state === 'published' && matches(dataset.definition, reference));
  const [datasetKey, setDatasetKey] = useState('');
  const dataset = compatible.find(row => identity(row) === datasetKey);
  const [inputId, setInputId] = useState('');
  const [source, setSource] = useState("Manual input");
  const [values, setValues] = useState<ConfiguredInput['values']>(() => initialValues(definition));
  const [labelIndex, setLabelIndex] = useState('');
  const [issues, setIssues] = useState<string[]>([]);
  const [error, setError] = useState('');
  const pending = useRef<RecommendationRequest | null>(null);
  const submitting = useRef(false);
  const labelValues = values[definition.method.bindings.labels];
  const labels = Array.isArray(labelValues) ? labelValues as Array<{ module?: string; operation?: string }> : [];
  const labelSignature = JSON.stringify(labelValues);
  useEffect(() => { setLabelIndex(''); }, [labelSignature]);
  async function execute() {
    if (submitting.current || !dataset) return;
    const nextIssues = inputIssues(definition, values, taxonomies);
    if (!inputId.trim()) nextIssues.push("Enter the input identifier.");
    if (!source.trim()) nextIssues.push("Enter the input source.");
    if (labelIndex === '' || !labels[Number(labelIndex)]) nextIssues.push("Choose the module/operation pair for this run.");
    setIssues(nextIssues); setError('');
    if (nextIssues.length) return;
    const payload = { definition: reference, dataset: { id: dataset.id, version: dataset.version, ...dataset.snapshot },
      input: { id: inputId, values, provenance: { source } }, selection: { labelIndex: Number(labelIndex) } };
    // Preserve the UUID after an uncertain network failure. Changed input always gets a new UUID.
    if (!pending.current || JSON.stringify({ ...pending.current, id: undefined }) !== JSON.stringify(payload)) pending.current = { id: crypto.randomUUID(), ...payload };
    submitting.current = true; onBusy(true);
    try { const run = await recommenderApi.execute(pending.current); pending.current = null; onCompleted(run); }
    catch (reason) { setError((reason as Error).message); }
    finally { submitting.current = false; onBusy(false); }
  }
  return <form onSubmit={event => { event.preventDefault(); void execute(); }}>
    <fieldset disabled={busy} className="configured-form-body"><section className="card configured-panel"><h2>2. Reference dataset</h2>
      <ReferenceDetails title="Selected definition" reference={reference}/>
      <label>Dataset and version<select value={dataset?.id ? datasetKey : ''} onChange={event => setDatasetKey(event.target.value)}><option value="">Select a compatible dataset</option>{compatible.map(row => <option key={identity(row)} value={identity(row)}>{row.id} · {row.version} · {row.recordCount} records</option>)}</select></label>
      {!compatible.length && <p>No compatible dataset is loaded. Load more datasets, if available, or publish a dataset linked to this definition through the API.</p>}
      {children}{dataset && <ReferenceDetails title="Selected dataset" reference={{ id: dataset.id, version: dataset.version, ...dataset.snapshot }}/>}
      <p>Only this dataset will be compared. Availability and hashes are checked again when running.</p>
    </section><section className="card configured-panel"><h2>3. Input and execution</h2><div className="configured-input-meta"><label>Input identifier<input maxLength={160} value={inputId} onChange={event => setInputId(event.target.value)}/></label><label>Input source<input maxLength={500} value={source} onChange={event => setSource(event.target.value)}/></label></div>
      <p>Use original identifiers when representing the same artifact. Additional context appears in the form without changing the NFR calculation.</p>
      <ConfiguredInputFields attributes={definition.attributes} values={values} taxonomies={taxonomies} onChange={setValues}/>
      <label>Module/operation pair for this run<select value={labelIndex} onChange={event => setLabelIndex(event.target.value)}><option value="">Select a pair entered above</option>{labels.map((label, index) => <option key={index} value={index}>{label.module || "Empty module"} / {label.operation || "Empty operation"}</option>)}</select></label>
      <div className="configured-actions"><button type="submit" className="primary" disabled={!dataset || busy}>{busy ? 'Executando…' : "Run recommendation"}</button></div>
      {!dataset && <p>Choose a compatible dataset to run.</p>}
    </section></fieldset>
    {issues.length > 0 && <div className="inline-error" role="alert"><p>Check these fields before running:</p><ul>{issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul></div>}
    {error && <p className="inline-error" role="alert">{error} Your input was preserved for another attempt.</p>}
  </form>;
}
