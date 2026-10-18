import { useRef, useState } from 'react';
import { recommenderApi, supportsWebMethod } from '../services/recommender-api';
import type { ConfiguredInput, ContentReference, DatasetRecord, DefinitionRecord, ImportSpec } from '../types/configurable-recommendations';
import { TEST_CASE_METHOD, type MethodImportRecord, type MethodImportSpec } from '../types/test-case-recommendations';
import { TestCaseCatalogPicker } from './TestCaseCatalogPicker';
import { ReferenceDetails } from './ConfiguredRunDetails';
import { CatalogState, useCatalog, versionKey } from './VersionCatalog';

type FieldMapping = { included: boolean; path: string; encoding: 'value' | 'json' };
const pathParts = (text: string) => text.split('\n');
const validPath = (parts: string[]) => parts.length <= 20 && parts.every(part => part.length > 0 && part.length <= 240);

export function DatasetImporter({ refresh, changed, busy, setBusy }: { refresh: number; changed: () => void; busy: boolean; setBusy: (value: boolean) => void }) {
  const definitions = useCatalog(recommenderApi.definitions, refresh);
  const [choice, setChoice] = useState(''), [definition, setDefinition] = useState<DefinitionRecord>();
  const [id, setId] = useState(''), [version, setVersion] = useState('');
  const [format, setFormat] = useState<'csv' | 'json'>('json'), [delimiter, setDelimiter] = useState<',' | ';' | '\t'>(',');
  const [source, setSource] = useState(''), [basis, setBasis] = useState<ImportSpec['source']['authorization']['basis'] | ''>(''), [authorization, setAuthorization] = useState('');
  const [recordPath, setRecordPath] = useState(''), [mapping, setMapping] = useState<Record<string, FieldMapping>>({});
  const [file, setFile] = useState<File>(), [preview, setPreview] = useState<MethodImportRecord>();
  const [catalog, setCatalog] = useState<ContentReference>();
  const [excluded, setExcluded] = useState<number[]>([]), [published, setPublished] = useState<DatasetRecord>();
  const [error, setError] = useState(''), [page, setPage] = useState(0), [recoverId, setRecoverId] = useState('');
  const running = useRef(false);
  const invalidate = () => { setPreview(undefined); setExcluded([]); setPublished(undefined); setPage(0); setError(''); };
  async function action(task: () => Promise<void>) {
    if (running.current) return; running.current = true; setBusy(true); setError('');
    try { await task(); } catch (reason) { setError((reason as Error).message); } finally { running.current = false; setBusy(false); }
  }
  const fields = definition?.snapshot?.content.definition.attributes ?? [];
  const testCases = definition?.definition.method.id === TEST_CASE_METHOD;
  function importSpec(): MethodImportSpec {
    if (!definition?.snapshot || definition.state !== 'published') throw new Error("Load a published definition.");
    if (!id || !version || !source.trim() || !basis || !authorization.trim()) throw new Error("Enter the dataset ID, version, source, and use declaration.");
    const recordId = pathParts(recordPath);
    if (!validPath(recordId)) throw new Error("Enter the record identity path, one key per line.");
    const attributes: ImportSpec['mapping']['attributes'] = {};
    for (const field of fields) {
      const entry = mapping[field.id];
      if (!entry?.included) { if (field.required) throw new Error(`Map the required attribute: ${field.name}.`); continue; }
      const path = pathParts(entry.path);
      if (!validPath(path)) throw new Error(`Enter the source path for ${field.name}, one key per line.`);
      attributes[field.id] = { path, encoding: entry.encoding };
    }
    if (testCases && (!catalog || basis !== 'synthetic')) throw new Error('Choose a published synthetic catalog and a synthetic use declaration.');
    return { ...(testCases ? { schemaVersion: 2 as const, catalog: catalog! } : { schemaVersion: 1 as const }), id, version, format, ...(format === 'csv' ? { delimiter } : {}),
      definition: { id: definition.definition.id, version: definition.definition.version, format: definition.snapshot.format, sha256: definition.snapshot.sha256 },
      source: { description: source, authorization: { basis, reference: authorization } }, mapping: { recordId, attributes } };
  }
  const report = preview?.snapshot.content.report;
  const includedRows = report?.rows.filter(row => !excluded.includes(row.ordinal)) ?? [];
  // Duplicates are resolved again by the backend after explicit exclusions; do not drop all members of a duplicate group.
  const identityFields = preview ? ['classification_id', 'story_id'].map(slot => preview.snapshot.content.definition.content.definition.method.bindings[slot]).filter(Boolean) : [];
  const identityChecks = [(input: ConfiguredInput) => input.id, ...identityFields.map(field => (input: ConfiguredInput) => String(input.values[field]))];
  const repeated = identityChecks.some(read => {
    const seen = new Set<string>();
    return includedRows.some(row => {
      if (!row.input) return false;
      const value = read(row.input);
      if (seen.has(value)) return true; seen.add(value); return false;
    });
  });
  const canPublish = !!preview && !published && !report!.fatal.length && includedRows.length > 0 && includedRows.every(row => row.input !== null) && !repeated;
  return <section className="card configured-panel" aria-label="Dataset import"><h2>Import and publish dataset</h2><p>Choose a published definition, describe its source, and review the report before publishing. Imported labels are preserved.</p>
    <fieldset disabled={busy} className="configured-form-body"><label>Import definition<select value={choice} onChange={event => { setChoice(event.target.value); setDefinition(undefined); setCatalog(undefined); setMapping({}); invalidate(); }}><option value="">Select</option>{definitions.rows.map(item => <option disabled={!supportsWebMethod(item.method)} key={versionKey(item)} value={versionKey(item)}>{item.name} · {item.id} · {item.version}{!supportsWebMethod(item.method) && ' · API only'}</option>)}</select></label><button type="button" disabled={definitions.loading || !definitions.rows.some(item => versionKey(item) === choice)} onClick={() => void action(async () => {
      const summary = definitions.rows.find(item => versionKey(item) === choice)!;
      const record = await recommenderApi.definition(summary.id, summary.version);
      if (record.state !== 'published' || !record.snapshot || record.snapshot.sha256 !== summary.snapshot?.sha256) throw new Error("Definition unavailable or changed. Refresh the list.");
      setDefinition(record); setMapping(Object.fromEntries(record.definition.attributes.map(field => [field.id, { included: field.required, path: '', encoding: 'value' }]))); invalidate();
    })}>Load dataset schema</button><CatalogState catalog={definitions} title="import definitions"/>
    {definition?.snapshot && <><ReferenceDetails title="Import definition" reference={{ id: definition.definition.id, version: definition.definition.version, format: definition.snapshot.format, sha256: definition.snapshot.sha256 }}/>
      {testCases && <><p>Synthetic E21 equation demonstration. Every dataset record must declare its test IDs; [] means known empty. Missing associations require an explicit exclusion.</p><TestCaseCatalogPicker value={catalog} refresh={refresh} onChange={value => { setCatalog(value); invalidate(); }}/></>}
      <div className="configured-editor-grid"><label>Dataset ID<input value={id} maxLength={80} onChange={event => { setId(event.target.value); invalidate(); }}/></label><label>Dataset version<input value={version} maxLength={80} onChange={event => { setVersion(event.target.value); invalidate(); }}/></label><label>File format<select value={format} onChange={event => { setFormat(event.target.value as 'csv' | 'json'); invalidate(); }}><option value="json">JSON</option><option value="csv">CSV</option></select></label>
        {format === 'csv' && <label>CSV delimiter<select value={delimiter} onChange={event => { setDelimiter(event.target.value as typeof delimiter); invalidate(); }}><option value=",">Comma</option><option value=";">Semicolon</option><option value={'\t'}>Tab</option></select></label>}</div>
      <label>Source description<textarea maxLength={500} value={source} onChange={event => { setSource(event.target.value); invalidate(); }}/></label>
      <div className="configured-editor-grid"><label>Use declaration<select value={basis} onChange={event => { setBasis(event.target.value as typeof basis); invalidate(); }}><option value="">Select</option><option value="synthetic">Synthetic demonstration</option><option value="public-license">Public license</option><option value="permission">Permission granted</option><option value="owned">Own data</option></select></label><label>Authorization reference<textarea maxLength={2000} value={authorization} onChange={event => { setAuthorization(event.target.value); invalidate(); }}/></label></div>
      <label>CSV or JSON file (up to 5 MB)<input type="file" accept=".json,.csv,application/json,text/csv" onChange={event => {
        invalidate(); const selected = event.target.files?.[0]; setFile(selected);
        if (selected && (!selected.size || selected.size > 5_000_000)) setError("The file must contain between 1 and 5,000,000 bytes.");
      }}/></label>
      <h3>Explicit mapping</h3><p>Enter one source key per line. For a column with a dot in its name, enter its full name on one line. For nested JSON, use multiple lines.</p>
      <button type="button" onClick={() => { setRecordPath('id'); setMapping(Object.fromEntries(fields.map(field => [field.id, { included: true,
        path: format === 'json' ? `values\n${field.id}` : field.id,
        encoding: format === 'csv' && (field.cardinality === 'many' || ['record', 'number', 'boolean'].includes(field.valueType.type)) ? 'json' : 'value' }]))); invalidate(); }}>Use US-Agent record mapping</button>
      <label>Record ID path<textarea value={recordPath} onChange={event => { setRecordPath(event.target.value); invalidate(); }}/></label>
      <div className="configured-fields">{fields.map(field => { const entry = mapping[field.id]; return <div className="configured-attribute" key={field.id}><h4>{field.name} · {field.id}</h4><p>{field.required ? "Required" : "Optional"} · {field.cardinality === 'many' ? "List" : "One value"}</p>
        {!field.required && <label className="configured-optional"><input type="checkbox" checked={entry?.included ?? false} onChange={event => { setMapping({ ...mapping, [field.id]: { ...entry, included: event.target.checked } }); invalidate(); }}/>Mapear {field.name}</label>}
        {entry?.included && <><label>Path for {field.name}<textarea value={entry.path} onChange={event => { setMapping({ ...mapping, [field.id]: { ...entry, path: event.target.value } }); invalidate(); }}/></label><label>Read {field.name}<select value={entry.encoding} onChange={event => { setMapping({ ...mapping, [field.id]: { ...entry, encoding: event.target.value as FieldMapping['encoding'] } }); invalidate(); }}><option value="value">Source value</option><option value="json">JSON cell content</option></select></label></>}
      </div>; })}</div><button type="button" className="primary" disabled={!file || !file.size || file.size > 5_000_000} onClick={() => void action(async () => {
        const spec = importSpec(); if (!file) return;
        const result = await recommenderApi.previewDataset(spec, file); setPreview(result); setExcluded([]); setPublished(undefined); setPage(0); setRecoverId(result.id);
      })}>Generate import preview</button>
    </>}
    <details><summary>Load preserved preview</summary><p>Use a previous preview ID to resume review. Loading it does not change the file or mapping.</p><label>Preview ID<input value={recoverId} onChange={event => setRecoverId(event.target.value)}/></label><button type="button" disabled={!recoverId} onClick={() => void action(async () => {
      const recovered = await recommenderApi.datasetImport(recoverId); setPreview(recovered); setExcluded([]); setPublished(undefined); setPage(0);
    })}>Load preview</button></details>
    </fieldset>
    {preview && report && <div className="configured-import-preview"><h3>Preserved preview</h3><p>Preview ID: <code>{preview.id}</code></p><ReferenceDetails title="Definition preserved in preview" reference={preview.snapshot.content.spec.definition}/>
      {preview.snapshot.content.schemaVersion === 2 && <ReferenceDetails title="Catalog preserved in preview" reference={preview.snapshot.content.spec.catalog}/>}
      <p>Dataset to publish: <b>{preview.snapshot.content.spec.id} · {preview.snapshot.content.spec.version}</b></p>
      <p>Source: {preview.snapshot.content.spec.source.description} · {preview.snapshot.content.spec.source.authorization.basis} · {preview.snapshot.content.spec.source.authorization.reference}</p>
      <p>File: {preview.snapshot.content.file.name} · {preview.snapshot.content.file.byteLength} bytes</p><p className="configured-hash">File SHA-256: {preview.snapshot.content.file.sha256}</p><p className="configured-hash">Preview SHA-256: {preview.snapshot.sha256}</p>
      <p>{report.total} registro(s) · {report.valid} valid · {report.invalid} invalid · {report.duplicate} with duplicate identities.</p>
      {report.fatal.map((issue, index) => <p role="alert" key={index}>{issue.message}</p>)}
      <p>Unmapped source fields: {report.unmappedSourceFields.join(', ') || 'nenhum'}.</p>
      <details><summary>Inspect preserved mapping</summary><pre className="configured-value">{JSON.stringify(preview.snapshot.content.spec.mapping, null, 2)}</pre></details>
      <p>Review every exclusion. Duplicates are checked again after exclusions; one valid occurrence can be retained.</p>
      <div className="table-wrap"><table><thead><tr><th>Exclude</th><th>Record / line</th><th>ID</th><th>State</th><th>Issues and values</th></tr></thead><tbody>{report.rows.slice(page * 50, (page + 1) * 50).map(row => <tr key={row.ordinal}>
        <td><input type="checkbox" aria-label={`Exclude record ${row.ordinal}`} disabled={busy || !!published} checked={excluded.includes(row.ordinal)} onChange={event => setExcluded(current => event.target.checked ? [...current, row.ordinal] : current.filter(value => value !== row.ordinal))}/></td><td>{row.ordinal} / {row.line ?? '—'}</td><td>{row.id ?? '—'}</td><td>{({ valid: "Valid", invalid: "Invalid", duplicate: "Duplicate identity" })[row.status]}</td><td>{row.issues.map((issue, index) => <p key={index}>{issue.path.join(' / ')}: {issue.message}</p>)}{row.input && <details><summary>Mapped values</summary><pre className="configured-value">{JSON.stringify(row.input, null, 2)}</pre></details>}</td>
      </tr>)}</tbody></table></div>
      <div className="configured-actions"><button type="button" disabled={page === 0} onClick={() => setPage(value => value - 1)}>Previous records</button><span>Page {page + 1}</span><button type="button" disabled={(page + 1) * 50 >= report.rows.length} onClick={() => setPage(value => value + 1)}>Next records</button></div>
      <p>{includedRows.length} selected records · {excluded.length} exclusions.{!canPublish && !published && " Correct fatal errors or resolve invalid and duplicate records with explicit exclusions before publishing."}</p>
      <button type="button" className="primary" disabled={busy || !canPublish} onClick={() => void action(async () => {
        const spec = preview.snapshot.content.spec;
        const result = await recommenderApi.publishDataset(spec.id, spec.version, preview.id, preview.snapshot.sha256, [...excluded].sort((a, b) => a - b));
        setPublished(result); changed();
      })}>Publish reviewed dataset</button>
      {published && <><p role="status">Dataset published. The version and selection were preserved.</p><ReferenceDetails title="Published dataset" reference={{ id: published.snapshot.content.id, version: published.snapshot.content.version, format: published.snapshot.format, sha256: published.snapshot.sha256 }}/></>}
    </div>}{error && <p className="inline-error" role="alert">{error}</p>}
  </section>;
}
