import { useRef, useState } from 'react';
import { api } from '../services/api';
import { recommenderApi } from '../services/recommender-api';
import { initialValues, inputIssues } from '../services/configured-input';
import type { ConfiguredInput, DefinitionRecord } from '../types/configurable-recommendations';
import { ConfiguredInputFields } from './ConfiguredInputFields';

type Row = { project: string; input: ConfiguredInput; reviewed: boolean };

export function RegisteredProjectDataset({ definition, busy, setBusy, onUse, onEdit }: {
  definition: DefinitionRecord; busy: boolean; setBusy: (value: boolean) => void;
  onUse: (file: File) => void; onEdit: () => void;
}) {
  const [projects, setProjects] = useState<string[]>();
  const [project, setProject] = useState(''), [rows, setRows] = useState<Row[]>([]), [error, setError] = useState('');
  const [selectedOutput, setSelectedOutput] = useState('');
  const running = useRef(false);
  const publication = definition.snapshot!;
  const schema = publication.content.definition;
  const outputs = schema.attributes.filter(attribute => attribute.role === 'output');
  async function action(task: () => Promise<void>) {
    if (running.current) return;
    running.current = true; setBusy(true); setError('');
    try { await task(); } catch (reason) { setError((reason as Error).message); }
    finally { running.current = false; setBusy(false); }
  }
  function update(next: Row[]) { setRows(next); setError(''); onEdit(); }
  function useRecords() {
    const issues = rows.flatMap(row => {
      const result = inputIssues(schema, row.input.values, publication.content.taxonomies);
      for (const attribute of schema.attributes.filter(attribute => attribute.role === 'feature')) {
        const raw = row.input.values[attribute.id];
        const values = Array.isArray(raw) ? raw : [raw];
        if (!values.length || values.some(value => typeof value !== 'string' || !value.trim())) result.push(`Complete ${attribute.name}.`);
      }
      for (const attribute of outputs) {
        const values = row.input.values[attribute.id];
        if (Array.isArray(values) && values.some(value => typeof value !== 'string' || !value.trim())) result.push(`Remove or fill empty items in ${attribute.name}.`);
      }
      if (!row.reviewed) result.push('Review the associated outputs.');
      return result.map(issue => `${row.project}: ${issue}`);
    });
    if (issues.length) { setError(issues.join('\n')); return; }
    const file = new File([JSON.stringify(rows.map(row => row.input))], 'registered-projects.json', { type: 'application/json' });
    if (file.size > 5_000_000) { setError('The selected records exceed 5 MB. Remove projects before preparing the preview.'); return; }
    onUse(file);
  }
  return <section className="configured-subeditor" aria-label="Registered project dataset"><h3>Build a reference dataset from registered projects</h3>
    <p>Select projects, review their comparison values and enter the items associated with each one. Saved recommender profiles and configured project sources prefill the features. Changes here belong to this dataset.</p>
    <button type="button" onClick={() => void action(async () => { setProjects(await api.projects()); })}>{projects ? 'Refresh registered projects' : 'Load registered projects'}</button>
    {projects && <><label>Reference project<select value={project} onChange={event => setProject(event.target.value)}><option value="">Select a project</option>{projects.filter(name => !rows.some(row => row.project === name)).map(name => <option key={name} value={name}>{name}</option>)}</select></label>
      {!projects.length && <p>No registered projects are available.</p>}
      <button type="button" disabled={busy || !project || rows.length >= 10_000} onClick={() => void action(async () => {
        const profile = await recommenderApi.projectProfile(project, { id: schema.id, version: schema.version, format: publication.format, sha256: publication.sha256 });
        update([...rows, { project, reviewed: false, input: { id: `project:${profile.projectId}`, values: { ...initialValues(schema), ...profile.values }, provenance: { source: `Registered project: ${project}`, sourceRecordId: profile.projectId } } }]);
        setProject('');
      })}>Add reference project</button></>}
    {rows.length > 0 && <>
      <p>{rows.length} reference projects selected. Empty output lists mean a reviewed absence of associated items.</p>
      <div className="configured-editor-grid"><label>Output for project names<select value={selectedOutput} onChange={event => setSelectedOutput(event.target.value)}><option value="">Select an output</option>{outputs.map(attribute => <option key={attribute.id} value={attribute.id}>{attribute.name}</option>)}</select></label>
        <button type="button" disabled={!selectedOutput} onClick={() => update(rows.map(row => ({ ...row, reviewed: false, input: { ...row.input, values: { ...row.input.values, [selectedOutput]: [row.project] } } })))}>Use project names as recommendations</button></div>
      {rows.map((row, index) => <details key={row.input.id} className="configured-subeditor" open><summary>{row.project}</summary>
        <ConfiguredInputFields attributes={schema.attributes} values={row.input.values} taxonomies={publication.content.taxonomies} onChange={values => update(rows.map((item, position) => position === index ? { ...item, reviewed: false, input: { ...item.input, values } } : item))}/>
        <label className="configured-optional"><input type="checkbox" checked={row.reviewed} onChange={event => update(rows.map((item, position) => position === index ? { ...item, reviewed: event.target.checked } : item))}/>I reviewed the associated outputs for {row.project}, including any empty lists.</label>
        <button type="button" onClick={() => update(rows.filter((_, position) => position !== index))}>Remove reference project {row.project}</button>
      </details>)}
      <button type="button" disabled={busy} onClick={useRecords}>Use selected project records</button>
    </>}
    {error && <p className="inline-error" role="alert" style={{ whiteSpace: 'pre-line' }}>{error}</p>}
  </section>;
}
