import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ClipboardList, Plus, Sparkles } from 'lucide-react';
import { PageTitle } from '../components/ui';
import { ResearchProfile } from '../components/ResearchProfile';
import { StoryItemModal, type StoryEditor } from '../components/StoryItemModal';
import { api } from '../services/api';
import { useWorkspace } from '../services/workspace';
import type { StoryDetails } from '../types/models';
import type { NfrRun } from '../types/nfr';

const emptyDetails: StoryDetails = { tasks: [], functionalRequirements: [], nonFunctionalRequirements: [] };
const statusLabels: Record<string, string> = { accepted_auto: 'Aceita automaticamente', reviewed: 'Revisada', pending_review: 'Aguardando revisão', taxonomy_gap: 'Lacuna na taxonomia', needs_rewrite: 'Precisa ser reescrita' };

export function ProjectDetailsPage() {
  const { projectName = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const workspace = useWorkspace();
  const projectStories = useMemo(() => workspace.stories.filter(item => item.project === projectName), [workspace.stories, projectName]);
  const story = projectStories.find(item => item.id === params.get('story')) ?? projectStories[0];
  const [details, setDetails] = useState<StoryDetails>(emptyDetails);
  const [runs, setRuns] = useState<NfrRun[]>([]);
  const [editor, setEditor] = useState<StoryEditor | null>(null);
  const [toolOpen, setToolOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!story) { setDetails(emptyDetails); setRuns([]); return; }
    let active = true;
    setDetails(emptyDetails); setRuns([]); setError('');
    Promise.all([api.storyDetails(story.id), api.nfrRuns(story.id)]).then(([nextDetails, nextRuns]) => {
      if (active) { setDetails(nextDetails); setRuns(nextRuns); }
    }).catch((reason: Error) => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, [story?.id]);

  async function save(next: StoryDetails) {
    if (!story) return;
    setSaving(true); setError('');
    try { setDetails(await api.saveStoryDetails(story.id, next)); setEditor(null); }
    catch (reason) { setError((reason as Error).message); }
    finally { setSaving(false); }
  }

  if (workspace.loading) return <section className="page"><p className="state">Carregando projeto…</p></section>;
  if (!projectStories.length) return <section className="page"><PageTitle title="Projeto não encontrado">Este projeto não possui histórias registradas.</PageTitle><Link to="/projects">Voltar aos projetos</Link></section>;

  return <section className="page project-details-page">
    <Link className="back-link" to="/projects"><ArrowLeft size={15}/> Meus projetos</Link>
    <PageTitle eyebrow="DETALHES DO PROJETO" title={projectName}>Consulte classificações, prepare o contexto e acompanhe os RNFs de cada história.</PageTitle>
    <div className="project-detail-toolbar"><span>{projectStories.length} história{projectStories.length === 1 ? '' : 's'} classificada{projectStories.length === 1 ? '' : 's'}</span><div className="project-tool-wrap"><button className="primary project-action" type="button" aria-expanded={toolOpen} aria-haspopup="true" onClick={() => setToolOpen(open => !open)}>Ferramentas <ChevronDown size={16}/></button>{toolOpen && <div className="project-tool-menu"><button onClick={() => navigate(`/classify?project=${encodeURIComponent(projectName)}`)}><Sparkles size={16}/> Classificar histórias</button><button disabled={!story} onClick={() => navigate(`/recommendations?classificationId=${story?.id}`)}><ClipboardList size={16}/> Recomendar RNFs para esta história</button></div>}</div></div>
    <ResearchProfile project={projectName}/>
    <div className="project-detail-grid"><div className="card project-story-panel"><h2>Histórias do projeto</h2><p>Selecione uma história para ver sua classificação e seus RNFs.</p><div className="project-story-list">{projectStories.map(item => <button className={story?.id === item.id ? 'selected' : ''} key={item.id} onClick={() => setParams({ story: item.id })}><b>US-{item.id} · {item.sprint || 'Backlog'}</b><span>{item.text}</span><small>{statusLabels[item.status] ?? item.status}</small></button>)}</div></div>
      {story && <div className="project-story-details"><article className="card story-header"><div className="story-code"><span>US-{story.id}</span><span className="sprint-chip">{story.sprint || 'Backlog'}</span><span className="status-chip">{statusLabels[story.status] ?? story.status}</span></div><h1>{story.text}</h1><p>Classificação: <strong>{story.module} / {story.operation}</strong> · {Math.round(story.confidence * 100)}% de confiança · taxonomia {story.taxonomyVersion || 'não informada'}</p><div className="project-story-actions"><Link to={`/recommendations?classificationId=${story.id}`}><ClipboardList size={15}/> Recomendar RNFs</Link>{story.status === 'pending_review' && <Link to={`/review?classificationId=${story.id}`}>Revisar classificação</Link>}</div></article>
        {error && <p className="inline-error" role="alert">{error}</p>}
        <div className="project-detail-sections"><DetailSection title="Tarefas" description="Categorias e tecnologias usadas na recomendação." onAdd={() => setEditor({ kind: 'task' })}>{details.tasks.map((item, index) => <button className="detail-row" key={item.id} onClick={() => setEditor({ kind: 'task', index })}><span>{item.title}</span><small>{item.category}</small></button>)}</DetailSection>
          <DetailSection title="Requisitos funcionais" onAdd={() => setEditor({ kind: 'functional' })}>{details.functionalRequirements.map((item, index) => <button className="detail-row" key={item.id} onClick={() => setEditor({ kind: 'functional', index })}><span>{item.description}</span></button>)}</DetailSection>
          <DetailSection title="RNFs vinculados" description="RNFs aceitos pelo recomendador ou cadastrados nesta história." onAdd={() => setEditor({ kind: 'nonFunctional' })}>{details.nonFunctionalRequirements.map((item, index) => <button className="detail-row" key={item.id} onClick={() => setEditor({ kind: 'nonFunctional', index })}><span>{item.description}</span><small>{item.type} · {item.metric}</small></button>)}</DetailSection>
          <section className="card detail-card"><div className="detail-head"><div><h2>Histórico de recomendações</h2><p>As execuções e decisões ficam salvas nesta classificação.</p></div></div><div className="details-list">{runs.length ? runs.map(run => <div className="project-run-row" key={run.id}><b>{new Date(run.createdAt).toLocaleString('pt-BR')} · {run.status === 'completed' ? 'Concluída' : 'Sem RNF vinculado'}</b><small>{run.items.length} sugestão(ões) · {Object.values(run.decisions).filter(value => value === 'accepted').length} aceita(s)</small></div>) : <div className="empty">Nenhuma recomendação executada para esta história.</div>}</div></section>
        </div></div>}
    </div>
    {editor && <StoryItemModal key={`${story?.id}-${editor.kind}-${editor.index ?? 'new'}`} editor={editor} details={details} saving={saving} onClose={() => setEditor(null)} onSave={next => void save(next)}/>}
  </section>;
}

function DetailSection({ title, description, onAdd, children }: { title: string; description?: string; onAdd: () => void; children: React.ReactNode }) {
  return <section className="detail-card card"><div className="detail-head"><div><h2>{title}</h2>{description && <p>{description}</p>}</div><button onClick={onAdd}><Plus size={15}/> Adicionar</button></div><div className="details-list">{children || <div className="empty">Nenhum item cadastrado.</div>}</div></section>;
}
