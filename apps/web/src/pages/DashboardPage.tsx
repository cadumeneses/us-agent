import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { StoryTable } from '../components/StoryTable';
import { CardHead, LoadState, Metric, PageTitle } from '../components/ui';
import { api } from '../services/api';
import type { ApplicationContext, Dashboard, Story } from '../types/models';

export function DashboardPage() {
  const context = useOutletContext<ApplicationContext>();
  const [data, setData] = useState<Dashboard>();
  const [stories, setStories] = useState<Story[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.dashboard(), api.stories()])
      .then(([dashboard, allStories]) => { setData(dashboard); setStories(allStories.slice(0, 6)); })
      .catch((reason: Error) => setError(reason.message));
  }, []);

  return <section className="page"><PageTitle eyebrow="OVERVIEW" title={`Good morning, ${context.user.displayName.split(' ')[0]}`}>Track classification quality and throughput.</PageTitle><LoadState loading={!data && !error} error={error}/>{data && <><div className="metrics"><Metric label="Classified stories" value={String(data.total)} trend="current dataset"/><Metric label="Average confidence" value={`${Math.round(data.confidence * 100)}%`} trend="combined models" tone="green"/><Metric label="Pending review" value={String(data.pending)} trend="requires attention" tone="orange"/><Metric label="Automatically accepted" value={String(data.accepted)} trend="low risk" tone="blue"/></div><div className="dashboard-grid"><div className="card span2"><CardHead title="Recent classifications" action="View all"/><StoryTable stories={stories}/></div><div className="card"><CardHead title="Distribution by module"/>{data.modules.slice(0, 5).map((module, index) => <div className="bar-row" key={module.name}><div><span>{module.name}</span><b>{module.count}</b></div><div className="bar"><i className={`chart-color-${index}`} style={{ width: `${Math.max(8, module.count / (data.modules[0]?.count || 1) * 100)}%` }}/></div></div>)}</div></div></>}</section>;
}
