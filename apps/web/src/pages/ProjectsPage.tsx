import { Link } from 'react-router-dom';
import { ArrowRight, FolderKanban, Plus } from 'lucide-react';
import { PageTitle } from '../components/ui';
import { useWorkspace } from '../services/workspace';

export function ProjectsPage() {
  const { projects, stories, loading } = useWorkspace();
  return <section className="page projects-page">
    <PageTitle eyebrow="PROJETOS" title="Meus projetos">Acesse as histórias classificadas e os RNFs vinculados a cada projeto.</PageTitle>
    <div className="projects-list-head"><p>{projects.length} projeto{projects.length === 1 ? '' : 's'}</p><Link className="primary project-action" to="/classify"><Plus size={16}/> Novo projeto e histórias</Link></div>
    {loading ? <p className="state">Carregando projetos…</p> : projects.length ? <div className="projects-grid">
      {projects.map((project, index) => {
        const projectStories = stories.filter(story => story.project === project);
        const cycles = new Set(projectStories.map(story => story.sprint || 'Backlog'));
        return <Link className="card project-overview" key={project} to={`/projects/${encodeURIComponent(project)}`}>
          <i className={`project-mark ${['blue', 'violet', 'orange'][index % 3]}`}><FolderKanban size={19}/></i>
          <div><h2>{project}</h2><p>{projectStories.length} história{projectStories.length === 1 ? '' : 's'} · {cycles.size} ciclo{cycles.size === 1 ? '' : 's'}</p></div>
          <span>Ver detalhes <ArrowRight size={15}/></span>
        </Link>;
      })}
    </div> : <div className="card empty large">Nenhum projeto ainda. Classifique a primeira história para criar um projeto.</div>}
  </section>;
}
