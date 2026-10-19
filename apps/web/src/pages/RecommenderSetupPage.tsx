import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DatasetImporter } from '../components/DatasetImporter';
import { DefinitionEditor, TaxonomyEditor } from '../components/RecommenderEditors';
import { PageTitle } from '../components/ui';
import { TestCaseCatalogEditor } from '../components/TestCaseCatalogEditor';

export function RecommenderSetupPage() {
  const [tab, setTab] = useState('definitions'), [refresh, setRefresh] = useState(0), [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const changed = () => setRefresh(value => value + 1);
  return <section className="page configured-page"><PageTitle eyebrow="RECOMMENDERS" title="Configure and import datasets">Prepare versioned attributes, taxonomies, and datasets for traceable recommendations.</PageTitle>
    <div className="configured-actions" role="group" aria-label="Recommender configuration">{[['definitions', "Definitions"], ['taxonomies', "Independent taxonomies"], ['catalogs', 'Test catalogs'], ['import', "Import dataset"]].map(([id, title]) => <button key={id} disabled={busy} aria-pressed={tab === id} onClick={() => setTab(id)}>{title}</button>)}<button disabled={busy} onClick={() => navigate('/configured-recommendations')}>Go to runs</button>{!busy && <Link to="/recommendations">Recommenders</Link>}</div>
    {busy && <p role="status">Processing request…</p>}
    <div hidden={tab !== 'definitions'}><DefinitionEditor refresh={refresh} changed={changed} busy={busy} setBusy={setBusy}/></div>
    <div hidden={tab !== 'taxonomies'}><TaxonomyEditor refresh={refresh} changed={changed} busy={busy} setBusy={setBusy}/></div>
    <div hidden={tab !== 'import'}><DatasetImporter refresh={refresh} changed={changed} busy={busy} setBusy={setBusy}/></div>
    <div hidden={tab !== 'catalogs'}><TestCaseCatalogEditor refresh={refresh} changed={changed} busy={busy} setBusy={setBusy}/></div>
  </section>;
}
