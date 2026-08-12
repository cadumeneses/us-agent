import type { QualityPlan, QualityPlanItem, QualityTestCase, Story } from '../domain/models.js';
import { query, withTransaction } from '../database/pool.js';

const GENERATOR_VERSION = 'quality_plan_v2';

type RecommendationTemplate = {
  questions: string[];
  criteria: string[];
  tests: Array<Pick<QualityTestCase, 'title' | 'type' | 'priority' | 'assumption'>>;
};

const commonSecurityTest = {
  title: 'Impedir a operação para um usuário sem permissão',
  type: 'security',
  priority: 'high',
  assumption: true
} as const;

type QualityPlanContent = Pick<QualityPlan, 'questions' | 'acceptanceCriteria' | 'testCases'>;

type StoryQualityPlan = QualityPlanContent & {
  story: Story;
  health: QualityPlan['health'];
  healthIssues: string[];
  generatorVersion: string;
  status: QualityPlan['status'];
};

function itemId(prefix: 'Q' | 'AC' | 'TC', index: number) {
  return `${prefix}-${String(index + 1).padStart(3, '0')}`;
}

function cleanLines(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(Boolean)
    : [];
}

function defaultExpectedResult(type: QualityTestCase['type'], criterion?: string) {
  if (type === 'positive' && criterion) return criterion;
  if (type === 'security') return 'A operação é bloqueada ou limitada de forma segura, sem expor dados ou permitir acesso indevido.';
  if (type === 'boundary') return 'O sistema trata o limite informado de forma previsível, sem perda ou corrupção de dados.';
  return 'O sistema trata a condição sem concluir uma operação indevida e apresenta o retorno esperado.';
}

function buildGeneratedTestCase(
  testCase: Pick<QualityTestCase, 'title' | 'type' | 'priority' | 'assumption'>,
  index: number,
  criteria: QualityPlanItem[]
): QualityTestCase {
  const linkedCriterion = criteria.length ? criteria[index % criteria.length] : undefined;
  return {
    ...testCase,
    id: itemId('TC', index),
    source: 'taxonomy_heuristic',
    preconditions: ['Ambiente de teste disponível e dados preparados para o cenário.'],
    testData: 'Dados de teste compatíveis com o cenário.',
    steps: ['Preparar as condições necessárias.', testCase.title, 'Registrar o comportamento apresentado pelo sistema.'],
    expectedResult: defaultExpectedResult(testCase.type, linkedCriterion?.text),
    linkedCriteria: linkedCriterion ? [linkedCriterion.id] : [],
    automation: testCase.type === 'positive' ? 'candidate' : 'manual'
  };
}

/**
 * Mantém os rascunhos antigos compatíveis e garante que todo plano tenha a
 * estrutura necessária para execução e rastreabilidade de cobertura.
 */
export function normalizeQualityPlanContent(content: QualityPlanContent): QualityPlanContent {
  const questions = (content.questions ?? []).map((item, index) => ({
    id: item.id || itemId('Q', index),
    text: item.text,
    source: item.source ?? 'taxonomy_heuristic'
  }));
  const acceptanceCriteria = (content.acceptanceCriteria ?? []).map((item, index) => ({
    id: item.id || itemId('AC', index),
    text: item.text,
    source: item.source ?? 'taxonomy_heuristic'
  }));
  const testCases = (content.testCases ?? []).map((testCase, index) => {
    const linkedCriterion = acceptanceCriteria.length ? acceptanceCriteria[index % acceptanceCriteria.length] : undefined;
    const preconditions = cleanLines(testCase.preconditions);
    const steps = cleanLines(testCase.steps);
    const linkedCriteria = cleanLines(testCase.linkedCriteria);
    return {
      id: testCase.id || itemId('TC', index),
      title: testCase.title,
      type: testCase.type,
      priority: testCase.priority,
      source: testCase.source ?? 'taxonomy_heuristic',
      assumption: testCase.assumption,
      preconditions: preconditions.length ? preconditions : ['Ambiente de teste disponível e dados preparados para o cenário.'],
      testData: testCase.testData?.trim() || 'Dados de teste compatíveis com o cenário.',
      steps: steps.length ? steps : ['Preparar as condições necessárias.', testCase.title, 'Registrar o comportamento apresentado pelo sistema.'],
      expectedResult: testCase.expectedResult?.trim() || defaultExpectedResult(testCase.type, linkedCriterion?.text),
      linkedCriteria: linkedCriteria.length
        ? linkedCriteria.filter(id => acceptanceCriteria.some(criterion => criterion.id === id))
        : linkedCriterion ? [linkedCriterion.id] : [],
      automation: testCase.automation === 'candidate' ? 'candidate' as const : 'manual' as const
    };
  });
  return { questions, acceptanceCriteria, testCases };
}

function exportTemplate(format: string): RecommendationTemplate {
  return {
    questions: [
      `Quais dados e seções devem compor o arquivo ${format}?`,
      'Existe um limite de registros para a exportação?'
    ],
    criteria: [
      `O arquivo ${format} contém os mesmos dados autorizados apresentados na consulta.`,
      'A exportação informa claramente quando não existem dados disponíveis.'
    ],
    tests: [
      { title: `Exportar um relatório válido em ${format}`, type: 'positive', priority: 'high', assumption: false },
      { title: 'Exportar um conjunto vazio de dados', type: 'boundary', priority: 'medium', assumption: true },
      { title: 'Exportar um volume elevado de registros', type: 'boundary', priority: 'medium', assumption: true },
      { title: 'Tratar uma falha durante a geração do arquivo', type: 'negative', priority: 'medium', assumption: true },
      commonSecurityTest
    ]
  };
}

function notificationTemplate(channel: string): RecommendationTemplate {
  return {
    questions: [
      `Quais eventos disparam a notificação por ${channel}?`,
      'Existe política de retentativa e prevenção de mensagens duplicadas?'
    ],
    criteria: [
      `A notificação por ${channel} é enviada apenas para destinatários elegíveis.`,
      'Falhas de envio ficam disponíveis para acompanhamento ou retentativa.'
    ],
    tests: [
      { title: `Enviar uma notificação válida por ${channel}`, type: 'positive', priority: 'high', assumption: false },
      { title: 'Tratar um destinatário inválido', type: 'negative', priority: 'high', assumption: true },
      { title: 'Evitar o envio duplicado da mesma notificação', type: 'boundary', priority: 'medium', assumption: true },
      { title: 'Tratar indisponibilidade do canal de entrega', type: 'negative', priority: 'medium', assumption: true }
    ]
  };
}

const templates: Record<string, RecommendationTemplate> = {
  'Registry / Insert data': {
    questions: ['Quais campos são obrigatórios e quais formatos são aceitos?', 'Como o sistema deve tratar registros duplicados?'],
    criteria: ['O sistema valida os campos obrigatórios antes de salvar.', 'Os dados válidos permanecem disponíveis após a conclusão do cadastro.'],
    tests: [
      { title: 'Cadastrar um registro com dados válidos', type: 'positive', priority: 'high', assumption: false },
      { title: 'Tentar cadastrar sem preencher um campo obrigatório', type: 'negative', priority: 'high', assumption: true },
      { title: 'Tentar cadastrar um registro duplicado', type: 'negative', priority: 'medium', assumption: true },
      { title: 'Validar os limites de tamanho dos campos', type: 'boundary', priority: 'medium', assumption: true },
      commonSecurityTest
    ]
  },
  'Registry / Retrieve data': {
    questions: ['Quais filtros, ordenações e critérios de busca devem ser suportados?', 'O que deve ser apresentado quando nenhum resultado for encontrado?'],
    criteria: ['A consulta apresenta somente os registros que atendem aos critérios informados.', 'O sistema apresenta um estado vazio compreensível quando não existem resultados.'],
    tests: [
      { title: 'Consultar dados existentes', type: 'positive', priority: 'high', assumption: false },
      { title: 'Consultar sem encontrar resultados', type: 'negative', priority: 'high', assumption: true },
      { title: 'Combinar filtros de consulta', type: 'boundary', priority: 'medium', assumption: true },
      { title: 'Consultar um conjunto grande de resultados', type: 'boundary', priority: 'medium', assumption: true },
      commonSecurityTest
    ]
  },
  'Registry / Update data': {
    questions: ['Quais campos podem ser alterados?', 'Como conflitos de atualização simultânea devem ser resolvidos?'],
    criteria: ['As alterações válidas são persistidas sem modificar campos não informados.', 'O sistema rejeita valores inválidos antes de atualizar o registro.'],
    tests: [
      { title: 'Atualizar um registro existente com dados válidos', type: 'positive', priority: 'high', assumption: false },
      { title: 'Tentar atualizar um registro inexistente', type: 'negative', priority: 'high', assumption: true },
      { title: 'Tentar atualizar com um valor inválido', type: 'negative', priority: 'high', assumption: true },
      { title: 'Atualizar apenas um dos campos permitidos', type: 'boundary', priority: 'medium', assumption: true },
      commonSecurityTest
    ]
  },
  'Registry / Remove data': {
    questions: ['A remoção é definitiva ou lógica?', 'Existem dependências que devem impedir a remoção?'],
    criteria: ['O sistema solicita ou registra a confirmação antes da remoção.', 'O item removido deixa de aparecer nas consultas aplicáveis.'],
    tests: [
      { title: 'Remover um registro existente', type: 'positive', priority: 'high', assumption: false },
      { title: 'Tentar remover o mesmo registro novamente', type: 'negative', priority: 'medium', assumption: true },
      { title: 'Tentar remover um registro com dependências', type: 'negative', priority: 'high', assumption: true },
      commonSecurityTest
    ]
  },
  'Authentication / Login with username and password': {
    questions: ['Existe limite de tentativas ou bloqueio temporário?', 'Qual mensagem deve ser apresentada para credenciais inválidas?'],
    criteria: ['Credenciais válidas iniciam uma sessão para o usuário correto.', 'Credenciais inválidas não revelam qual dado está incorreto.'],
    tests: [
      { title: 'Entrar com credenciais válidas', type: 'positive', priority: 'high', assumption: false },
      { title: 'Tentar entrar com senha incorreta', type: 'negative', priority: 'high', assumption: false },
      { title: 'Tentar entrar com campos vazios', type: 'boundary', priority: 'medium', assumption: true },
      { title: 'Exceder o limite de tentativas de autenticação', type: 'security', priority: 'high', assumption: true }
    ]
  },
  'Authentication / Login with OAuth': {
    questions: ['Quais provedores OAuth são aceitos?', 'O que acontece quando o e-mail do provedor já pertence a uma conta?'],
    criteria: ['O retorno válido do provedor autentica a conta correspondente.', 'Retornos inválidos ou expirados não iniciam uma sessão.'],
    tests: [
      { title: 'Entrar com uma conta válida do provedor', type: 'positive', priority: 'high', assumption: false },
      { title: 'Cancelar a autorização no provedor', type: 'negative', priority: 'high', assumption: true },
      { title: 'Retornar com state ou token inválido', type: 'security', priority: 'high', assumption: true },
      { title: 'Tentar entrar quando o provedor estiver indisponível', type: 'negative', priority: 'medium', assumption: true }
    ]
  },
  'Authentication / Password recovery': {
    questions: ['Por quanto tempo o link ou código permanece válido?', 'Existe limite de solicitações por usuário ou endereço IP?'],
    criteria: ['A resposta não revela se o usuário está cadastrado.', 'Um token expirado ou já utilizado não permite alterar a senha.'],
    tests: [
      { title: 'Recuperar a senha com um token válido', type: 'positive', priority: 'high', assumption: false },
      { title: 'Solicitar recuperação para um usuário inexistente', type: 'security', priority: 'high', assumption: true },
      { title: 'Tentar utilizar um token expirado', type: 'negative', priority: 'high', assumption: true },
      { title: 'Tentar reutilizar um token consumido', type: 'security', priority: 'high', assumption: true },
      { title: 'Exceder o limite de solicitações', type: 'boundary', priority: 'medium', assumption: true }
    ]
  },
  'Management / Export report to PDF': exportTemplate('PDF'),
  'Management / Export report to XLS': exportTemplate('XLS'),
  'Management / Notify by email': notificationTemplate('e-mail'),
  'Management / Notify via app': notificationTemplate('aplicativo'),
  'Management / View dashboard': {
    questions: ['Quais indicadores devem aparecer e como são calculados?', 'Quais perfis podem visualizar cada informação?'],
    criteria: ['Os indicadores exibidos correspondem aos dados disponíveis para o usuário.', 'O dashboard apresenta estados de carregamento, vazio e erro.'],
    tests: [
      { title: 'Visualizar o dashboard com dados disponíveis', type: 'positive', priority: 'high', assumption: false },
      { title: 'Visualizar o dashboard sem dados', type: 'boundary', priority: 'high', assumption: true },
      { title: 'Tratar falha no carregamento dos indicadores', type: 'negative', priority: 'medium', assumption: true },
      commonSecurityTest
    ]
  }
};

export function buildQualityPlan(story: Story): StoryQualityPlan {
  const template = templates[`${story.module} / ${story.operation}`];
  const healthIssues: string[] = [];
  if (!template || story.module === 'n/a') healthIssues.push('A história ainda não possui uma classificação coberta pela taxonomia.');
  if (['pending_review', 'taxonomy_gap', 'needs_rewrite'].includes(story.status)) healthIssues.push('A classificação precisa de validação humana antes de consolidar o plano.');
  if (story.uncertainty >= 0.33) healthIssues.push('A classificação apresenta incerteza relevante.');

  const questions = (template?.questions ?? [
    'Qual comportamento principal esta história deve entregar?',
    'Quais resultados indicam que a história foi concluída com sucesso?',
    'Quais erros, limites e permissões precisam ser considerados?'
  ]).map((text, index) => ({ id: itemId('Q', index), text, source: 'taxonomy_heuristic' as const }));
  const acceptanceCriteria = (template?.criteria ?? []).map((text, index) => ({ id: itemId('AC', index), text, source: 'taxonomy_heuristic' as const }));

  return {
    story,
    health: !template ? 'needs_clarification' : healthIssues.length ? 'needs_review' : 'ready',
    healthIssues,
    questions,
    acceptanceCriteria,
    testCases: (template?.tests ?? []).map((testCase, index) => buildGeneratedTestCase(testCase, index, acceptanceCriteria)),
    generatorVersion: GENERATOR_VERSION,
    status: 'generated'
  };
}

export function buildQualityPlans(stories: Story[]): StoryQualityPlan[] {
  return stories.map(buildQualityPlan);
}

export function buildQualityPlanScope(input: {
  id: string;
  project: string;
  sprint: string;
  stories: Story[];
  storyPlans?: StoryQualityPlan[];
  status?: QualityPlan['status'];
  updatedAt?: string;
  updatedBy?: string;
}): QualityPlan {
  const storyPlans = input.storyPlans ?? buildQualityPlans(input.stories);
  const questions: QualityPlan['questions'] = [];
  const acceptanceCriteria: QualityPlan['acceptanceCriteria'] = [];
  const testCases: QualityPlan['testCases'] = [];
  const healthIssues: string[] = [];

  storyPlans.forEach(storyPlan => {
    const prefix = `US-${storyPlan.story.id}`;
    const criterionIds = new Map(storyPlan.acceptanceCriteria.map(item => [item.id, `${prefix}-${item.id}`]));
    storyPlan.questions.forEach(item => questions.push({ ...item, id: `${prefix}-${item.id}`, text: `${prefix} · ${item.text}` }));
    storyPlan.acceptanceCriteria.forEach(item => acceptanceCriteria.push({ ...item, id: `${prefix}-${item.id}`, text: `${prefix} · ${item.text}` }));
    storyPlan.testCases.forEach(testCase => testCases.push({
      ...testCase,
      id: `${prefix}-${testCase.id}`,
      title: `${prefix} · ${testCase.title}`,
      linkedCriteria: testCase.linkedCriteria.map(id => criterionIds.get(id) ?? id)
    }));
    healthIssues.push(...storyPlan.healthIssues.map(issue => `${prefix}: ${issue}`));
  });

  const health = !storyPlans.length || storyPlans.some(plan => plan.health === 'needs_clarification')
    ? 'needs_clarification'
    : storyPlans.some(plan => plan.health === 'needs_review') ? 'needs_review' : 'ready';
  if (!storyPlans.length) healthIssues.push('Selecione ao menos uma User Story para compor o plano desta sprint.');

  return {
    id: input.id,
    project: input.project,
    sprint: input.sprint,
    stories: input.stories,
    health,
    healthIssues,
    questions,
    acceptanceCriteria,
    testCases,
    generatorVersion: 'quality_plan_scope_v1',
    status: input.status ?? 'generated',
    updatedAt: input.updatedAt,
    updatedBy: input.updatedBy
  };
}

type StoredStoryPlan = {
  classification_id: string;
  content: Pick<QualityPlan, 'questions' | 'acceptanceCriteria' | 'testCases'>;
  status: 'draft' | 'approved';
  updated_at: string;
  updated_by: string | null;
};

type StoredScope = {
  id: string;
  project: string;
  sprint: string;
  content: QualityPlanContent;
  status: 'draft' | 'approved';
  updated_at: string;
  updated_by: string | null;
  story_ids: string[];
};

async function loadLegacyStoryPlans(stories: Story[]): Promise<StoryQualityPlan[]> {
  const generated = buildQualityPlans(stories);
  const saved = await query<StoredStoryPlan>(`
    SELECT
      draft.classification_id::text,
      draft.content,
      draft.status,
      draft.updated_at::text,
      user_account.display_name AS updated_by
    FROM quality_plan_drafts draft
    LEFT JOIN app_users user_account ON user_account.id = draft.updated_by
  `);
  const byClassification = new Map(saved.rows.map(row => [row.classification_id, row]));

  return generated.map(plan => {
    const custom = byClassification.get(plan.story.id);
    if (!custom) return plan;
    return {
      ...plan,
      ...normalizeQualityPlanContent({
        questions: custom.content.questions ?? plan.questions,
        acceptanceCriteria: custom.content.acceptanceCriteria ?? plan.acceptanceCriteria,
        testCases: custom.content.testCases ?? plan.testCases
      }),
      status: custom.status,
      updatedAt: custom.updated_at,
      updatedBy: custom.updated_by ?? undefined
    };
  });
}

export async function loadQualityPlans(stories: Story[]): Promise<QualityPlan[]> {
  const [storyPlans, storedScopes] = await Promise.all([
    loadLegacyStoryPlans(stories),
    query<StoredScope>(`
      SELECT
        scope.id::text,
        project.name AS project,
        scope.sprint,
        scope.content,
        scope.status,
        scope.updated_at::text,
        user_account.display_name AS updated_by,
        COALESCE(array_agg(scope_story.classification_id::text) FILTER (WHERE scope_story.classification_id IS NOT NULL), ARRAY[]::text[]) AS story_ids
      FROM quality_plan_scopes scope
      JOIN projects project ON project.id = scope.project_id
      LEFT JOIN quality_plan_scope_stories scope_story ON scope_story.quality_plan_scope_id = scope.id
      LEFT JOIN app_users user_account ON user_account.id = scope.updated_by
      GROUP BY scope.id, project.name, user_account.display_name
      ORDER BY project.name, scope.updated_at DESC
    `)
  ]);
  const storyPlansById = new Map(storyPlans.map(plan => [plan.story.id, plan]));
  const storiesById = new Map(stories.map(story => [story.id, story]));
  const scopedStoryIds = new Set(storedScopes.rows.flatMap(scope => scope.story_ids));
  const savedPlans = storedScopes.rows.map(scope => {
    const selectedStoryPlans = scope.story_ids.map(id => storyPlansById.get(id)).filter((plan): plan is StoryQualityPlan => Boolean(plan));
    const generated = buildQualityPlanScope({
      id: scope.id,
      project: scope.project,
      sprint: scope.sprint,
      stories: scope.story_ids.map(id => storiesById.get(id)).filter((story): story is Story => Boolean(story)),
      storyPlans: selectedStoryPlans,
      status: scope.status,
      updatedAt: scope.updated_at,
      updatedBy: scope.updated_by ?? undefined
    });
    return {
      ...generated,
      ...normalizeQualityPlanContent(scope.content),
      status: scope.status,
      updatedAt: scope.updated_at,
      updatedBy: scope.updated_by ?? undefined
    };
  });
  const defaultPlans = [...new Set(stories.map(story => story.project))]
    .map(project => {
      const projectStories = stories.filter(story => story.project === project && !scopedStoryIds.has(story.id));
      if (!projectStories.length) return null;
      return buildQualityPlanScope({
        id: `new:${project}:backlog`,
        project,
        sprint: 'Backlog',
        stories: projectStories,
        storyPlans: projectStories.map(story => storyPlansById.get(story.id)!).filter(Boolean)
      });
    })
    .filter((plan): plan is QualityPlan => Boolean(plan));
  return [...savedPlans, ...defaultPlans];
}

export type SaveQualityPlanInput = QualityPlanContent & {
  status: 'draft' | 'approved';
  storyIds: string[];
};

async function validateStoriesInProject(projectId: string, storyIds: string[]) {
  const uniqueIds = [...new Set(storyIds)];
  const result = await query<{ id: string }>(`
    SELECT classification.id::text AS id
    FROM classifications classification
    JOIN stories story ON story.id = classification.story_id
    WHERE story.project_id = $1 AND classification.id = ANY($2::bigint[])
  `, [projectId, uniqueIds]);
  if (result.rows.length !== uniqueIds.length) throw new Error('Uma ou mais histórias não pertencem ao projeto selecionado.');
  return uniqueIds;
}

async function replaceScopeStories(scopeId: string, storyIds: string[]) {
  await withTransaction(async client => {
    await client.query('DELETE FROM quality_plan_scope_stories WHERE quality_plan_scope_id = $1', [scopeId]);
    if (storyIds.length) await client.query(`
      INSERT INTO quality_plan_scope_stories (quality_plan_scope_id, classification_id)
      SELECT $1, value::bigint FROM unnest($2::text[]) AS value
    `, [scopeId, storyIds]);
  });
}

export async function createQualityPlanScope(userId: string, input: SaveQualityPlanInput & { project: string; sprint: string }) {
  const project = await query<{ id: string }>('SELECT id::text FROM projects WHERE name = $1', [input.project]);
  if (!project.rows[0]) return null;
  const sprint = await query<{ id: string }>(`
    INSERT INTO project_sprints (project_id, name, status)
    VALUES ($1, $2, 'planning')
    ON CONFLICT (project_id, name) DO UPDATE SET name = EXCLUDED.name
    RETURNING id::text
  `, [project.rows[0].id, input.sprint]);
  const storyIds = await validateStoriesInProject(project.rows[0].id, input.storyIds);
  const content = normalizeQualityPlanContent(input);
  const result = await query<{ id: string; updated_at: string }>(`
    INSERT INTO quality_plan_scopes (project_id, sprint_id, sprint, content, status, updated_by)
    VALUES ($1, $2, $3, $4::jsonb, $5, $6)
    ON CONFLICT (sprint_id) DO NOTHING
    RETURNING id::text, updated_at::text
  `, [project.rows[0].id, sprint.rows[0].id, input.sprint, JSON.stringify(content), input.status, userId]);
  if (!result.rows[0]) return { conflict: true } as const;
  await replaceScopeStories(result.rows[0].id, storyIds);
  return { ...result.rows[0], conflict: false } as const;
}

export async function saveQualityPlanScope(scopeId: string, userId: string, input: SaveQualityPlanInput) {
  const content = normalizeQualityPlanContent(input);
  const scope = await query<{ project_id: string }>('SELECT project_id::text FROM quality_plan_scopes WHERE id = $1', [scopeId]);
  if (!scope.rows[0]) return null;
  const storyIds = await validateStoriesInProject(scope.rows[0].project_id, input.storyIds);
  const result = await query<{ updated_at: string }>(`
    UPDATE quality_plan_scopes SET
      content = $2::jsonb,
      status = $3,
      updated_by = $4,
      updated_at = NOW()
    WHERE id = $1
    RETURNING updated_at::text
  `, [
    scopeId,
    JSON.stringify(content),
    input.status,
    userId
  ]);
  await replaceScopeStories(scopeId, storyIds);
  return result.rows[0] ?? null;
}
