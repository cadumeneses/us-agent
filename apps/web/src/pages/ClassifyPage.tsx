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
      setError('Informe o projeto, a sprint e a taxonomia que será usada.');
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
    <PageTitle eyebrow="CLASSIFICAÇÃO" title="Classificar histórias">Cadastre histórias em um projeto para classificá-las por módulo e operação. Depois, consulte o resultado e recomende RNFs nos detalhes do projeto.</PageTitle>
    <div className="classify-grid">
      <div className="card editor-card">
        <div className="form-row">
          <label>Projeto<div className="project-input"><input value={project} onChange={event => setProject(event.target.value)} placeholder="Nome do projeto"/><button type="button" onClick={() => setProjectPickerOpen(open => !open)}>Selecionar projeto</button>{projectPickerOpen && <div className="project-picker">{workspace.projects.map(name => <button type="button" key={name} onClick={() => { const nextSprint = workspace.stories.find(story => story.project === name)?.sprint ?? 'Backlog'; setProject(name); setSprint(nextSprint); setProjectPickerOpen(false); }}>{name}</button>)}{!workspace.projects.length && <span>Nenhum projeto cadastrado.</span>}</div>}</div></label>
          <label>Sprint<input list="project-sprints" value={sprint} onChange={event => setSprint(event.target.value)} placeholder="Ex.: Sprint 14"/><datalist id="project-sprints">{projectSprints.map(name => <option key={name} value={name}/>)}</datalist></label>
          <label className="file-button"><FileUp size={16}/> Importar TXT/CSV<input type="file" accept=".txt,.csv" onChange={event => importFile(event.target.files?.[0])}/></label>
        </div>
        <label>Histórias de usuário<textarea value={text} onChange={event => setText(event.target.value)} placeholder={'Uma história por linha. Exemplo:\nComo usuário, quero entrar com minha conta Google para acessar rapidamente.'}/></label>
        {registeredStories.length > 0 && <p className="project-stories-note">{registeredStories.length} User Story(s) já registrada(s) nesta sprint.</p>}
        <div className="editor-foot"><span>{stories.length} história(s) · {sprint || 'sem sprint'}</span><button className="primary" disabled={!stories.length || !taxonomyVersion || running} onClick={classify}><Sparkles size={17}/>{running ? 'Classificando…' : 'Iniciar classificação'}</button></div>
        {error && <p className="inline-error">{error}</p>}
      </div>
      <div className="card config"><CardHead title="Configuração da execução"/><label>Taxonomia<select value={taxonomyVersion} onChange={event => setTaxonomyVersion(event.target.value)}><option value="">Selecione a versão</option>{taxonomies.map(item => <option key={item.version} value={item.version}>{item.version} · {item.modules} módulos · {item.operations} operações</option>)}</select></label><p className="classify-taxonomy-note">Esta versão será usada na classificação e salva com cada história. A recomendação compara histórias da mesma versão.</p>{!taxonomies.length && <Link to="/taxonomy">Configurar uma taxonomia com operações</Link>}<label>Modo<select value={mode} onChange={event => setMode(event.target.value)}>{context.executionModes.map(executionMode => <option key={executionMode.key} value={executionMode.key}>{executionMode.name}</option>)}</select></label><div className="model active"><BrainCircuit size={18}/><div><b>Motor híbrido</b><small>Regras locais + LLM integrado</small></div><span>Ativo</span></div><div className="hint">A classificação fica salva no projeto. A partir de cada história classificada, você pode recomendar RNFs.</div></div>
    </div>
    {results.length > 0 && <div className="card results"><CardHead title="Classificação salva"/><p>As histórias já estão disponíveis no projeto.</p><Link className="primary project-action" to={`/projects/${encodeURIComponent(resultProject)}`}>Ver detalhes do projeto</Link><div className="result-grid">{results.map(result => <article key={result.id}><p>{result.text}</p><div><span className="tag">{result.module}</span><b>{result.operation}</b></div><footer><span>{Math.round(result.confidence * 100)}% de confiança</span>{result.needsReview && <span className="badge warning">Revisar</span>}</footer></article>)}</div></div>}
  </section>;
}
