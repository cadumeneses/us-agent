import type { Story } from '../types/models';

const pendingStatuses = new Set(['pending_review', 'taxonomy_gap', 'needs_rewrite']);

function Status({ value }: { value: string }) {
  const pending = pendingStatuses.has(value);
  return <span className={`badge ${pending ? 'warning' : 'success'}`}>{pending ? 'Review' : 'Completed'}</span>;
}

export function StoryTable({ stories }: { stories: Story[] }) {
  return <div className="table-wrap"><table><thead><tr><th>Story</th><th>Classification</th><th>Confidence</th><th>Status</th></tr></thead><tbody>{stories.map(story => <tr key={story.id}><td><b>{story.text}</b><small>{story.project}</small></td><td><span className="tag">{story.module}</span><small>{story.operation}</small></td><td><b>{Math.round(story.confidence * 100)}%</b></td><td><Status value={story.status}/></td></tr>)}</tbody></table>{!stories.length && <div className="empty">No stories found.</div>}</div>;
}
