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
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Classification[]>([]);
  const [error, setError] = useState('');
  const [mode, setMode] = useState(context.defaultExecutionMode);
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const stories = useMemo(() => text.split(/\n|;/).map(value => value.trim()).filter(Boolean), [text]);
  const registeredStories = workspace.stories.filter(story => story.project === project);

  async function classify() {
    setError(''); setRunning(true);
    if (!project.trim()) { setError('Informe ou selecione um projeto.'); setRunning(false); return; }
    try { setResults((await api.classify(stories, project.trim(), mode)).results); await workspace.refreshStories(); workspace.selectProject(project.trim()); }
    catch (reason) { setError((reason as Error).message); }
    finally { setRunning(false); }
  }
  async function importFile(file?: File) { if (!file) return; try { setText((await api.importFile(file)).stories.join('\n')); } catch (reason) { setError((reason as Error).message); } }

  return <section className="page"><PageTitle eyebrow="CLASSIFICAÇÃO" title="Classificar histórias">Informe um novo projeto ou selecione um já existente para carregar suas User Stories.</PageTitle><div className="classify-grid"><div className="card editor-card"><div className="form-row"><label>Projeto<div className="project-input"><input value={project} onChange={event => setProject(event.target.value)} placeholder="Nome do projeto"/><button type="button" onClick={() => setProjectPickerOpen(open => !open)}>Selecionar projeto</button>{projectPickerOpen && <div className="project-picker">{workspace.projects.map(name => <button type="button" key={name} onClick={() => { setProject(name); setText(workspace.stories.filter(story => story.project === name).map(story => story.text).join('\n')); workspace.selectProject(name); setProjectPickerOpen(false); }}>{name}</button>)}{!workspace.projects.length && <span>Nenhum projeto cadastrado.</span>}</div>}</div></label><label className="file-button"><FileUp size={16}/> Importar TXT/CSV<input type="file" accept=".txt,.csv" onChange={event => importFile(event.target.files?.[0])}/></label></div><label>Histórias de usuário<textarea value={text} onChange={event => setText(event.target.value)} placeholder={'Uma história por linha. Exemplo:\nComo usuário, quero entrar com minha conta Google para acessar rapidamente.'}/></label>{registeredStories.length > 0 && <p className="project-stories-note">{registeredStories.length} User Story(s) existente(s) carregada(s) no campo acima.</p>}<div className="editor-foot"><span>{stories.length} história(s)</span><button className="primary" disabled={!stories.length || running} onClick={classify}><Sparkles size={17}/>{running ? 'Classificando…' : 'Iniciar classificação'}</button></div>{error && <p className="inline-error">{error}</p>}</div><div className="card config"><CardHead title="Configuração da execução"/><label>Modo<select value={mode} onChange={event => setMode(event.target.value)}>{context.executionModes.map(executionMode => <option key={executionMode.key} value={executionMode.key}>{executionMode.name}</option>)}</select></label><div className="model active"><BrainCircuit size={18}/><div><b>Motor híbrido</b><small>Regras locais + LLM integrado</small></div><span>Ativo</span></div><div className="hint">A classificação é persistida e fica disponível em Meus projetos, no plano de qualidade e na fila de revisão.</div></div></div>{results.length > 0 && <div className="card results"><CardHead title="Resultado da pré-classificação"/><div className="result-grid">{results.map(result => <article key={result.id}><p>{result.text}</p><div><span className="tag">{result.module}</span><b>{result.operation}</b></div><footer><span>{Math.round(result.confidence * 100)}% de confiança</span>{result.needsReview && <span className="badge warning">Revisar</span>}</footer></article>)}</div></div>}</section>;
}
