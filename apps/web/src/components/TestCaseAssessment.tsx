import { useEffect, useRef, useState } from 'react';
import { recommenderApi } from '../services/recommender-api';
import type { TestCaseRun, TestCaseResult } from '../types/test-case-recommendations';
import type { TestReview, TestTargetRecord, TestItemReview, TestDecisionRequest, TestCopyRequest, TestCopyRecord } from '../types/test-case-assessments';

export function TestCaseAssessment({ run, items }: { run: TestCaseRun; items: TestCaseResult['items'] }) {
  const [review, setReview] = useState<TestReview>(), [loading, setLoading] = useState(true), [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''); const running = useRef(false);
  useEffect(() => {
    let active = true; const controller = new AbortController(); setLoading(true); setError(''); setReview(undefined);
    recommenderApi.testReview(run.id, controller.signal).then(value => {
      if (value.runId !== run.id || value.runSha256 !== run.snapshot.sha256) throw new Error('Assessment does not match the preserved run.');
      if (active) setReview(value);
    }).catch((reason: Error) => { if (active) setError(reason.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [run.id, run.snapshot.sha256, retry]);
  async function confirm() {
    if (running.current || !review) return; running.current = true; setBusy(true); setError('');
    try { const target = await recommenderApi.confirmTestTarget(run.id, run.snapshot.sha256); setReview({ ...review, target }); }
    catch (reason) { setError((reason as Error).message); } finally { running.current = false; setBusy(false); }
  }
  return <section aria-label="Test assessment" className="configured-review"><h4>Assess tests and preserve adapted copies</h4>
    <p>Human judgments are separate from recommendation scores. The destination is the preserved input <b>{run.snapshot.content.request.content.input.id}</b>. This assessment creates no operational story or NFR link.</p>
    {loading && <p role="status">Loading test assessment…</p>}
    {!loading && !review && <button type="button" onClick={() => setRetry(value => value + 1)}>Retry test assessment</button>}
    {review && !review.target && <button type="button" disabled={busy} onClick={() => void confirm()}>Confirm preserved input as test destination</button>}
    {review?.target && <><p>Confirmed destination · Technical actor: {review.target.createdBy}</p><p className="configured-hash">Destination SHA-256: {review.target.snapshot.sha256}</p>
      {items.map(item => <ItemAssessment key={item.key} run={run} item={item} target={review.target!}/>)}</>}
    {error && <p role="alert" className="inline-error">{error}</p>}
  </section>;
}
function ItemAssessment({ run, item, target }: { run: TestCaseRun; item: TestCaseResult['items'][number]; target: TestTargetRecord }) {
  const [data, setData] = useState<TestItemReview>(), [latest, setLatest] = useState<TestCopyRecord>();
  const [offset, setOffset] = useState(0), [refresh, setRefresh] = useState(0), [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notes, setNotes] = useState('');
  const [editing, setEditing] = useState(false), [title, setTitle] = useState(''), [gherkin, setGherkin] = useState(''), [reason, setReason] = useState('');
  const [parent, setParent] = useState<TestCopyRequest['previousCopy']>(null);
  const running = useRef(false), pendingDecision = useRef<TestDecisionRequest | null>(null), pendingCopy = useRef<TestCopyRequest | null>(null);
  useEffect(() => {
    let active = true; const controller = new AbortController(); setLoading(true); setError('');
    recommenderApi.testItemReview(run.id, item.key, offset, controller.signal).then(value => {
      if (value.runId !== run.id || value.runSha256 !== run.snapshot.sha256 || value.itemKey !== item.key) throw new Error('Item assessment does not match the preserved test.');
      if (active) { setData(value); if (offset === 0) setLatest(value.copies[0]); }
    }).catch((failure: Error) => { if (active) setError(failure.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [run.id, run.snapshot.sha256, item.key, target.snapshot.sha256, offset, refresh]);
  async function action(task: () => Promise<void>) {
    if (running.current) return; running.current = true; setBusy(true); setError('');
    try { await task(); } catch (failure) { setError((failure as Error).message); } finally { running.current = false; setBusy(false); }
  }
  async function decide(decision: 'accepted' | 'rejected') {
    if (!data || loading) return;
    const payload = { runSha256: run.snapshot.sha256, targetSha256: target.snapshot.sha256, itemKey: item.key, decision, notes };
    if (!pendingDecision.current || JSON.stringify({ ...pendingDecision.current, id: undefined }) !== JSON.stringify(payload)) pendingDecision.current = { id: crypto.randomUUID(), ...payload };
    await action(async () => { const saved = await recommenderApi.decideTest(run.id, pendingDecision.current!); pendingDecision.current = null; setData({ ...data, decision: saved }); });
  }
  function openCopy() {
    const source = latest?.snapshot.content.artifact.content ?? item.artifact;
    setTitle(source.title); setGherkin(source.gherkin); setReason(''); setParent(latest ? { id: latest.id, sha256: latest.snapshot.sha256 } : null); setEditing(true); setError('');
  }
  async function saveCopy() {
    if (!data?.decision || !title.trim() || !gherkin.trim() || reason.trim().length < 5) return;
    const payload = { runSha256: run.snapshot.sha256, targetSha256: target.snapshot.sha256, decisionId: data.decision.id, itemKey: item.key, previousCopy: parent, title, gherkin, reason };
    if (!pendingCopy.current || JSON.stringify({ ...pendingCopy.current, id: undefined }) !== JSON.stringify(payload)) pendingCopy.current = { id: crypto.randomUUID(), ...payload };
    await action(async () => { const saved = await recommenderApi.saveTestCopy(run.id, pendingCopy.current!); pendingCopy.current = null; setLatest(saved); setEditing(false); setOffset(0); setRefresh(value => value + 1); });
  }
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ run, target, assessment: data }, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `test-assessment-${run.id}-${item.testCaseId.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const decision = data?.decision?.snapshot.content.request.content.decision;
  return <section className="configured-attribute" aria-label={`Assess test ${item.testCaseId}`}><h5>{item.artifact.title} · {item.testCaseId}</h5>
    {loading && <p role="status">Loading test decision and copy history…</p>}
    <button type="button" disabled={busy || loading} onClick={() => setRefresh(value => value + 1)}>Refresh test assessment</button>
    {data && <fieldset disabled={busy || loading} className="configured-form-body">
      {!decision ? <><label>Assessment notes<textarea maxLength={2000} value={notes} onChange={event => setNotes(event.target.value)}/></label><div className="configured-actions"><button type="button" onClick={() => void decide('accepted')}>Accept test</button><button type="button" onClick={() => void decide('rejected')}>Reject test</button></div></>
        : <><p>{decision === 'accepted' ? 'Accepted for the preserved input.' : 'Rejected. No adapted copy is created.'} Decisions are immutable.</p><p>{data.decision!.snapshot.content.request.content.notes}</p><p>Technical actor: {data.decision!.createdBy} · {new Date(data.decision!.createdAt).toLocaleString('en-US')}</p></>}
      {decision === 'accepted' && !editing && <button type="button" onClick={openCopy}>{latest ? 'New copy revision' : 'Copy or adapt accepted test'}</button>}
      {editing && <div className="configured-subeditor"><h5>{parent ? 'New revision of adapted copy' : 'Copy from preserved original'}</h5><p>Only this copy's title and Gherkin are editable. Original metadata and test identity remain preserved.</p>
        <label>Copy title<input maxLength={1000} value={title} onChange={event => setTitle(event.target.value)}/></label><label>Copy Gherkin<textarea maxLength={20000} value={gherkin} onChange={event => setGherkin(event.target.value)}/></label><label>Copy reason<textarea maxLength={2000} value={reason} onChange={event => setReason(event.target.value)}/></label>
        <div className="configured-actions"><button type="button" disabled={!title.trim() || !gherkin.trim() || reason.trim().length < 5} onClick={() => void saveCopy()}>Save immutable copy revision</button><button type="button" onClick={() => setEditing(false)}>Cancel copy edit</button></div>
      </div>}
      {data.copies.map(copy => <details key={copy.id}><summary>Copy revision {copy.snapshot.content.revision} · {copy.snapshot.content.artifact.content.title}</summary>
        <pre className="configured-value">{copy.snapshot.content.artifact.content.gherkin}</pre><p>Reason: {copy.snapshot.content.request.content.reason}</p><p>Technical actor: {copy.createdBy} · {new Date(copy.createdAt).toLocaleString('en-US')}</p>
        <p className="configured-hash">Copy SHA-256: {copy.snapshot.sha256}</p><p className="configured-hash">Previous SHA-256: {copy.snapshot.content.previous?.sha256 ?? 'Original source'}</p><pre className="configured-value">{JSON.stringify(copy.snapshot.content.changes, null, 2)}</pre>
      </details>)}
      {data.page.total > 0 && <p>{data.page.total} immutable copy revision(s) · showing {data.copies.length} from offset {offset}.</p>}
      <div className="configured-actions"><button type="button" disabled={offset === 0} onClick={() => setOffset(value => Math.max(0, value - 5))}>Previous copy revisions</button><button type="button" disabled={offset + data.page.limit >= data.page.total} onClick={() => setOffset(value => value + 5)}>Next copy revisions</button><button type="button" onClick={download}>Download this assessment page</button></div>
    </fieldset>}{error && <p role="alert" className="inline-error">{error} Draft values are preserved; refresh the assessment to inspect the latest history.</p>}
  </section>;
}
