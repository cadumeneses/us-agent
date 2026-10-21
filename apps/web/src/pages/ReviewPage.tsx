import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { CardHead, PageTitle } from '../components/ui';
import { api } from '../services/api';
import { useWorkspace } from '../services/workspace';
import type { ClassificationLabel, FallbackSuggestion, ReviewContext, Story, Taxonomy } from '../types/models';

const pendingStatuses = new Set(['pending_review', 'taxonomy_gap', 'needs_rewrite']);
const newDomainOption = '__new_domain__';
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
  new_domain: "New domain",
  new_module: "New module",
  new_operation: "New operation",
  clarify_story: "Clarify story",
  classification: "Alternative classification"
};

function suggestionTarget(suggestion: FallbackSuggestion) {
  if (suggestion.type === 'new_domain' && suggestion.proposedDomain) return `Proposed domain: ${[suggestion.proposedDomain, suggestion.proposedModule, suggestion.proposedOperation].filter(Boolean).join(' / ')}`;
  if (suggestion.type === 'new_module' && suggestion.proposedModule) return `Proposed module: ${[suggestion.targetDomain ?? "Domain not specified", suggestion.proposedModule, suggestion.proposedOperation].filter(Boolean).join(' / ')}`;
  if (suggestion.type === 'new_operation' && suggestion.proposedOperation) return `Proposed operation: ${[suggestion.targetDomain, suggestion.targetModule ?? "Module not specified", suggestion.proposedOperation].filter(Boolean).join(' / ')}`;
  return undefined;
}

function feedbackTarget(feedback: ReviewContext['taxonomyFeedbacks'][number]) {
  if (feedback.proposalType === 'new_domain') return `New domain: ${[feedback.proposedDomain, feedback.proposedModule, feedback.proposedOperation].filter(Boolean).join(' / ')}`;
  if (feedback.proposalType === 'new_module') return `New module: ${[feedback.targetDomain, feedback.proposedModule, feedback.proposedOperation].filter(Boolean).join(' / ')}`;
  if (feedback.proposalType === 'new_operation') return `New operation: ${[feedback.targetDomain, feedback.targetModule, feedback.proposedOperation].filter(Boolean).join(' / ')}`;
  return "Story clarification requested";
}

export function ReviewPage() {
  const [params, setParams] = useSearchParams();
  const requestedId = params.get('classificationId');
  const workspace = useWorkspace();
  const [stories, setStories] = useState<Story[]>([]);
  const [selected, setSelected] = useState<Story>();
  const [taxonomy, setTaxonomy] = useState<Taxonomy>();
  const [reviewContext, setReviewContext] = useState<ReviewContext>();
  const [loadingContext, setLoadingContext] = useState(false);
  const [classificationDomain, setClassificationDomain] = useState('');
  const [module, setModule] = useState('n/a');
  const [operation, setOperation] = useState('n/a');
  const [selectedLabels, setSelectedLabels] = useState<ClassificationLabel[]>([]);
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
  const [applyingFeedback, setApplyingFeedback] = useState<string>();
  const [error, setError] = useState('');

  useEffect(() => {
    api.stories()
      .then(allStories => {
        const pending = allStories.filter(story =>
          pendingStatuses.has(story.status)
          || (story.status === 'reviewed' && (story.module === 'n/a' || story.operation === 'n/a'))
        );
        setStories(pending);
        setSelected(pending.find(story => story.id === requestedId) ?? pending[0]);
      })
      .catch((reason: Error) => setError(reason.message));
  }, [requestedId]);

  useEffect(() => {
    if (!selected) {
      setReviewContext(undefined);
      return;
    }
    let active = true;
    setReviewContext(undefined);
    setSelectedLabels(selected.labels.filter(label => label.module !== 'n/a' && label.operation !== 'n/a'));
    setClassificationDomain(selected.module === 'n/a' ? '' : taxonomy?.moduleDomains[selected.module] ?? '');
    setModule(selected.module);
    setOperation(selected.operation);
    setNotes('');
    setShowFeedback(false);
    resetFeedbackFields('new_domain');
    setProposalSuccess('');
    setError('');
    setLoadingContext(true);
    setTaxonomy(undefined);
    Promise.all([api.reviewContext(selected.id), api.taxonomy(selected.taxonomyVersion || undefined)])
      .then(([context, selectedTaxonomy]) => { if (active) {
        setReviewContext(context); setTaxonomy(selectedTaxonomy);
        setClassificationDomain(selectedTaxonomy.moduleDomains[selected.module] ?? '');
        setSelectedLabels(context.labels.filter(label => label.module !== 'n/a' && label.operation !== 'n/a'));
      } })
      .catch((reason: Error) => { if (active) setError(reason.message); })
      .finally(() => { if (active) setLoadingContext(false); });
    return () => { active = false; };
  }, [selected]);

  useEffect(() => {
    if (!selected || selected.module === 'n/a' || classificationDomain || !taxonomy) return;
    setClassificationDomain(taxonomy.moduleDomains[selected.module] ?? '');
  }, [classificationDomain, selected, taxonomy]);

  function domainNames() {
    return Object.keys(taxonomy?.domains ?? {});
  }

  function modulesForDomain(domain: string) {
    return Object.keys(taxonomy?.domains[domain]?.modules ?? {});
  }

  function resetFeedbackFields(nextType: ProposalType) {
    const nextDomain = nextType === 'new_module'
      ? domainNames()[0] ?? newDomainOption
      : nextType === 'new_operation'
        ? domainNames()[0] ?? ''
        : '';
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
    setTargetModule(nextDomain === newDomainOption ? '' : modulesForDomain(nextDomain)[0] ?? '');
  }

  function selectClassificationDomain(nextDomain: string) {
    setClassificationDomain(nextDomain);
    const nextModule = modulesForDomain(nextDomain)[0] ?? 'n/a';
    setModule(nextModule);
    setOperation(nextModule === 'n/a' ? 'n/a' : taxonomy?.modules[nextModule]?.[0] ?? 'n/a');
  }

  function selectModule(nextModule: string) {
    setClassificationDomain(nextModule === 'n/a' ? '' : taxonomy?.moduleDomains[nextModule] ?? classificationDomain);
    setModule(nextModule);
    setOperation(nextModule === 'n/a' ? 'n/a' : taxonomy?.modules[nextModule]?.[0] ?? 'n/a');
  }

  function useSuggestedClassification(nextModule: string, nextOperation: string) {
    setClassificationDomain(taxonomy?.moduleDomains[nextModule] ?? '');
    setModule(nextModule);
    setOperation(nextOperation);
    addClassification({ module: nextModule, operation: nextOperation });
    setError('');
  }

  function addClassification(label: ClassificationLabel) {
    if (!taxonomy?.modules[label.module]?.includes(label.operation)) return;
    setSelectedLabels(current => current.length >= 8 || current.some(item => item.module === label.module && item.operation === label.operation)
      ? current : [...current, label]);
  }

  function useSuggestedSet(labels: ClassificationLabel[]) {
    if (!labels.length || labels.some(label => !taxonomy?.modules[label.module]?.includes(label.operation))) return;
    setSelectedLabels(labels.map(label => ({ ...label })));
  }

  function finishCurrent() {
    if (!selected) return;
    const remaining = stories.filter(story => story.id !== selected.id);
    setStories(remaining);
    setSelected(remaining[0]);
  }

  function buildTaxonomyFeedback(): TaxonomyFeedbackInput | null {
    if (!showFeedback) {
      setError("Open the taxonomy proposal before saving it.");
      return null;
    }
    if (feedbackJustification.trim().length < 5) {
      setError("Explain the reason for the taxonomy proposal.");
      return null;
    }
    if (proposalType === 'new_domain' && proposedDomain.trim().length < 2) {
      setError('Enter the proposed domain.');
      return null;
    }
    if (proposalType === 'new_module' && targetDomain === newDomainOption && (proposedDomain.trim().length < 2 || proposedModule.trim().length < 2)) {
      setError("Enter the new domain and proposed module.");
      return null;
    }
    if (proposalType === 'new_module' && targetDomain !== newDomainOption && (targetDomain.trim().length < 2 || proposedModule.trim().length < 2)) {
      setError("Select the existing domain and enter the proposed module.");
      return null;
    }
    if (proposalType === 'new_operation' && (targetDomain.trim().length < 2 || targetModule.trim().length < 2 || proposedOperation.trim().length < 2)) {
      setError("Select the existing domain and module and enter the proposed operation.");
      return null;
    }
    const moduleCreatesDomain = proposalType === 'new_module' && targetDomain === newDomainOption;
    return {
      proposalType: moduleCreatesDomain ? 'new_domain' : proposalType,
      proposedDomain: proposalType === 'new_domain' || moduleCreatesDomain ? proposedDomain.trim() : undefined,
      targetDomain: (proposalType === 'new_module' && !moduleCreatesDomain) || proposalType === 'new_operation' ? targetDomain.trim() : undefined,
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
      const saved = await api.saveTaxonomyFeedback(selected.id, feedback);
      setTaxonomy(saved.taxonomy);
      useTaxonomyExpansion(saved.taxonomy, feedback);
      setReviewContext(await api.reviewContext(selected.id));
      setShowFeedback(false);
      setProposalSuccess(saved.status === 'applied'
        ? "The expansion was saved and applied to the taxonomy. It can now be used to confirm the classification."
        : "The clarification request was saved. The classification remains available for review.");
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

  async function applySavedFeedback(feedback: ReviewContext['taxonomyFeedbacks'][number]) {
    if (!selected || feedback.status === 'applied') return;
    setApplyingFeedback(feedback.id);
    setError('');
    try {
      const result = await api.applyTaxonomyFeedback(feedback.id);
      setTaxonomy(result.taxonomy);
      useTaxonomyExpansion(result.taxonomy, feedback);
      setReviewContext(await api.reviewContext(selected.id));
      setProposalSuccess(result.status === 'applied'
        ? "The expansion was applied to the taxonomy. It can now be used to confirm the classification."
        : "The expansion was already applied to the taxonomy.");
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setApplyingFeedback(undefined);
    }
  }

  function useTaxonomyExpansion(nextTaxonomy: Taxonomy, expansion: TaxonomyFeedbackInput | ReviewContext['taxonomyFeedbacks'][number]) {
    const nextDomain = expansion.proposalType === 'new_domain' ? expansion.proposedDomain : expansion.targetDomain;
    const nextModule = expansion.proposalType === 'new_domain' || expansion.proposalType === 'new_module'
      ? expansion.proposedModule
      : expansion.targetModule;
    const nextOperation = expansion.proposedOperation;
    if (!nextDomain || !nextModule || !nextTaxonomy.modules[nextModule]) return;
    setClassificationDomain(nextDomain);
    setModule(nextModule);
    setOperation(nextOperation && nextTaxonomy.modules[nextModule].includes(nextOperation)
      ? nextOperation
      : nextTaxonomy.modules[nextModule][0] ?? 'n/a');
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
      setError("Save or cancel the taxonomy proposal before marking the gap.");
      return;
    }
    setSaving(true);
    try {
      if (action === 'approve') {
        await api.review(selected.id, { action, labels: selectedLabels, notes: notes || undefined });
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
  const classificationDomains = domainNames();
  const classificationModules = modulesForDomain(classificationDomain);
  const targetDomains = domainNames();
  const targetModules = modulesForDomain(targetDomain);
  const currentSelectionIsValid = Boolean(taxonomy?.modules[module]?.includes(operation));
  const confirmationDisabledReason = saving
    ? "The classification is being saved."
    : savingProposal
      ? "The taxonomy proposal is being saved."
      : !taxonomy || loadingContext
        ? "The taxonomy is still loading."
        : !selectedLabels.length
          ? "Add at least one pair to confirm the classification."
          : selectedLabels.some(label => !taxonomy.modules[label.module]?.includes(label.operation))
            ? "Remove or replace pairs that do not belong to this run's taxonomy."
            : '';

  return <section className="page">
    <PageTitle eyebrow="HUMAN REVIEW" title="Review Queue">Review only the stories that need a human decision.</PageTitle>
    <div className="review-grid">
      <div className="card queue">
        <CardHead title={`Pending (${stories.length})`}/>
        {stories.map(story => <button disabled={saving || savingProposal || !!applyingSuggestion || !!applyingFeedback} aria-pressed={selected?.id === story.id} className={selected?.id === story.id ? 'queue-item selected' : 'queue-item'} onClick={() => { setSelected(story); setParams({ classificationId: story.id }); }} key={story.id}><span className="risk-dot"/><div><b>{story.text}</b><small>{story.module} · {Math.round(story.confidence * 100)}% confidence</small></div><ChevronRight size={16} aria-hidden="true"/></button>)}
        {!stories.length && <div className="empty">The queue is empty.</div>}
      </div>
      <div className="card review-panel">
        {selected ? <>
          <span className="badge warning">Review required</span>
          <h2>{selected.text}</h2>
          <div className="score-row"><div><small>Run confidence</small><strong>{Math.round(selected.confidence * 100)}%</strong></div><div><small>Consensus{selected.metricsSource === 'legacy' ? " (legacy)" : ''}</small><strong>{selected.metricsSource === 'rules' ? "Not applicable" : `${Math.round(selected.consensus * 100)}%`}</strong></div><div><small>Uncertainty{selected.metricsSource === 'legacy' ? " (legacy)" : ''}</small><strong>{selected.metricsSource === 'rules' ? "Not applicable" : `${Math.round(selected.uncertainty * 100)}%`}</strong></div></div>
          <section className="fallback-context" aria-live="polite">
            <h3>Why this story needs review</h3>
            {loadingContext ? <p>Loading review context…</p> : <>
              <p>{reviewContext?.final.reason ?? "This classification requires human confirmation."}</p>
              {reviewContext?.provenance ? <details><summary>Run provenance</summary>
                <p>Engine: {reviewContext.provenance.engine} · Policy: {reviewContext.provenance.policyVersion}</p>
                <p>Prompt: {reviewContext.provenance.promptVersion ?? "Not used (local rules)"} · Taxonomy: {reviewContext.provenance.taxonomy.version}</p>
                <p>Taxonomy hash: <code>{reviewContext.provenance.taxonomy.sha256}</code></p>
                <p>Valid responses: {reviewContext.provenance.decision.providerHealth.successful}/{reviewContext.provenance.decision.providerHealth.total} · Failures: {reviewContext.provenance.decision.providerHealth.failed}</p>
                <p>Preserved automatic result: {reviewContext.provenance.decision.labels.map(label => `${label.module} / ${label.operation}`).join(' · ')}</p>
              </details> : reviewContext && <p>Legacy record: the original run snapshot is unavailable.</p>}
              {reviewContext?.final.notesForHuman && <p className="fallback-note">{reviewContext.final.notesForHuman}</p>}
              {(reviewContext?.final.disagreementCause || reviewContext?.final.action) && <small>Technical reason: {reviewContext.final.disagreementCause ?? 'n/a'} · Suggested action: {reviewContext.final.action ?? 'n/a'}</small>}
              {reviewContext?.suggestions.length ? <div className="fallback-list">
                <h4>Fallback suggestions</h4>
                {reviewContext.suggestions.map(suggestion => <article key={suggestion.id}>
                  <span>{suggestionTypeLabel[suggestion.type]}</span>
                  <div><b>{suggestionTarget(suggestion) ?? `Source: ${suggestion.source}`}</b><p>{suggestion.reason}</p>{suggestion.evidence.length > 0 && <small>Evidence: {suggestion.evidence.join(' · ')}</small>}{(suggestion.type === 'new_domain' || suggestion.type === 'new_module' || suggestion.type === 'new_operation') && <button className="apply-suggestion" disabled={Boolean(suggestion.appliedAt) || applyingSuggestion === suggestion.id} onClick={() => void applySuggestion(suggestion)}>{suggestion.appliedAt ? "Added to taxonomy" : applyingSuggestion === suggestion.id ? "Adding…" : suggestion.type === 'new_domain' ? "Add domain" : suggestion.type === 'new_module' ? "Add module" : "Add operation"}</button>}</div>
                </article>)}
              </div> : null}
              {reviewContext?.taxonomyFeedbacks.length ? <div className="saved-feedback-list">
                <h4>Saved taxonomy proposals</h4>
                {reviewContext.taxonomyFeedbacks.map(feedback => <article key={feedback.id}><b>{feedbackTarget(feedback)}</b><p>{feedback.justification}</p><small>Status: {feedback.status === 'applied' ? "applied to taxonomy" : feedback.status === 'needs_clarification' ? "awaiting story clarification" : "proposal not yet applied"}</small>{feedback.status !== 'applied' && feedback.proposalType !== 'clarify_story' && <button className="apply-suggestion" disabled={applyingFeedback === feedback.id} onClick={() => void applySavedFeedback(feedback)}>{applyingFeedback === feedback.id ? "Applying…" : "Apply to taxonomy"}</button>}</article>)}
              </div> : null}
              {reviewContext?.votes.length ? <div className="vote-list">
                <h4>Classifier suggestions</h4>
                {reviewContext.votes.map(vote => <article key={vote.provider}>
                  <div className="vote-head"><b>{vote.provider}</b><span>{vote.status === 'success' ? `${Math.round((vote.confidence ?? 0) * 100)}% confidence` : "Failed"}</span></div>
                  <small>Requested model: {vote.requestedModel ?? "Not recorded"} · Returned model: {vote.model ?? "Not supplied by provider"}</small>
                  {vote.error ? <p className="inline-error">{vote.error}</p> : <>
                    {vote.rows.length > 0 && <div className="vote-classifications"><small>Classification: {vote.rows.map(row => `${row.module} / ${row.operation}`).join(' · ')}</small>{vote.rows.filter(row => row.module !== 'n/a' && row.operation !== 'n/a').map(row => <button type="button" key={`${row.module}-${row.operation}`} onClick={() => useSuggestedClassification(row.module, row.operation)}>Use {row.module} / {row.operation}</button>)}</div>}
                    {vote.rationale && <p>{vote.rationale}</p>}
                    {vote.evidence.length > 0 && <small>Evidence: {vote.evidence.join(' · ')}</small>}
                    {vote.rows.length > 1 && vote.rows.every(label => taxonomy?.modules[label.module]?.includes(label.operation)) && <button type="button" onClick={() => useSuggestedSet(vote.rows)}>Use set from {vote.provider}</button>}
                    {vote.issues.length > 0 && <small>Issues: {vote.issues.join(' · ')}</small>}
                    {vote.suggestedQuestions.length > 0 && <small>Questions: {vote.suggestedQuestions.join(' · ')}</small>}
                  </>}
                </article>)}
              </div> : null}
            </>}
          </section>
          <section className="review-labels" aria-label="Classifications to confirm">
            <h3>Pairs to confirm ({selectedLabels.length}/8)</h3>
            {selectedLabels.map((label, index) => <div key={JSON.stringify(label)}>
              <span>{label.module} / {label.operation}</span>
              <button type="button" disabled={saving || loadingContext} aria-label={`Remove ${label.module} / ${label.operation}`} onClick={() => setSelectedLabels(current => current.filter((_, position) => position !== index))}>Remove</button>
            </div>)}
          </section>
          <label>Domain<select value={classificationDomain} onChange={event => selectClassificationDomain(event.target.value)}><option value="" disabled>Select a domain</option>{classificationDomains.map(name => <option key={name} value={name}>{name}</option>)}</select></label>
          <label>Module<select value={module} onChange={event => selectModule(event.target.value)} disabled={!classificationDomain}><option value="n/a">Select a module</option>{classificationModules.map(name => <option key={name} value={name}>{name}</option>)}</select></label>
          <label>Operation<select value={operation} onChange={event => setOperation(event.target.value)}>{operations.map(name => <option key={name} value={name}>{name}</option>)}</select></label>
          <button type="button" disabled={!currentSelectionIsValid || saving || loadingContext || selectedLabels.length >= 8 || selectedLabels.some(label => label.module === module && label.operation === operation)} onClick={() => addClassification({ module, operation })}>Add pair</button>
          {Boolean(reviewContext?.reviews.length) && <details><summary>Review history</summary>{reviewContext?.reviews.map(item => <article key={item.id}><b>{item.reviewer} · {item.action === 'approve' ? "Classification confirmed" : "Gap recorded"}</b><p>{item.notes}</p><small>{item.reviewedAt}</small></article>)}</details>}
          <label>Review notes<textarea className="small-area" value={notes} onChange={event => setNotes(event.target.value)} placeholder="Record the reason for the decision…"/></label>
          <div className="taxonomy-feedback">
            <button type="button" onClick={toggleFeedback}>{showFeedback ? "Cancel taxonomy proposal" : "Suggest taxonomy evolution"}</button>
            {showFeedback && <div className="feedback-fields">
              <label>Proposal type<select value={proposalType} onChange={event => selectFeedbackProposalType(event.target.value as ProposalType)}><option value="new_domain">New domain (new area)</option><option value="new_module">New module in an existing domain</option><option value="new_operation">New operation in an existing module</option><option value="clarify_story">Request story clarification</option></select></label>
              {proposalType === 'new_domain' && <><label>Proposed domain<input value={proposedDomain} onChange={event => setProposedDomain(event.target.value)} placeholder="Example: Mobile or IoT"/></label><label>Initial module (optional)<input value={proposedModule} onChange={event => setProposedModule(event.target.value)} placeholder="Example: Synchronization"/></label><label>Initial operation (optional)<input value={proposedOperation} onChange={event => setProposedOperation(event.target.value)} placeholder="Example: Sync offline"/></label></>}
              {proposalType === 'new_module' && <><label>Domain<select value={targetDomain} onChange={event => selectTargetDomain(event.target.value)}><option value="" disabled>Select a domain</option>{targetDomains.map(name => <option key={name} value={name}>{name}</option>)}<option value={newDomainOption}>Add a new domain…</option></select></label>{targetDomain === newDomainOption && <label>New domain<input value={proposedDomain} onChange={event => setProposedDomain(event.target.value)} placeholder="Example: Mobile or IoT"/></label>}<label>Proposed module<input value={proposedModule} onChange={event => setProposedModule(event.target.value)} placeholder="Example: Push notifications"/></label><label>Initial operation (optional)<input value={proposedOperation} onChange={event => setProposedOperation(event.target.value)} placeholder="Example: Schedule notification"/></label></>}
              {proposalType === 'new_operation' && <><label>Existing domain<select value={targetDomain} onChange={event => selectTargetDomain(event.target.value)}><option value="" disabled>Select a domain</option>{targetDomains.map(name => <option key={name} value={name}>{name}</option>)}</select></label><label>Existing module<select value={targetModule} onChange={event => setTargetModule(event.target.value)} disabled={!targetDomain}><option value="" disabled>Select a module</option>{targetModules.map(name => <option key={name} value={name}>{name}</option>)}</select></label><label>Proposed operation<input value={proposedOperation} onChange={event => setProposedOperation(event.target.value)} placeholder="Example: Sync offline"/></label></>}
              <label>Proposal rationale<textarea className="small-area" value={feedbackJustification} onChange={event => setFeedbackJustification(event.target.value)} placeholder="Explain the observed gap and how the proposal addresses it…"/></label>
              <div className="feedback-actions"><button type="button" className="primary" disabled={savingProposal || !taxonomy} onClick={() => void saveTaxonomyProposal()}>{savingProposal ? "Saving expansion…" : proposalType === 'clarify_story' ? "Save request" : "Save and apply expansion"}</button><small>The expansion becomes available in the active taxonomy for this review; clarification requests are recorded without changing the taxonomy.</small></div>
            </div>}
          </div>
          {proposalSuccess && <p className="inline-success" role="status">{proposalSuccess}</p>}
          {error && <p className="inline-error" role="alert">{error}</p>}
          {confirmationDisabledReason && <p className="action-hint" role="status">{confirmationDisabledReason}</p>}
          <div className="actions"><button disabled={saving || savingProposal} onClick={() => review('taxonomy_gap')}>Mark taxonomy gap</button><button disabled={Boolean(confirmationDisabledReason)} title={confirmationDisabledReason || undefined} className="primary" onClick={() => review('approve')}>{saving ? 'Saving…' : 'Confirm classification'}</button></div>
        </> : <div className="empty large">Select a story to review.</div>}
      </div>
    </div>
  </section>;
}
