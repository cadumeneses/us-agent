import { useState } from 'react';
import type { TestCaseRun } from '../types/test-case-recommendations';
import { ReferenceDetails } from './ConfiguredRunDetails';
import { TestCaseAssessment } from './TestCaseAssessment';

const statusText = { completed: 'Test suggestions found', blocked: 'Test demonstration blocked', no_items: 'Selected neighbors have no associated tests' };
const issueText: Record<string, string> = { fewer_than_three_candidates: 'At least three eligible candidates are required.',
  unknown_test_associations: 'Eligible candidates have unknown test associations.', target_output_must_be_withheld: 'Target test answers must be withheld.' };
export function TestCaseRunDetails({ run, compact = false }: { run: TestCaseRun; compact?: boolean }) {
  const content = run.snapshot.content, request = content.request.content, result = content.result.content;
  const explanation = content.explanation.content, representation = content.projection.content.representation;
  const [itemPage, setItemPage] = useState(0), [candidatePage, setCandidatePage] = useState(0), [dimensionPage, setDimensionPage] = useState(0);
  if (compact) return <>
    <h3>{result.status === 'completed' ? `${result.items.length} test case(s) found` : result.status === 'blocked' ? 'Complete the dataset to run recommendations' : 'No test cases found in the selected neighbors'}</h3>
    <p>{request.input.provenance.source} · {new Date(run.createdAt).toLocaleString('en-US')}</p>
    {explanation.issues.map((issue, index) => <p role="status" key={index}>{issue.code === 'fewer_than_three_candidates' ? 'The dataset needs at least three eligible candidates.' : issue.code === 'unknown_test_associations' ? 'Some candidates have unknown test associations in the dataset.' : issueText[issue.code] ?? issue.code}</p>)}
    {result.items.slice(itemPage * 20, (itemPage + 1) * 20).map(item => <section className="test-case-item configured-attribute" key={item.key} aria-label={`Test ${item.testCaseId}`}>
      <h4>{item.artifact.title}</h4>{item.artifact.purpose && <p>{item.artifact.purpose}</p>}<pre className="configured-value">{item.artifact.gherkin}</pre>
      <details><summary>Source and contribution of this test case</summary><p>Test {item.testCaseId} · {item.support} of {result.k} selected neighbors · score {item.score.toLocaleString('en-US', { maximumFractionDigits: 4 })}. The score is not a probability of correctness.</p><ul>{item.contributions.map(row => <li key={row.recordId}>{row.recordId}: similarity {row.similarity.toLocaleString('en-US', { maximumFractionDigits: 4 })}</li>)}</ul></details>
    </section>)}
    {result.items.length > 20 && <PageControls page={itemPage} setPage={setItemPage} count={result.items.length} size={20} name="tests"/>}
    <details><summary>Dataset and recommendation criteria</summary><p>Recommender: {content.definition.content.definition.name} · {request.definition.version}. Dataset: {request.dataset.id} · {request.dataset.version}. Catalog: {request.catalog.id} · {request.catalog.version}.</p><p>The input features are compared with the selected dataset. Test cases are retrieved from the three selected neighbors.</p><ul>{result.neighbors.map(row => <li key={row.recordId}>{row.recordId}: similarity {row.similarity.toLocaleString('en-US', { maximumFractionDigits: 4 })}</li>)}</ul><p>Synthetic dataset demonstration; this is not an empirical reproduction of the paper.</p><details><summary>Preserved input</summary><pre className="configured-value">{JSON.stringify(request.input, null, 2)}</pre></details></details>
    {result.status === 'completed' && <details><summary>Assess and adapt test cases</summary><TestCaseAssessment run={run} items={result.items.slice(itemPage * 20, (itemPage + 1) * 20)}/></details>}
  </>;
  return <>
    <h3>{statusText[result.status]}</h3>
    <p className="configured-demo-notice">Synthetic E21 equation demonstration · Manhattan similarity · k=3. This is not a reproduction of the original selected Euclidean configuration or evidence of empirical accuracy. Q01/Q02 remain open.</p>
    <p>Input <b>{request.input.id}</b> · {new Date(run.createdAt).toLocaleString('en-US')}</p>
    <div className="configured-references"><ReferenceDetails title="Definition used" reference={request.definition}/><ReferenceDetails title="Dataset used" reference={request.dataset}/><ReferenceDetails title="Test catalog used" reference={request.catalog}/></div>
    <p>Input source: {request.input.provenance.source}. Dataset: {content.dataset.content.source.description}.</p>
    <p>Dataset use declaration: {content.dataset.content.source.authorization.basis} · {content.dataset.content.source.authorization.reference}</p>
    <p>Catalog source: {content.catalog.content.catalog.content.source.reference}. Use declaration: {content.catalog.content.authorization.basis} · {content.catalog.content.authorization.reference}</p>
    <p>{result.neighbors.length} selected neighbors · {explanation.ranked.length} ranked candidates · {explanation.excluded.length} excluded · {result.items.length} test(s).</p>
    {explanation.issues.map((issue, index) => <p role="status" key={index}>{issueText[issue.code] ?? issue.code} {issue.recordIds.join(', ')}</p>)}
    <details><summary>Preserved input</summary><pre className="configured-value">{JSON.stringify(request.input, null, 2)}</pre></details>
    {result.neighbors.length > 0 && <><h4>Selected neighbors</h4><p>Similarity measures matching characteristics; it is not a probability of correctness. Module and operation are features, not eligibility filters.</p>
      <div className="table-wrap"><table><thead><tr><th>Record</th><th>Manhattan distance</th><th>Similarity</th><th>Associated test IDs</th></tr></thead><tbody>{result.neighbors.map(row => <tr key={row.recordId}><td>{row.recordId}</td><td>{row.distance}</td><td>{row.similarity}</td><td>{row.testCaseIds.join(', ') || 'Known empty'}</td></tr>)}</tbody></table></div>
      <details><summary>Compared features ({representation.dimensions.length})</summary><div className="table-wrap"><table><thead><tr><th>Target dimension</th>{result.neighbors.map(row => <th key={row.recordId}>{row.recordId}</th>)}</tr></thead><tbody>{representation.dimensions.slice(dimensionPage * 100, (dimensionPage + 1) * 100).map((row, index) => <tr key={dimensionPage * 100 + index}><td>{row.label}: {row.value}</td>{result.neighbors.map(neighbor => <td key={neighbor.recordId}>{neighbor.vector[dimensionPage * 100 + index] ? 'Present' : 'Absent'}</td>)}</tr>)}</tbody></table></div><PageControls page={dimensionPage} setPage={setDimensionPage} count={representation.dimensions.length} size={100} name="dimensions"/></details>
    </>}
    {result.items.slice(itemPage * 20, (itemPage + 1) * 20).map(item => <section className="test-case-item configured-attribute" key={item.key} aria-label={`Test ${item.testCaseId}`}>
      <h4>{item.artifact.title}</h4><p>Test ID: <code>{item.testCaseId}</code> · Score: {item.score.toLocaleString('en-US', { maximumFractionDigits: 6 })} · Support: {item.support}/{result.k}</p>
      <p>Equation 4.3: {item.numerator} / {item.denominator} = {item.score}. This score is not a success probability.</p>
      <pre className="configured-value">{item.artifact.gherkin}</pre>
      {item.artifact.purpose && <p>Purpose: {item.artifact.purpose}</p>}<p>Execution mode: {item.artifact.executionMode ?? 'Unspecified'}</p>
      <details><summary>Contributions and original metadata</summary><div className="table-wrap"><table><thead><tr><th>Source record</th><th>Similarity contribution</th></tr></thead><tbody>{item.contributions.map(row => <tr key={row.recordId}><td>{row.recordId}</td><td>{row.similarity}</td></tr>)}</tbody></table></div><pre className="configured-value">{JSON.stringify(item.artifact.metadata ?? {}, null, 2)}</pre><p className="configured-hash">Item key: {item.key}</p></details>
    </section>)}
    {result.items.length > 20 && <PageControls page={itemPage} setPage={setItemPage} count={result.items.length} size={20} name="tests"/>}
    {result.status === 'completed' && <TestCaseAssessment run={run} items={result.items.slice(itemPage * 20, (itemPage + 1) * 20)}/>}
    <details><summary>Candidates and exclusion reasons</summary><div className="table-wrap"><table><thead><tr><th>Rank</th><th>Record</th><th>Distance</th><th>Similarity</th></tr></thead><tbody>{explanation.ranked.slice(candidatePage * 50, (candidatePage + 1) * 50).map((row, index) => <tr key={row.recordId}><td>{candidatePage * 50 + index + 1}</td><td>{row.recordId}</td><td>{row.distance}</td><td>{row.similarity}</td></tr>)}</tbody></table></div><PageControls page={candidatePage} setPage={setCandidatePage} count={explanation.ranked.length} size={50} name="candidates"/>
      {explanation.excluded.map(row => <p key={row.recordId}>Excluded {row.recordId}: target record or same story.</p>)}
    </details>
    <details><summary>Versions, source, and integrity</summary><dl className="configured-provenance"><dt>Run</dt><dd>{run.id}</dd><dt>Technical actor</dt><dd>{run.createdBy}</dd><dt>Package SHA-256</dt><dd>{run.snapshot.sha256}</dd><dt>Dataset file SHA-256</dt><dd>{content.dataset.content.import.fileSha256}</dd><dt>Catalog file SHA-256</dt><dd>{content.catalog.content.file.sha256}</dd><dt>Method</dt><dd>{result.method} · k={result.k}</dd><dt>Adapter / policy / kernel</dt><dd>{content.software.adapterVersion} / {content.software.policyVersion} / {content.software.kernelVersion}</dd><dt>Runtime</dt><dd>{content.software.runtime.node} · ICU {content.software.runtime.icu} · {content.software.runtime.locale}</dd></dl>
      <pre className="configured-value">{JSON.stringify(explanation.rules, null, 2)}</pre>
      {content.definition.content.taxonomies.map(row => <ReferenceDetails key={`${row.snapshot.content.id}@${row.snapshot.content.version}`} title="Preserved taxonomy" reference={{ id: row.snapshot.content.id, version: row.snapshot.content.version, format: row.snapshot.format, sha256: row.snapshot.sha256 }}/>)}</details>
  </>;
}
function PageControls({ page, setPage, count, size, name }: { page: number; setPage: (value: number) => void; count: number; size: number; name: string }) {
  return <div className="configured-actions"><button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous {name}</button><span>Page {page + 1}</span><button type="button" disabled={(page + 1) * size >= count} onClick={() => setPage(page + 1)}>Next {name}</button></div>;
}
