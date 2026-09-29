import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, FolderKanban, Plus, X } from 'lucide-react';
import { PageTitle } from '../components/ui';
import { api } from '../services/api';
import { useWorkspace } from '../services/workspace';

export function ProjectsPage() {
  const workspace = useWorkspace();
  const { projects, stories, loading } = workspace;
  const navigate = useNavigate();
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function createProject(event: React.FormEvent) {
    event.preventDefault();
    if (name.trim().length < 2 || saving) return;
    setSaving(true); setError('');
    try {
      const project = await api.createProject(name.trim());
      await workspace.refreshStories();
      setFormOpen(false); setName('');
      navigate(`/projects/${encodeURIComponent(project.name)}`);
    } catch (reason) { setError((reason as Error).message); }
    finally { setSaving(false); }
  }

  return <section className="page projects-page">
    <PageTitle eyebrow="PROJECTS" title="My Projects">Access classified user stories and the NFRs linked to each project.</PageTitle>
    <div className="projects-list-head"><p>{projects.length} project{projects.length === 1 ? '' : 's'}</p><button className="primary project-action" type="button" onClick={() => { setError(''); setFormOpen(true); }}><Plus size={16}/> Add project</button></div>
    {loading ? <p className="state">Loading projects…</p> : projects.length ? <div className="projects-grid">
      {projects.map((project, index) => {
        const projectStories = stories.filter(story => story.project === project);
        const cycles = new Set(projectStories.map(story => story.sprint || 'Backlog'));
        return <Link className="card project-overview" key={project} to={`/projects/${encodeURIComponent(project)}`}>
          <i className={`project-mark ${['blue', 'violet', 'orange'][index % 3]}`}><FolderKanban size={19}/></i>
          <div><h2>{project}</h2><p>{projectStories.length} stor{projectStories.length === 1 ? 'y' : 'ies'} · {cycles.size} cycle{cycles.size === 1 ? '' : 's'}</p></div>
          <span>View details <ArrowRight size={15}/></span>
        </Link>;
      })}
    </div> : <div className="card empty large">No projects yet. Add your first project to get started.</div>}
    {formOpen && <div className="modal-backdrop" onMouseDown={() => !saving && setFormOpen(false)}><form className="project-modal card" onSubmit={event => void createProject(event)} onMouseDown={event => event.stopPropagation()}><div className="modal-head"><div><span>NEW PROJECT</span><h2>Add project</h2></div><button type="button" disabled={saving} aria-label="Close" onClick={() => setFormOpen(false)}><X size={18}/></button></div><p>Create the project first. You can add and classify its user stories from the project page.</p><label>Project name<input required minLength={2} maxLength={160} value={name} onChange={event => setName(event.target.value)} placeholder="Example: Customer Portal" autoFocus/></label>{error && <p className="inline-error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" disabled={saving} onClick={() => setFormOpen(false)}>Cancel</button><button className="primary" disabled={saving || name.trim().length < 2}>{saving ? 'Creating…' : 'Create project'}</button></div></form></div>}
  </section>;
}
