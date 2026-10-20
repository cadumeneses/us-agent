import { useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import { recommenderApi } from '../services/recommender-api';
import type { BindTargetRequest, ClassificationDestination, ConfiguredRun, ItemDecisionRequest, RecommendationReview, Snapshot } from '../types/configurable-recommendations';
import type { Story } from '../types/models';
import { NfrAdaptation } from './NfrAdaptation';

function exportReview(run: ConfiguredRun, review: RecommendationReview) {
  const url = URL.createObjectURL(new Blob([JSON.stringify({ run, review }, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `avaliacao-${run.id}.json`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ConfiguredRunReview({ run }: { run: ConfiguredRun }) {
  const [review, setReview] = useState<RecommendationReview>();
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [refresh, setRefresh] = useState(0);
  const [kind, setKind] = useState<'input' | 'classification'>('input'), [stories, setStories] = useState<Story[]>([]);
  const [storiesLoading, setStoriesLoading] = useState(false), [storiesError, setStoriesError] = useState(''), [storyRetry, setStoryRetry] = useState(0);
  const [classificationId, setClassificationId] = useState(''), [destination, setDestination] = useState<Snapshot<ClassificationDestination>>();
  const [justification, setJustification] = useState(''), [notes, setNotes] = useState<Record<string, string>>({});
  const pending = useRef(new Map<string, ItemDecisionRequest>()), running = useRef(false);
  const result = run.snapshot.content.result.content;
  useEffect(() => {
    let active = true; const controller = new AbortController(); setLoading(true); setError(''); setReview(undefined);
    recommenderApi.review(run.id, controller.signal).then(value => {
      if (!active) return;
      if (value.runId !== run.id || value.runSha256 !== run.snapshot.sha256) throw new Error("The assessments do not match the open run.");
      setReview(value);
    }).catch((reason: Error) => { if (active) setError(reason.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [run.id, run.snapshot.sha256, refresh]);
  useEffect(() => {
    if (kind !== 'classification' || review?.target) return;
    let active = true; setStoriesLoading(true); setStoriesError('');
    api.stories().then(values => { if (active) setStories(values); }).catch((reason: Error) => { if (active) setStoriesError(reason.message); }).finally(() => { if (active) setStoriesLoading(false); });
    return () => { active = false; };
  }, [kind, storyRetry, !!review?.target]);
  async function action(task: () => Promise<void>) {
    if (running.current) return; running.current = true; setBusy(true); setError('');
    try { await task(); } catch (reason) { setError((reason as Error).message); } finally { running.current = false; setBusy(false); }
  }
  async function bind() {
    if (!review || kind === 'classification' && (!destination || justification.trim().length < 5)) return;
    const request: BindTargetRequest = { runSha256: run.snapshot.sha256, target: kind === 'input' ? { kind: 'input' } : {
      kind: 'classification', classificationId: destination!.content.classificationId, expectedSha256: destination!.sha256, justification: justification.trim()
    } };
    await action(async () => { const target = await recommenderApi.bindTarget(run.id, request); setReview({ ...review, target }); });
  }
  async function decide(itemKey: string, decision: 'accepted' | 'rejected') {
    if (!review?.target) return;
    const payload = { runSha256: run.snapshot.sha256, targetSha256: review.target.snapshot.sha256, itemKey, decision, notes: notes[itemKey] ?? '' };
    const previous = pending.current.get(itemKey);
    if (!previous || JSON.stringify({ ...previous, id: undefined }) !== JSON.stringify(payload)) pending.current.set(itemKey, { id: crypto.randomUUID(), ...payload });
    await action(async () => {
      const saved = await recommenderApi.decideItem(run.id, pending.current.get(itemKey)!);
      pending.current.delete(itemKey);
      setReview(current => current && ({ ...current, decisions: [...current.decisions.filter(item => item.snapshot.content.request.content.itemKey !== itemKey), saved] }));
    });
  }
  const target = review?.target?.snapshot.content.destination;
  const eligible = stories.filter(story => ['accepted_auto', 'reviewed', 'reclassified'].includes(story.status) && story.labels.some(label => label.module === result.label?.module && label.operation === result.label.operation));
  return <section aria-label="Suggestion assessment" className="configured-review">
    <h3>Assess suggestions</h3><p>The original result and published dataset remain preserved. Accepting or rejecting records a separate assessment.</p>
    {loading && <p role="status">Loading assessments…</p>}
    {error && <p role="alert" className="inline-error">{error}</p>}
    {!loading && <button disabled={busy} onClick={() => setRefresh(value => value + 1)}>Refresh assessments</button>}
    {review && !target && <fieldset className="configured-subeditor" disabled={busy}><legend>Assessment destination</legend><label>Link suggestions to<select value={kind} onChange={event => { setKind(event.target.value as typeof kind); setDestination(undefined); setClassificationId(''); setJustification(''); }}><option value="input">This run's preserved input</option><option value="classification">Selected US-Agent story</option></select></label>
      {kind === 'input' ? <p>Accepting creates a link to input <b>{run.snapshot.content.request.content.input.id}</b> and its preserved version. No operational story will be changed.</p> : <>
        <p>Select and review the story. Imported IDs do not automatically identify US-Agent records.</p>
        {storiesLoading && <p role="status">Loading stories…</p>}{storiesError && <p role="alert">{storiesError} <button onClick={() => setStoryRetry(value => value + 1)}>Retry loading stories</button></p>}
        <label>Destination story<select value={classificationId} disabled={storiesLoading} onChange={event => { setClassificationId(event.target.value); setDestination(undefined); }}><option value="">Select explicitly</option>{eligible.map(story => <option key={story.id} value={story.id}>{story.project} · classification {story.id} · {story.text}</option>)}</select></label>
        <button disabled={!classificationId || busy} onClick={() => void action(async () => setDestination(await recommenderApi.destination(run.id, classificationId)))}>Review destination story</button>
        {destination && <div className="configured-destination"><p><b>{destination.content.project}</b> · story {destination.content.storyId} · classification {destination.content.classificationId}</p><p>{destination.content.text}</p><p>{destination.content.labels.map(label => `${label.module} / ${label.operation}`).join('; ')}</p><label>Reason for linking to this story<textarea value={justification} maxLength={2000} onChange={event => setJustification(event.target.value)}/></label></div>}
      </>}
      <button className="primary" disabled={busy || kind === 'classification' && (!destination || justification.trim().length < 5)} onClick={() => void bind()}>Confirm reviewed destination</button><p>The confirmed destination applies to all items in this run. Start another run to change it.</p>
    </fieldset>}
    {target && <div className="configured-destination" role="status"><b>Confirmed destination</b>{target.kind === 'input' ? <p>Preserved input: {review!.target!.snapshot.content.input.content.id}</p> : <><p>{target.snapshot.content.project} · story {target.snapshot.content.storyId} · classification {target.snapshot.content.classificationId}</p><p>{target.snapshot.content.text}</p><p>Reason: {target.justification}</p></>}<small>Confirmed by {review!.target!.createdBy} on {new Date(review!.target!.createdAt).toLocaleString('en-US')}.</small></div>}
    <div className="nfr-items">{result.items.map(item => {
      const decision = review?.decisions.find(value => value.snapshot.content.request.content.itemKey === item.key);
      return <article className="nfr-item" key={item.key} aria-label={`Suggestion: ${item.sentence}`}><span className="tag">{item.type} / {item.attribute}</span><p>{item.sentence}</p><small>Utility: {(item.score * 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}%{item.alreadyLinked ? " · Already present in the original input" : ''}</small>
        {decision ? <div className="configured-decision" role="status"><p>{decision.snapshot.content.request.content.decision === 'rejected' ? "Rejected. This decision created no link." : decision.snapshot.content.association?.materialization === 'input_only' ? "Accepted and linked to the preserved input." : "Accepted. The link to the story was confirmed when the decision was recorded."}</p><p>{decision.snapshot.content.request.content.notes || "No notes."}</p><small>{decision.createdBy} · {new Date(decision.createdAt).toLocaleString('en-US')}</small><details><summary>Decision evidence</summary><p className="configured-hash">SHA-256: {decision.snapshot.sha256}</p>{decision.snapshot.content.association && <p className="configured-hash">Link: {decision.snapshot.content.association.identitySha256}</p>}</details></div> : <fieldset disabled={loading || busy || !target} className="configured-form-body"><label>Suggestion notes<textarea maxLength={2000} value={notes[item.key] ?? ''} onChange={event => setNotes({ ...notes, [item.key]: event.target.value })}/></label><div className="configured-actions"><button className="primary" onClick={() => void decide(item.key, 'accepted')}>Accept and link</button><button onClick={() => void decide(item.key, 'rejected')}>Reject</button></div></fieldset>}
        {decision?.snapshot.content.request.content.decision === 'accepted' && <NfrAdaptation key={`${decision.id}:${(review?.copies ?? []).filter(copy=>copy.snapshot.content.request.content.decisionId === decision.id).length}`} run={run} decision={decision}
          copies={(review?.copies ?? []).filter(copy=>copy.snapshot.content.request.content.decisionId === decision.id)}
          saved={copy=>setReview(current=>current && ({ ...current,copies:[...(current.copies ?? []).filter(value=>value.id!==copy.id),copy] }))}/>}
      </article>;
    })}</div>
    {review && <button disabled={busy || loading} onClick={() => exportReview(run, review)}>Download evidence with assessments</button>}
  </section>;
}
