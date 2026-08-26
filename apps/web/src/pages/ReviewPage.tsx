import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { CardHead, PageTitle } from '../components/ui';
import { api } from '../services/api';
import { useWorkspace } from '../services/workspace';
import type { FallbackSuggestion, ReviewContext, Story, Taxonomy } from '../types/models';

const pendingStatuses = new Set(['pending_review', 'taxonomy_gap', 'needs_rewrite']);
type ProposalType = 'new_domain' | 'new_module' | 'new_operation' | 'clarify_story';
type TaxonomyFeedbackInput = {
  proposalType: ProposalType;
  proposedDomain?: string;
  targetDomain?: string;
  proposedModule?: string;
  targetModule?: string;
  proposedOperation?: string;
  justification: string;
};

const suggestionTypeLabel: Record<FallbackSuggestion['type'], string> = {
  new_domain: 'Novo domínio',
  new_module: 'Novo módulo',
  new_operation: 'Nova operação',
  clarify_story: 'Esclarecer história',
  classification: 'Classificação alternativa'
};

function suggestionTarget(suggestion: FallbackSuggestion) {
  if (suggestion.type === 'new_domain' && suggestion.proposedDomain) return `Domínio sugerido: ${[suggestion.proposedDomain, suggestion.proposedModule, suggestion.proposedOperation].filter(Boolean).join(' / ')}`;
  if (suggestion.type === 'new_module' && suggestion.proposedModule) return `Módulo sugerido: ${[suggestion.targetDomain ?? 'Domínio não informado', suggestion.proposedModule, suggestion.proposedOperation].filter(Boolean).join(' / ')}`;
  if (suggestion.type === 'new_operation' && suggestion.proposedOperation) return `Operação sugerida: ${[suggestion.targetDomain, suggestion.targetModule ?? 'Módulo não informado', suggestion.proposedOperation].filter(Boolean).join(' / ')}`;
  return undefined;
}

function feedbackTarget(feedback: ReviewContext['taxonomyFeedbacks'][number]) {
  if (feedback.proposalType === 'new_domain') return `Novo domínio: ${[feedback.proposedDomain, feedback.proposedModule, feedback.proposedOperation].filter(Boolean).join(' / ')}`;
  if (feedback.proposalType === 'new_module') return `Novo módulo: ${[feedback.targetDomain, feedback.proposedModule, feedback.proposedOperation].filter(Boolean).join(' / ')}`;
  if (feedback.proposalType === 'new_operation') return `Nova operação: ${[feedback.targetDomain, feedback.targetModule, feedback.proposedOperation].filter(Boolean).join(' / ')}`;
  return 'Esclarecimento da história solicitado';
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
  const [proposalType, setProposalType] = useState<ProposalType>('new_domain');
  const [proposedDomain, setProposedDomain] = useState('');
  const [targetDomain, setTargetDomain] = useState('');
  const [proposedModule, setProposedModule] = useState('');
  const [targetModule, setTargetModule] = useState('');
  const [proposedOperation, setProposedOperation] = useState('');
  const [feedbackJustification, setFeedbackJustification] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingProposal, setSavingProposal] = useState(false);
  const [proposalSuccess, setProposalSuccess] = useState('');
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
    resetFeedbackFields('new_domain');
    setProposalSuccess('');
    setError('');
    setLoadingContext(true);
    api.reviewContext(selected.id)
      .then(context => { if (active) setReviewContext(context); })
      .catch((reason: Error) => { if (active) setError(reason.message); })
      .finally(() => { if (active) setLoadingContext(false); });
    return () => { active = false; };
  }, [selected]);

  function domainNames() {
    return Object.keys(taxonomy?.domains ?? {});
  }

  function modulesForDomain(domain: string) {
    return Object.keys(taxonomy?.domains[domain]?.modules ?? {});
  }

  function resetFeedbackFields(nextType: ProposalType) {
    const nextDomain = ['new_module', 'new_operation'].includes(nextType) ? domainNames()[0] ?? '' : '';
    setProposalType(nextType);
    setProposedDomain('');
    setTargetDomain(nextDomain);
    setProposedModule('');
    setTargetModule(nextType === 'new_operation' ? modulesForDomain(nextDomain)[0] ?? '' : '');
    setProposedOperation('');
    setFeedbackJustification('');
  }

  function toggleFeedback() {
    if (showFeedback) {
      setShowFeedback(false);
      return;
    }
    resetFeedbackFields('new_domain');
    setProposalSuccess('');
    setError('');
    setShowFeedback(true);
  }

  function selectFeedbackProposalType(nextType: ProposalType) {
    resetFeedbackFields(nextType);
    setProposalSuccess('');
    setError('');
  }

  function selectTargetDomain(nextDomain: string) {
    setTargetDomain(nextDomain);
    setTargetModule(modulesForDomain(nextDomain)[0] ?? '');
  }

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

  function buildTaxonomyFeedback(): TaxonomyFeedbackInput | null {
    if (!showFeedback) {
      setError('Abra a proposta de evolução para salvá-la.');
      return null;
    }
    if (feedbackJustification.trim().length < 5) {
      setError('Explique a justificativa da proposta de evolução da taxonomia.');
      return null;
    }
    if (proposalType === 'new_domain' && proposedDomain.trim().length < 2) {
      setError('Informe o domínio sugerido.');
      return null;
    }
    if (proposalType === 'new_module' && (targetDomain.trim().length < 2 || proposedModule.trim().length < 2)) {
      setError('Selecione o domínio existente e informe o módulo sugerido.');
      return null;
    }
    if (proposalType === 'new_operation' && (targetDomain.trim().length < 2 || targetModule.trim().length < 2 || proposedOperation.trim().length < 2)) {
      setError('Selecione o domínio e o módulo existentes e informe a operação sugerida.');
      return null;
    }
    return {
      proposalType,
      proposedDomain: proposalType === 'new_domain' ? proposedDomain.trim() : undefined,
      targetDomain: proposalType === 'new_module' || proposalType === 'new_operation' ? targetDomain.trim() : undefined,
      proposedModule: proposalType === 'new_domain' || proposalType === 'new_module' ? proposedModule.trim() || undefined : undefined,
      targetModule: proposalType === 'new_operation' ? targetModule.trim() : undefined,
      proposedOperation: proposalType === 'new_domain' || proposalType === 'new_module' || proposalType === 'new_operation' ? proposedOperation.trim() || undefined : undefined,
      justification: feedbackJustification.trim()
    };
  }

  async function saveTaxonomyProposal() {
    if (!selected) return;
    setError('');
    const feedback = buildTaxonomyFeedback();
    if (!feedback) return;
    setSavingProposal(true);
    try {
      await api.saveTaxonomyFeedback(selected.id, feedback);
      setReviewContext(await api.reviewContext(selected.id));
      setShowFeedback(false);
      setProposalSuccess('Proposta salva para a governança da taxonomia. A classificação continua disponível para revisão.');
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setSavingProposal(false);
    }
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
    setProposalSuccess('');
    if (action === 'approve' && confirmationDisabledReason) {
      setError(confirmationDisabledReason);
      return;
    }
    if (action === 'taxonomy_gap' && showFeedback) {
      setError('Salve ou cancele a proposta de evolução antes de marcar a lacuna.');
      return;
    }
    setSaving(true);
    try {
      if (action === 'approve') {
        await api.review(selected.id, { action, module, operation, notes: notes || undefined });
      } else {
        await api.review(selected.id, { action, notes: notes || undefined });
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
  const targetDomains = domainNames();
  const targetModules = modulesForDomain(targetDomain);
  const currentSelectionIsValid = Boolean(taxonomy?.modules[module]?.includes(operation));
  const confirmationDisabledReason = saving
    ? 'A classificação está sendo salva.'
    : savingProposal
      ? 'A proposta de evolução está sendo salva.'
      : !taxonomy
        ? 'A taxonomia ainda está sendo carregada.'
        : module === 'n/a'
          ? 'Selecione um módulo existente para confirmar a classificação.'
          : operation === 'n/a'
            ? 'Selecione uma operação do módulo para confirmar a classificação.'
            : !currentSelectionIsValid
              ? 'Selecione uma operação válida para o módulo escolhido.'
              : '';

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
                  <div><b>{suggestionTarget(suggestion) ?? `Origem: ${suggestion.source}`}</b><p>{suggestion.reason}</p>{suggestion.evidence.length > 0 && <small>Evidência: {suggestion.evidence.join(' · ')}</small>}{(suggestion.type === 'new_domain' || suggestion.type === 'new_module' || suggestion.type === 'new_operation') && <button className="apply-suggestion" disabled={Boolean(suggestion.appliedAt) || applyingSuggestion === suggestion.id} onClick={() => void applySuggestion(suggestion)}>{suggestion.appliedAt ? 'Adicionada à taxonomia' : applyingSuggestion === suggestion.id ? 'Adicionando…' : suggestion.type === 'new_domain' ? 'Adicionar domínio' : suggestion.type === 'new_module' ? 'Adicionar módulo' : 'Adicionar operação'}</button>}</div>
                </article>)}
              </div> : null}
              {reviewContext?.taxonomyFeedbacks.length ? <div className="saved-feedback-list">
                <h4>Propostas de evolução salvas</h4>
                {reviewContext.taxonomyFeedbacks.map(feedback => <article key={feedback.id}><b>{feedbackTarget(feedback)}</b><p>{feedback.justification}</p><small>Status: {feedback.status === 'pending_taxonomy_board' ? 'aguardando governança da taxonomia' : feedback.status}</small></article>)}
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
            <button type="button" onClick={toggleFeedback}>{showFeedback ? 'Cancelar proposta de evolução' : 'Sugerir evolução da taxonomia'}</button>
            {showFeedback && <div className="feedback-fields">
              <label>Tipo de proposta<select value={proposalType} onChange={event => selectFeedbackProposalType(event.target.value as ProposalType)}><option value="new_domain">Novo domínio (nova área)</option><option value="new_module">Novo módulo em um domínio existente</option><option value="new_operation">Nova operação em um módulo existente</option><option value="clarify_story">Solicitar esclarecimento da história</option></select></label>
              {proposalType === 'new_domain' && <><label>Domínio sugerido<input value={proposedDomain} onChange={event => setProposedDomain(event.target.value)} placeholder="Ex.: Mobile ou IoT"/></label><label>Módulo inicial (opcional)<input value={proposedModule} onChange={event => setProposedModule(event.target.value)} placeholder="Ex.: Sincronização"/></label><label>Operação inicial (opcional)<input value={proposedOperation} onChange={event => setProposedOperation(event.target.value)} placeholder="Ex.: Sincronizar offline"/></label></>}
              {proposalType === 'new_module' && <><label>Domínio existente<select value={targetDomain} onChange={event => selectTargetDomain(event.target.value)}><option value="" disabled>Selecione um domínio</option>{targetDomains.map(name => <option key={name} value={name}>{name}</option>)}</select></label><label>Módulo sugerido<input value={proposedModule} onChange={event => setProposedModule(event.target.value)} placeholder="Ex.: Notificações push"/></label><label>Operação inicial (opcional)<input value={proposedOperation} onChange={event => setProposedOperation(event.target.value)} placeholder="Ex.: Agendar notificação"/></label></>}
              {proposalType === 'new_operation' && <><label>Domínio existente<select value={targetDomain} onChange={event => selectTargetDomain(event.target.value)}><option value="" disabled>Selecione um domínio</option>{targetDomains.map(name => <option key={name} value={name}>{name}</option>)}</select></label><label>Módulo existente<select value={targetModule} onChange={event => setTargetModule(event.target.value)} disabled={!targetDomain}><option value="" disabled>Selecione um módulo</option>{targetModules.map(name => <option key={name} value={name}>{name}</option>)}</select></label><label>Operação sugerida<input value={proposedOperation} onChange={event => setProposedOperation(event.target.value)} placeholder="Ex.: Sincronizar offline"/></label></>}
              <label>Justificativa da proposta<textarea className="small-area" value={feedbackJustification} onChange={event => setFeedbackJustification(event.target.value)} placeholder="Explique a lacuna observada e por que a proposta ajuda a cobri-la…"/></label>
              <div className="feedback-actions"><button type="button" className="primary" disabled={savingProposal || !taxonomy} onClick={() => void saveTaxonomyProposal()}>{savingProposal ? 'Salvando proposta…' : 'Salvar proposta'}</button><small>Salvar a proposta não altera esta classificação: você ainda pode confirmá-la ou marcar uma lacuna.</small></div>
            </div>}
          </div>
          {proposalSuccess && <p className="inline-success" role="status">{proposalSuccess}</p>}
          {error && <p className="inline-error" role="alert">{error}</p>}
          {confirmationDisabledReason && <p className="action-hint" role="status">{confirmationDisabledReason}</p>}
          <div className="actions"><button disabled={saving || savingProposal} onClick={() => review('taxonomy_gap')}>Marcar lacuna</button><button disabled={Boolean(confirmationDisabledReason)} title={confirmationDisabledReason || undefined} className="primary" onClick={() => review('approve')}>{saving ? 'Salvando…' : 'Confirmar classificação'}</button></div>
        </> : <div className="empty large">Selecione uma história para revisar.</div>}
      </div>
    </div>
  </section>;
}
