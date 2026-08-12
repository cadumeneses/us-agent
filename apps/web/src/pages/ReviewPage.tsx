import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { CardHead, PageTitle } from '../components/ui';
import { api } from '../services/api';
import { useWorkspace } from '../services/workspace';
import type { FallbackSuggestion, ReviewContext, Story, Taxonomy } from '../types/models';

const pendingStatuses = new Set(['pending_review', 'taxonomy_gap', 'needs_rewrite']);
const suggestionTypeLabel: Record<FallbackSuggestion['type'], string> = {
  new_domain: 'Novo domínio',
  new_operation: 'Nova operação',
  clarify_story: 'Esclarecer história',
  classification: 'Classificação alternativa'
};

function suggestionTarget(suggestion: FallbackSuggestion) {
  if (suggestion.type === 'new_domain' && suggestion.proposedDomain) return `Domínio sugerido: ${suggestion.proposedDomain}`;
  if (suggestion.type === 'new_operation' && suggestion.proposedOperation) return `Operação sugerida: ${suggestion.targetModule ?? 'Módulo não informado'} / ${suggestion.proposedOperation}`;
  return undefined;
}

export function ReviewPage() {
  const workspace = useWorkspace();
  const [stories, setStories] = useState<Story[]>([]);
  const [selected, setSelected] = useState<Story>();
  const [taxonomy, setTaxonomy] = useState<Taxonomy>();
  const [reviewContext, setReviewContext] = useState<ReviewContext>();
  const [loadingContext, setLoadingContext] = useState(false);
  const [module, setModule] = useState('n/a');
  const [operation, setOperation] = useState('n/a');
  const [notes, setNotes] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [proposalType, setProposalType] = useState<'new_domain' | 'new_operation' | 'clarify_story'>('new_domain');
  const [proposedDomain, setProposedDomain] = useState('');
  const [proposedOperation, setProposedOperation] = useState('');
  const [feedbackJustification, setFeedbackJustification] = useState('');
  const [saving, setSaving] = useState(false);
  const [applyingSuggestion, setApplyingSuggestion] = useState<string>();
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.stories(), api.taxonomy()])
      .then(([allStories, activeTaxonomy]) => {
        const pending = allStories.filter(story =>
          pendingStatuses.has(story.status)
          || (story.status === 'reviewed' && (story.module === 'n/a' || story.operation === 'n/a'))
        );
        setStories(pending);
        setSelected(pending[0]);
        setTaxonomy(activeTaxonomy);
      })
      .catch((reason: Error) => setError(reason.message));
  }, []);

  useEffect(() => {
    if (!selected) {
      setReviewContext(undefined);
      return;
    }
    let active = true;
    setModule(selected.module);
    setOperation(selected.operation);
    setNotes('');
    setShowFeedback(false);
    setProposalType('new_domain');
    setProposedDomain('');
    setProposedOperation('');
    setFeedbackJustification('');
    setError('');
    setLoadingContext(true);
    api.reviewContext(selected.id)
      .then(context => { if (active) setReviewContext(context); })
      .catch((reason: Error) => { if (active) setError(reason.message); })
      .finally(() => { if (active) setLoadingContext(false); });
    return () => { active = false; };
  }, [selected]);

  function selectModule(nextModule: string) {
    setModule(nextModule);
    setOperation(nextModule === 'n/a' ? 'n/a' : taxonomy?.modules[nextModule]?.[0] ?? 'n/a');
  }

  function useSuggestedClassification(nextModule: string, nextOperation: string) {
    selectModule(nextModule);
    setOperation(nextOperation);
    setError('');
  }

  function finishCurrent() {
    if (!selected) return;
    const remaining = stories.filter(story => story.id !== selected.id);
    setStories(remaining);
    setSelected(remaining[0]);
  }

  function taxonomyFeedback() {
    if (!showFeedback) return undefined;
    if (feedbackJustification.trim().length < 5) {
      setError('Explique a justificativa da proposta de evolução da taxonomia.');
      return null;
    }
    if (proposalType === 'new_domain' && proposedDomain.trim().length < 2) {
      setError('Informe o domínio sugerido.');
      return null;
    }
    if (proposalType === 'new_operation' && (module === 'n/a' || proposedOperation.trim().length < 2)) {
      setError('Selecione o módulo alvo e informe a operação sugerida.');
      return null;
    }
    return {
      proposalType,
      proposedDomain: proposalType === 'new_domain' ? proposedDomain.trim() : undefined,
      targetModule: proposalType === 'new_operation' ? module : undefined,
      proposedOperation: proposalType === 'new_operation' ? proposedOperation.trim() : undefined,
      justification: feedbackJustification.trim()
    };
  }

  async function applySuggestion(suggestion: FallbackSuggestion) {
    if (!selected || suggestion.appliedAt) return;
    setApplyingSuggestion(suggestion.id);
    setError('');
    try {
      const result = await api.applyFallbackSuggestion(suggestion.id);
      setTaxonomy(result.taxonomy);
      setReviewContext(await api.reviewContext(selected.id));
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setApplyingSuggestion(undefined);
    }
  }

  async function review(action: 'approve' | 'taxonomy_gap') {
    if (!selected) return;
    setError('');
    if (action === 'approve' && (module === 'n/a' || operation === 'n/a')) {
      setError('Escolha uma classificação da taxonomia ou marque a história como lacuna.');
      return;
    }
    const feedback = action === 'taxonomy_gap' ? taxonomyFeedback() : undefined;
    if (feedback === null) return;
    setSaving(true);
    try {
      if (action === 'approve') {
        await api.review(selected.id, { action, module, operation, notes: notes || undefined });
      } else {
        await api.review(selected.id, { action, notes: notes || undefined, taxonomyFeedback: feedback });
      }
      await workspace.refreshStories();
      finishCurrent();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const operations = module === 'n/a' ? ['n/a'] : taxonomy?.modules[module] ?? [];

  return <section className="page">
    <PageTitle eyebrow="HUMAN IN THE LOOP" title="Fila de revisão">Entenda as sugestões e seus motivos antes de validar ou evoluir a taxonomia.</PageTitle>
    <div className="review-grid">
      <div className="card queue">
        <CardHead title={`Pendentes (${stories.length})`}/>
        {stories.map(story => <button className={selected?.id === story.id ? 'queue-item selected' : 'queue-item'} onClick={() => setSelected(story)} key={story.id}><span className="risk-dot"/><div><b>{story.text}</b><small>{story.module} · {Math.round(story.confidence * 100)}% confiança</small></div><ChevronRight size={16}/></button>)}
        {!stories.length && <div className="empty">A fila está vazia.</div>}
      </div>
      <div className="card review-panel">
        {selected ? <>
          <span className="badge warning">Revisão necessária</span>
          <h2>{selected.text}</h2>
          <div className="score-row"><div><small>Confiança</small><strong>{Math.round(selected.confidence * 100)}%</strong></div><div><small>Consenso</small><strong>{Math.round(selected.consensus * 100)}%</strong></div><div><small>Incerteza</small><strong>{Math.round(selected.uncertainty * 100)}%</strong></div></div>
          <section className="fallback-context" aria-live="polite">
            <h3>Por que esta história caiu na revisão</h3>
            {loadingContext ? <p>Carregando contexto do fallback…</p> : <>
              <p>{reviewContext?.final.reason ?? 'Esta classificação exige confirmação humana.'}</p>
              {reviewContext?.final.notesForHuman && <p className="fallback-note">{reviewContext.final.notesForHuman}</p>}
              {(reviewContext?.final.disagreementCause || reviewContext?.final.action) && <small>Motivo técnico: {reviewContext.final.disagreementCause ?? 'n/a'} · Ação sugerida: {reviewContext.final.action ?? 'n/a'}</small>}
              {reviewContext?.suggestions.length ? <div className="fallback-list">
                <h4>Sugestões de fallback</h4>
                {reviewContext.suggestions.map(suggestion => <article key={suggestion.id}>
                  <span>{suggestionTypeLabel[suggestion.type]}</span>
                  <div><b>{suggestionTarget(suggestion) ?? `Origem: ${suggestion.source}`}</b><p>{suggestion.reason}</p>{suggestion.evidence.length > 0 && <small>Evidência: {suggestion.evidence.join(' · ')}</small>}{(suggestion.type === 'new_domain' || suggestion.type === 'new_operation') && <button className="apply-suggestion" disabled={Boolean(suggestion.appliedAt) || applyingSuggestion === suggestion.id} onClick={() => void applySuggestion(suggestion)}>{suggestion.appliedAt ? 'Adicionada à taxonomia' : applyingSuggestion === suggestion.id ? 'Adicionando…' : suggestion.type === 'new_domain' ? 'Adicionar domínio' : 'Adicionar operação'}</button>}</div>
                </article>)}
              </div> : null}
              {reviewContext?.votes.length ? <div className="vote-list">
                <h4>Sugestões dos classificadores</h4>
                {reviewContext.votes.map(vote => <article key={vote.provider}>
                  <div className="vote-head"><b>{vote.provider}</b><span>{vote.status === 'success' ? `${Math.round((vote.confidence ?? 0) * 100)}% confiança` : 'Falhou'}</span></div>
                  {vote.error ? <p className="inline-error">{vote.error}</p> : <>
                    {vote.rows.length > 0 && <div className="vote-classifications"><small>Classificação: {vote.rows.map(row => `${row.module} / ${row.operation}`).join(' · ')}</small>{vote.rows.filter(row => row.module !== 'n/a' && row.operation !== 'n/a').map(row => <button type="button" key={`${row.module}-${row.operation}`} onClick={() => useSuggestedClassification(row.module, row.operation)}>Usar {row.module} / {row.operation}</button>)}</div>}
                    {vote.rationale && <p>{vote.rationale}</p>}
                    {vote.issues.length > 0 && <small>Problemas: {vote.issues.join(' · ')}</small>}
                    {vote.suggestedQuestions.length > 0 && <small>Perguntas: {vote.suggestedQuestions.join(' · ')}</small>}
                  </>}
                </article>)}
              </div> : null}
            </>}
          </section>
          <label>Módulo<select value={module} onChange={event => selectModule(event.target.value)}><option value="n/a">n/a</option>{taxonomy && Object.keys(taxonomy.modules).map(name => <option key={name} value={name}>{name}</option>)}</select></label>
          <label>Operação<select value={operation} onChange={event => setOperation(event.target.value)}>{operations.map(name => <option key={name} value={name}>{name}</option>)}</select></label>
          <label>Notas da revisão<textarea className="small-area" value={notes} onChange={event => setNotes(event.target.value)} placeholder="Registre o motivo da decisão…"/></label>
          <div className="taxonomy-feedback">
            <button type="button" onClick={() => setShowFeedback(value => !value)}>{showFeedback ? 'Cancelar proposta de evolução' : 'Sugerir evolução da taxonomia'}</button>
            {showFeedback && <div className="feedback-fields">
              <label>Tipo de proposta<select value={proposalType} onChange={event => setProposalType(event.target.value as typeof proposalType)}><option value="new_domain">Novo domínio</option><option value="new_operation">Nova operação em um módulo</option><option value="clarify_story">Solicitar esclarecimento da história</option></select></label>
              {proposalType === 'new_domain' && <label>Domínio sugerido<input value={proposedDomain} onChange={event => setProposedDomain(event.target.value)} placeholder="Ex.: Faturamento"/></label>}
              {proposalType === 'new_operation' && <label>Operação sugerida para {module === 'n/a' ? 'um módulo selecionado' : module}<input value={proposedOperation} onChange={event => setProposedOperation(event.target.value)} placeholder="Ex.: Conciliar pagamento"/></label>}
              <label>Justificativa da proposta<textarea className="small-area" value={feedbackJustification} onChange={event => setFeedbackJustification(event.target.value)} placeholder="Explique a lacuna observada e por que a proposta ajuda a cobri-la…"/></label>
              <small>A proposta será registrada ao marcar a lacuna e seguirá para a governança da taxonomia.</small>
            </div>}
          </div>
          {error && <p className="inline-error">{error}</p>}
          <div className="actions"><button disabled={saving} onClick={() => review('taxonomy_gap')}>Marcar lacuna</button><button disabled={saving || module === 'n/a' || operation === 'n/a'} className="primary" onClick={() => review('approve')}>{saving ? 'Salvando…' : 'Confirmar classificação'}</button></div>
        </> : <div className="empty large">Selecione uma história para revisar.</div>}
      </div>
    </div>
  </section>;
}
