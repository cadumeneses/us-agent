import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { DatasetImporter } from '../components/DatasetImporter';
import { DefinitionEditor } from '../components/RecommenderEditors';
import { PageTitle } from '../components/ui';
import { RecommenderNavigation } from '../components/RecommenderNavigation';
import { TestCaseCatalogEditor } from '../components/TestCaseCatalogEditor';
import type { DefinitionRecord } from '../types/configurable-recommendations';
import { recommenderApi } from '../services/recommender-api';

export function RecommenderSetupPage() {
  const [params] = useSearchParams();
  const [tab, setTab] = useState(params.get('tab') === 'import' ? 'import' : 'definitions'), [refresh, setRefresh] = useState(0), [busy, setBusy] = useState(false);
  const [importDefinition, setImportDefinition] = useState<DefinitionRecord>();
  const [schemaError, setSchemaError] = useState(''), [schemaRetry, setSchemaRetry] = useState(0);
  const definitionId = params.get('definitionId'), definitionVersion = params.get('definitionVersion');
  useEffect(() => {
    if (!definitionId || !definitionVersion) return;
    const controller = new AbortController(); let active = true;
    setSchemaError('');
    recommenderApi.definition(definitionId, definitionVersion, controller.signal).then(record => {
      if (record.state !== 'published' || !record.snapshot) throw new Error('Choose a published configuration before adding reference data.');
      if (active) { setImportDefinition(record); setTab('import'); }
    }).catch((reason: Error) => { if (active) setSchemaError(reason.message); });
    return () => { active = false; controller.abort(); };
  }, [definitionId, definitionVersion, schemaRetry]);
  const navigate = useNavigate();
  const changed = () => setRefresh(value => value + 1);
  return <section className="page configured-page"><PageTitle eyebrow="RECOMMENDERS" title="Configuration and datasets">Manage existing definitions, prepare reference datasets and maintain test catalogs.</PageTitle>
    <RecommenderNavigation busy={busy}/>
    {schemaError && <p role="alert">{schemaError} <button type="button" disabled={busy} onClick={() => setSchemaRetry(value => value + 1)}>Retry loading configuration</button></p>}
    <div className="configured-actions" role="group" aria-label="Recommender configuration">{[['definitions', "Definitions"], ['catalogs', 'Test catalogs'], ['import', "Import dataset"]].map(([id, title]) => <button key={id} disabled={busy} aria-pressed={tab === id} onClick={() => setTab(id)}>{title}</button>)}<button disabled={busy} onClick={() => navigate('/taxonomy')}>Taxonomies</button><button disabled={busy} onClick={() => navigate('/configured-recommendations')}>Go to runs</button>{!busy && <Link to="/recommendations">Recommenders</Link>}</div>
    {busy && <p role="status">Processing request…</p>}
    <div hidden={tab !== 'definitions'}><DefinitionEditor refresh={refresh} changed={changed} busy={busy} setBusy={setBusy} onPrepareDataset={record => { setImportDefinition(structuredClone(record)); setTab('import'); }}/></div>
    <div hidden={tab !== 'import'}><DatasetImporter refresh={refresh} changed={changed} busy={busy} setBusy={setBusy} initialDefinition={importDefinition}/></div>
    <div hidden={tab !== 'catalogs'}><TestCaseCatalogEditor refresh={refresh} changed={changed} busy={busy} setBusy={setBusy}/></div>
  </section>;
}
