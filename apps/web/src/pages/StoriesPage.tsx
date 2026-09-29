import { useEffect, useState } from 'react';
import { StoryTable } from '../components/StoryTable';
import { PageTitle } from '../components/ui';
import { api } from '../services/api';
import type { Story } from '../types/models';

export function StoriesPage() {
  const [stories, setStories] = useState<Story[]>([]);
  useEffect(() => { api.stories().then(setStories); }, []);
  return <section className="page"><PageTitle eyebrow="HISTORY" title="Runs and results">View classifications processed by the agent.</PageTitle><div className="card"><StoryTable stories={stories}/></div></section>;
}

export function SettingsPage() {
  return <section className="page"><PageTitle title="Settings">This area will be enabled in a future integration phase.</PageTitle></section>;
}
