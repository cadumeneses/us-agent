import { useState } from 'react';
import { X } from 'lucide-react';
import type { StoryDetails } from '../types/models';
import { emptyTechnologies, TechnologyFields } from './ResearchProfile';

// Ramos (2019), table 5.1 and appendix D. Existing values remain editable.
const attributes: Record<string, string[]> = {
  Performance: ['response_time', 'capacity', 'transit_delay', 'efficiency_compliance'],
  Reliability: ['availability', 'integrity', 'fault_tolerance', 'recoverability'],
  Security: ['confidentiality', 'access_control', 'authentication']
};
export type StoryEditor = { kind: 'task' | 'functional' | 'nonFunctional'; index?: number };

export function StoryItemModal({ editor, details, saving, onClose, onSave }: {
  editor: StoryEditor; details: StoryDetails; saving: boolean;
  onClose: () => void; onSave: (details: StoryDetails) => void;
}) {
  const existing = editor.index === undefined ? undefined : editor.kind === 'task' ? details.tasks[editor.index] : editor.kind === 'functional' ? details.functionalRequirements[editor.index] : details.nonFunctionalRequirements[editor.index];
  const [text, setText] = useState(existing ? ('title' in existing ? existing.title : existing.description) : '');
  const [done, setDone] = useState(existing && 'done' in existing ? existing.done : false);
  const [category, setCategory] = useState(existing && 'category' in existing ? existing.category ?? '' : '');
  const [technologies, setTechnologies] = useState(existing && 'technologies' in existing ? existing.technologies ?? emptyTechnologies() : emptyTechnologies());
  const [type, setType] = useState(existing && 'type' in existing && typeof existing.type === 'string' ? existing.type : 'Performance');
  const [metric, setMetric] = useState(existing && 'metric' in existing && typeof existing.metric === 'string' ? existing.metric : 'response_time');
  const title = editor.kind === 'task' ? 'Tarefa' : editor.kind === 'functional' ? 'Requisito funcional' : 'Requisito não funcional';
  const types = [...new Set([...Object.keys(attributes), type])];
  const metrics = [...new Set([...(attributes[type] ?? []), metric])];
  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!text.trim() || saving) return;
    const id = existing?.id ?? `new-${Date.now()}`;
    if (editor.kind === 'task') {
      const items = [...details.tasks];
      const item = { id, title: text.trim(), done, category: category.trim(), technologies };
      editor.index === undefined ? items.push(item) : items.splice(editor.index, 1, item);
      onSave({ ...details, tasks: items });
    } else if (editor.kind === 'functional') {
      const items = [...details.functionalRequirements];
      const item = { id, description: text.trim() };
      editor.index === undefined ? items.push(item) : items.splice(editor.index, 1, item);
      onSave({ ...details, functionalRequirements: items });
    } else {
      const items = [...details.nonFunctionalRequirements];
      const item = { id, description: text.trim(), type, metric };
      editor.index === undefined ? items.push(item) : items.splice(editor.index, 1, item);
      onSave({ ...details, nonFunctionalRequirements: items });
    }
  }
  return <div className="modal-backdrop"><form className="project-modal card research-item-modal" onSubmit={submit}>
    <div className="modal-head"><div><span>{editor.index === undefined ? 'ADICIONAR' : 'EDITAR'}</span><h2>{title}</h2></div><button type="button" disabled={saving} onClick={onClose} aria-label="Fechar"><X size={18}/></button></div>
    <fieldset disabled={saving}>
      <label>{editor.kind === 'task' ? 'Descrição da tarefa' : editor.kind === 'nonFunctional' ? 'Sentença do RNF' : 'Descrição'}<textarea required maxLength={editor.kind === 'task' ? 500 : 1000} value={text} onChange={event => setText(event.target.value)} autoFocus/></label>
      {editor.kind === 'task' && <>
        <label>Categoria da tarefa<input value={category} maxLength={160} onChange={event => setCategory(event.target.value)} placeholder="Ex.: Associar entidades no banco de dados"/></label>
        <p>Use a mesma categoria para tarefas equivalentes. As tecnologias complementam o perfil do projeto.</p>
        <TechnologyFields value={technologies} onChange={setTechnologies}/>
        <label className="inline-check"><input type="checkbox" checked={done} onChange={event => setDone(event.target.checked)}/> Concluída</label>
      </>}
      {editor.kind === 'nonFunctional' && <div className="nfr-selects">
        <label>Tipo<select value={type} onChange={event => { setType(event.target.value); setMetric(attributes[event.target.value]?.[0] ?? metric); }}>{types.map(value => <option key={value}>{value}</option>)}</select></label>
        <label>Atributo<select value={metric} onChange={event => setMetric(event.target.value)}>{metrics.map(value => <option key={value}>{value}</option>)}</select></label>
      </div>}
    </fieldset>
    <div className="modal-actions"><button type="button" disabled={saving} onClick={onClose}>Cancelar</button><button className="primary" disabled={saving}>Salvar</button></div>
  </form></div>;
}
