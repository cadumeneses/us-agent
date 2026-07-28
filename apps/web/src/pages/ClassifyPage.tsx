import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { BrainCircuit, FileUp, Sparkles } from 'lucide-react';
import { CardHead, PageTitle } from '../components/ui';
import { api } from '../services/api';
import type { ApplicationContext, Classification } from '../types/models';

export function ClassifyPage() {
  const context = useOutletContext<ApplicationContext>();
  const [text, setText] = useState('');
  const [project, setProject] = useState('Meu projeto');
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Classification[]>([]);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('committee');
  const stories = useMemo(() => text.split(/\n|;/).map(value => value.trim()).filter(Boolean), [text]);

  async function classify() {
    setError('');
    setRunning(true);
    try { setResults((await api.classify(stories, project, mode)).results); }
    catch (reason) { setError((reason as Error).message); }
    finally { setRunning(false); }
  }

  async function importFile(file?: File) {
    if (!file) return;
    try { setText((await api.importFile(file)).stories.join('\n')); }
    catch (reason) { setError((reason as Error).message); }
  }

  return <section className="page"><PageTitle eyebrow="CLASSIFICAÇÃO" title="Classificar histórias">Cole requisitos ou importe um arquivo para obter uma pré-classificação instantânea.</PageTitle><div className="classify-grid"><div className="card editor-card"><div className="form-row"><label>Projeto<input value={project} onChange={event => setProject(event.target.value)}/></label><label className="file-button"><FileUp size={16}/> Importar TXT/CSV<input type="file" accept=".txt,.csv" onChange={event => importFile(event.target.files?.[0])}/></label></div><label>Histórias de usuário<textarea value={text} onChange={event => setText(event.target.value)} placeholder={'Uma história por linha. Exemplo:\nComo usuário, quero entrar com minha conta Google para acessar rapidamente.'}/></label><div className="editor-foot"><span>{stories.length} história(s)</span><button className="primary" disabled={!stories.length || running} onClick={classify}><Sparkles size={17}/>{running ? 'Classificando…' : 'Iniciar classificação'}</button></div>{error && <p className="inline-error">{error}</p>}</div><div className="card config"><CardHead title="Configuração da execução"/><label>Modo<select value={mode} onChange={event => setMode(event.target.value)}>{context.executionModes.map(executionMode => <option key={executionMode.key} value={executionMode.key}>{executionMode.name}</option>)}</select></label><div className="model active"><BrainCircuit size={18}/><div><b>Motor híbrido</b><small>Regras locais + LLM integrado</small></div><span>Ativo</span></div><div className="hint">Toda classificação é persistida no PostgreSQL e fica disponível no histórico e na fila de revisão.</div></div></div>{results.length > 0 && <div className="card results"><CardHead title="Resultado da pré-classificação"/><div className="result-grid">{results.map(result => <article key={result.id}><p>{result.text}</p><div><span className="tag">{result.module}</span><b>{result.operation}</b></div><footer><span>{Math.round(result.confidence * 100)}% de confiança</span>{result.needsReview && <span className="badge warning">Revisar</span>}</footer></article>)}</div></div>}</section>;
}
