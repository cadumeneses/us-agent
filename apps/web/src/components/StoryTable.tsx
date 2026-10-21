import type { Story } from '../types/models';
import { Link } from 'react-router-dom';

const pendingStatuses = new Set(['pending_review', 'taxonomy_gap', 'needs_rewrite']);

function Status({ value }: { value: string }) {
  const pending = pendingStatuses.has(value);
  return <span className={`badge ${pending ? 'warning' : 'success'}`}>{pending ? 'Review' : 'Completed'}</span>;
}

export function StoryTable({ stories }: { stories: Story[] }) {
  return <div className="table-wrap"><table><caption className="sr-only">Story classifications</caption><thead><tr><th scope="col">Story</th><th scope="col">Classification</th><th scope="col">Confidence</th><th scope="col">Status</th></tr></thead><tbody>{stories.map(story => <tr key={story.id}><td><Link to={pendingStatuses.has(story.status) ? `/review?classificationId=${encodeURIComponent(story.id)}` : `/projects/${encodeURIComponent(story.project)}?story=${encodeURIComponent(story.id)}`}>{story.text}</Link><small>{story.project}</small></td><td>{story.labels.map(label => <div key={JSON.stringify(label)}><span className="tag">{label.module}</span><small>{label.operation}</small></div>)}</td><td><b>{Math.round(story.confidence * 100)}%</b></td><td><Status value={story.status}/></td></tr>)}</tbody></table>{!stories.length && <div className="empty">No stories found.</div>}</div>;
}
