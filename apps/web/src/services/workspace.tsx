/*  */import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from './api';
import type { Story } from '../types/models';

type Workspace = { stories: Story[]; projects: string[]; selectedProject: string; selectedStoryId: string; loading: boolean; selectProject: (project: string) => void; selectStory: (storyId: string) => void; refreshStories: () => Promise<void> };
const WorkspaceContext = createContext<Workspace | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [stories, setStories] = useState<Story[]>([]);
  const [projects, setProjects] = useState<string[]>([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedStoryId, setSelectedStoryId] = useState('');
  const [loading, setLoading] = useState(true);
  async function refreshStories() {
    setLoading(true);
    try { const [nextStories, nextProjects] = await Promise.all([api.stories(), api.projects()]); setStories(nextStories); setProjects(nextProjects); setSelectedProject(current => current && nextProjects.includes(current) ? current : nextProjects[0] ?? ''); setSelectedStoryId(current => current && nextStories.some(story => story.id === current) ? current : nextStories[0]?.id ?? ''); }
    finally { setLoading(false); }
  }
  useEffect(() => { void refreshStories(); }, []);
  const value = useMemo(() => ({ stories, projects, selectedProject, selectedStoryId, loading, refreshStories,
    selectProject: (project: string) => { setSelectedProject(project); setSelectedStoryId(stories.find(story => story.project === project)?.id ?? ''); },
    selectStory: (storyId: string) => { const story = stories.find(item => item.id === storyId); if (story) { setSelectedStoryId(storyId); setSelectedProject(story.project); } }
  }), [stories, projects, selectedProject, selectedStoryId, loading]);
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() { const workspace = useContext(WorkspaceContext); if (!workspace) throw new Error('WorkspaceProvider is missing.'); return workspace; }
