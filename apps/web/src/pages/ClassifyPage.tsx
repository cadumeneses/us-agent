import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { BrainCircuit, FileUp, Sparkles } from 'lucide-react';
import { CardHead, PageTitle } from '../components/ui';
import { api } from '../services/api';
import { useWorkspace } from '../services/workspace';
import type { ApplicationContext, Classification } from '../types/models';

export function ClassifyPage() {
  const context = useOutletContext<ApplicationContext>();
  const workspace = useWorkspace();
  const [text, setText] = useState('');
  const [project, setProject] = useState('');
  const [sprint, setSprint] = useState('Backlog');
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Classification[]>([]);
  const [error, setError] = useState('');
  const [mode, setMode] = useState(context.defaultExecutionMode);
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const stories = useMemo(() => text.split(/\n|;/).map(value => value.trim()).filter(Boolean), [text]);
  const registeredStories = workspace.stories.filter(story => story.project === project && story.sprint === sprint);

  async function classify() {
    setError('');
    setRunning(true);
    if (!project.trim() || !sprint.trim()) {
      setError('Informe ou selecione o projeto e a sprint.');
      setRunning(false);
      return;
    }
    try {
      setResults((await api.classify(stories, project.trim(), sprint.trim(), mode)).results);
      await workspace.refreshStories();
      workspace.selectProject(project.trim());
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
    <PageTitle eyebrow="CLASSIFICAÇÃO" title="Classificar histórias">Registre cada User Story no projeto e na sprint corretos para manter o backlog, o ciclo e o plano de qualidade alinhados.</PageTitle>
    <div className="classify-grid">
      <div className="card editor-card">
        <div className="form-row">
          <label>Projeto<div className="project-input"><input value={project} onChange={event => setProject(event.target.value)} placeholder="Nome do projeto"/><button type="button" onClick={() => setProjectPickerOpen(open => !open)}>Selecionar projeto</button>{projectPickerOpen && <div className="project-picker">{workspace.projects.map(name => <button type="button" key={name} onClick={() => { const nextSprint = workspace.stories.find(story => story.project === name)?.sprint ?? 'Backlog'; setProject(name); setSprint(nextSprint); setText(workspace.stories.filter(story => story.project === name && story.sprint === nextSprint).map(story => story.text).join('\n')); workspace.selectProject(name); setProjectPickerOpen(false); }}>{name}</button>)}{!workspace.projects.length && <span>Nenhum projeto cadastrado.</span>}</div>}</div></label>
          <label>Sprint<input list="project-sprints" value={sprint} onChange={event => setSprint(event.target.value)} placeholder="Ex.: Sprint 14"/><datalist id="project-sprints">{projectSprints.map(name => <option key={name} value={name}/>)}</datalist></label>
          <label className="file-button"><FileUp size={16}/> Importar TXT/CSV<input type="file" accept=".txt,.csv" onChange={event => importFile(event.target.files?.[0])}/></label>
        </div>
        <label>Histórias de usuário<textarea value={text} onChange={event => setText(event.target.value)} placeholder={'Uma história por linha. Exemplo:\nComo usuário, quero entrar com minha conta Google para acessar rapidamente.'}/></label>
        {registeredStories.length > 0 && <p className="project-stories-note">{registeredStories.length} User Story(s) já registrada(s) nesta sprint.</p>}
        <div className="editor-foot"><span>{stories.length} história(s) · {sprint || 'sem sprint'}</span><button className="primary" disabled={!stories.length || running} onClick={classify}><Sparkles size={17}/>{running ? 'Classificando…' : 'Iniciar classificação'}</button></div>
        {error && <p className="inline-error">{error}</p>}
      </div>
      <div className="card config"><CardHead title="Configuração da execução"/><label>Modo<select value={mode} onChange={event => setMode(event.target.value)}>{context.executionModes.map(executionMode => <option key={executionMode.key} value={executionMode.key}>{executionMode.name}</option>)}</select></label><div className="model active"><BrainCircuit size={18}/><div><b>Motor híbrido</b><small>Regras locais + LLM integrado</small></div><span>Ativo</span></div><div className="hint">A classificação é persistida na sprint e fica disponível em Meus projetos, no plano de qualidade e na fila de revisão.</div></div>
    </div>
    {results.length > 0 && <div className="card results"><CardHead title="Resultado da pré-classificação"/><div className="result-grid">{results.map(result => <article key={result.id}><p>{result.text}</p><div><span className="tag">{result.module}</span><b>{result.operation}</b></div><footer><span>{Math.round(result.confidence * 100)}% de confiança</span>{result.needsReview && <span className="badge warning">Revisar</span>}</footer></article>)}</div></div>}
  </section>;
}
