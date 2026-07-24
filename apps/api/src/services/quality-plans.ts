import type { QualityPlan, QualityTestCase, Story } from '../domain/models.js';
import { query } from '../database/pool.js';

const GENERATOR_VERSION = 'quality_plan_v1';

type RecommendationTemplate = {
  questions: string[];
  criteria: string[];
  tests: Array<Omit<QualityTestCase, 'source'>>;
};

const commonSecurityTest = {
  title: 'Impedir a operação para um usuário sem permissão',
  type: 'security',
  priority: 'high',
  assumption: true
} as const;

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

export function buildQualityPlan(story: Story): QualityPlan {
  const template = templates[`${story.module} / ${story.operation}`];
  const healthIssues: string[] = [];
  if (!template || story.module === 'n/a') healthIssues.push('A história ainda não possui uma classificação coberta pela taxonomia.');
  if (['pending_review', 'taxonomy_gap', 'needs_rewrite'].includes(story.status)) healthIssues.push('A classificação precisa de validação humana antes de consolidar o plano.');
  if (story.uncertainty >= 0.33) healthIssues.push('A classificação apresenta incerteza relevante.');

  return {
    story,
    health: !template ? 'needs_clarification' : healthIssues.length ? 'needs_review' : 'ready',
    healthIssues,
    questions: (template?.questions ?? [
      'Qual comportamento principal esta história deve entregar?',
      'Quais resultados indicam que a história foi concluída com sucesso?',
      'Quais erros, limites e permissões precisam ser considerados?'
    ]).map(text => ({ text, source: 'taxonomy_heuristic' })),
    acceptanceCriteria: (template?.criteria ?? []).map(text => ({ text, source: 'taxonomy_heuristic' })),
    testCases: (template?.tests ?? []).map(testCase => ({ ...testCase, source: 'taxonomy_heuristic' })),
    generatorVersion: GENERATOR_VERSION,
    status: 'generated'
  };
}

export function buildQualityPlans(stories: Story[]): QualityPlan[] {
  return stories.map(buildQualityPlan);
}

type StoredPlan = {
  classification_id: string;
  content: Pick<QualityPlan, 'questions' | 'acceptanceCriteria' | 'testCases'>;
  status: 'draft' | 'approved';
  updated_at: string;
  updated_by: string | null;
};

export async function loadQualityPlans(stories: Story[]): Promise<QualityPlan[]> {
  const generated = buildQualityPlans(stories);
  const saved = await query<StoredPlan>(`
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
      ...custom.content,
      status: custom.status,
      updatedAt: custom.updated_at,
      updatedBy: custom.updated_by ?? undefined
    };
  });
}

export type SaveQualityPlanInput = Pick<QualityPlan, 'questions' | 'acceptanceCriteria' | 'testCases'> & {
  status: 'draft' | 'approved';
};

export async function saveQualityPlan(classificationId: string, userId: string, input: SaveQualityPlanInput) {
  const result = await query<{ updated_at: string }>(`
    INSERT INTO quality_plan_drafts (classification_id, content, status, updated_by)
    SELECT $1, $2::jsonb, $3, $4
    WHERE EXISTS (SELECT 1 FROM classifications WHERE id = $1)
    ON CONFLICT (classification_id) DO UPDATE SET
      content = EXCLUDED.content,
      status = EXCLUDED.status,
      updated_by = EXCLUDED.updated_by,
      updated_at = NOW()
    RETURNING updated_at::text
  `, [
    classificationId,
    JSON.stringify({
      questions: input.questions,
      acceptanceCriteria: input.acceptanceCriteria,
      testCases: input.testCases
    }),
    input.status,
    userId
  ]);
  return result.rows[0] ?? null;
}
