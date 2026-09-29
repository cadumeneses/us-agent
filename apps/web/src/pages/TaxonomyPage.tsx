import { useEffect, useState } from 'react';
import { FolderTree, Plus, Tags, X } from 'lucide-react';
import { PageTitle } from '../components/ui';
import { api } from '../services/api';
import type { Taxonomy } from '../types/models';

type Modal = 'taxonomy' | 'domain' | 'operation' | null;

export function TaxonomyPage() {
  const [taxonomy, setTaxonomy] = useState<Taxonomy>();
  const [version, setVersion] = useState('');
  const [domain, setDomain] = useState('');
  const [modal, setModal] = useState<Modal>(null);
  const [name, setName] = useState('');
  const [module, setModule] = useState('');
  const [operation, setOperation] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function load(nextVersion?: string) {
    try {
      const next = await api.taxonomy(nextVersion);
      const selectedVersion = nextVersion ?? (version || next.taxonomies[0]?.version || '');
      const domains = Object.keys(next.domains);
      setTaxonomy(next);
      setVersion(selectedVersion);
      setDomain(current => domains.includes(current) ? current : domains[0] ?? '');
    } catch (reason) {
      setError((reason as Error).message);
    }
  }

  useEffect(() => { void load(); }, []);

  function closeModal() {
    setModal(null);
    setName('');
    setModule('');
    setOperation('');
    setDescription('');
  }

  async function save() {
    setError('');
    setSaving(true);
    try {
      if (modal === 'taxonomy') await api.createTaxonomyVersion(name.trim());
      if (modal === 'domain') await api.addTaxonomyDomain({ domain: name.trim(), description: description.trim(), version: version || undefined });
      if (modal === 'operation') await api.addTaxonomyOperation({ domain, module: module.trim(), operation: operation.trim(), description: description.trim(), version: version || undefined });
      const nextVersion = modal === 'taxonomy' ? name.trim() : version;
      closeModal();
      await load(nextVersion);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const selectedDomain = domain && taxonomy ? taxonomy.domains[domain] : undefined;
  const domainNames = taxonomy ? Object.keys(taxonomy.domains) : [];

  return <section className="page taxonomy-page">
    <PageTitle eyebrow="GOVERNANCE" title="Taxonomies">Organize classifications by domain, module, and operation.</PageTitle>
    {taxonomy && <div className="projects-layout">
      <aside className="project-panel card">
        <div className="project-panel-head"><div><span>TAXONOMIES</span><b>Active versions</b></div><button className="square-button" aria-label="Create taxonomy" onClick={() => setModal('taxonomy')}><Plus size={16}/></button></div>
        <div className="project-list">{taxonomy.taxonomies.map(item => <button key={item.version} className={version === item.version ? 'project-item selected' : 'project-item'} onClick={() => void load(item.version)}><i className="project-mark blue"><Tags size={14}/></i><div><b>{item.version}</b><small>{item.modules} modules · {item.operations} operations</small></div></button>)}</div>
      </aside>
      <div className="story-workspace card node">
        <div className="taxonomy-actions"><button onClick={() => setModal('domain')}><Plus size={14}/> Add domain</button>{domain && <button onClick={() => setModal('operation')}><Plus size={14}/> Add module or operation</button>}</div>
        <span className="eyebrow">{version || 'TAXONOMIA'}</span>
        <h1>Domains</h1>
        <p>A domain is an area of the solution, such as Mobile or IoT. Each domain groups modules and their operations.</p>
        {domainNames.length ? <div className="taxonomy-version-list">{domainNames.map(item => <button key={item} className={domain === item ? 'selected' : ''} onClick={() => setDomain(item)}><FolderTree size={15}/><span>{item}</span><small>{Object.keys(taxonomy.domains[item].modules).length} modules</small></button>)}</div> : <div className="empty">Add the first domain to get started.</div>}
        {selectedDomain && <><h2 className="taxonomy-domain-title">{domain}</h2>{selectedDomain.description && <p>{selectedDomain.description}</p>}<div className="module-grid">{Object.entries(selectedDomain.modules).map(([moduleName, operations]) => <article className="module-card" key={moduleName}><FolderTree size={17}/><h2>{moduleName}</h2><small>{operations.length} operations</small><div className="operations">{operations.length ? operations.map((item, index) => <div key={item}><span>{index + 1}</span><div><b>{item}</b><small>{taxonomy.descriptions[moduleName]?.[item] || 'No description.'}</small></div><span className="badge success">Active</span></div>) : <div className="empty">No operations.</div>}</div></article>)}</div>{Object.keys(selectedDomain.modules).length === 0 && <div className="empty">This domain has no modules yet.</div>}</>}
      </div>
    </div>}
    {error && <p className="inline-error">{error}</p>}
    {modal && <div className="modal-backdrop"><div className="project-modal taxonomy-modal card"><div className="modal-head"><div><span>{modal === 'taxonomy' ? 'NEW TAXONOMY' : modal === 'domain' ? 'NEW DOMAIN' : 'MODULE AND OPERATION'}</span><h2>{modal === 'taxonomy' ? 'Create taxonomy' : modal === 'domain' ? 'Create domain' : `Add to ${domain}`}</h2></div><button aria-label="Close" onClick={closeModal}><X/></button></div>{modal === 'taxonomy' && <label>Taxonomy name<input value={name} onChange={event => setName(event.target.value)} placeholder="Example: Platform 2.0"/></label>}{modal === 'domain' && <><label>Domain name<input value={name} onChange={event => setName(event.target.value)} placeholder="Example: Mobile or IoT"/></label><label>Description<textarea value={description} onChange={event => setDescription(event.target.value)} placeholder="What area of the solution does this domain represent?"/></label></>}{modal === 'operation' && <><label>Module<input value={module} onChange={event => setModule(event.target.value)} placeholder="Example: Synchronization"/></label><label>Operation<input value={operation} onChange={event => setOperation(event.target.value)} placeholder="Example: Sync offline"/></label><label>Description<textarea value={description} onChange={event => setDescription(event.target.value)} placeholder="When should this operation be used?"/></label></>}<div className="modal-actions"><button onClick={closeModal}>Cancel</button><button className="primary" disabled={saving || !name.trim() && modal !== 'operation' || modal === 'operation' && (!module.trim() || !operation.trim() || !description.trim()) || modal === 'domain' && !description.trim()} onClick={() => void save()}>{saving ? 'Saving…' : 'Save'}</button></div></div></div>}
  </section>;
}
