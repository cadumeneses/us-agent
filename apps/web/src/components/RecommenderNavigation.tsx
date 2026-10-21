import { NavLink } from 'react-router-dom';

export function RecommenderNavigation({ busy = false }: { busy?: boolean }) {
  return <nav className="section-navigation" aria-label="Recommender workspace" aria-disabled={busy || undefined}>
    {[
      ['/recommendations', 'Choose a recommender'],
      ['/configured-recommendations', 'Runs and history'],
      ['/recommender-setup', 'Configuration and datasets']
    ].map(([to, label]) => <NavLink key={to} to={to} end tabIndex={busy ? -1 : undefined} onClick={event => { if (busy) event.preventDefault(); }}>{label}</NavLink>)}
  </nav>;
}
