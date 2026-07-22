import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { CardHead, PageTitle } from '../components/ui';
import { api } from '../services/api';
import type { Story, Taxonomy } from '../types/models';

const pendingStatuses = new Set(['pending_review', 'taxonomy_gap', 'needs_rewrite']);

export function ReviewPage() {
  const [stories, setStories] = useState<Story[]>([]);
  const [selected, setSelected] = useState<Story>();
  const [taxonomy, setTaxonomy] = useState<Taxonomy>();
  const [module, setModule] = useState('n/a');
  const [operation, setOperation] = useState('n/a');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.stories(), api.taxonomy()])
      .then(([allStories, activeTaxonomy]) => {
        const pending = allStories.filter(story => pendingStatuses.has(story.status));
        setStories(pending);
        setSelected(pending[0]);
        setTaxonomy(activeTaxonomy);
      })
      .catch((reason: Error) => setError(reason.message));
  }, []);

  useEffect(() => {
    if (!selected) return;
    setModule(selected.module);
    setOperation(selected.operation);
    setNotes('');
    setError('');
  }, [selected]);

  function selectModule(nextModule: string) {
    setModule(nextModule);
    setOperation(nextModule === 'n/a' ? 'n/a' : taxonomy?.modules[nextModule]?.[0] ?? 'n/a');
  }

  function finishCurrent() {
    if (!selected) return;
    const remaining = stories.filter(story => story.id !== selected.id);
    setStories(remaining);
    setSelected(remaining[0]);
  }

  async function review(action: 'approve' | 'taxonomy_gap') {
    if (!selected) return;
    setSaving(true);
    setError('');
    try {
      if (action === 'approve') {
        await api.review(selected.id, { action, module, operation, notes: notes || undefined });
      } else {
        await api.review(selected.id, { action, notes: notes || undefined });
      }
      finishCurrent();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const operations = module === 'n/a' ? ['n/a'] : taxonomy?.modules[module] ?? [];

  return <section className="page">
    <PageTitle eyebrow="HUMAN IN THE LOOP" title="Fila de revisão">Valide os casos com maior incerteza antes de consolidar a base.</PageTitle>
    <div className="review-grid">
      <div className="card queue">
        <CardHead title={`Pendentes (${stories.length})`}/>
        {stories.map(story => <button className={selected?.id === story.id ? 'queue-item selected' : 'queue-item'} onClick={() => setSelected(story)} key={story.id}><span className="risk-dot"/><div><b>{story.text}</b><small>{story.module} · {Math.round(story.confidence * 100)}% confiança</small></div><ChevronRight size={16}/></button>)}
        {!stories.length && <div className="empty">A fila está vazia.</div>}
      </div>
      <div className="card review-panel">
        {selected ? <>
          <span className="badge warning">Revisão necessária</span>
          <h2>{selected.text}</h2>
          <div className="score-row"><div><small>Confiança</small><strong>{Math.round(selected.confidence * 100)}%</strong></div><div><small>Consenso</small><strong>{Math.round(selected.consensus * 100)}%</strong></div><div><small>Incerteza</small><strong>{Math.round(selected.uncertainty * 100)}%</strong></div></div>
          <label>Módulo<select value={module} onChange={event => selectModule(event.target.value)}><option value="n/a">n/a</option>{taxonomy && Object.keys(taxonomy.modules).map(name => <option key={name} value={name}>{name}</option>)}</select></label>
          <label>Operação<select value={operation} onChange={event => setOperation(event.target.value)}>{operations.map(name => <option key={name} value={name}>{name}</option>)}</select></label>
          <label>Justificativa<textarea className="small-area" value={notes} onChange={event => setNotes(event.target.value)} placeholder="Registre o motivo da decisão…"/></label>
          {error && <p className="inline-error">{error}</p>}
          <div className="actions"><button disabled={saving} onClick={() => review('taxonomy_gap')}>Marcar lacuna</button><button disabled={saving} className="primary" onClick={() => review('approve')}>{saving ? 'Salvando…' : 'Aprovar classificação'}</button></div>
        </> : <div className="empty large">Selecione uma história para revisar.</div>}
      </div>
    </div>
  </section>;
}
