import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowRight, CheckCircle2, ClipboardList, History, Info, X } from 'lucide-react';
import { PageTitle } from '../components/ui';
import { api } from '../services/api';
import { useWorkspace } from '../services/workspace';
import type { NfrContext, NfrRun } from '../types/nfr';

const statusLabels: Record<NfrRun['status'], string> = {
  blocked: 'Dados pendentes', no_candidates: 'Sem histórias compatíveis',
  no_items: 'História semelhante sem RNFs elegíveis', completed: 'Sugestões encontradas'
};

export function NfrRecommendationsPage() {
  const workspace = useWorkspace();
  const [params, setParams] = useSearchParams();
  const [infoOpen, setInfoOpen] = useState(false);
  const id = params.get('classificationId') || workspace.selectedStoryId;

  useEffect(() => {
    if (!infoOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setInfoOpen(false); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [infoOpen]);

  return <section className="page nfr-page">
    <div className="nfr-page-heading"><PageTitle eyebrow="RECOMENDAÇÃO" title="Recomendar RNFs">Encontre requisitos não funcionais já usados em uma história semelhante e decida quais fazem sentido para a sua.</PageTitle><button className="nfr-info-button" type="button" onClick={() => setInfoOpen(true)} aria-label="Como funciona a recomendação de RNFs"><Info size={17}/> Como funciona</button></div>
    <div className="nfr-flow" aria-label="Etapas da recomendação"><span><b>1</b> Escolha uma história classificada</span><ArrowRight size={15}/><span><b>2</b> Confira o contexto</span><ArrowRight size={15}/><span><b>3</b> Gere e avalie os RNFs</span></div>
    <section className="card nfr-panel nfr-selection"><div className="nfr-section-heading"><span>ETAPA 1</span><h2>História que receberá os RNFs</h2><p>O projeto e a classificação escolhidos definem quais histórias anteriores podem ser comparadas.</p></div><label>História de usuário<select value={id} disabled={workspace.loading} onChange={event => { workspace.selectStory(event.target.value); setParams(event.target.value ? { classificationId: event.target.value } : {}); }}>
      <option value="">Selecione uma história</option>
      {workspace.stories.map(story => <option key={story.id} value={story.id}>{story.project} · US-{story.id} · {story.text}</option>)}
    </select></label></section>
    {id ? <NfrStory key={id} id={id}/> : <div className="card nfr-empty">Cadastre e classifique uma história para iniciar. <Link to="/classify">Classificar histórias</Link></div>}
    {infoOpen && <div className="modal-backdrop" onMouseDown={() => setInfoOpen(false)}><div className="card nfr-info-modal" role="dialog" aria-modal="true" aria-labelledby="nfr-info-title" onMouseDown={event => event.stopPropagation()}><div className="nfr-info-head"><div><span>ENTENDA O MÉTODO</span><h2 id="nfr-info-title">Como os RNFs são recomendados?</h2></div><button type="button" onClick={() => setInfoOpen(false)} aria-label="Fechar explicação"><X size={18}/></button></div>
      <ol><li><b>Filtra o histórico.</b> O motor considera histórias com o mesmo módulo e operação, a mesma versão da taxonomia e classificação aceita, revisada ou reclassificada. Ele exclui a própria história e projetos de protótipo.</li><li><b>Encontra a história mais parecida.</b> Compara plataforma, domínio, arquitetura, tecnologias e categorias das tarefas. Usa distância de Manhattan e escolhe somente o vizinho mais próximo (k=1).</li><li><b>Reaproveita RNFs existentes.</b> Mostra as sentenças de RNF vinculadas à história vizinha. A pontuação de utilidade corresponde à similaridade desse vizinho; ela não é uma probabilidade de acerto.</li><li><b>Você decide.</b> Aceitar vincula o RNF à história atual; rejeitar registra a decisão sem criar o vínculo. Execuções e decisões ficam salvas.</li></ol>
      <p>Se não houver dados suficientes, história compatível ou RNFs elegíveis no vizinho mais próximo, o resultado explica o motivo. O motor não gera novas sentenças com IA nem troca para outro vizinho.</p><button className="primary" type="button" onClick={() => setInfoOpen(false)}>Entendi</button>
    </div></div>}
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

  if (loading) return <p className="state">Carregando contexto e histórico…</p>;
  return <>
    {error && <p className="inline-error" role="alert">{error}</p>}
    {context && <section className="card nfr-panel"><div className="nfr-section-heading"><span>ETAPA 2</span><h2>Confira o contexto da história</h2><p>Esses dados são usados para selecionar e comparar histórias do histórico.</p></div>
      <div className="nfr-target"><small>{context.target.project} · História #{context.target.storyId}</small><strong>{context.target.text}</strong></div>
      <div className="nfr-context-grid"><label>Classificação usada<select value={labelIndex} onChange={event => setLabelIndex(Number(event.target.value))} disabled={busy}>{context.target.labels.map((label, index) => <option key={index} value={index}>{label.module} / {label.operation}</option>)}</select></label><div><small>Versão da taxonomia</small><b>{context.target.taxonomyVersion || 'Não informada'}</b></div></div>
      {context.issues.length ? <div className="nfr-readiness needs-work"><AlertCircle size={18}/><div><b>Há dados a completar</b><ul>{context.issues.map(issue => <li key={issue}>{issue}</li>)}</ul></div></div> : <div className="nfr-readiness ready"><CheckCircle2 size={18}/><span>Contexto pronto para buscar histórias semelhantes.</span></div>}
      <div className="nfr-actions"><button className="primary" disabled={busy || !context.target.labels.length || !!context.issues.length} onClick={() => void execute()}>{busy ? 'Buscando RNFs…' : 'Gerar recomendações'}</button><Link to={`/projects/${encodeURIComponent(context.target.project)}?story=${id}`}>Editar perfil e tarefas</Link>{context.issues.some(issue => issue.includes('classificação')) && <Link to={`/review?classificationId=${id}`}>Revisar classificação</Link>}</div>
    </section>}
    <section className="card nfr-panel nfr-results"><div className="nfr-section-heading"><span>ETAPA 3</span><h2>Resultado e avaliação</h2><p>Confira a história encontrada antes de aceitar ou rejeitar cada RNF.</p></div>
      {runs.length ? <><label className="nfr-history-label"><History size={16}/> Execução<select value={selected} disabled={busy} onChange={event => setSelected(event.target.value)}>{runs.map(item => <option key={item.id} value={item.id}>{new Date(item.createdAt).toLocaleString('pt-BR')} · {statusLabels[item.status]}</option>)}</select></label>
        {run && <><div className="nfr-result-summary"><span className={`nfr-result-status ${run.status}`}>{statusLabels[run.status]}</span><small>{run.eligibleCount} história(s) compatível(is) · {run.items.length} RNF(s) sugerido(s)</small></div>
          {run.messages.map(message => <p className="nfr-result-message" key={message} role="status">{message}</p>)}
          {run.neighbor && <details className="nfr-neighbor"><summary>Por que esta história foi escolhida? <span>{Math.round(run.neighbor.similarity * 100)}% de similaridade</span></summary><p><b>{run.neighbor.project}</b> · {run.neighbor.text}</p><p>O motor comparou {run.dimensions.length} característica(s) da história atual. A similaridade mede correspondência entre características, não a chance de o RNF estar correto.</p><div className="table-wrap"><table><thead><tr><th>Característica da história atual</th><th>Encontrada na vizinha?</th></tr></thead><tbody>{run.dimensions.map((dimension, index) => <tr key={dimension}><td>{dimension.replace(':', ': ')}</td><td>{run.neighbor!.vector[index] ? 'Sim' : 'Não'}</td></tr>)}</tbody></table></div></details>}
          {run.items.length > 0 && <div className="nfr-suggestions"><h3><ClipboardList size={17}/> RNFs sugeridos</h3><div className="nfr-items">{run.items.map(item => { const decision = run.decisions[item.key]; return <article key={item.key} className="nfr-item"><div className="nfr-item-head"><span className="tag">{item.type} / {item.attribute}</span><small>Utilidade {Math.round(item.score * 100)}%</small></div><p>{item.sentence}</p>{decision ? <p className="nfr-decision" role="status">{decision === 'accepted' ? 'Aceito e vinculado à história.' : 'Rejeitado nesta execução.'}</p> : item.alreadyLinked ? <p className="nfr-decision">Este RNF já está vinculado à história.</p> : <div className="nfr-actions"><button className="primary" disabled={busy} onClick={() => void decide(item.key, 'accepted')}>Aceitar e vincular</button><button disabled={busy} onClick={() => void decide(item.key, 'rejected')}>Rejeitar</button></div>}</article>; })}</div></div>}
          <p className="nfr-run-note">Resultado salvo em {new Date(run.createdAt).toLocaleString('pt-BR')}. Se o perfil ou a classificação mudar, gere uma nova recomendação.</p>
        </>}
      </> : <div className="nfr-empty-result">Nenhuma recomendação executada para esta classificação. Confira o contexto acima e clique em “Gerar recomendações”.</div>}
    </section>
  </>;
}
