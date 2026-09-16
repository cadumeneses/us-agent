import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageTitle } from '../components/ui';
import { api } from '../services/api';
import { useWorkspace } from '../services/workspace';
import type { NfrContext, NfrRun } from '../types/nfr';

const statusLabels = { blocked: 'Dados pendentes', no_candidates: 'Sem vizinhos compatíveis', no_items: 'Vizinho sem RNFs elegíveis', completed: 'Concluída' };

export function NfrRecommendationsPage() {
  const workspace = useWorkspace();
  const [params, setParams] = useSearchParams();
  const id = params.get('classificationId') || workspace.selectedStoryId;
  return <section className="page">
    <PageTitle eyebrow="RECOMENDADORES" title="Recomendação de RNFs">Reutilize requisitos não funcionais de histórias semelhantes, pelo método de Felipe Ramos (2019).</PageTitle>
    <div className="card nfr-panel"><label>História de usuário<select value={id} disabled={workspace.loading} onChange={event => { workspace.selectStory(event.target.value); setParams({ classificationId: event.target.value }); }}>
      <option value="">Selecione uma US</option>
      {workspace.stories.map(story => <option key={story.id} value={story.id}>{story.project} · US-{story.id} · {story.text}</option>)}
    </select></label></div>
    {id ? <NfrStory key={id} id={id}/> : <p className="empty">Cadastre e classifique uma US para iniciar.</p>}
  </section>;
}

function NfrStory({ id }: { id: string }) {
  const [context, setContext] = useState<NfrContext>();
  const [runs, setRuns] = useState<NfrRun[]>([]);
  const [selected, setSelected] = useState('');
  const [labelIndex, setLabelIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = runs.find(item => item.id === selected);
  useEffect(() => {
    let active = true;
    Promise.all([api.nfrContext(id), api.nfrRuns(id)]).then(([nextContext, history]) => {
      if (!active) return;
      setContext(nextContext); setRuns(history); setSelected(history[0]?.id ?? '');
    }).catch((reason: Error) => { if (active) setError(reason.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);
  async function execute() {
    setBusy(true); setError('');
    try {
      const result = await api.recommendNfr(id, labelIndex);
      setRuns(current => [result, ...current]); setSelected(result.id);
      setContext(await api.nfrContext(id));
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  }
  async function decide(itemKey: string, decision: 'accepted' | 'rejected') {
    if (!run) return;
    setBusy(true); setError('');
    try {
      await api.decideNfr(run.id, itemKey, decision);
      setRuns(current => current.map(item => item.id === run.id ? { ...item, decisions: { ...item.decisions, [itemKey]: decision } } : item));
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  }
  if (loading) return <p className="state">Carregando perfil e histórico…</p>;
  return <>
    {error && <p className="inline-error" role="alert">{error}</p>}
    {context && <div className="card nfr-panel">
      <h2>{context.target.project}</h2><p>{context.target.text}</p>
      <label>Classificação usada na recomendação<select value={labelIndex} onChange={event => setLabelIndex(Number(event.target.value))} disabled={busy}>
        {context.target.labels.map((label, index) => <option key={index} value={index}>{label.module} / {label.operation}</option>)}
      </select></label>
      <p>Taxonomia: {context.target.taxonomyVersion || 'não informada'} · k=1 · similaridade de Manhattan</p>
      <p>Os RNFs vêm do vizinho mais próximo. A similaridade indica correspondência de características, não probabilidade de acerto.</p>
      {!!context.issues.length && <ul>{context.issues.map(issue => <li key={issue}>{issue}</li>)}</ul>}
      <div className="nfr-actions"><button className="primary" disabled={busy || !context.target.labels.length} onClick={() => void execute()}>{busy ? 'Processando…' : 'Recomendar RNFs'}</button><Link to="/projects">Editar perfil e tarefas</Link><Link to="/review">Revisar classificação</Link></div>
    </div>}
    {!!runs.length && <div className="card nfr-panel"><label>Execuções desta classificação<select value={selected} disabled={busy} onChange={event => setSelected(event.target.value)}>{runs.map(item => <option key={item.id} value={item.id}>#{item.id} · {new Date(item.createdAt).toLocaleString('pt-BR')} · {statusLabels[item.status]}</option>)}</select></label></div>}
    {run && <div className="card nfr-panel">
      <h2>{statusLabels[run.status]}</h2>
      <p>{run.label?.module} / {run.label?.operation} · {run.eligibleCount} US elegíveis · {run.excludedCount} excluídas</p>
      {run.messages.map(message => <p key={message} role="status">{message}</p>)}
      {run.neighbor && <details open><summary>Vizinho: {run.neighbor.project} · classificação #{run.neighbor.classificationId} · similaridade {run.neighbor.similarity.toFixed(4)}</summary>
        <p>{run.neighbor.text}</p><div className="table-wrap"><table><thead><tr><th>Característica do alvo</th><th>Alvo</th><th>Vizinho</th></tr></thead><tbody>{run.dimensions.map((dimension, index) => <tr key={dimension}><td>{dimension}</td><td>1</td><td>{run.neighbor!.vector[index]}</td></tr>)}</tbody></table></div>
      </details>}
      <div className="nfr-items">{run.items.map(item => {
        const decision = run.decisions[item.key];
        return <article key={item.key} className="nfr-item"><span className="tag">{item.type} / {item.attribute}</span><p>{item.sentence}</p><small>Utilidade: {item.score.toFixed(4)} · origem: US vizinha</small>
          {decision ? <p role="status">{decision === 'accepted' ? 'Aceito e vinculado à US.' : 'Rejeitado.'}</p> : item.alreadyLinked ? <p>Este RNF já estava vinculado à US nesta execução.</p> : <div className="nfr-actions"><button className="primary" disabled={busy} onClick={() => void decide(item.key, 'accepted')}>Aceitar e vincular</button><button disabled={busy} onClick={() => void decide(item.key, 'rejected')}>Rejeitar</button></div>}
        </article>;
      })}</div>
      <small>Execução #{run.id} · {run.method} · taxonomia {run.target.taxonomyVersion}. Entradas e resultados preservados nesta execução; alterações posteriores exigem uma nova execução.</small>
    </div>}
  </>;
}
