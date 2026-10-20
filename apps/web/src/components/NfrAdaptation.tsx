import { useRef, useState } from 'react';
import { recommenderApi } from '../services/recommender-api';
import type { ConfiguredRun, ItemDecision, NfrCopy, NfrCopyRequest } from '../types/configurable-recommendations';

export function NfrAdaptation({ run, decision, copies, saved }: { run: ConfiguredRun; decision: ItemDecision; copies: NfrCopy[]; saved: (copy: NfrCopy) => void }) {
  const latest = [...copies].sort((a,b) => b.snapshot.content.revision-a.snapshot.content.revision)[0];
  const original = decision.snapshot.content.originalItem;
  const [sentence,setSentence] = useState(latest?.snapshot.content.artifact.sentence ?? original.sentence);
  const [reason,setReason] = useState(''), [busy,setBusy] = useState(false), [error,setError] = useState('');
  const pending = useRef<NfrCopyRequest | null>(null), running = useRef(false);
  async function save() {
    if (running.current) return;
    running.current = true; setBusy(true);setError('');
    const payload = { runSha256: run.snapshot.sha256, targetSha256: decision.snapshot.content.target.sha256,
      decisionId: decision.id, itemKey: original.key, previousCopy: latest ? { id: latest.id, sha256: latest.snapshot.sha256 } : null,
      sentence: sentence.trim(), reason: reason.trim() };
    if (!pending.current || JSON.stringify({ ...pending.current,id:undefined }) !== JSON.stringify(payload)) pending.current = { id: crypto.randomUUID(), ...payload };
    try { saved(await recommenderApi.saveNfrCopy(run.id,pending.current)); pending.current=null;setReason(''); }
    catch (failure) { setError((failure as Error).message); }
    finally { running.current=false;setBusy(false); }
  }
  return <details><summary>Adapt accepted NFR</summary>
    <p>Save a separate version for this destination. The original suggestion, decision, and story remain preserved.</p>
    <fieldset disabled={busy}><label>Adapted sentence<textarea value={sentence} maxLength={20000} onChange={event=>setSentence(event.target.value)}/></label>
      <label>Reason for adaptation<textarea value={reason} maxLength={2000} onChange={event=>setReason(event.target.value)}/></label>
      <button disabled={!sentence.trim() || reason.trim().length<5} onClick={()=>void save()}>Save NFR adaptation</button>
    </fieldset>{error && <p role="alert">{error}</p>}
    {copies.length>0 && <div aria-label="NFR adaptation history">{[...copies].sort((a,b)=>b.snapshot.content.revision-a.snapshot.content.revision).map(copy=><article key={copy.id}>
      <b>Revision {copy.snapshot.content.revision}</b><p>{copy.snapshot.content.artifact.sentence}</p><p>{copy.snapshot.content.request.content.reason}</p>
      <small>{copy.createdBy} · {new Date(copy.createdAt).toLocaleString('en-US')}</small><p className="configured-hash">SHA-256: {copy.snapshot.sha256}</p>
    </article>)}</div>}
  </details>;
}
