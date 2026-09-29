import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { PageTitle } from '../components/ui';
import { api } from '../services/api';
import { useWorkspace } from '../services/workspace';
import type { Story, Taxonomy } from '../types/models';

const pendingStatuses = new Set(['pending_review', 'taxonomy_gap', 'needs_rewrite']);

export function ReviewPage() {
  const [params] = useSearchParams();
  const requestedId = params.get('classificationId');
  const workspace = useWorkspace();
  const [stories, setStories] = useState<Story[]>([]);
  const [selected, setSelected] = useState<Story>();
  const [taxonomy, setTaxonomy] = useState<Taxonomy>();
  const [domain, setDomain] = useState('');
  const [module, setModule] = useState('n/a');
  const [operation, setOperation] = useState('n/a');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.stories().then(allStories => {
      const pending = allStories.filter(story => pendingStatuses.has(story.status)
        || (story.status === 'reviewed' && (story.module === 'n/a' || story.operation === 'n/a')));
      setStories(pending);
      setSelected(pending.find(story => story.id === requestedId) ?? pending[0]);
    }).catch((reason: Error) => setError(reason.message)).finally(() => setLoading(false));
  }, [requestedId]);

  useEffect(() => {
    if (!selected) { setTaxonomy(undefined); return; }
    let active = true;
    setLoading(true); setError(''); setNotes('');
    api.taxonomy(selected.taxonomyVersion || undefined)
      .then(selectedTaxonomy => {
        if (!active) return;
        setTaxonomy(selectedTaxonomy);
        const selectedDomain = selected.module === 'n/a' ? '' : selectedTaxonomy.moduleDomains[selected.module] ?? '';
        setDomain(selectedDomain); setModule(selected.module); setOperation(selected.operation);
      })
      .catch((reason: Error) => { if (active) setError(reason.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [selected]);

  const domains = useMemo(() => Object.keys(taxonomy?.domains ?? {}), [taxonomy]);
  const modules = useMemo(() => Object.keys(taxonomy?.domains[domain]?.modules ?? {}), [taxonomy, domain]);
  const operations = taxonomy?.modules[module] ?? [];
  const cannotConfirm = !taxonomy ? 'Taxonomy is still loading.'
    : !domain ? 'Select a domain.'
      : module === 'n/a' || !modules.includes(module) ? 'Select a module.'
        : operation === 'n/a' || !operations.includes(operation) ? 'Select an operation.' : '';

  function selectDomain(nextDomain: string) {
    const nextModule = Object.keys(taxonomy?.domains[nextDomain]?.modules ?? {})[0] ?? 'n/a';
    setDomain(nextDomain); setModule(nextModule); setOperation(taxonomy?.modules[nextModule]?.[0] ?? 'n/a');
  }

  function selectModule(nextModule: string) {
    setModule(nextModule); setOperation(taxonomy?.modules[nextModule]?.[0] ?? 'n/a');
  }

  async function submit(action: 'approve' | 'taxonomy_gap') {
    if (!selected || saving || action === 'approve' && cannotConfirm) return;
    setSaving(true); setError('');
    try {
      await api.review(selected.id, action === 'approve' ? { action, module, operation, notes } : { action, notes });
      const remaining = stories.filter(story => story.id !== selected.id);
      setStories(remaining); setSelected(remaining[0]);
      await workspace.refreshStories();
    } catch (reason) { setError((reason as Error).message); }
    finally { setSaving(false); }
  }

  return <section className="page review-page">
    <PageTitle eyebrow="HUMAN REVIEW" title="Review Queue">Review only the stories that need a human decision.</PageTitle>
    <div className="review-grid">
      <div className="card queue"><h2>Pending ({stories.length})</h2>{loading && !stories.length ? <div className="state">Loading queue…</div> : stories.map(story => <button className={`queue-item${selected?.id === story.id ? ' selected' : ''}`} key={story.id} onClick={() => setSelected(story)}><i className="risk-dot"/><div><b>{story.text}</b><small>{story.module} · {Math.round(story.confidence * 100)}% confidence</small></div><ChevronRight size={16}/></button>)}{!loading && !stories.length && <div className="empty">The review queue is empty.</div>}</div>
      <div className="card review-panel">{selected ? <>
        <span className="badge warning">Review required</span><h2>{selected.text}</h2>
        <div className="fallback-context review-reason"><b>Why it needs review</b><p>The automated classification needs human confirmation.</p></div>
        <label>Domain<select value={domain} onChange={event => selectDomain(event.target.value)} disabled={loading}><option value="">Select a domain</option>{domains.map(name => <option key={name}>{name}</option>)}</select></label>
        <label>Module<select value={module} onChange={event => selectModule(event.target.value)} disabled={loading || !domain}><option value="n/a">Select a module</option>{modules.map(name => <option key={name}>{name}</option>)}</select></label>
        <label>Operation<select value={operation} onChange={event => setOperation(event.target.value)} disabled={loading || module === 'n/a'}><option value="n/a">Select an operation</option>{operations.map(name => <option key={name}>{name}</option>)}</select></label>
        <label>Review notes<textarea className="small-area" value={notes} onChange={event => setNotes(event.target.value)} placeholder="Record the reason for the decision…"/></label>
        {error && <p className="inline-error" role="alert">{error}</p>}
        {cannotConfirm && <p className="action-hint">{cannotConfirm}</p>}
        <div className="actions"><button disabled={saving || loading} onClick={() => void submit('taxonomy_gap')}>Mark taxonomy gap</button><button className="primary" disabled={saving || loading || Boolean(cannotConfirm)} onClick={() => void submit('approve')}>{saving ? 'Saving…' : 'Confirm classification'}</button></div>
      </> : <div className="empty large">There are no stories to review.</div>}</div>
    </div>
  </section>;
}
