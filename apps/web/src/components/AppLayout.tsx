import { Suspense, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { BrainCircuit, ClipboardCheck, FileCheck2, FolderKanban, FolderTree, History, LayoutDashboard, Menu, ShieldCheck, Sparkles, X } from 'lucide-react';
import { api } from '../services/api';
import type { ApplicationContext } from '../types/models';
import { WorkspaceProvider } from '../services/workspace';
import { usePrivateSignOut, usePrivateUsername } from './WebAccessGate';
import { switchOrganization, type AccessContext } from '../services/organization';

const navigation = [
  { title: 'Workspace', items: [
    ['My Projects', '/projects', FolderKanban], ['Classify Stories', '/classify', Sparkles],
    ['Recommenders', '/recommendations', ClipboardCheck], ['Review Queue', '/review', FileCheck2],
    ['Classification history', '/runs', History], ['Dashboard', '/dashboard', LayoutDashboard]
  ] },
  { title: 'Manage', items: [['Taxonomies', '/taxonomy', FolderTree], ['Access and audit', '/access', ShieldCheck]] }
] as const;

export function AppLayout() {
  const { pathname } = useLocation();
  const signOut = usePrivateSignOut();
  const username = usePrivateUsername();
  const [open, setOpen] = useState(false);
  const [context, setContext] = useState<ApplicationContext>();
  const [error, setError] = useState('');
  const [access,setAccess] = useState<AccessContext>();
  const [mobile, setMobile] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null), sidebar = useRef<HTMLElement>(null), content = useRef<HTMLElement>(null);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 700px)');
    const update = () => { setMobile(media.matches); if (!media.matches) setOpen(false); };
    update(); media.addEventListener('change', update); return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (!open || !mobile) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    sidebar.current?.querySelector<HTMLElement>('a')?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); menuButton.current?.focus(); }
      if (event.key !== 'Tab') return;
      const targets = sidebar.current?.querySelectorAll<HTMLElement>('a,button:not(:disabled)');
      if (!targets?.length) return;
      const first = targets[0], last = targets[targets.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', keydown); menuButton.current?.focus(); };
  }, [open, mobile]);
  useEffect(() => {
    const heading = content.current?.querySelector<HTMLElement>('h1');
    if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
    window.scrollTo({ top: 0 });
  }, [pathname, context]);

  useEffect(() => {
    api.context().then(setContext).catch((reason: Error) => setError(reason.message));
    api.accessContext().then(setAccess).catch((reason: Error) => setError(reason.message));
  }, []);

  if (error) return <div className="state error">{error}<button onClick={()=>switchOrganization()}>Reset organization selection</button></div>;
  if (!context) return <div className="state">Loading application…</div>;

  return <div className="shell">
    <a className="skip-link" href="#workspace-content">Skip to content</a>
    {open && mobile && <button className="navigation-scrim" aria-label="Close navigation" tabIndex={-1} onClick={() => { setOpen(false); menuButton.current?.focus(); }}/>}
    <aside id="primary-navigation" ref={sidebar} inert={mobile && !open} className={open ? 'sidebar open' : 'sidebar'} aria-label="Application navigation">
      <div className="brand"><span className="brand-icon"><BrainCircuit size={19} aria-hidden="true"/></span><div><strong>US-Agent</strong><small>Project workspace</small></div>{mobile && <button aria-label="Close navigation" className="mobile-nav-close" onClick={() => { setOpen(false); menuButton.current?.focus(); }}><X size={20}/></button>}</div>
      <nav aria-label="Main navigation">{navigation.map(group => <div className="navigation-group" key={group.title}><span className="navigation-label">{group.title}</span>{group.items.map(([label, path, Icon]) => <NavLink key={path} to={path} className={({ isActive }) => isActive || path === '/recommendations' && ['/configured-recommendations', '/recommender-setup', '/recommenders/new'].includes(pathname) ? 'active' : undefined} onClick={() => setOpen(false)}><Icon size={18} aria-hidden="true"/><span>{label}</span></NavLink>)}</div>)}</nav>
      <div className="sidebar-foot"><div className="avatar">{username?.slice(0,2).toUpperCase() ?? context.user.initials}</div><div><b>{username ?? context.user.displayName}</b><small>{username ? 'Private access' : context.user.role}</small>{signOut && <button className="private-signout" onClick={() => void signOut()}>Sign out</button>}</div></div>
    </aside>
    <main ref={content} id="workspace-content" inert={mobile && open}>
      <header><button ref={menuButton} className="icon-button mobile" onClick={() => setOpen(!open)} aria-label="Open menu" aria-expanded={open} aria-controls="primary-navigation">{open ? <X/> : <Menu/>}</button><div className="app-purpose">Project workspace</div><span className="environment">{access?.organizations.find(org=>org.id===access.organizationId)?.name ?? context.environment} · {access?.role ?? context.user.role}</span><div className="avatar">{username?.slice(0,2).toUpperCase() ?? context.user.initials}</div></header>
      <WorkspaceProvider><Suspense fallback={<div className="page state" role="status">Loading workspace…</div>}><Outlet context={context}/></Suspense></WorkspaceProvider>
    </main>
  </div>;
}
