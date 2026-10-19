import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { initialValues, taxonomyOptions } from '../services/configured-input';
import { recommenderApi } from '../services/recommender-api';
import type { ConfiguredInput, DatasetSummary, DefinitionRecord, DefinitionSummary, JsonValue } from '../types/configurable-recommendations';
import type { Story } from '../types/models';
import type { NfrContext } from '../types/nfr';
import { TEST_CASE_METHOD } from '../types/test-case-recommendations';
import { CatalogState, useCatalog, versionKey } from './VersionCatalog';
import { TestCaseExecutionForm } from './TestCaseExecutionForm';
import { ConfiguredRunDetails } from './ConfiguredRunDetails';

type Publication = DefinitionRecord & { snapshot: NonNullable<DefinitionRecord['snapshot']> };

// Copy only declared bindings and compatible values. Taxonomy names are not IDs:
// unmatched operational values remain for explicit selection in the published form.
function projectInput(record: Publication, target: NfrContext['target'], labelIndex: number): ConfiguredInput {
  const { definition, taxonomies } = record.snapshot.content;
  const values = initialValues(definition);
  const label = target.labels[labelIndex];
  const source: Record<string, string | string[]> = {
    story_id: target.storyId, module: label?.module ?? '', operation: label?.operation ?? '',
    platforms: target.projectProfile.platforms,
    application_domain: target.projectProfile.applicationDomains.length === 1 ? target.projectProfile.applicationDomains[0] : ''
  };
  for (const [slot, raw] of Object.entries(source)) {
    const attribute = definition.attributes.find(row => row.id === definition.method.bindings[slot]);
    if (!attribute) continue;
    const type = attribute.valueType;
    const accepts = (value: string) => type.type === 'taxonomy_node'
      ? taxonomyOptions(type, taxonomies).some(option => option.id === value)
      : type.type === 'enum' ? type.values.includes(value) : type.type === 'text' || type.type === 'category';
    if (Array.isArray(raw)) {
      // Do not silently drop unknown members and present a partial profile as complete.
      if (raw.every(accepts)) values[attribute.id] = [...new Set(raw)];
    } else if (raw && accepts(raw)) values[attribute.id] = raw;
  }
  return { id: target.storyId, values, provenance: {
    source: `Project ${target.project}; profile and classification ${target.classificationId}`,
    sourceRecordId: target.classificationId
  } };
}

export function ProjectTestRecommendations({ story, busy, onBusy }: {
  story: Story; busy: boolean; onBusy: (value: boolean) => void;
}) {
  const definitions = useCatalog(recommenderApi.definitions, 0);
  const datasets = useCatalog(recommenderApi.datasets, 0);
  const [choice, setChoice] = useState('');
  const available = definitions.rows.filter(row => row.state === 'published' && row.method === TEST_CASE_METHOD && row.snapshot);
  const selected = available.find(row => versionKey(row) === choice) ?? (!choice && available.length === 1 ? available[0] : undefined);
  return <>
    <section className="card configured-panel"><h2>Test cases</h2><p>Use a published configuration and reference dataset. Compatible fields are filled from the selected story and project profile.</p>
      <label>Recommender and version<select disabled={busy || definitions.loading} value={selected ? versionKey(selected) : ''} onChange={event => setChoice(event.target.value)}>
        <option value="">Select a configuration</option>{available.map(row => <option key={versionKey(row)} value={versionKey(row)}>{row.name} · {row.version}</option>)}
      </select></label><CatalogState catalog={definitions} title="recommenders"/>
      {!definitions.loading && !definitions.error && !available.length && <p>No test-case recommender has been published. <Link to="/recommender-setup">Configure a recommender and import a dataset</Link></p>}
    </section>
    {selected && <ProjectTestExecution key={versionKey(selected)} summary={selected} story={story} datasets={datasets.rows} busy={busy} onBusy={onBusy}>
      <CatalogState catalog={datasets} title="reference datasets"/>
    </ProjectTestExecution>}
  </>;
}

function ProjectTestExecution({ summary, story, datasets, busy, onBusy, children }: {
  summary: DefinitionSummary; story: Story; datasets: DatasetSummary[]; busy: boolean;
  onBusy: (value: boolean) => void; children: React.ReactNode;
}) {
  const [loaded, setLoaded] = useState<{ record: Publication; context: NfrContext }>();
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [pair, setPair] = useState('');
  const [resultId, setResultId] = useState('');
  const resultPanel = useRef<HTMLElement>(null);
  useEffect(() => { if (resultId) resultPanel.current?.focus(); }, [resultId]);
  useEffect(() => {
    let active = true; const controller = new AbortController();
    setLoaded(undefined); setError(''); setResultId(''); setPair('');
    Promise.all([recommenderApi.definition(summary.id, summary.version, controller.signal), api.nfrContext(story.id)])
      .then(([record, context]) => {
        if (!active) return;
        if (record.state !== 'published' || !record.snapshot || record.snapshot.sha256 !== summary.snapshot?.sha256 || record.snapshot.format !== summary.snapshot?.format) {
          throw new Error('The configuration has changed. Refresh the page and select a published version.');
        }
        setLoaded({ record: record as Publication, context });
      }).catch((reason: Error) => { if (active) setError(reason.message); });
    return () => { active = false; controller.abort(); };
  }, [summary.id, summary.version, summary.snapshot?.sha256, summary.snapshot?.format, story.id, retry]);
  if (error) return <section className="card configured-panel" role="alert"><p>{error}</p><button onClick={() => setRetry(value => value + 1)}>Try again</button></section>;
  if (!loaded) return <p role="status">Loading the project profile and configuration…</p>;
  const { record, context } = loaded;
  const labels = context.target.labels;
  const labelIndex = labels.length === 1 ? 0 : pair === '' ? -1 : Number(pair);
  const prepared = labelIndex >= 0 ? projectInput(record, context.target, labelIndex) : undefined;
  const copied = prepared ? record.definition.attributes.filter(attribute => attribute.role === 'feature' &&
    Object.hasOwn(prepared.values, attribute.id) && (Array.isArray(prepared.values[attribute.id])
      ? (prepared.values[attribute.id] as JsonValue[]).length > 0 : !!prepared.values[attribute.id])).map(attribute => attribute.name) : [];
  return <>
    {labels.length !== 1 && <section className="card configured-panel"><label>Classification for this recommendation<select disabled={busy} value={pair} onChange={event => { setPair(event.target.value); setResultId(''); }}>
      <option value="">Select a module and operation</option>{labels.map((label, index) => <option key={index} value={index}>{label.module} / {label.operation}</option>)}
    </select></label></section>}
    {prepared && <>
      <section className="card configured-panel"><h2>Complete the story details</h2>
        <p>{copied.length ? `Filled from the project and classification: ${copied.join(', ')}.` : 'Select values from this recommender’s taxonomy below.'} Complete the acceptance criteria and any other required fields. Changes below apply to this run.</p>
        {context.target.nfrs.length > 0 && <details><summary>NFRs already linked to the story</summary><ul>{context.target.nfrs.map((item, index) => <li key={index}>{item.type} / {item.attribute}: {item.sentence}</li>)}</ul><p>Select the corresponding identifiers from the recommender’s taxonomy in the form.</p></details>}
        <details><summary>Saved project profile</summary><p>Platforms: {context.target.projectProfile.platforms.join(', ') || 'Not specified'}</p><p>Application domains: {context.target.projectProfile.applicationDomains.join(', ') || 'Not specified'}</p></details>
        <p>Values from another taxonomy require explicit selection. Your saved profile is available under “View profile and tasks”.</p>
      </section>
      <TestCaseExecutionForm key={`${record.snapshot.sha256}:${labelIndex}`} record={record} datasets={datasets} busy={busy} onBusy={onBusy} initialInput={prepared} onCompleted={run => setResultId(run.id)}>{children}</TestCaseExecutionForm>
    </>}
    {resultId && <section ref={resultPanel} tabIndex={-1} className="card configured-panel" aria-label="Test-case recommendation result"><h2>Recommended test cases</h2><p>This result was saved for this run. Run the recommendation again after changing the input.</p><ConfiguredRunDetails key={resultId} id={resultId} compact/></section>}
  </>;
}
