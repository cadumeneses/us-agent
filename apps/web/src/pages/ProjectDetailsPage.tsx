import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus } from 'lucide-react';
import { PageTitle } from '../components/ui';
import { ResearchProfile } from '../components/ResearchProfile';
import { StoryItemModal, type StoryEditor } from '../components/StoryItemModal';
import { api } from '../services/api';
import { useWorkspace } from '../services/workspace';
import type { StoryDetails } from '../types/models';

const emptyDetails: StoryDetails = { tasks: [], functionalRequirements: [], nonFunctionalRequirements: [] };
const statusLabels: Record<string, string> = {
  accepted_auto: 'Automatically accepted', reviewed: 'Reviewed', pending_review: 'Pending review',
  taxonomy_gap: 'Taxonomy gap', needs_rewrite: 'Needs rewriting', reclassified: 'Reclassified'
};

export function ProjectDetailsPage() {
  const { projectName = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const workspace = useWorkspace();
  const projectStories = useMemo(() => workspace.stories.filter(item => item.project === projectName), [workspace.stories, projectName]);
  const story = projectStories.find(item => item.id === params.get('story')) ?? projectStories[0];
  const [details, setDetails] = useState<StoryDetails>(emptyDetails);
  const [editor, setEditor] = useState<StoryEditor | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!story) { setDetails(emptyDetails); return; }
    let active = true;
    setDetails(emptyDetails); setError('');
    api.storyDetails(story.id).then(value => { if (active) setDetails(value); })
      .catch((reason: Error) => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, [story?.id]);

  async function saveTasks(next: StoryDetails) {
    if (!story) return;
    setSaving(true); setError('');
    try { setDetails(await api.saveStoryDetails(story.id, next)); setEditor(null); }
    catch (reason) { setError((reason as Error).message); }
    finally { setSaving(false); }
  }

  if (workspace.loading) return <section className="page"><p className="state">Loading project…</p></section>;
  if (!workspace.projects.includes(projectName)) return <section className="page"><PageTitle title="Project not found">This project does not exist.</PageTitle><Link to="/projects">Back to projects</Link></section>;

  return <section className="page project-details-page">
    <Link className="back-link" to="/projects"><ArrowLeft size={15}/> My Projects</Link>
    <PageTitle eyebrow="PROJECT DETAILS" title={projectName}>View classifications, maintain recommendation inputs, and check linked NFRs.</PageTitle>
    <div className="project-detail-toolbar"><span>{projectStories.length} classified stor{projectStories.length === 1 ? 'y' : 'ies'}</span><Link className="primary project-action" to={`/classify?project=${encodeURIComponent(projectName)}`}><Plus size={16}/> Add user story</Link></div>
    <ResearchProfile project={projectName}/>
    <div className="project-detail-grid"><div className="card project-story-panel"><h2>Project stories</h2><p>{projectStories.length ? 'Select a story to view its classification and linked NFRs.' : 'No stories yet. Use “Add user story” to create the first one.'}</p><div className="project-story-list">{projectStories.map(item => <button className={story?.id === item.id ? 'selected' : ''} key={item.id} onClick={() => setParams({ story: item.id })}><b>US-{item.id} · {item.sprint || 'Backlog'}</b><span>{item.text}</span><small>{statusLabels[item.status] ?? item.status}</small></button>)}</div></div>
      {story && <div className="project-story-details"><article className="card story-header"><div className="story-code"><span>US-{story.id}</span><span className="sprint-chip">{story.sprint || 'Backlog'}</span><span className="status-chip">{statusLabels[story.status] ?? story.status}</span></div><h1>{story.text}</h1><p>Classification: <strong>{story.labels.map(label => `${label.module} / ${label.operation}`).join(' · ')}</strong> · {Math.round(story.confidence * 100)}% confidence · taxonomy {story.taxonomyVersion || 'not specified'}</p>{story.status === 'pending_review' && <div className="project-story-actions"><Link to={`/review?classificationId=${story.id}`}>Review classification</Link></div>}</article>
        {error && <p className="inline-error" role="alert">{error}</p>}
        <div className="project-detail-sections"><DetailSection title="Tasks" description="Categories and technologies used by the recommender." onAdd={() => setEditor({ kind: 'task' })}>{details.tasks.map((item, index) => <button className="detail-row" key={item.id} onClick={() => setEditor({ kind: 'task', index })}><span>{item.title}</span><small>{item.category || 'Uncategorized'}</small></button>)}</DetailSection>
          <section className="detail-card card"><div className="detail-head"><div><h2>Linked NFRs</h2><p>NFRs accepted through the recommender for this user story.</p></div></div><div className="details-list">{details.nonFunctionalRequirements.length ? details.nonFunctionalRequirements.map(item => <div className="detail-row" key={item.id}><span>{item.description}</span><small>{item.type} · {item.metric}</small></div>) : <div className="empty">No NFRs linked yet.</div>}</div></section>
        </div></div>}
    </div>
    {editor && <StoryItemModal key={`${story?.id}-${editor.kind}-${editor.index ?? 'new'}`} editor={editor} details={details} module={story?.module ?? ''} operation={story?.operation ?? ''} saving={saving} onClose={() => setEditor(null)} onSave={next => void saveTasks(next)}/>}
  </section>;
}

function DetailSection({ title, description, onAdd, children }: { title: string; description?: string; onAdd: () => void; children: React.ReactNode }) {
  return <section className="detail-card card"><div className="detail-head"><div><h2>{title}</h2>{description && <p>{description}</p>}</div><button onClick={onAdd}><Plus size={15}/> Add</button></div><div className="details-list">{children || <div className="empty">No items registered.</div>}</div></section>;
}
