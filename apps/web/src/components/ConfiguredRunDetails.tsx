import { useEffect, useState } from 'react';
import { recommenderApi } from '../services/recommender-api';
import type { ContentReference, RecommendationResult, ReplayResult } from '../types/configurable-recommendations';
import { ConfiguredRunReview } from './ConfiguredRunReview';
import { displayScientificMessage } from '../services/scientific-messages';
import { isTestCaseRun, type MethodRun } from '../types/test-case-recommendations';
import { TestCaseRunDetails } from './TestCaseRunDetails';

export const configuredStatus: Record<RecommendationResult['status'], string> = {
  blocked: "Missing data", no_candidates: "No compatible candidates", no_items: "No recommended items", completed: "Suggestions found"
};
export function ReferenceDetails({ title, reference }: { title: string; reference: ContentReference }) {
  return <div className="configured-reference"><b>{title}</b><span>{reference.id} · {reference.version}</span><small>SHA-256</small><code>{reference.sha256}</code></div>;
}

function downloadRun(run: MethodRun) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(run, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `execucao-${run.id}.json`; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ConfiguredRunDetails({ id, compact = false }: { id: string; compact?: boolean }) {
  const [run, setRun] = useState<MethodRun>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [replaying, setReplaying] = useState(false);
  const [replay, setReplay] = useState<ReplayResult>();
  const [candidatePage, setCandidatePage] = useState(0);
  const [dimensionPage, setDimensionPage] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    setLoading(true); setRun(undefined); setError(''); setReplay(undefined); setCandidatePage(0); setDimensionPage(0);
    recommenderApi.publishedRun(id, controller.signal).then(value => { if (active) setRun(value); })
      .catch((reason: Error) => { if (active) setError(reason.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [id, retry]);
  async function verify() {
    setReplaying(true); setError(''); setReplay(undefined);
    try { setReplay(await recommenderApi.replay(id)); }
    catch (reason) { setError((reason as Error).message); }
    finally { setReplaying(false); }
  }
  if (loading) return <p role="status">Loading run evidence…</p>;
  if (!run) return <div role="alert"><p>{error}</p><button onClick={() => setRetry(value => value + 1)}>Retry loading run</button></div>;
  const actions = <><div className="configured-actions"><button disabled={replaying} onClick={() => void verify()}>{replaying ? 'Verifying…' : 'Verify replay'}</button><button onClick={() => downloadRun(run)}>Download JSON evidence</button></div>
    {error && <p className="inline-error" role="alert">{error}</p>}
    {replay && <div role={replay.verified ? 'status' : 'alert'}><p>{replay.verified ? 'Replay verified: result, explanation, and projection match the preserved run.' : 'Replay differs: the original evidence was preserved.'}</p><p>Result: {replay.resultMatches ? 'matches' : 'differs'} · Explanation: {replay.explanationMatches ? 'matches' : 'differs'} · Projection: {replay.projectionMatches ? 'matches' : 'differs'}</p></div>}</>;
  if (isTestCaseRun(run)) return <article className="configured-result" aria-label="Run result"><TestCaseRunDetails key={run.id} run={run} compact={compact}/>{compact ? <details><summary>Export and replay this run</summary>{actions}</details> : actions}</article>;
  const { content } = run.snapshot;
  const request = content.request.content, result = content.result.content, dataset = content.dataset.content;
  const candidates = content.explanation.content.candidates;
  return <article className="configured-result" aria-label="Run result">
    <h3>{configuredStatus[result.status]}</h3><p>Input <b>{request.input.id}</b> · {new Date(run.createdAt).toLocaleString('en-US')}</p>
    <div className="configured-references"><ReferenceDetails title="Definition used" reference={request.definition}/><ReferenceDetails title="Dataset used" reference={request.dataset}/></div>
    <p>Input source: {request.input.provenance.source}. Dataset: {dataset.source.description}.</p>
    <p>Dataset use declaration: {dataset.source.authorization.basis} · {dataset.source.authorization.reference}</p>
    <p>{result.eligibleCount} compatible candidates · {result.excludedCount} excluded · {result.items.length} NFR(s).</p>
    {result.label && <p>Pair used: {result.label.module} / {result.label.operation}</p>}
    {result.messages.map((message, index) => <p role="status" key={index}>{displayScientificMessage(message)}</p>)}
    <details><summary>Preserved input</summary><div className="table-wrap"><table><thead><tr><th>Attribute</th><th>Value entered</th></tr></thead><tbody>
      {content.definition.content.definition.attributes.filter(attribute => Object.hasOwn(request.input.values, attribute.id)).map(attribute => <tr key={attribute.id}><td>{attribute.name}</td><td><pre className="configured-value">{JSON.stringify(request.input.values[attribute.id], null, 2)}</pre></td></tr>)}
    </tbody></table></div></details>
    {result.neighbor && <div className="configured-neighbor"><h4>Selected neighbor</h4><p>{result.neighbor.project} · {result.neighbor.text}</p>
      <p>Source record: story {result.neighbor.storyId}, classification {result.neighbor.classificationId}.</p>
      <p>Similarity: {(result.neighbor.similarity * 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}%.</p>
      <p>Similarity measures matching characteristics; it is not a probability of correctness.</p>
      <details><summary>Compared features ({result.dimensions.length})</summary><div className="table-wrap"><table><thead><tr><th>Target dimension</th><th>Present in neighbor</th></tr></thead><tbody>
        {result.dimensions.slice(dimensionPage * 100, (dimensionPage + 1) * 100).map((dimension, index) => <tr key={dimension}><td>{dimension}</td><td>{result.neighbor!.vector[dimensionPage * 100 + index] ? "Yes" : "No"}</td></tr>)}
      </tbody></table></div><div className="configured-actions"><button disabled={dimensionPage === 0} onClick={() => setDimensionPage(value => value - 1)}>Previous dimensions</button><span>Page {dimensionPage + 1}</span><button disabled={(dimensionPage + 1) * 100 >= result.dimensions.length} onClick={() => setDimensionPage(value => value + 1)}>Next dimensions</button></div></details>
    </div>}
    {result.items.length > 0 && <ConfiguredRunReview key={run.id} run={run}/>}
    <details><summary>Candidates and exclusion reasons ({candidates.length})</summary><div className="table-wrap"><table><thead><tr><th>Dataset record</th><th>Rank</th><th>Distance</th><th>Similarity</th><th>Exclusion reason</th></tr></thead><tbody>
      {candidates.slice(candidatePage * 50, (candidatePage + 1) * 50).map(candidate => <tr key={candidate.datasetRecordId}>
        <td>{candidate.datasetRecordId}</td><td>{candidate.rank ?? "Excluded"}</td><td>{candidate.distance ?? '—'}</td><td>{candidate.similarity === null ? '—' : candidate.similarity.toLocaleString('en-US', { maximumFractionDigits: 4 })}</td><td>{candidate.issues.map(issue => issue.message).join(' ') || "Eligible"}</td>
      </tr>)}
    </tbody></table></div>{!candidates.length && <p>No candidates were evaluated in this run.</p>}<div className="configured-actions"><button disabled={candidatePage === 0} onClick={() => setCandidatePage(value => value - 1)}>Previous candidates</button><span>Page {candidatePage + 1}</span><button disabled={(candidatePage + 1) * 50 >= candidates.length} onClick={() => setCandidatePage(value => value + 1)}>Next candidates</button></div></details>
    <details><summary>Versions, source, and integrity</summary><dl className="configured-provenance"><dt>Run</dt><dd>{run.id}</dd><dt>Technical actor</dt><dd>{run.createdBy}</dd><dt>Service duration</dt><dd>{run.durationMs.toLocaleString('en-US', { maximumFractionDigits: 2 })} ms (loading and calculation; excludes final persistence and network)</dd><dt>Method</dt><dd>{result.method} · k={result.k}</dd><dt>Adapter</dt><dd>{content.software.adapterVersion}</dd><dt>Published adapter</dt><dd>{content.software.definitionAdapterVersion}</dd><dt>Policy / kernel</dt><dd>{content.software.policyVersion} / {content.software.kernelVersion}</dd><dt>Recorded runtime</dt><dd>{content.software.runtime.node} · ICU {content.software.runtime.icu} · {content.software.runtime.locale}</dd><dt>Package SHA-256</dt><dd>{run.snapshot.sha256}</dd><dt>Source file SHA-256</dt><dd>{dataset.import.fileSha256}</dd></dl>
      {content.definition.content.taxonomies.map(dependency => <ReferenceDetails key={`${dependency.snapshot.content.id}@${dependency.snapshot.content.version}`} title="Preserved taxonomy" reference={{ id: dependency.snapshot.content.id, version: dependency.snapshot.content.version, format: dependency.snapshot.format, sha256: dependency.snapshot.sha256 }}/>)}</details>
    {actions}
  </article>;
}
