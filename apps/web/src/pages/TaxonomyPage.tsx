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

  return <section className="page">
    <PageTitle eyebrow="GOVERNANÇA" title="Taxonomias">Organize a classificação por domínio, módulo e operação.</PageTitle>
    {taxonomy && <div className="projects-layout">
      <aside className="project-panel card">
        <div className="project-panel-head"><div><span>TAXONOMIAS</span><b>Versões ativas</b></div><button className="square-button" onClick={() => setModal('taxonomy')}><Plus size={16}/></button></div>
        <div className="project-list">{taxonomy.taxonomies.map(item => <button key={item.version} className={version === item.version ? 'project-item selected' : 'project-item'} onClick={() => void load(item.version)}><i className="project-mark blue"><Tags size={14}/></i><div><b>{item.version}</b><small>{item.modules} módulos · {item.operations} operações</small></div></button>)}</div>
      </aside>
      <div className="story-workspace card node">
        <div className="taxonomy-actions"><button onClick={() => setModal('domain')}><Plus size={14}/> Adicionar domínio</button>{domain && <button onClick={() => setModal('operation')}><Plus size={14}/> Adicionar módulo ou operação</button>}</div>
        <span className="eyebrow">{version || 'TAXONOMIA'}</span>
        <h1>Domínios</h1>
        <p>Domínio é uma área da solução, como Mobile ou IoT. Cada domínio agrupa módulos e suas operações.</p>
        {domainNames.length ? <div className="taxonomy-version-list">{domainNames.map(item => <button key={item} className={domain === item ? 'selected' : ''} onClick={() => setDomain(item)}><FolderTree size={15}/><span>{item}</span><small>{Object.keys(taxonomy.domains[item].modules).length} módulos</small></button>)}</div> : <div className="empty">Adicione o primeiro domínio para começar.</div>}
        {selectedDomain && <><h2 className="taxonomy-domain-title">{domain}</h2>{selectedDomain.description && <p>{selectedDomain.description}</p>}<div className="module-grid">{Object.entries(selectedDomain.modules).map(([moduleName, operations]) => <article className="module-card" key={moduleName}><FolderTree size={17}/><h2>{moduleName}</h2><small>{operations.length} operações</small><div className="operations">{operations.length ? operations.map((item, index) => <div key={item}><span>{index + 1}</span><div><b>{item}</b><small>{taxonomy.descriptions[moduleName]?.[item] || 'Sem descrição.'}</small></div><span className="badge success">Ativa</span></div>) : <div className="empty">Sem operações.</div>}</div></article>)}</div>{Object.keys(selectedDomain.modules).length === 0 && <div className="empty">Este domínio ainda não possui módulos.</div>}</>}
      </div>
    </div>}
    {error && <p className="inline-error">{error}</p>}
    {modal && <div className="modal-backdrop"><div className="project-modal taxonomy-modal card"><div className="modal-head"><div><span>{modal === 'taxonomy' ? 'NOVA TAXONOMIA' : modal === 'domain' ? 'NOVO DOMÍNIO' : 'MÓDULO E OPERAÇÃO'}</span><h2>{modal === 'taxonomy' ? 'Criar taxonomia' : modal === 'domain' ? 'Cadastrar domínio' : `Adicionar em ${domain}`}</h2></div><button onClick={closeModal}><X/></button></div>{modal === 'taxonomy' && <label>Nome da taxonomia<input value={name} onChange={event => setName(event.target.value)} placeholder="Ex.: Plataforma 2.0"/></label>}{modal === 'domain' && <><label>Nome do domínio<input value={name} onChange={event => setName(event.target.value)} placeholder="Ex.: Mobile ou IoT"/></label><label>Descrição<textarea value={description} onChange={event => setDescription(event.target.value)} placeholder="Qual área da solução este domínio representa?"/></label></>}{modal === 'operation' && <><label>Módulo<input value={module} onChange={event => setModule(event.target.value)} placeholder="Ex.: Sincronização"/></label><label>Operação<input value={operation} onChange={event => setOperation(event.target.value)} placeholder="Ex.: Sincronizar offline"/></label><label>Descrição<textarea value={description} onChange={event => setDescription(event.target.value)} placeholder="Quando essa operação deve ser usada?"/></label></>}<div className="modal-actions"><button onClick={closeModal}>Cancelar</button><button className="primary" disabled={saving || !name.trim() && modal !== 'operation' || modal === 'operation' && (!module.trim() || !operation.trim() || !description.trim()) || modal === 'domain' && !description.trim()} onClick={() => void save()}>{saving ? 'Salvando…' : 'Salvar'}</button></div></div></div>}
  </section>;
}
