import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { BrainCircuit, ClipboardCheck, FileCheck2, FolderKanban, FolderTree, LayoutDashboard, Menu, Settings2, Sparkles, X } from 'lucide-react';
import { api } from '../services/api';
import type { ApplicationContext } from '../types/models';
import { WorkspaceProvider } from '../services/workspace';
import { usePrivateSignOut, usePrivateUsername } from './WebAccessGate';

const navigation = [
  ['My Projects', '/projects', FolderKanban],
  ['Classify Stories', '/classify', Sparkles],
  ['NFR Recommender', '/recommendations', ClipboardCheck],
  ['Published datasets', '/configured-recommendations', Settings2],
  ['Review Queue', '/review', FileCheck2],
  ['Taxonomy', '/taxonomy', FolderTree],
  ['Dashboard', '/dashboard', LayoutDashboard]
] as const;

export function AppLayout() {
  const signOut = usePrivateSignOut();
  const username = usePrivateUsername();
  const [open, setOpen] = useState(false);
  const [context, setContext] = useState<ApplicationContext>();
  const [error, setError] = useState('');

  useEffect(() => {
    api.context().then(setContext).catch((reason: Error) => setError(reason.message));
  }, []);

  if (error) return <div className="state error">{error}</div>;
  if (!context) return <div className="state">Loading application…</div>;

  return <div className="shell">
    <aside className={open ? 'sidebar open' : 'sidebar'}>
      <div className="brand"><span className="brand-icon"><BrainCircuit size={19}/></span><div><strong>US-Agent</strong><small>AI Classification</small></div></div>
      <nav>{navigation.map(([label, path, Icon]) => <NavLink key={path} to={path} onClick={() => setOpen(false)}><Icon size={17}/><span>{label}</span></NavLink>)}</nav>
      <div className="sidebar-foot"><div className="avatar">{username?.slice(0,2).toUpperCase() ?? context.user.initials}</div><div><b>{username ?? context.user.displayName}</b><small>{username ? 'Acesso privado' : context.user.role}</small>{signOut && <button className="private-signout" onClick={() => void signOut()}>Sair</button>}</div></div>
    </aside>
    <main>
      <header><button className="icon-button mobile" onClick={() => setOpen(!open)} aria-label="Open menu">{open ? <X/> : <Menu/>}</button><div className="app-purpose">User story classification and NFR recommendation</div><span className="environment">{context.environment}</span><div className="avatar">{username?.slice(0,2).toUpperCase() ?? context.user.initials}</div></header>
      <WorkspaceProvider><Outlet context={context}/></WorkspaceProvider>
    </main>
  </div>;
}
