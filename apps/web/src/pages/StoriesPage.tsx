import { useEffect, useState } from 'react';
import { StoryTable } from '../components/StoryTable';
import { LoadState, PageTitle } from '../components/ui';
import { api } from '../services/api';
import type { Story } from '../types/models';

export function StoriesPage() {
  const [stories, setStories] = useState<Story[]>([]);
  const [search, setSearch] = useState(''), [loading, setLoading] = useState(true), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  useEffect(() => { let active = true; setLoading(true); setError(''); api.stories().then(rows => { if (active) setStories(rows); }).catch((reason: Error) => { if (active) setError(reason.message); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [retry]);
  const matches = stories.filter(story => `${story.text} ${story.project} ${story.labels.map(label => `${label.module} ${label.operation}`).join(' ')}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  return <section className="page"><PageTitle eyebrow="HISTORY" title="Classification history">Find processed stories by project, text or classification.</PageTitle><label className="catalog-search">Search classifications<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Project, story, module or operation"/></label><LoadState loading={loading} error={error}/>{error && <button onClick={() => setRetry(value => value + 1)}>Retry loading classifications</button>}{!loading && !error && <><p role="status">{matches.length} of {stories.length} classifications</p><div className="card"><StoryTable stories={matches}/></div></>}</section>;
}

export function SettingsPage() {
  return <section className="page"><PageTitle title="Settings">This area will be enabled in a future integration phase.</PageTitle></section>;
}
