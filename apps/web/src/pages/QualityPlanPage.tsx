import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowRight, CheckCircle2, ChevronRight, CircleHelp, Copy, ListChecks, Plus, Save, ShieldCheck, Target, Trash2 } from 'lucide-react';
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

type TestType = QualityPlan['testCases'][number]['type'];

function nextId(prefix: string, items: Array<{ id: string }>) {
  let number = items.length + 1;
  while (items.some(item => item.id === `${prefix}-${String(number).padStart(3, '0')}`)) number += 1;
  return `${prefix}-${String(number).padStart(3, '0')}`;
}

function toLines(value: string) {
  return value.split('\n').map(line => line.trim()).filter(Boolean);
}

function fromLines(value: string[]) {
  return value.join('\n');
}

function expectedFor(type: TestType, criterion?: string) {
  if (type === 'positive' && criterion) return criterion;
  if (type === 'security') return 'A operação é bloqueada ou limitada de forma segura, sem expor dados ou permitir acesso indevido.';
  if (type === 'boundary') return 'O sistema trata o limite informado de forma previsível, sem perda ou corrupção de dados.';
  return 'O sistema trata a condição sem concluir uma operação indevida e apresenta o retorno esperado.';
}

function createTestCase(plan: QualityPlan, type: TestType): QualityPlan['testCases'][number] {
  const covered = new Set(plan.testCases.flatMap(testCase => testCase.linkedCriteria));
  const criterion = plan.acceptanceCriteria.find(item => !covered.has(item.id)) ?? plan.acceptanceCriteria[0];
  const label = typeLabels[type].toLowerCase();
  return {
    id: nextId('TC', plan.testCases),
    title: `Novo cenário ${label}`,
    type,
    priority: type === 'security' ? 'high' : 'medium',
    source: 'user',
    assumption: true,
    preconditions: ['Ambiente de teste disponível e dados preparados para o cenário.'],
    testData: 'Defina os dados de teste necessários.',
    steps: ['Preparar as condições necessárias.', 'Executar a ação do cenário.', 'Registrar o comportamento apresentado pelo sistema.'],
    expectedResult: expectedFor(type, criterion?.text),
    linkedCriteria: criterion ? [criterion.id] : [],
    automation: type === 'positive' ? 'candidate' : 'manual'
  };
}

function coverageFor(plan: QualityPlan) {
  return plan.acceptanceCriteria.map(criterion => ({
    criterion,
    testCases: plan.testCases.filter(testCase => testCase.linkedCriteria.includes(criterion.id))
  }));
}

function isExecutable(testCase: QualityPlan['testCases'][number]) {
  return Boolean(testCase.title.trim() && testCase.steps.length && testCase.expectedResult.trim());
}

export function QualityPlanPage() {
  const workspace = useWorkspace();
  const [searchParams] = useSearchParams();
  const [plans, setPlans] = useState<QualityPlan[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [search, setSearch] = useState('');
  const [creatingSprint, setCreatingSprint] = useState(false);
  const [sprintName, setSprintName] = useState('');
  const [scopeStoryIds, setScopeStoryIds] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.qualityPlans()
      .then(items => {
        setPlans(items);
        const requestedSprint = searchParams.get('sprint');
        setSelectedId(items.find(plan => plan.project === workspace.selectedProject && plan.sprint === requestedSprint)?.id ?? items.find(plan => plan.project === workspace.selectedProject)?.id ?? items[0]?.id ?? '');
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, [workspace.selectedProject, workspace.selectedStoryId, searchParams]);

  const visiblePlans = useMemo(() => {
    const term = search.trim().toLowerCase();
    return plans.filter(plan => plan.project === workspace.selectedProject && (!term || `${plan.project} ${plan.sprint} ${plan.stories.map(story => `${story.text} ${story.module} ${story.operation}`).join(' ')}`.toLowerCase().includes(term)));
  }, [plans, search, workspace.selectedProject]);
  const selected = plans.find(plan => plan.id === selectedId) ?? visiblePlans[0];

  function changePlan(next: QualityPlan) {
    setPlans(current => current.map(plan => plan.id === next.id ? next : plan));
    setNotice('');
  }

  function startSprint() {
    const stories = workspace.stories.filter(story => story.project === workspace.selectedProject);
    setScopeStoryIds(stories.map(story => story.id));
    setSprintName('');
    setCreatingSprint(true);
  }

  async function createSprint() {
    if (!workspace.selectedProject || !sprintName.trim() || !scopeStoryIds.length) {
      setError('Informe o nome da sprint e selecione ao menos uma User Story.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const created = await api.createQualityPlanScope(workspace.selectedProject, sprintName.trim(), scopeStoryIds);
      setPlans(await api.qualityPlans());
      setSelectedId(created.id);
      setCreatingSprint(false);
      setNotice(`Plano da ${created.sprint} criado.`);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function savePlan(status: 'draft' | 'approved') {
    if (!selected) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const persisted = selected.id.startsWith('new:')
        ? await api.createQualityPlanScope(selected.project, selected.sprint, selected.stories.map(story => story.id))
        : selected;
      const saved = await api.saveQualityPlan({ ...selected, id: persisted.id }, status);
      const next = { ...selected, id: persisted.id, status, updatedAt: saved.updatedAt, updatedBy: saved.updatedBy };
      setPlans(current => [...current.filter(plan => plan.id !== selected.id && plan.id !== persisted.id), next]);
      setSelectedId(persisted.id);
      setNotice(status === 'approved' ? 'Plano aprovado e salvo.' : 'Rascunho salvo.');
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return <section className="page">
    <PageTitle eyebrow="QUALIDADE" title="Plano de qualidade">Planeje a qualidade por projeto e sprint, reunindo as histórias do ciclo em uma única cobertura rastreável.</PageTitle>
    <div className="quality-summary">
      <div><CheckCircle2 size={18}/><strong>{plans.filter(plan => plan.status === 'approved').length}</strong><span>planos aprovados</span></div>
      <div><CircleHelp size={18}/><strong>{plans.filter(plan => plan.health === 'needs_clarification').length}</strong><span>precisam de refinamento</span></div>
      <div><ShieldCheck size={18}/><strong>{plans.reduce((total, plan) => total + plan.testCases.length, 0)}</strong><span>casos no planejamento</span></div>
    </div>
    <div className="quality-origin-note"><ShieldCheck size={18}/><div><b>Plano orientado para execução</b><p>As sugestões da taxonomia agora vêm com pré-condições, dados, passos, resultado esperado e vínculo com critério. Revise os itens marcados como regra a confirmar antes de executar.</p></div></div>
    {error && <p className="inline-error">{error}</p>}
    {notice && <p className="inline-success">{notice}</p>}
    {loading ? <div className="state">Gerando planos de qualidade…</div> : <div className="quality-grid">
      <div className="card quality-list">
        <div className="quality-scope-head"><CardHead title={`Sprints (${visiblePlans.length})`}/><button onClick={startSprint} disabled={!workspace.selectedProject}><Plus size={14}/> Nova sprint</button></div>
        {creatingSprint && <div className="sprint-creator"><label>Sprint<input value={sprintName} onChange={event => setSprintName(event.target.value)} placeholder="Ex.: Sprint 14"/></label><b>Histórias incluídas ({scopeStoryIds.length})</b><div>{workspace.stories.filter(story => story.project === workspace.selectedProject).map(story => <label key={story.id}><input type="checkbox" checked={scopeStoryIds.includes(story.id)} onChange={event => setScopeStoryIds(current => event.target.checked ? [...current, story.id] : current.filter(id => id !== story.id))}/><span>US-{story.id}</span>{story.text}</label>)}</div><footer><button onClick={() => setCreatingSprint(false)}>Cancelar</button><button className="primary" disabled={saving} onClick={createSprint}>Criar plano</button></footer></div>}
        <div className="quality-search"><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Filtrar sprints ou histórias…"/></div>
        {visiblePlans.map(plan => <button className={selected?.id === plan.id ? 'quality-story selected' : 'quality-story'} onClick={() => { setSelectedId(plan.id); workspace.selectProject(plan.project); setNotice(''); setError(''); }} key={plan.id}>
          <span className={`health-indicator ${plan.status === 'approved' ? 'ready' : plan.health}`}/>
          <div><b>{plan.sprint}</b><small>{plan.project} · {plan.stories.length} histórias · {plan.status === 'generated' ? 'não editado' : plan.status === 'draft' ? 'rascunho' : 'aprovado'}</small></div>
          <ChevronRight size={16}/>
        </button>)}
        {!visiblePlans.length && <div className="empty">Nenhuma história encontrada.</div>}
      </div>
      <div className="quality-detail">
        {selected
          ? <QualityPlanEditor key={selected.id} plan={selected} onChange={changePlan} onSave={savePlan} saving={saving}/>
          : <div className="card empty large">Crie uma sprint e selecione as histórias que entrarão no plano de qualidade.</div>}
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
  const coverage = coverageFor(plan);
  const incompleteCases = plan.testCases.filter(testCase => !isExecutable(testCase));
  const uncovered = coverage.filter(item => !item.testCases.length);
  const approvalIssues = [
    ...(plan.testCases.length ? [] : ['Inclua ao menos um caso de teste.']),
    ...(incompleteCases.length ? [`Complete título, passos e resultado esperado em ${incompleteCases.length} caso(s).`] : []),
    ...(uncovered.length ? [`Relacione um caso a ${uncovered.length} critério(s) de aceitação.`] : [])
  ];
  const [validationMessage, setValidationMessage] = useState('');

  function updateList(kind: 'questions' | 'acceptanceCriteria', index: number, text: string) {
    onChange({
      ...plan,
      [kind]: plan[kind].map((item, itemIndex) => itemIndex === index ? { ...item, text, source: 'user' as const } : item)
    });
  }

  function removeListItem(kind: 'questions' | 'acceptanceCriteria', index: number) {
    const removed = plan[kind][index];
    onChange({
      ...plan,
      [kind]: plan[kind].filter((_, itemIndex) => itemIndex !== index),
      ...(kind === 'acceptanceCriteria' ? { testCases: plan.testCases.map(testCase => ({ ...testCase, linkedCriteria: testCase.linkedCriteria.filter(id => id !== removed.id) })) } : {})
    });
  }

  function addListItem(kind: 'questions' | 'acceptanceCriteria') {
    const prefix = kind === 'questions' ? 'Q' : 'AC';
    onChange({ ...plan, [kind]: [...plan[kind], { id: nextId(prefix, plan[kind]), text: '', source: 'user' }] });
  }

  function updateTest(index: number, patch: Partial<QualityPlan['testCases'][number]>) {
    onChange({
      ...plan,
      testCases: plan.testCases.map((testCase, testIndex) => testIndex === index ? { ...testCase, ...patch, source: 'user' } : testCase)
    });
  }

  function duplicateTest(index: number) {
    const testCase = plan.testCases[index];
    onChange({ ...plan, testCases: [...plan.testCases, { ...testCase, id: nextId('TC', plan.testCases), title: `Cópia — ${testCase.title}`, source: 'user', automation: 'manual' }] });
  }

  function requestSave(status: 'draft' | 'approved') {
    if (status === 'approved' && approvalIssues.length) {
      setValidationMessage(approvalIssues.join(' '));
      return;
    }
    setValidationMessage('');
    onSave(status);
  }

  return <>
    <div className="card quality-hero">
      <div className="quality-hero-top">
        <span className={`badge health-${plan.health}`}>{healthLabels[plan.health]}</span>
        <span>{plan.status === 'generated' ? 'Plano ainda não salvo' : `${plan.status === 'draft' ? 'Rascunho' : 'Aprovado'}${plan.updatedBy ? ` por ${plan.updatedBy}` : ''}`}</span>
      </div>
      <h2>{plan.project} · {plan.sprint}</h2>
      <div className="quality-meta"><span className="tag">{plan.stories.length} User Stories</span><b>{plan.testCases.length} casos planejados</b><span>{plan.stories.filter(story => story.status === 'pending_review').length} aguardando revisão</span></div>
      <div className="scope-stories"><b>Escopo da sprint</b>{plan.stories.map(story => <span key={story.id}>US-{story.id} · {story.text}</span>)}</div>
      {plan.healthIssues.length > 0 && <div className="quality-warning"><AlertCircle size={17}/><div>{plan.healthIssues.map(issue => <p key={issue}>{issue}</p>)}</div></div>}
    </div>

    <TestModelingChart plan={plan} coverage={coverage} incompleteCases={incompleteCases.length} approvalIssues={approvalIssues}/>

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

    <div className="card quality-section test-case-section">
      <div className="editable-head test-case-title"><div><h2>Casos de teste ({plan.testCases.length})</h2><span>Modele um caso que outra pessoa consiga executar sem depender de contexto oral.</span></div><div className="test-quick-add"><button onClick={() => onChange({ ...plan, testCases: [...plan.testCases, createTestCase(plan, 'positive')] })}><Plus size={14}/> Cenário</button><button onClick={() => onChange({ ...plan, testCases: [...plan.testCases, createTestCase(plan, 'negative')] })}>+ Negativo</button><button onClick={() => onChange({ ...plan, testCases: [...plan.testCases, createTestCase(plan, 'boundary')] })}>+ Limite</button><button onClick={() => onChange({ ...plan, testCases: [...plan.testCases, createTestCase(plan, 'security')] })}>+ Segurança</button></div></div>
      <div className="editable-tests">
        {plan.testCases.map((testCase, index) => <article key={testCase.id}>
          <div className="editable-test-head">
            <div><span className="test-id">{testCase.id}</span><span className={`source-chip ${testCase.source}`}>{testCase.source === 'user' ? 'Usuário' : 'Taxonomia WIS'}</span></div>
            <div><button className="duplicate-item" onClick={() => duplicateTest(index)} aria-label="Duplicar caso"><Copy size={14}/> Duplicar</button><button className="remove-item" onClick={() => onChange({ ...plan, testCases: plan.testCases.filter((_, testIndex) => testIndex !== index) })} aria-label="Remover teste"><Trash2 size={14}/></button></div>
          </div>
          <label className="test-field"><span>Cenário / objetivo</span><input value={testCase.title} onChange={event => updateTest(index, { title: event.target.value })} placeholder="Descreva o caso de teste…"/></label>
          <div className="test-model-fields">
            <label className="test-field"><span>Pré-condições <small>uma por linha</small></span><textarea value={fromLines(testCase.preconditions)} onChange={event => updateTest(index, { preconditions: toLines(event.target.value) })} placeholder="Perfil, estado e preparação"/></label>
            <label className="test-field"><span>Dados de teste</span><textarea value={testCase.testData} onChange={event => updateTest(index, { testData: event.target.value })} placeholder="Dados, massa ou variação necessária"/></label>
          </div>
          <label className="test-field"><span>Passos <small>um por linha</small></span><textarea value={fromLines(testCase.steps)} onChange={event => updateTest(index, { steps: toLines(event.target.value) })} placeholder="1. Acessar…&#10;2. Preencher…&#10;3. Confirmar…"/></label>
          <label className="test-field"><span>Resultado esperado</span><textarea value={testCase.expectedResult} onChange={event => updateTest(index, { expectedResult: event.target.value })} placeholder="Resultado observável e verificável"/></label>
          <div className="test-options">
            <label>Tipo<select value={testCase.type} onChange={event => updateTest(index, { type: event.target.value as TestType })}>{Object.entries(typeLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
            <label>Prioridade<select value={testCase.priority} onChange={event => updateTest(index, { priority: event.target.value as typeof testCase.priority })}><option value="high">Alta</option><option value="medium">Média</option></select></label>
            <label>Execução<select value={testCase.automation} onChange={event => updateTest(index, { automation: event.target.value as typeof testCase.automation })}><option value="manual">Manual</option><option value="candidate">Candidato à automação</option></select></label>
            <label className="inline-check"><input type="checkbox" checked={testCase.assumption} onChange={event => updateTest(index, { assumption: event.target.checked })}/> Regra a confirmar</label>
          </div>
          <div className="criterion-links"><b><Target size={14}/> Critérios cobertos</b>{plan.acceptanceCriteria.length ? plan.acceptanceCriteria.map(criterion => <label key={criterion.id}><input type="checkbox" checked={testCase.linkedCriteria.includes(criterion.id)} onChange={event => updateTest(index, { linkedCriteria: event.target.checked ? [...testCase.linkedCriteria, criterion.id] : testCase.linkedCriteria.filter(id => id !== criterion.id) })}/><span>{criterion.id}</span>{criterion.text}</label>) : <p>Adicione critérios de aceitação para criar rastreabilidade de cobertura.</p>}</div>
        </article>)}
        {!plan.testCases.length && <div className="empty">Nenhum teste no plano. Use os atalhos acima para criar um cenário já estruturado.</div>}
      </div>
    </div>

    {validationMessage && <p className="inline-error">{validationMessage}</p>}
    <div className="quality-savebar">
      <span>{approvalIssues.length ? 'Complete os gates de qualidade antes de aprovar.' : 'Cobertura e detalhamento prontos para aprovação.'}</span>
      <div><button disabled={saving} onClick={() => requestSave('draft')}><Save size={15}/> Salvar rascunho</button><button disabled={saving} className="primary" onClick={() => requestSave('approved')}><CheckCircle2 size={15}/>{saving ? 'Salvando…' : 'Aprovar plano'}</button></div>
    </div>
  </>;
}

function TestModelingChart({ plan, coverage, incompleteCases, approvalIssues }: { plan: QualityPlan; coverage: ReturnType<typeof coverageFor>; incompleteCases: number; approvalIssues: string[] }) {
  const types = new Set(plan.testCases.map(testCase => testCase.type));
  const assumptions = plan.testCases.filter(testCase => testCase.assumption).length;
  const coveredCriteria = coverage.filter(item => item.testCases.length).length;
  const executableCases = plan.testCases.length - incompleteCases;
  return <section className="card test-modeling-chart">
    <div className="modeling-chart-head"><div><span>CHART DE MODELAGEM</span><h2>Do requisito ao caso executável</h2><p>Use o fluxo para revisar cobertura, profundidade do cenário e prontidão do plano.</p></div><ListChecks size={22}/></div>
    <div className="modeling-flow">
      <ModelStep index="1" title="Critérios" value={`${coveredCriteria}/${coverage.length || 0}`} description={coverage.length ? 'cobertos por testes' : 'a definir'} state={coverage.length && coveredCriteria === coverage.length ? 'ready' : 'attention'}/>
      <ArrowRight size={17}/>
      <ModelStep index="2" title="Cenários" value={String(plan.testCases.length)} description="casos planejados" state={plan.testCases.length ? 'ready' : 'attention'}/>
      <ArrowRight size={17}/>
      <ModelStep index="3" title="Variações" value={`${types.size}/4`} description="positivo, negativo, limite e segurança" state={types.size >= 2 ? 'ready' : 'attention'}/>
      <ArrowRight size={17}/>
      <ModelStep index="4" title="Executáveis" value={`${executableCases}/${plan.testCases.length || 0}`} description="com passos e resultado" state={plan.testCases.length && !incompleteCases ? 'ready' : 'attention'}/>
    </div>
    <div className="modeling-chart-foot"><span className={assumptions ? 'attention' : 'ready'}>{assumptions ? `${assumptions} regra(s) a confirmar` : 'Sem regras pendentes'}</span><span className={approvalIssues.length ? 'attention' : 'ready'}>{approvalIssues.length ? `${approvalIssues.length} gate(s) pendente(s) para aprovação` : 'Plano pronto para aprovação'}</span></div>
  </section>;
}

function ModelStep({ index, title, value, description, state }: { index: string; title: string; value: string; description: string; state: 'ready' | 'attention' }) {
  return <article className={state === 'ready' ? 'model-step ready' : 'model-step attention'}><span>{index}</span><div><b>{title}</b><strong>{value}</strong><small>{description}</small></div></article>;
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
      {items.map((item, index) => <div key={item.id}>
        <span className={`source-chip ${item.source}`}>{item.source === 'user' ? 'Usuário' : 'Taxonomia WIS'}</span>
        <input value={item.text} onChange={event => onChange(index, event.target.value)} placeholder={placeholder}/>
        <button className="remove-item" onClick={() => onRemove(index)} aria-label="Remover item"><Trash2 size={14}/></button>
      </div>)}
      {!items.length && <div className="empty">Nenhum item. Adicione livremente.</div>}
    </div>
  </div>;
}
