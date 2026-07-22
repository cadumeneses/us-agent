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

  return <section className="page"><PageTitle eyebrow="VISÃO GERAL" title={`Bom dia, ${context.user.displayName.split(' ')[0]}`}>Acompanhe a qualidade e o ritmo das classificações.</PageTitle><LoadState loading={!data && !error} error={error}/>{data && <><div className="metrics"><Metric label="Histórias classificadas" value={String(data.total)} trend="base atual"/><Metric label="Confiança média" value={`${Math.round(data.confidence * 100)}%`} trend="modelos combinados" tone="green"/><Metric label="Aguardando revisão" value={String(data.pending)} trend="requer atenção" tone="orange"/><Metric label="Aceitas automaticamente" value={String(data.accepted)} trend="baixo risco" tone="blue"/></div><div className="dashboard-grid"><div className="card span2"><CardHead title="Classificações recentes" action="Ver todas"/><StoryTable stories={stories}/></div><div className="card"><CardHead title="Distribuição por módulo"/>{data.modules.slice(0, 5).map((module, index) => <div className="bar-row" key={module.name}><div><span>{module.name}</span><b>{module.count}</b></div><div className="bar"><i className={`chart-color-${index}`} style={{ width: `${Math.max(8, module.count / (data.modules[0]?.count || 1) * 100)}%` }}/></div></div>)}</div></div></>}</section>;
}
