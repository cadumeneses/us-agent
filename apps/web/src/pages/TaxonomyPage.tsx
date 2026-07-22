import { useEffect, useState } from 'react';
import { FolderTree, Tags } from 'lucide-react';
import { PageTitle } from '../components/ui';
import { api } from '../services/api';
import type { Taxonomy } from '../types/models';

export function TaxonomyPage() {
  const [taxonomy, setTaxonomy] = useState<Taxonomy>();
  const [selected, setSelected] = useState<string>();

  useEffect(() => {
    api.taxonomy().then(data => {
      setTaxonomy(data);
      setSelected(Object.keys(data.modules)[0]);
    });
  }, []);

  return <section className="page"><PageTitle eyebrow="GOVERNANÇA" title="Gerenciar taxonomia">Explore os módulos e operações usados pelo comitê de classificação.</PageTitle>{taxonomy && <div className="taxonomy-grid"><div className="card tree"><div className="version"><Tags size={18}/><div><b>Taxonomia WIS</b><small>Versão {taxonomy.version}</small></div></div>{Object.entries(taxonomy.modules).map(([name, operations]) => <button className={selected === name ? 'selected' : ''} onClick={() => setSelected(name)} key={name}><FolderTree size={17}/><span>{name}</span><small>{operations.length}</small></button>)}</div><div className="card node"><span className="eyebrow">MÓDULO</span><h1>{selected}</h1><p>Operações disponíveis para classificação neste módulo.</p><div className="operations">{selected && taxonomy.modules[selected].map((operation, index) => <div key={operation}><span>{String(index + 1).padStart(2, '0')}</span><b>{operation}</b><span className="badge success">Ativa</span></div>)}</div></div></div>}</section>;
}
