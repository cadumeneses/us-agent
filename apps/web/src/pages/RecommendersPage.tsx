import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, ClipboardCheck, FileCheck2 } from 'lucide-react';
import { PageTitle } from '../components/ui';
import { useWorkspace } from '../services/workspace';
import { NfrStory } from './NfrRecommendationsPage';
import { ProjectTestRecommendations } from '../components/ProjectTestRecommendations';

const recommenders = [
  { id: 'nfr', title: 'Requisitos não funcionais', description: 'Encontre RNFs de histórias semelhantes e escolha quais associar à sua história.', icon: ClipboardCheck },
  { id: 'tests', title: 'Casos de teste', description: 'Encontre casos de teste usando a classificação, o perfil do projeto e os critérios de aceitação.', icon: FileCheck2 }
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
    <PageTitle eyebrow="PROJETO E RECOMENDAÇÃO" title="Recomendadores">Escolha o que deseja recomendar. Aproveite o perfil do projeto e as histórias que você já classificou.</PageTitle>
    <div className="recommender-choices" role="group" aria-label="Escolha um recomendador">
      {recommenders.map(({ id, title, description, icon: Icon }) => <button type="button" key={id} className="card recommender-choice" aria-pressed={method === id} disabled={busy} onClick={() => change({ recommender: id })}>
        <span className="recommender-choice-icon"><Icon size={22}/>{method === id && <Check size={18} aria-label="Selecionado"/>}</span><strong>{title}</strong><span>{description}</span>
      </button>)}
    </div>
    {!selected && <p className="recommender-guidance">Selecione um recomendador acima para começar.</p>}
    {selected && <>
      <section className="card configured-panel recommender-context"><h2>Projeto e história</h2>
        <div className="configured-input-meta"><label>Projeto<select value={project} disabled={busy || workspace.loading} onChange={event => {
          workspace.selectProject(event.target.value); change({ project: event.target.value, classificationId: '' });
        }}><option value="">Selecione um projeto</option>{workspace.projects.map(name => <option key={name} value={name}>{name}</option>)}</select></label>
          <label>História classificada<select value={story?.id ?? ''} disabled={busy || workspace.loading || !project} onChange={event => {
            workspace.selectStory(event.target.value); change({ project, classificationId: event.target.value });
          }}><option value="">Selecione uma história</option>{stories.map(row => <option key={row.id} value={row.id}>{row.text}{!readyStatuses.has(row.status) ? ' · Revisão pendente' : ''}</option>)}</select></label></div>
        {workspace.loading ? <p role="status">Carregando projetos e histórias…</p> : !workspace.projects.length ? <p>Crie seu projeto e preencha seu perfil para começar. <Link to="/projects">Criar projeto</Link></p> : project && <div className="configured-actions">
          <Link to={`/projects/${encodeURIComponent(project)}${story ? `?story=${encodeURIComponent(story.id)}` : ''}`}>Ver perfil e tarefas</Link>
          <Link to={`/classify?project=${encodeURIComponent(project)}`}>{stories.length ? 'Adicionar ou classificar histórias' : 'Classificar a primeira história'}</Link>
        </div>}
        {!workspace.loading && project && !stories.length && <p>Este projeto ainda não tem histórias classificadas. Classifique uma história para usar este recomendador.</p>}
        {story && <div className="recommender-story"><strong>{story.text}</strong><p>{story.labels.map(label => `${label.module} / ${label.operation}`).join(' · ') || 'Classificação incompleta'}</p>
          {!ready && <p role="status">Conclua a revisão da classificação antes de recomendar. <Link to={`/review?classificationId=${encodeURIComponent(story.id)}`}>Revisar classificação</Link></p>}
        </div>}
      </section>
      {ready && (method === 'nfr' ? <NfrStory key={story.id} id={story.id} onBusy={setBusy}/> : <ProjectTestRecommendations key={story.id} story={story} busy={busy} onBusy={setBusy}/>)}
    </>}
    <details className="recommender-management"><summary>Configuração, bases e histórico</summary><div className="configured-actions"><Link to="/recommender-setup">Configurar recomendadores e bases</Link><Link to="/configured-recommendations">Consultar execuções de bases publicadas</Link></div></details>
  </section>;
}
