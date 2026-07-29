import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { BrainCircuit, ClipboardCheck, FileCheck2, FolderKanban, FolderTree, LayoutDashboard, Menu, Search, Settings, Sparkles, X } from 'lucide-react';
import { api } from '../services/api';
import type { ApplicationContext } from '../types/models';
import { WorkspaceProvider } from '../services/workspace';

const navigation = [
  ['Dashboard', '/', LayoutDashboard],
  ['Meus projetos', '/projects', FolderKanban],
  ['Classificar histórias', '/classify', Sparkles],
  ['Plano de qualidade', '/quality', ClipboardCheck],
  ['Fila de revisão', '/review', FileCheck2],
  ['Taxonomia', '/taxonomy', FolderTree],
  ['Execuções', '/runs', BrainCircuit],
  ['Configurações', '/settings', Settings]
] as const;

export function AppLayout() {
  const [open, setOpen] = useState(false);
  const [context, setContext] = useState<ApplicationContext>();
  const [error, setError] = useState('');

  useEffect(() => {
    api.context().then(setContext).catch((reason: Error) => setError(reason.message));
  }, []);

  if (error) return <div className="state error">{error}</div>;
  if (!context) return <div className="state">Carregando aplicação…</div>;

  return <div className="shell">
    <aside className={open ? 'sidebar open' : 'sidebar'}>
      <div className="brand"><span className="brand-icon"><BrainCircuit size={19}/></span><div><strong>US-Agent</strong><small>AI Classification</small></div></div>
      <nav>{navigation.map(([label, path, Icon]) => <NavLink key={path} to={path} end={path === '/'} onClick={() => setOpen(false)}><Icon size={17}/><span>{label}</span></NavLink>)}</nav>
      <div className="sidebar-foot"><div className="avatar">{context.user.initials}</div><div><b>{context.user.displayName}</b><small>{context.user.role}</small></div></div>
    </aside>
    <main>
      <header><button className="icon-button mobile" onClick={() => setOpen(!open)} aria-label="Abrir menu">{open ? <X/> : <Menu/>}</button><div className="global-search"><Search size={16}/><input placeholder="Buscar histórias, módulos ou execuções..."/></div><span className="environment">{context.environment}</span><div className="avatar">{context.user.initials}</div></header>
      <WorkspaceProvider><Outlet context={context}/></WorkspaceProvider>
    </main>
  </div>;
}
