import { useEffect, useState } from 'react';
import { FolderTree, Tags } from 'lucide-react';
import { Link } from 'react-router-dom';
import { TaxonomyEditor } from '../components/RecommenderEditors';
import { PageTitle } from '../components/ui';
import { api } from '../services/api';
import type { Taxonomy } from '../types/models';

export function TaxonomyPage() {
  const [refresh, setRefresh] = useState(0), [busy, setBusy] = useState(false);
  const [showClassification, setShowClassification] = useState(false);
  return <section className="page configured-page taxonomy-page">
    <PageTitle eyebrow="GOVERNANCE" title="Taxonomies">Create lists and trees, review drafts, and publish versions for recommender attributes.</PageTitle>
    <div className="configured-actions">{!busy && <Link to="/recommender-setup">Configure recommenders</Link>}</div>
    {busy && <p role="status">Processing request…</p>}
    <TaxonomyEditor refresh={refresh} changed={() => setRefresh(value => value + 1)} busy={busy} setBusy={setBusy}/>
    <details onToggle={event => setShowClassification(event.currentTarget.open)}>
      <summary>Story classification catalog</summary>
      <p>Existing story classifications use this domain, module, and operation catalog. Consult its versions here; proposed changes are reviewed in the review queue.</p>
      {!busy && <Link to="/review">Review classification proposals</Link>}
      {showClassification && <ClassificationTaxonomyCatalog/>}
    </details>
  </section>;
}

function ClassificationTaxonomyCatalog() {
  const [taxonomy, setTaxonomy] = useState<Taxonomy>();
  const [version, setVersion] = useState('');
  const [domain, setDomain] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setTaxonomy(undefined);
    setError('');
    api.taxonomy(version || undefined).then(next => {
      if (!active) return;
      setTaxonomy(next);
      const domains = Object.keys(next.domains);
      setDomain(current => domains.includes(current) ? current : domains[0] ?? '');
    }).catch((reason: Error) => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, [version]);

  const selectedDomain = domain && taxonomy ? taxonomy.domains[domain] : undefined;
  const domainNames = taxonomy ? Object.keys(taxonomy.domains) : [];
  const selectedVersion = version || taxonomy?.version || '';

  return <section aria-label="Story classification catalog">
    {!taxonomy && !error && <p role="status">Loading classification catalog…</p>}
    {taxonomy && <div className="projects-layout">
      <aside className="project-panel card">
        <div className="project-panel-head"><div><span>CLASSIFICATION CATALOG</span><b>Active versions</b></div></div>
        <div className="project-list">{taxonomy.taxonomies.map(item => <button key={item.version} className={selectedVersion === item.version ? 'project-item selected' : 'project-item'} onClick={() => setVersion(item.version)}><i className="project-mark blue"><Tags size={14}/></i><div><b>{item.version}</b><small>{item.modules} modules · {item.operations} operations</small></div></button>)}</div>
      </aside>
      <div className="story-workspace card node">
        <span className="eyebrow">{selectedVersion || 'CLASSIFICATION'}</span>
        <h2>Domains</h2>
        <p>A domain is an area of the solution, such as Mobile or IoT. Each domain groups modules and their operations.</p>
        {domainNames.length ? <div className="taxonomy-version-list">{domainNames.map(item => <button key={item} className={domain === item ? 'selected' : ''} onClick={() => setDomain(item)}><FolderTree size={15}/><span>{item}</span><small>{Object.keys(taxonomy.domains[item].modules).length} modules</small></button>)}</div> : <div className="empty">No domains in this version.</div>}
        {selectedDomain && <><h2 className="taxonomy-domain-title">{domain}</h2>{selectedDomain.description && <p>{selectedDomain.description}</p>}<div className="module-grid">{Object.entries(selectedDomain.modules).map(([moduleName, operations]) => <article className="module-card" key={moduleName}><FolderTree size={17}/><h2>{moduleName}</h2><small>{operations.length} operations</small><div className="operations">{operations.length ? operations.map((item, index) => <div key={item}><span>{index + 1}</span><div><b>{item}</b><small>{taxonomy.descriptions[moduleName]?.[item] || 'No description.'}</small></div><span className="badge success">Active</span></div>) : <div className="empty">No operations.</div>}</div></article>)}</div>{Object.keys(selectedDomain.modules).length === 0 && <div className="empty">This domain has no modules yet.</div>}</>}
      </div>
    </div>}
    {error && <p role="alert" className="inline-error">{error}</p>}
  </section>;
}
