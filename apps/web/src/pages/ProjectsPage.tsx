// @ts-nocheck
import { useEffect, useMemo, useState } from 'react';
import { Archive, Check, ChevronDown, CirclePlus, ClipboardList, FileText, Layers3, Plus, Target, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageTitle } from '../components/ui';
import { useWorkspace } from '../services/workspace';
import { api } from '../services/api';
import type { StoryDetails } from '../types/models';

const emptyDetails: StoryDetails = { tasks: [], functionalRequirements: [], nonFunctionalRequirements: [] };
const metrics: Record<string, string[]> = { Performance: ['response_time', 'capacity', 'latency', 'throughput'], Usability: ['accuracy', 'efficiency_compliance'], Reliability: ['delay', 'data_loss'], Security: ['access_control', 'data_encryption'], Maintainability: ['modularity', 'testability'] };
type Editor = { kind: 'task' | 'functional' | 'nonFunctional'; index?: number } | null;

const statusLabels: Record<string, string> = {
  accepted_auto: 'Aceita automaticamente',
  reviewed: 'Revisada',
  pending_review: 'Aguardando revisão',
  taxonomy_gap: 'Lacuna na taxonomia',
  needs_rewrite: 'Precisa ser reescrita'
};

function storyStatus(status: string) {
  return statusLabels[status] ?? status.replaceAll('_', ' ');
}

export function ProjectsPage() {
  const workspace = useWorkspace();
  const [details, setDetails] = useState<StoryDetails>(emptyDetails);
  const [editor, setEditor] = useState<Editor>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [sprintModalOpen, setSprintModalOpen] = useState(false);
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [sprintName, setSprintName] = useState('Backlog');
  const [storyText, setStoryText] = useState('');
  const [selectedSprint, setSelectedSprint] = useState('Backlog');
  const [sprintRecords, setSprintRecords] = useState<any[]>([]);
  const [qualityPlans, setQualityPlans] = useState<any[]>([]);
  const [assignmentIds, setAssignmentIds] = useState<string[]>([]);
  const [sprintStatus, setSprintStatus] = useState('planning');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const projectStories = useMemo(() => workspace.stories.filter(story => story.project === workspace.selectedProject), [workspace.stories, workspace.selectedProject]);
  useEffect(() => {
    Promise.all([api.sprints(), api.qualityPlans()]).then(([sprintItems, plans]) => { setSprintRecords(sprintItems); setQualityPlans(plans); }).catch(reason => setError((reason as Error).message));
  }, [workspace.stories]);
  const projectSprints = useMemo(() => sprintRecords.filter(sprint => sprint.project === workspace.selectedProject), [sprintRecords, workspace.selectedProject]);
  const sprints = useMemo(() => {
    const names = projectSprints.map(sprint => sprint.name);
    return names.length ? names : [...new Set(projectStories.map(story => story.sprint || 'Backlog'))];
  }, [projectSprints, projectStories]);
  const sprintStories = useMemo(() => projectStories.filter(story => (story.sprint || 'Backlog') === selectedSprint), [projectStories, selectedSprint]);
  const story = sprintStories.find(item => item.id === workspace.selectedStoryId) ?? sprintStories[0];
  const selectedSprintRecord = projectSprints.find(sprint => sprint.name === selectedSprint);
  const selectedPlan = qualityPlans.find(plan => plan.project === workspace.selectedProject && plan.sprint === selectedSprint);

  useEffect(() => {
    const currentStory = workspace.stories.find(item => item.id === workspace.selectedStoryId);
    if (currentStory?.project === workspace.selectedProject) setSelectedSprint(currentStory.sprint || 'Backlog');
    else if (!sprints.includes(selectedSprint)) setSelectedSprint(sprints[0] ?? 'Backlog');
  }, [workspace.selectedProject, workspace.selectedStoryId, workspace.stories, sprints]);

  useEffect(() => {
    if (!story) { setDetails(emptyDetails); return; }
    api.storyDetails(story.id).then(setDetails).catch(reason => setError((reason as Error).message));
  }, [story?.id]);

  function selectProject(project: string) {
    workspace.selectProject(project);
    const firstStory = workspace.stories.find(item => item.project === project);
    setSelectedSprint(firstStory?.sprint || 'Backlog');
    setError('');
  }

  function selectSprint(sprint: string) {
    setSelectedSprint(sprint);
    const firstStory = projectStories.find(item => (item.sprint || 'Backlog') === sprint);
    if (firstStory) workspace.selectStory(firstStory.id);
  }

  function openAssignment() {
    if (!selectedSprintRecord) { setError('Crie uma sprint antes de conectar User Stories.'); return; }
    setAssignmentIds(sprintStories.map(story => story.id));
    setAssignmentOpen(true);
  }

  async function saveAssignment() {
    if (!selectedSprintRecord || !assignmentIds.length) { setError('Selecione ao menos uma User Story para a sprint.'); return; }
    setSaving(true); setError('');
    try {
      await api.assignStoriesToSprint(selectedSprintRecord.id, assignmentIds);
      await workspace.refreshStories();
      setSprintRecords(await api.sprints());
      setQualityPlans(await api.qualityPlans());
      setAssignmentOpen(false);
    } catch (reason) { setError((reason as Error).message); }
    finally { setSaving(false); }
  }

  async function createSprint() {
    if (!workspace.selectedProject || !sprintName.trim()) { setError('Informe o nome da sprint.'); return; }
    setSaving(true); setError('');
    try {
      const created = await api.createSprint({ project: workspace.selectedProject, name: sprintName.trim(), status: sprintStatus });
      setSprintRecords(current => [...current, created]);
      setSelectedSprint(created.name);
      setSprintModalOpen(false);
      setSprintName('');
    } catch (reason) { setError((reason as Error).message); }
    finally { setSaving(false); }
  }

  async function changeSprintStatus(status: string) {
    if (!selectedSprintRecord) return;
    setSaving(true); setError('');
    try { const updated = await api.updateSprintStatus(selectedSprintRecord.id, status as any); setSprintRecords(current => current.map(item => item.id === updated.id ? updated : item)); }
    catch (reason) { setError((reason as Error).message); }
    finally { setSaving(false); }
  }

  async function openQualityPlan() {
    if (!selectedSprintRecord || !sprintStories.length) { setError('Adicione User Stories à sprint antes de planejar a qualidade.'); return; }
    setSaving(true); setError('');
    try {
      const plan = selectedPlan ?? await api.createQualityPlanScope(workspace.selectedProject, selectedSprint, sprintStories.map(story => story.id));
      setQualityPlans(current => [...current.filter(item => item.id !== plan.id), plan]);
      navigate(`/quality?sprint=${encodeURIComponent(selectedSprint)}`);
    } catch (reason) { setError((reason as Error).message); }
    finally { setSaving(false); }
  }

  async function persist(next: StoryDetails) {
    if (!story) return;
    setSaving(true);
    setError('');
    try { setDetails(await api.saveStoryDetails(story.id, next)); }
    catch (reason) { setError((reason as Error).message); }
    finally { setSaving(false); }
  }

  async function createProject(event: React.FormEvent) {
    event.preventDefault();
    const list = storyText.split(/\n|;/).map(value => value.trim()).filter(Boolean);
    if (!projectName.trim() || !sprintName.trim() || !list.length) { setError('Informe projeto, sprint e ao menos uma User Story.'); return; }
    setSaving(true);
    setError('');
    try {
      await api.classify(list, projectName.trim(), sprintName.trim(), 'preview');
      await workspace.refreshStories();
      setSprintRecords(await api.sprints());
      workspace.selectProject(projectName.trim());
      setSelectedSprint(sprintName.trim());
      setCreateOpen(false);
      setProjectName(''); setSprintName('Backlog'); setStoryText('');
    } catch (reason) { setError((reason as Error).message); }
    finally { setSaving(false); }
  }

  return <section className="page projects-page">
    <PageTitle eyebrow="GESTÃO DE PRODUTO" title="Meus projetos">Escolha um projeto, entre no backlog ou em uma sprint e trabalhe nas histórias daquele ciclo.</PageTitle>
    <div className="projects-layout">
      <aside className="project-panel card">
        <div className="project-panel-head"><div><span>PROJETOS</span><b>Seu espaço de trabalho</b></div><button className="square-button" onClick={() => setCreateOpen(true)} aria-label="Criar projeto"><Plus size={16}/></button></div>
        <div className="project-list">{workspace.projects.map((project, index) => <button key={project} onClick={() => selectProject(project)} className={workspace.selectedProject === project ? 'project-item selected' : 'project-item'}><i className={`project-mark ${['blue', 'violet', 'orange'][index % 3]}`}>{project[0]}</i><div><b>{project}</b><small>{workspace.stories.filter(item => item.project === project).length} histórias</small></div><ChevronDown size={14}/></button>)}</div>
        {workspace.selectedProject && <div className="project-sprint-nav"><div className="project-sprint-nav-title"><Layers3 size={14}/> CICLOS DO PROJETO <button onClick={() => { setSprintName(''); setSprintStatus('planning'); setSprintModalOpen(true); }} aria-label="Criar sprint"><Plus size={13}/></button></div>{sprints.map(sprint => { const record = projectSprints.find(item => item.name === sprint); return <button key={sprint} onClick={() => selectSprint(sprint)} className={selectedSprint === sprint ? 'project-sprint selected' : 'project-sprint'}><Archive size={13}/><span><b>{sprint}</b><small>{projectStories.filter(item => (item.sprint || 'Backlog') === sprint).length} histórias{record && ` · ${record.status === 'active' ? 'ativa' : record.status === 'completed' ? 'concluída' : 'planejamento'}`}</small></span></button>; })}</div>}
        <button className="new-story" onClick={() => setCreateOpen(true)}><CirclePlus size={16}/> Criar projeto e histórias</button>
      </aside>

      <div className="story-workspace">
        {!workspace.selectedProject ? <div className="card empty large">Crie ou selecione um projeto para começar.</div> : <>
          <article className="project-context card"><div><span>PROJETO</span><h1>{workspace.selectedProject}</h1><p>Organize o trabalho por backlog e sprint.</p></div><div className="context-counts"><div><b>{projectStories.length}</b><small>histórias</small></div><div><b>{sprints.length - 1}</b><small>sprints</small></div><div><b>{projectStories.filter(item => item.status === 'pending_review').length}</b><small>em revisão</small></div></div></article>
          <div className="sprint-tabs" role="tablist" aria-label="Ciclos do projeto">{sprints.map(sprint => <button key={sprint} onClick={() => selectSprint(sprint)} className={selectedSprint === sprint ? 'active' : ''} role="tab" aria-selected={selectedSprint === sprint}><span>{sprint === 'Backlog' ? 'BACKLOG' : 'SPRINT'}</span><b>{sprint}</b><small>{projectStories.filter(item => (item.sprint || 'Backlog') === sprint).length} histórias</small></button>)}<button className="sprint-add-tab" onClick={() => setSprintModalOpen(true)}><Plus size={14}/> Nova sprint</button></div>
          <section className="sprint-board card"><div className="sprint-board-head"><div><span>{selectedSprint === 'Backlog' ? 'BACKLOG' : 'SPRINT ATUAL'}</span><h2>{selectedSprint}</h2><p>{sprintStories.length ? 'Histórias incluídas neste ciclo de trabalho.' : 'Nenhuma história foi adicionada a este ciclo ainda.'}</p><small className="plan-state">Plano de qualidade: {selectedPlan ? (selectedPlan.status === 'approved' ? 'aprovado' : 'rascunho') : 'ainda não criado'}</small></div><div className="sprint-board-actions">{selectedSprintRecord && <select value={selectedSprintRecord.status} onChange={event => changeSprintStatus(event.target.value)} disabled={saving || selectedSprint === 'Backlog'}><option value="planning">Planejamento</option><option value="active">Ativa</option><option value="completed">Concluída</option></select>}<button onClick={openAssignment}><Plus size={14}/> Conectar histórias</button><button className="quality-link" onClick={openQualityPlan}><ClipboardList size={14}/> {selectedPlan ? 'Abrir plano' : 'Planejar qualidade'}</button></div></div><div className="sprint-story-list">{sprintStories.map(item => <button key={item.id} className={story?.id === item.id ? 'selected' : ''} onClick={() => workspace.selectStory(item.id)}><span className={`story-state ${item.status}`} /><div><b>US-{item.id}</b><strong>{item.text}</strong><small>{item.module} · {item.operation}</small></div><em>{storyStatus(item.status)}</em></button>)}{!sprintStories.length && <div className="empty">Este ciclo está vazio. Use “Conectar histórias” para selecionar as User Stories.</div>}</div></section>
          {story && <><article className="story-header card"><div className="story-code"><span>US-{story.id}</span><span className="sprint-chip">{story.sprint || 'Backlog'}</span><span className="status-chip">{storyStatus(story.status)}</span></div><h1>{story.text}</h1><p>{story.module} · {story.operation}</p><div className="story-info"><span><Target size={14}/> Projeto <b>{story.project}</b></span><span><Archive size={14}/> Ciclo <b>{story.sprint || 'Backlog'}</b></span><span><ClipboardList size={14}/> {details.tasks.filter(item => item.done).length}/{details.tasks.length} tarefas</span><span><FileText size={14}/> {Math.round(story.confidence * 100)}% confiança</span></div></article>{error && <p className="inline-error">{error}</p>}<div className="story-content"><DetailSection title="Tarefas" description="Entregas menores e rastreáveis." onAdd={() => setEditor({ kind: 'task' })}>{details.tasks.map((item, index) => <button className={item.done ? 'detail-row done' : 'detail-row'} key={item.id} onClick={() => setEditor({ kind: 'task', index })}><Check size={13}/><span>{item.title}</span></button>)}</DetailSection><DetailSection title="Requisitos funcionais" description="Comportamentos que a solução oferece." onAdd={() => setEditor({ kind: 'functional' })}>{details.functionalRequirements.map((item, index) => <button className="detail-row" key={item.id} onClick={() => setEditor({ kind: 'functional', index })}><b>RF-{index + 1}</b><span>{item.description}</span></button>)}</DetailSection><DetailSection title="Requisitos não funcionais" description="Qualidade e restrições da solução." onAdd={() => setEditor({ kind: 'nonFunctional' })}>{details.nonFunctionalRequirements.map((item, index) => <button className="detail-row" key={item.id} onClick={() => setEditor({ kind: 'nonFunctional', index })}><b>RNF-{index + 1}</b><span>{item.description}</span><small>{item.type} · {item.metric}</small></button>)}</DetailSection></div></>}
        </>}
      </div>
    </div>
    {editor && <StoryItemModal editor={editor} details={details} saving={saving} onClose={() => setEditor(null)} onSave={async next => { await persist(next); setEditor(null); }}/>} {createOpen && <div className="modal-backdrop" onMouseDown={() => !saving && setCreateOpen(false)}><form className="project-modal card" onSubmit={createProject} onMouseDown={event => event.stopPropagation()}><div className="modal-head"><div><span>NOVO PROJETO</span><h2>Crie seu projeto</h2></div><button type="button" onClick={() => setCreateOpen(false)}><X size={18}/></button></div><label>Nome do projeto<input value={projectName} onChange={event => setProjectName(event.target.value)} placeholder="Ex.: Portal do Cliente"/></label><label>Sprint inicial<input value={sprintName} onChange={event => setSprintName(event.target.value)} placeholder="Ex.: Sprint 1 ou Backlog"/></label><label>User Stories<textarea value={storyText} onChange={event => setStoryText(event.target.value)} placeholder="Uma User Story por linha"/></label><div className="modal-actions"><button type="button" onClick={() => setCreateOpen(false)}>Cancelar</button><button className="primary" disabled={saving}>Criar projeto</button></div></form></div>}
    {sprintModalOpen && <div className="modal-backdrop" onMouseDown={() => !saving && setSprintModalOpen(false)}><form className="project-modal card" onSubmit={event => { event.preventDefault(); void createSprint(); }} onMouseDown={event => event.stopPropagation()}><div className="modal-head"><div><span>NOVA SPRINT</span><h2>Crie um ciclo de trabalho</h2></div><button type="button" onClick={() => setSprintModalOpen(false)}><X size={18}/></button></div><p>As histórias continuam no Backlog até você conectá-las a esta sprint.</p><label>Nome da sprint<input value={sprintName} onChange={event => setSprintName(event.target.value)} placeholder="Ex.: Sprint 15" autoFocus/></label><label>Status inicial<select value={sprintStatus} onChange={event => setSprintStatus(event.target.value)}><option value="planning">Planejamento</option><option value="active">Ativa</option></select></label><div className="modal-actions"><button type="button" onClick={() => setSprintModalOpen(false)}>Cancelar</button><button className="primary" disabled={saving}>Criar sprint</button></div></form></div>}
    {assignmentOpen && <div className="modal-backdrop" onMouseDown={() => !saving && setAssignmentOpen(false)}><form className="project-modal card sprint-assignment-modal" onSubmit={event => { event.preventDefault(); void saveAssignment(); }} onMouseDown={event => event.stopPropagation()}><div className="modal-head"><div><span>SPRINT · {selectedSprint}</span><h2>Conectar User Stories</h2></div><button type="button" onClick={() => setAssignmentOpen(false)}><X size={18}/></button></div><p>Selecione as histórias que devem fazer parte deste ciclo. As demais continuam no Backlog ou em outra sprint.</p><div className="assignment-list">{projectStories.map(item => <label key={item.id}><input type="checkbox" checked={assignmentIds.includes(item.id)} onChange={event => setAssignmentIds(current => event.target.checked ? [...current, item.id] : current.filter(id => id !== item.id))}/><span>US-{item.id}</span><div><b>{item.text}</b><small>{item.sprint || 'Backlog'} · {storyStatus(item.status)}</small></div></label>)}</div><div className="modal-actions"><button type="button" onClick={() => setAssignmentOpen(false)}>Cancelar</button><button className="primary" disabled={saving}>Salvar conexão</button></div></form></div>}
  </section>;
}

function DetailSection({ title, description, onAdd, children }: { title: string; description: string; onAdd: () => void; children: React.ReactNode }) { return <section className="detail-card card"><div className="detail-head"><div><h2>{title}</h2><p>{description}</p></div><button onClick={onAdd}><Plus size={15}/> Adicionar</button></div><div className="details-list">{children || <div className="empty">Nenhum item cadastrado.</div>}</div></section>; }

function StoryItemModal({ editor, details, saving, onClose, onSave }: { editor: Exclude<Editor, null>; details: StoryDetails; saving: boolean; onClose: () => void; onSave: (details: StoryDetails) => void }) { const existing = editor.index === undefined ? undefined : editor.kind === 'task' ? details.tasks[editor.index] : editor.kind === 'functional' ? details.functionalRequirements[editor.index] : details.nonFunctionalRequirements[editor.index]; const [text, setText] = useState(existing ? ('title' in existing ? existing.title : existing.description) : ''); const [done, setDone] = useState(existing && 'done' in existing ? existing.done : false); const [type, setType] = useState(existing && 'type' in existing ? existing.type : 'Performance'); const [metric, setMetric] = useState(existing && 'metric' in existing ? existing.metric : 'response_time'); const title = editor.kind === 'task' ? 'Tarefa' : editor.kind === 'functional' ? 'Requisito funcional' : 'Requisito não funcional'; function submit(event: React.FormEvent) { event.preventDefault(); if (!text.trim()) return; const id = existing?.id ?? `new-${Date.now()}`; if (editor.kind === 'task') { const items = [...details.tasks]; const item = { id, title: text.trim(), done }; editor.index === undefined ? items.push(item) : items.splice(editor.index, 1, item); onSave({ ...details, tasks: items }); } else if (editor.kind === 'functional') { const items = [...details.functionalRequirements]; const item = { id, description: text.trim() }; editor.index === undefined ? items.push(item) : items.splice(editor.index, 1, item); onSave({ ...details, functionalRequirements: items }); } else { const items = [...details.nonFunctionalRequirements]; const item = { id, description: text.trim(), type, metric }; editor.index === undefined ? items.push(item) : items.splice(editor.index, 1, item); onSave({ ...details, nonFunctionalRequirements: items }); } } return <div className="modal-backdrop"><form className="project-modal card" onSubmit={submit}><div className="modal-head"><div><span>{editor.index === undefined ? 'ADICIONAR' : 'EDITAR'}</span><h2>{title}</h2></div><button type="button" onClick={onClose}><X size={18}/></button></div><label>{editor.kind === 'task' ? 'Tarefa' : 'Descrição'}<textarea value={text} onChange={event => setText(event.target.value)} autoFocus/></label>{editor.kind === 'task' && <label className="inline-check"><input type="checkbox" checked={done} onChange={event => setDone(event.target.checked)}/> Concluída</label>}{editor.kind === 'nonFunctional' && <div className="nfr-selects"><label>Tipo<select value={type} onChange={event => { setType(event.target.value); setMetric(metrics[event.target.value][0]); }}>{Object.keys(metrics).map(value => <option key={value}>{value}</option>)}</select></label><label>Métrica<select value={metric} onChange={event => setMetric(event.target.value)}>{metrics[type].map(value => <option key={value}>{value}</option>)}</select></label></div>}<div className="modal-actions"><button type="button" onClick={onClose}>Cancelar</button><button className="primary" disabled={saving}>Salvar</button></div></form></div>; }
