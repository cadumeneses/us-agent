import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronRight, CircleHelp, Plus, Save, ShieldCheck, Trash2 } from 'lucide-react';
import { CardHead, PageTitle } from '../components/ui';
import { api } from '../services/api';
import type { QualityPlan } from '../types/models';
import { useWorkspace } from '../services/workspace';

const healthLabels = {
  ready: 'Pronto para testar',
  needs_clarification: 'Precisa de refinamento',
  needs_review: 'Revisão recomendada'
} as const;

const typeLabels = {
  positive: 'Positivo',
  negative: 'Negativo',
  boundary: 'Limite',
  security: 'Segurança'
} as const;

export function QualityPlanPage() {
  const workspace = useWorkspace();
  const [plans, setPlans] = useState<QualityPlan[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.qualityPlans()
      .then(items => {
        setPlans(items);
        setSelectedId(items.find(plan => plan.story.id === workspace.selectedStoryId)?.story.id ?? items.find(plan => plan.story.project === workspace.selectedProject)?.story.id ?? items[0]?.story.id ?? '');
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, [workspace.selectedProject, workspace.selectedStoryId]);

  const visiblePlans = useMemo(() => {
    const term = search.trim().toLowerCase();
    return plans.filter(plan => plan.story.project === workspace.selectedProject && (!term || `${plan.story.text} ${plan.story.project} ${plan.story.module} ${plan.story.operation}`.toLowerCase().includes(term)));
  }, [plans, search, workspace.selectedProject]);
  const selected = plans.find(plan => plan.story.id === selectedId) ?? visiblePlans[0];

  function changePlan(next: QualityPlan) {
    setPlans(current => current.map(plan => plan.story.id === next.story.id ? next : plan));
    setNotice('');
  }

  async function savePlan(status: 'draft' | 'approved') {
    if (!selected) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const saved = await api.saveQualityPlan(selected, status);
      changePlan({ ...selected, status, updatedAt: saved.updatedAt, updatedBy: saved.updatedBy });
      setNotice(status === 'approved' ? 'Plano aprovado e salvo.' : 'Rascunho salvo.');
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return <section className="page">
    <PageTitle eyebrow="QUALIDADE" title="Plano de qualidade">Edite livremente perguntas, critérios de aceitação e testes antes de aprovar o plano.</PageTitle>
    <div className="quality-summary">
      <div><CheckCircle2 size={18}/><strong>{plans.filter(plan => plan.status === 'approved').length}</strong><span>planos aprovados</span></div>
      <div><CircleHelp size={18}/><strong>{plans.filter(plan => plan.health === 'needs_clarification').length}</strong><span>precisam de refinamento</span></div>
      <div><ShieldCheck size={18}/><strong>{plans.reduce((total, plan) => total + plan.testCases.length, 0)}</strong><span>testes no planejamento</span></div>
    </div>
    <div className="quality-origin-note"><ShieldCheck size={18}/><div><b>Quem está sugerindo estes pontos?</b><p>As sugestões iniciais vêm de heurísticas versionadas da taxonomia WIS, selecionadas pela classificação da história. Itens alterados ou adicionados por você são identificados como “Usuário”.</p></div></div>
    {error && <p className="inline-error">{error}</p>}
    {notice && <p className="inline-success">{notice}</p>}
    {loading ? <div className="state">Gerando planos de qualidade…</div> : <div className="quality-grid">
      <div className="card quality-list">
        <CardHead title={`Histórias (${visiblePlans.length})`}/>
        <div className="quality-search"><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Filtrar histórias…"/></div>
        {visiblePlans.map(plan => <button className={selected?.story.id === plan.story.id ? 'quality-story selected' : 'quality-story'} onClick={() => { setSelectedId(plan.story.id); workspace.selectStory(plan.story.id); setNotice(''); setError(''); }} key={plan.story.id}>
          <span className={`health-indicator ${plan.status === 'approved' ? 'ready' : plan.health}`}/>
          <div><b>{plan.story.text}</b><small>{plan.story.project} · {plan.status === 'generated' ? 'não editado' : plan.status === 'draft' ? 'rascunho' : 'aprovado'}</small></div>
          <ChevronRight size={16}/>
        </button>)}
        {!visiblePlans.length && <div className="empty">Nenhuma história encontrada.</div>}
      </div>
      <div className="quality-detail">
        {selected
          ? <QualityPlanEditor plan={selected} onChange={changePlan} onSave={savePlan} saving={saving}/>
          : <div className="card empty large">Classifique uma história para criar seu plano de qualidade.</div>}
      </div>
    </div>}
  </section>;
}

type EditorProps = {
  plan: QualityPlan;
  onChange: (plan: QualityPlan) => void;
  onSave: (status: 'draft' | 'approved') => void;
  saving: boolean;
};

function QualityPlanEditor({ plan, onChange, onSave, saving }: EditorProps) {
  function updateList(kind: 'questions' | 'acceptanceCriteria', index: number, text: string) {
    onChange({
      ...plan,
      [kind]: plan[kind].map((item, itemIndex) => itemIndex === index ? { text, source: 'user' as const } : item)
    });
  }

  function removeListItem(kind: 'questions' | 'acceptanceCriteria', index: number) {
    onChange({ ...plan, [kind]: plan[kind].filter((_, itemIndex) => itemIndex !== index) });
  }

  function addListItem(kind: 'questions' | 'acceptanceCriteria') {
    onChange({ ...plan, [kind]: [...plan[kind], { text: '', source: 'user' }] });
  }

  function updateTest(index: number, patch: Partial<QualityPlan['testCases'][number]>) {
    onChange({
      ...plan,
      testCases: plan.testCases.map((test, testIndex) => testIndex === index ? { ...test, ...patch, source: 'user' } : test)
    });
  }

  return <>
    <div className="card quality-hero">
      <div className="quality-hero-top">
        <span className={`badge health-${plan.health}`}>{healthLabels[plan.health]}</span>
        <span>{plan.status === 'generated' ? 'Plano ainda não salvo' : `${plan.status === 'draft' ? 'Rascunho' : 'Aprovado'}${plan.updatedBy ? ` por ${plan.updatedBy}` : ''}`}</span>
      </div>
      <h2>{plan.story.text}</h2>
      <div className="quality-meta"><span className="tag">{plan.story.module}</span><b>{plan.story.operation}</b><span>{Math.round(plan.story.confidence * 100)}% de confiança</span></div>
      {plan.healthIssues.length > 0 && <div className="quality-warning"><AlertCircle size={17}/><div>{plan.healthIssues.map(issue => <p key={issue}>{issue}</p>)}</div></div>}
    </div>

    <EditableTextSection
      title="Perguntas para refinamento"
      items={plan.questions}
      onChange={(index, text) => updateList('questions', index, text)}
      onRemove={index => removeListItem('questions', index)}
      onAdd={() => addListItem('questions')}
      placeholder="Digite uma pergunta para o refinamento…"
    />

    <EditableTextSection
      title="Critérios de aceitação"
      items={plan.acceptanceCriteria}
      onChange={(index, text) => updateList('acceptanceCriteria', index, text)}
      onRemove={index => removeListItem('acceptanceCriteria', index)}
      onAdd={() => addListItem('acceptanceCriteria')}
      placeholder="Digite um critério de aceitação…"
    />

    <div className="card quality-section">
      <div className="editable-head"><h2>Casos de teste ({plan.testCases.length})</h2><button onClick={() => onChange({ ...plan, testCases: [...plan.testCases, { title: '', type: 'positive', priority: 'medium', assumption: false, source: 'user' }] })}><Plus size={14}/> Adicionar teste</button></div>
      <div className="editable-tests">
        {plan.testCases.map((testCase, index) => <article key={index}>
          <div className="editable-test-head">
            <span className={`source-chip ${testCase.source}`}>{testCase.source === 'user' ? 'Usuário' : 'Taxonomia WIS'}</span>
            <button className="remove-item" onClick={() => onChange({ ...plan, testCases: plan.testCases.filter((_, testIndex) => testIndex !== index) })} aria-label="Remover teste"><Trash2 size={14}/></button>
          </div>
          <input value={testCase.title} onChange={event => updateTest(index, { title: event.target.value })} placeholder="Descreva o caso de teste…"/>
          <div className="test-options">
            <select value={testCase.type} onChange={event => updateTest(index, { type: event.target.value as typeof testCase.type })}>{Object.entries(typeLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select>
            <select value={testCase.priority} onChange={event => updateTest(index, { priority: event.target.value as typeof testCase.priority })}><option value="high">Prioridade alta</option><option value="medium">Prioridade média</option></select>
            <label className="inline-check"><input type="checkbox" checked={testCase.assumption} onChange={event => updateTest(index, { assumption: event.target.checked })}/> Regra a confirmar</label>
          </div>
        </article>)}
        {!plan.testCases.length && <div className="empty">Nenhum teste no plano. Você pode adicionar o primeiro.</div>}
      </div>
    </div>

    <div className="quality-savebar">
      <span>As sugestões são um ponto de partida: você decide o conteúdo final.</span>
      <div><button disabled={saving} onClick={() => onSave('draft')}><Save size={15}/> Salvar rascunho</button><button disabled={saving} className="primary" onClick={() => onSave('approved')}><CheckCircle2 size={15}/>{saving ? 'Salvando…' : 'Aprovar plano'}</button></div>
    </div>
  </>;
}

type TextSectionProps = {
  title: string;
  items: QualityPlan['questions'];
  onChange: (index: number, text: string) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
  placeholder: string;
};

function EditableTextSection({ title, items, onChange, onRemove, onAdd, placeholder }: TextSectionProps) {
  return <div className="card quality-section">
    <div className="editable-head"><h2>{title} ({items.length})</h2><button onClick={onAdd}><Plus size={14}/> Adicionar</button></div>
    <div className="editable-list">
      {items.map((item, index) => <div key={index}>
        <span className={`source-chip ${item.source}`}>{item.source === 'user' ? 'Usuário' : 'Taxonomia WIS'}</span>
        <input value={item.text} onChange={event => onChange(index, event.target.value)} placeholder={placeholder}/>
        <button className="remove-item" onClick={() => onRemove(index)} aria-label="Remover item"><Trash2 size={14}/></button>
      </div>)}
      {!items.length && <div className="empty">Nenhum item. Adicione livremente.</div>}
    </div>
  </div>;
}
