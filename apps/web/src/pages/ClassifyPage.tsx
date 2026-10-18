import { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import { BrainCircuit, FileUp, Sparkles } from 'lucide-react';
import { CardHead, PageTitle } from '../components/ui';
import { api } from '../services/api';
import { useWorkspace } from '../services/workspace';
import type { ApplicationContext, Classification, Taxonomy } from '../types/models';

export function ClassifyPage() {
  const context = useOutletContext<ApplicationContext>();
  const workspace = useWorkspace();
  const [params] = useSearchParams();
  const [text, setText] = useState('');
  const [project, setProject] = useState(params.get('project') ?? '');
  const [sprint, setSprint] = useState('Backlog');
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Classification[]>([]);
  const [resultProject, setResultProject] = useState('');
  const [error, setError] = useState('');
  const [mode, setMode] = useState(context.defaultExecutionMode);
  const [taxonomyVersion, setTaxonomyVersion] = useState('');
  const [taxonomies, setTaxonomies] = useState<Taxonomy['taxonomies']>([]);
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const stories = useMemo(() => text.split(/\n|;/).map(value => value.trim()).filter(Boolean), [text]);
  const registeredStories = workspace.stories.filter(story => story.project === project && story.sprint === sprint);

  useEffect(() => {
    api.taxonomy().then(catalog => setTaxonomies(catalog.taxonomies.filter(item => item.active && item.operations > 0)))
      .catch((reason: Error) => setError(reason.message));
  }, []);
  useEffect(() => {
    let active = true;
    const fallback = taxonomies.length === 1 ? taxonomies[0].version : '';
    if (!workspace.projects.includes(project.trim())) { setTaxonomyVersion(fallback); return; }
    api.projectResearchProfile(project.trim()).then(profile => {
      if (active) setTaxonomyVersion(taxonomies.some(item => item.version === profile.taxonomyVersion) ? profile.taxonomyVersion : fallback);
    }).catch((reason: Error) => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, [project, taxonomies, workspace.projects]);

  async function classify() {
    setError('');
    setRunning(true);
    if (!project.trim() || !sprint.trim() || !taxonomyVersion) {
      setError('Enter the project, sprint, and taxonomy to use.');
      setRunning(false);
      return;
    }
    try {
      setResults((await api.classify(stories, project.trim(), sprint.trim(), mode, taxonomyVersion)).results);
      setResultProject(project.trim());
      await workspace.refreshStories();
      setText('');
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setRunning(false);
    }
  }

  async function importFile(file?: File) {
    if (!file) return;
    try { setText((await api.importFile(file)).stories.join('\n')); }
    catch (reason) { setError((reason as Error).message); }
  }

  const projectSprints = [...new Set(workspace.stories.filter(story => story.project === project).map(story => story.sprint))];

  return <section className="page">
    <PageTitle eyebrow="CLASSIFICATION" title="Classify Stories">Add stories to a project and classify them by module and operation.</PageTitle>
    <div className="classify-grid">
      <div className="card editor-card">
        <div className="form-row">
          <label>Project<div className="project-input"><input value={project} onChange={event => setProject(event.target.value)} placeholder="Project name"/><button type="button" onClick={() => setProjectPickerOpen(open => !open)}>Select project</button>{projectPickerOpen && <div className="project-picker">{workspace.projects.map(name => <button type="button" key={name} onClick={() => { const nextSprint = workspace.stories.find(story => story.project === name)?.sprint ?? 'Backlog'; setProject(name); setSprint(nextSprint); setProjectPickerOpen(false); }}>{name}</button>)}{!workspace.projects.length && <span>No projects registered.</span>}</div>}</div></label>
          <label>Sprint<input list="project-sprints" value={sprint} onChange={event => setSprint(event.target.value)} placeholder="Example: Sprint 14"/><datalist id="project-sprints">{projectSprints.map(name => <option key={name} value={name}/>)}</datalist></label>
          <label className="file-button"><FileUp size={16}/> Import TXT/CSV<input type="file" accept=".txt,.csv" onChange={event => importFile(event.target.files?.[0])}/></label>
        </div>
        <label>User stories<textarea value={text} onChange={event => setText(event.target.value)} placeholder={'One story per line. Example:\nAs a user, I want to sign in with my Google account for quick access.'}/></label>
        {registeredStories.length > 0 && <p className="project-stories-note">{registeredStories.length} user stor{registeredStories.length === 1 ? 'y is' : 'ies are'} already registered in this sprint.</p>}
        <div className="editor-foot"><span>{stories.length} stor{stories.length === 1 ? 'y' : 'ies'} · {sprint || 'no sprint'}</span><button className="primary" disabled={!stories.length || !taxonomyVersion || running} onClick={classify}><Sparkles size={17}/>{running ? 'Classifying…' : 'Start classification'}</button></div>
        {error && <p className="inline-error">{error}</p>}
      </div>
      <div className="card config"><CardHead title="Run configuration"/><label>Taxonomy<select value={taxonomyVersion} onChange={event => setTaxonomyVersion(event.target.value)}><option value="">Select a version</option>{taxonomies.map(item => <option key={item.version} value={item.version}>{item.version} · {item.modules} modules · {item.operations} operations</option>)}</select></label><p className="classify-taxonomy-note">The taxonomy version and content used for classification are preserved with the run.</p>{!taxonomies.length && <Link to="/taxonomy">Configure a taxonomy with operations</Link>}<label>Mode<select value={mode} onChange={event => setMode(event.target.value)}>{context.executionModes.map(executionMode => <option key={executionMode.key} value={executionMode.key}>{executionMode.name}</option>)}</select></label><div className="model active"><BrainCircuit size={18}/><div><b>{mode === 'committee' ? 'Model committee' : 'Local rules'}</b><small>{mode === 'committee' ? 'Multiple labels and review policy' : 'Pre-classification without model calls'}</small></div><span>Active</span></div><div className="hint">The classification is saved in the project. You can recommend NFRs for every classified story.</div></div>
    </div>
    {results.length > 0 && <div className="card results"><CardHead title="Classification saved"/><p>The stories are now available in the project.</p><Link className="primary project-action" to={`/projects/${encodeURIComponent(resultProject)}`}>View project details</Link><div className="result-grid">{results.map(result => <article key={result.id}><p>{result.text}</p>{result.labels.map(label => <div key={JSON.stringify(label)}><span className="tag">{label.module}</span><b>{label.operation}</b></div>)}<footer><span>{Math.round(result.confidence * 100)}% confidence</span>{result.needsReview && <span className="badge warning">Review</span>}</footer></article>)}</div></div>}
  </section>;
}
