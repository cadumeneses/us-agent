import type { ProjectRecommendationRun } from '../types/project-recommendations';
export function ProjectRecommendationDetails({ run }: { run: ProjectRecommendationRun }) {
  const { content } = run.snapshot, result = content.result.content;
  const names = new Map(content.definition.content.definition.attributes.map(attribute => [attribute.id, attribute.name]));
  return <div><h3>{result.status === 'completed' ? 'Recommendations' : result.status === 'no_candidates' ? 'No reference projects available' : 'The selected neighbors have no associated items'}</h3>
    <p>{result.items.length} items from {result.neighbors.length} neighbors. Suggestions require your review.</p>
    {content.dataset.content.source.authorization.basis === 'synthetic' && <p role="status">Demonstration dataset: these associations are synthetic and have not been empirically validated.</p>}
    {result.items.map(item => <article className="configured-subeditor" key={item.key}><h4>{item.text}</h4><p>{names.get(item.attributeId)} · Found in {item.support} of {result.neighbors.length} neighbors.</p><details><summary>Source projects</summary><p>{item.recordIds.join(', ')}</p></details></article>)}
    <p>Similarity describes matching profile characteristics. It does not measure the likelihood or effectiveness of a recommended item.</p>
    <details><summary>Compared projects and feature contributions</summary>{result.neighbors.map(neighbor => <section className="configured-subeditor" key={neighbor.recordId}><h4>{neighbor.recordId}</h4><p>Similarity: {(neighbor.similarity * 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}% · Distance: {neighbor.distance}</p><div className="table-wrap"><table><thead><tr><th>Attribute</th><th>Weight</th><th>Distance contribution</th></tr></thead><tbody>{neighbor.contributions.map(item => <tr key={item.attributeId}><td>{names.get(item.attributeId)}</td><td>{item.weight}</td><td>{item.distance}</td></tr>)}</tbody></table></div></section>)}</details>
    <details><summary>Recorded profile, configuration, and calculation</summary><p>Configuration: {content.definition.content.definition.name} · {content.request.content.definition.version}. Dataset: {content.request.content.dataset.id} · {content.request.content.dataset.version}.</p><p>{content.dataset.content.source.description}</p><pre className="configured-value">{JSON.stringify({ input: content.request.content.input, method: content.definition.content.definition.method, representation: content.projection.content, policy: content.explanation.content.policy }, null, 2)}</pre></details>
  </div>;
}
