import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowRight, CheckCircle2, ClipboardList, History, Info, X } from 'lucide-react';
import { PageTitle } from '../components/ui';
import { api } from '../services/api';
import { useWorkspace } from '../services/workspace';
import type { NfrContext, NfrRun } from '../types/nfr';

const statusLabels: Record<NfrRun['status'], string> = {
  blocked: 'Missing data', no_candidates: 'No compatible stories',
  no_items: 'Similar story has no eligible NFRs', completed: 'Suggestions found'
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
    <div className="nfr-page-heading"><PageTitle eyebrow="RECOMMENDATION" title="Recommend NFRs">Find non-functional requirements used in a similar story and decide which ones fit yours.</PageTitle><button className="nfr-info-button" type="button" onClick={() => setInfoOpen(true)} aria-label="How NFR recommendation works"><Info size={17}/> How it works</button></div>
    <div className="nfr-flow" aria-label="Recommendation steps"><span><b>1</b> Choose a classified story</span><ArrowRight size={15}/><span><b>2</b> Check its context</span><ArrowRight size={15}/><span><b>3</b> Generate and assess NFRs</span></div>
    <section className="card nfr-panel nfr-selection"><div className="nfr-section-heading"><span>STEP 1</span><h2>Story that will receive the NFRs</h2><p>The selected project and classification determine which previous stories can be compared.</p></div><label>User story<select value={id} disabled={workspace.loading} onChange={event => { workspace.selectStory(event.target.value); setParams(event.target.value ? { classificationId: event.target.value } : {}); }}>
      <option value="">Select a story</option>{workspace.stories.map(story => <option key={story.id} value={story.id}>{story.project} · US-{story.id} · {story.text}</option>)}
    </select></label></section>
    {id ? <NfrStory key={id} id={id}/> : <div className="card nfr-empty">Create and classify a story to get started. <Link to="/classify">Classify stories</Link></div>}
    {infoOpen && <div className="modal-backdrop" onMouseDown={() => setInfoOpen(false)}><div className="card nfr-info-modal" role="dialog" aria-modal="true" aria-labelledby="nfr-info-title" onMouseDown={event => event.stopPropagation()}><div className="nfr-info-head"><div><span>ABOUT THE METHOD</span><h2 id="nfr-info-title">How are NFRs recommended?</h2></div><button type="button" onClick={() => setInfoOpen(false)} aria-label="Close explanation"><X size={18}/></button></div>
      <ol><li><b>Filter the history.</b> The engine considers stories with the same module, operation, and taxonomy version whose classification was accepted, reviewed, or reclassified. It excludes the current story and prototype projects.</li><li><b>Find the most similar story.</b> It compares platform, domain, architecture, technologies, and task categories using Manhattan distance and selects only the nearest neighbor (k=1).</li><li><b>Reuse existing NFRs.</b> It shows NFR statements linked to the neighboring story. Utility is the neighbor similarity score, not a probability of correctness.</li><li><b>You decide.</b> Accepting links the NFR to the current story; rejecting records the decision without creating a link. Runs and decisions are saved.</li></ol>
      <p>If there is not enough data, no compatible story, or no eligible NFR in the nearest neighbor, the result explains why. The engine does not generate new statements with AI or switch to another neighbor.</p><button className="primary" type="button" onClick={() => setInfoOpen(false)}>Got it</button>
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
      if (decision === 'accepted') {
        const accepted = run.items.find(item => item.key === itemKey);
        if (accepted) setContext(current => current && !current.target.nfrs.some(item => item.sentence === accepted.sentence && item.type === accepted.type && item.attribute === accepted.attribute)
          ? { ...current, target: { ...current.target, nfrs: [...current.target.nfrs, { type: accepted.type, attribute: accepted.attribute, sentence: accepted.sentence }] } }
          : current);
      }
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  }

  if (loading) return <p className="state">Loading context and history…</p>;
  return <>
    {error && <p className="inline-error" role="alert">{error}</p>}
    {context && <section className="card nfr-panel"><div className="nfr-section-heading"><span>STEP 2</span><h2>Check the story context</h2><p>This data is used to select and compare stories from the history.</p></div>
      <div className="nfr-target"><small>{context.target.project} · Story #{context.target.storyId}</small><strong>{context.target.text}</strong></div>
      <div className="nfr-context-grid"><label>Classification used<select value={labelIndex} onChange={event => setLabelIndex(Number(event.target.value))} disabled={busy}>{context.target.labels.map((label, index) => <option key={index} value={index}>{label.module} / {label.operation}</option>)}</select></label><div><small>Taxonomy version</small><b>{context.target.taxonomyVersion || 'Not specified'}</b></div></div>
      <div className="nfr-linked"><h3>Linked NFRs ({context.target.nfrs.length})</h3>{context.target.nfrs.length ? <div className="nfr-items">{context.target.nfrs.map((item, index) => <article className="nfr-item" key={`${item.type}-${item.attribute}-${item.sentence}-${index}`}><div className="nfr-item-head"><span className="tag">{item.type} / {item.attribute}</span></div><p>{item.sentence}</p></article>)}</div> : <p className="empty">No NFRs are linked to this story yet.</p>}</div>
      {context.issues.length ? <div className="nfr-readiness needs-work"><AlertCircle size={18}/><div><b>Some data is missing</b><ul>{context.issues.map(issue => <li key={issue}>{issue}</li>)}</ul></div></div> : <div className="nfr-readiness ready"><CheckCircle2 size={18}/><span>Context is ready to search for similar stories.</span></div>}
      <div className="nfr-actions"><button className="primary" disabled={busy || !context.target.labels.length || !!context.issues.length} onClick={() => void execute()}>{busy ? 'Searching for NFRs…' : 'Generate recommendations'}</button>{context.issues.some(issue => issue.toLowerCase().includes('classification')) && <Link to={`/review?classificationId=${id}`}>Review classification</Link>}</div>
    </section>}
    <section className="card nfr-panel nfr-results"><div className="nfr-section-heading"><span>STEP 3</span><h2>Results and assessment</h2><p>Review the matching story before accepting or rejecting each NFR.</p></div>
      {runs.length ? <><label className="nfr-history-label"><History size={16}/> Run<select value={selected} disabled={busy} onChange={event => setSelected(event.target.value)}>{runs.map(item => <option key={item.id} value={item.id}>{new Date(item.createdAt).toLocaleString('en-US')} · {statusLabels[item.status]}</option>)}</select></label>
        {run && <><div className="nfr-result-summary"><span className={`nfr-result-status ${run.status}`}>{statusLabels[run.status]}</span><small>{run.eligibleCount} compatible stor{run.eligibleCount === 1 ? 'y' : 'ies'} · {run.items.length} suggested NFR{run.items.length === 1 ? '' : 's'}</small></div>
          {run.messages.map(message => <p className="nfr-result-message" key={message} role="status">{message}</p>)}
          {run.neighbor && <details className="nfr-neighbor"><summary>Why was this story selected? <span>{Math.round(run.neighbor.similarity * 100)}% similarity</span></summary><p><b>{run.neighbor.project}</b> · {run.neighbor.text}</p><p>The engine compared {run.dimensions.length} characteristics of the current story. Similarity measures matching characteristics, not the chance that an NFR is correct.</p><div className="table-wrap"><table><thead><tr><th>Current story characteristic</th><th>Found in neighbor?</th></tr></thead><tbody>{run.dimensions.map((dimension, index) => <tr key={dimension}><td>{dimension.replace(':', ': ')}</td><td>{run.neighbor!.vector[index] ? 'Yes' : 'No'}</td></tr>)}</tbody></table></div></details>}
          {run.items.length > 0 && <div className="nfr-suggestions"><h3><ClipboardList size={17}/> Suggested NFRs</h3><div className="nfr-items">{run.items.map(item => { const decision = run.decisions[item.key]; return <article key={item.key} className="nfr-item"><div className="nfr-item-head"><span className="tag">{item.type} / {item.attribute}</span><small>Utility {Math.round(item.score * 100)}%</small></div><p>{item.sentence}</p>{decision ? <p className="nfr-decision" role="status">{decision === 'accepted' ? 'Accepted and linked to the story.' : 'Rejected in this run.'}</p> : item.alreadyLinked ? <p className="nfr-decision">This NFR is already linked to the story.</p> : <div className="nfr-actions"><button className="primary" disabled={busy} onClick={() => void decide(item.key, 'accepted')}>Accept and link</button><button disabled={busy} onClick={() => void decide(item.key, 'rejected')}>Reject</button></div>}</article>; })}</div></div>}
          <p className="nfr-run-note">Result saved on {new Date(run.createdAt).toLocaleString('en-US')}. Generate a new recommendation if the profile or classification changes.</p>
        </>}
      </> : <div className="nfr-empty-result">No recommendation has been run for this classification. Check the context above and click “Generate recommendations”.</div>}
    </section>
  </>;
}
