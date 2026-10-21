import { useRef, useState } from 'react';
import { recommenderApi } from '../services/recommender-api';
import type { TestCaseCatalog, TestCaseCatalogRecord } from '../types/test-case-recommendations';
import { ReferenceDetails } from './ConfiguredRunDetails';
import { CatalogState, useCatalog, versionKey } from './VersionCatalog';
import { parseImportJson } from '../../../api/src/domain/import-formats';

/** Review feedback only; publication validates the original bytes with the authoritative API schema. */
export async function reviewTestCaseFile(file: File) {
  if (!file.size || file.size > 5_000_000) throw new Error('The file must contain between 1 and 5,000,000 bytes.');
  const bytes = await file.arrayBuffer();
  const catalog = parseImportJson(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as TestCaseCatalog;
  if (!catalog || catalog.schemaVersion !== 1 || typeof catalog.id !== 'string' || typeof catalog.version !== 'string'
      || catalog.source?.kind !== 'synthetic' || typeof catalog.source.reference !== 'string' || !Array.isArray(catalog.items)
      || catalog.items.some(row => !row || typeof row.id !== 'string' || typeof row.title !== 'string' || typeof row.gherkin !== 'string')
      || new Set(catalog.items.map(row => row.id)).size !== catalog.items.length) throw new Error('Provide a schema 1 synthetic catalog with distinct test IDs, titles and Gherkin.');
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return { catalog, sha256: [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('') };
}
export function TestCaseCatalogEditor({ refresh, changed, busy, setBusy }: { refresh: number; changed: () => void; busy: boolean; setBusy: (value: boolean) => void }) {
  const versions = useCatalog(recommenderApi.testCaseCatalogs, refresh);
  const [mode, setMode] = useState('browse');
  const [choice, setChoice] = useState(''), [loaded, setLoaded] = useState<TestCaseCatalogRecord>();
  const [file, setFile] = useState<File>(), [reviewed, setReviewed] = useState<Awaited<ReturnType<typeof reviewTestCaseFile>>>();
  const [reference, setReference] = useState(''), [error, setError] = useState(''), [message, setMessage] = useState(''), [page, setPage] = useState(0);
  const running = useRef(false);
  async function action(task: () => Promise<void>) {
    if (running.current) return; running.current = true; setBusy(true); setError(''); setMessage('');
    try { await task(); } catch (reason) { setError((reason as Error).message); } finally { running.current = false; setBusy(false); }
  }
  const catalog = reviewed?.catalog ?? loaded?.snapshot.content.catalog.content;
  return <section className="card configured-panel" aria-label="Test catalog editor"><h2>Test-case catalogs</h2>
    <p>Catalogs preserve test artifacts independently from taxonomies and dataset associations. This web flow publishes synthetic demonstration catalogs only.</p>
    <div className="section-navigation" role="group" aria-label="Test catalog tasks"><button disabled={busy} aria-pressed={mode === 'browse'} onClick={() => setMode('browse')}>Browse catalogs</button><button disabled={busy} aria-pressed={mode === 'import'} onClick={() => setMode('import')}>Import test catalog</button></div>
    <fieldset hidden={mode !== 'browse'} disabled={busy} className="configured-form-body"><label>Catalog to inspect<select value={choice} onChange={event => setChoice(event.target.value)}><option value="">Select</option>{versions.rows.map(row => <option key={versionKey(row)} value={versionKey(row)}>{row.id} · {row.version} · {row.state}</option>)}</select></label>
      <button type="button" disabled={!choice || versions.loading} onClick={() => void action(async () => {
        const summary = versions.rows.find(row => versionKey(row) === choice); if (!summary) return;
        const record = await recommenderApi.testCaseCatalog(summary.id, summary.version);
        if (record.snapshot.sha256 !== summary.snapshot.sha256 || record.snapshot.format !== summary.snapshot.format) throw new Error('Catalog changed. Refresh the versions.');
        setLoaded(record); setReviewed(undefined); setPage(0);
      })}>Inspect catalog version</button><CatalogState catalog={versions} title="catalog versions"/>
    </fieldset>
    <fieldset hidden={mode !== 'import'} disabled={busy} className="configured-form-body">
      <label>Catalog JSON file (up to 5 MB)<input type="file" accept=".json,application/json" onChange={event => { setFile(event.target.files?.[0]); setReviewed(undefined); setLoaded(undefined); setPage(0); setError(''); setMessage(''); }}/></label>
      <button type="button" disabled={!file} onClick={() => void action(async () => { if (file) { setReviewed(await reviewTestCaseFile(file)); setLoaded(undefined); setPage(0); } })}>Review catalog file</button>
      <label>Catalog use declaration<textarea maxLength={2000} value={reference} onChange={event => setReference(event.target.value)}/></label>
      <p>Describe the synthetic data's authorship or origin. Publication preserves this declaration and the exact reviewed file bytes.</p>
      <button type="button" className="primary" disabled={!file || !reviewed || !reference.trim()} onClick={() => void action(async () => {
        if (!file || !reviewed || !reference.trim()) return;
        const record = await recommenderApi.publishTestCaseCatalog(reviewed.catalog.id, reviewed.catalog.version, file, reviewed.sha256, reference);
        setLoaded(record); setReviewed(undefined); setPage(0); setMessage('Catalog published with its original file and use declaration.'); changed();
      })}>Publish reviewed catalog</button>
    </fieldset>
    {catalog && <div><h3>{reviewed ? 'Review before publication' : 'Preserved catalog'}: {catalog.id} · {catalog.version}</h3><p>Source: {catalog.source.reference} · {catalog.items.length} tests.</p>
      {reviewed && <p className="configured-hash">Reviewed file SHA-256: {reviewed.sha256}. The API validates the complete original file before publication.</p>}
      {loaded && <><p>State: {loaded.state} · Technical actor: {loaded.publishedBy}</p><ReferenceDetails title="Catalog publication" reference={{ id: loaded.snapshot.content.id, version: loaded.snapshot.content.version, format: loaded.snapshot.format, sha256: loaded.snapshot.sha256 }}/><p>Use declaration: {loaded.snapshot.content.authorization.basis} · {loaded.snapshot.content.authorization.reference}</p><a href={`/api/internal/test-case-catalogs/${encodeURIComponent(catalog.id)}/versions/${encodeURIComponent(catalog.version)}/original`}>Download original catalog file</a></>}
      {catalog.items.slice(page * 20, (page + 1) * 20).map(row => <details className="configured-attribute" key={row.id}><summary>{row.title} · {row.id}</summary><pre className="configured-value">{row.gherkin}</pre><pre className="configured-value">{JSON.stringify(row, null, 2)}</pre></details>)}
      <div className="configured-actions"><button type="button" disabled={page === 0} onClick={() => setPage(value => value - 1)}>Previous catalog tests</button><span>Page {page + 1}</span><button type="button" disabled={(page + 1) * 20 >= catalog.items.length} onClick={() => setPage(value => value + 1)}>Next catalog tests</button></div>
    </div>}{error && <p role="alert" className="inline-error">{error}</p>}{message && <p role="status">{message}</p>}
  </section>;
}
