import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, ClipboardCheck, FileCheck2, ShieldAlert } from 'lucide-react';
import { PageTitle } from '../components/ui';
import { useWorkspace } from '../services/workspace';
import { NfrStory } from './NfrRecommendationsPage';
import { ProjectRiskRecommendations } from '../components/ProjectRiskRecommendations';
import { ProjectTestRecommendations } from '../components/ProjectTestRecommendations';

const recommenders = [
  { id: 'nfr', title: 'Non-functional requirements', description: 'Find NFRs from similar stories and choose which ones fit your story.', icon: ClipboardCheck },
  { id: 'tests', title: 'Test cases', description: 'Find test cases using the classification, project profile, and acceptance criteria.', icon: FileCheck2 },
  { id: 'risks', title: 'Project risks', description: 'Find risks from similar project profiles.', icon: ShieldAlert }
] as const;
const readyStatuses = new Set(['accepted_auto', 'reviewed', 'reclassified']);

export function RecommendersPage() {
  const workspace = useWorkspace();
  const [params, setParams] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const requestedStory = workspace.stories.find(story => story.id === params.get('classificationId'));
  const requestedProject = params.get('project');
  const project = requestedProject ?? requestedStory?.project ?? workspace.selectedProject;
  const stories = workspace.stories.filter(story => story.project === project);
  const storyId = params.has('classificationId') ? params.get('classificationId') : workspace.selectedStoryId;
  const story = stories.find(row => row.id === storyId);
  // Existing links to a classified story continue to open its NFR recommender.
  const method = params.get('recommender') ?? (params.has('classificationId') ? 'nfr' : '');
  const selected = recommenders.find(row => row.id === method);
  const source=params.get('source')??(params.has('classificationId')&&!params.has('recommender')?'history':'published');
  const ready = story && readyStatuses.has(story.status) && story.labels.length > 0;
  function change(values: Record<string, string | null>) {
    setParams(current => {
      const next = new URLSearchParams(current);
      for (const [key, value] of Object.entries(values)) {
        if (value === null) next.delete(key); else next.set(key, value);
      }
      return next;
    });
  }
  return <section className="page configured-page recommenders-page">
    <PageTitle eyebrow="PROJECT RECOMMENDATIONS" title="Recommenders">Choose a recommender, then complete the project context it needs.</PageTitle>
    <div className="recommender-choices" role="group" aria-label="Choose a recommender">
      {recommenders.map(({ id, title, description, icon: Icon }) => <button type="button" key={id} className="card recommender-choice" aria-pressed={method === id} disabled={busy} onClick={() => change({ recommender: id })}>
        <span className="recommender-choice-icon"><Icon size={22}/>{method === id && <Check size={18} aria-label="Selected"/>}</span><strong>{title}</strong><span>{description}</span>
      </button>)}
    </div>
    {!selected && <p className="recommender-guidance">Select a recommender above to get started.</p>}
    {selected && <>
      <section className="card configured-panel recommender-context"><h2>{method === 'risks' ? 'Project' : 'Project and story'}</h2>
        <div className="configured-input-meta"><label>Project<select value={project} disabled={busy || workspace.loading} onChange={event => {
          workspace.selectProject(event.target.value); change({ project: event.target.value, classificationId: '' });
        }}><option value="">Select a project</option>{workspace.projects.map(name => <option key={name} value={name}>{name}</option>)}</select></label>
          {method !== 'risks' && <label>Classified story<select value={story?.id ?? ''} disabled={busy || workspace.loading || !project} onChange={event => {
            workspace.selectStory(event.target.value); change({ project, classificationId: event.target.value });
          }}><option value="">Select a story</option>{stories.map(row => <option key={row.id} value={row.id}>{row.text}{!readyStatuses.has(row.status) ? ' · Review required' : ''}</option>)}</select></label>}</div>
        {workspace.loading ? <p role="status">Loading projects and stories…</p> : !workspace.projects.length ? <p>Create your project and complete its profile to get started. <Link to="/projects">Create project</Link></p> : project && <div className="configured-actions">
          <Link to={`/projects/${encodeURIComponent(project)}${story ? `?story=${encodeURIComponent(story.id)}` : ''}`}>{method === 'risks' ? 'View project profile' : 'View profile and tasks'}</Link>
          {method !== 'risks' && <Link to={`/projects/${encodeURIComponent(project)}`}>Prepare and classify stories</Link>}
        </div>}
        {method !== 'risks' && !workspace.loading && project && !stories.length && <p>This project has no classified stories yet. Classify a story to use this recommender.</p>}
        {method !== 'risks' && story && <div className="recommender-story"><strong>{story.text}</strong><p>{story.labels.map(label => `${label.module} / ${label.operation}`).join(' · ') || 'Incomplete classification'}</p>
          {!ready && <p role="status">Complete the classification review before running a recommendation. <Link to={`/review?classificationId=${encodeURIComponent(story.id)}`}>Review classification</Link></p>}
        </div>}
      </section>
      {ready&&method==='nfr'&&<section className="card configured-panel"><label>Reference source<select disabled={busy} value={source} onChange={event=>change({source:event.target.value})}><option value="published">Published dataset</option><option value="history">Operational project history</option></select></label><p>{source==='history'?'Compare with the operational history using the existing NFR policy.':'Choose a versioned reference dataset for this run.'}</p></section>}
      {method !== 'risks' && ready && (method === 'nfr'&&source==='history' ? <NfrStory key={story.id} id={story.id} onBusy={setBusy}/> : <ProjectTestRecommendations key={`${method}:${story.id}`} kind={method==='nfr'?'nfr':'tests'} story={story} busy={busy} onBusy={setBusy}/>)}
      {method === 'risks' && project && !workspace.loading && <ProjectRiskRecommendations key={project} project={project} busy={busy} onBusy={setBusy}/>}
    </>}
    <details className="recommender-management"><summary>Configuration, datasets, and history</summary><div className="configured-actions"><Link to="/recommender-setup">Configure recommenders and datasets</Link><Link to="/configured-recommendations">View published dataset runs</Link></div></details>
  </section>;
}
