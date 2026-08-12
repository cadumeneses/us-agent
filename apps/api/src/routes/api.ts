import { timingSafeEqual } from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { addTaxonomyDomain, addTaxonomyOperation, applyFallbackSuggestion, assignStoriesToSprint, createProjectSprint, createTaxonomyVersion, loadProjectSprints, loadReviewContext, loadStories, loadTaxonomy, updateProjectSprintStatus } from '../repositories/data-repository.js';
import { classifyPreview, parseImportedStories } from '../services/classifier.js';
import { classifyWithAi } from '../services/ai-classifier.js';
import { buildDashboard, filterStories } from '../services/stories.js';
import { query, withTransaction } from '../database/pool.js';
import { isExecutionModeActive, loadApplicationContext } from '../repositories/application-repository.js';
import { savePreviewClassifications, saveReview } from '../services/classification-store.js';
import { importRecord, type HistoricalResult } from '../database/import-jsonl.js';
import { buildQualityPlanScope, createQualityPlanScope, loadQualityPlans, saveQualityPlanScope, syncQualityPlanForSprint } from '../services/quality-plans.js';
import { loadStoryDetails, saveStoryDetails } from '../services/story-details.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5_000_000 }
});

const classifyRequest = z.object({
  stories: z.array(z.string().min(10)).min(1).max(100),
  project: z.string().trim().min(1).max(160).default('Web'),
  sprint: z.string().trim().min(1).max(120).default('Backlog'),
  mode: z.enum(['preview', 'committee']).default('committee')
});

const taxonomyFeedbackRequest = z.object({
  proposalType: z.enum(['new_domain', 'new_module', 'new_operation', 'clarify_story']),
  proposedDomain: z.string().trim().min(2).max(120).optional(),
  targetDomain: z.string().trim().min(2).max(120).optional(),
  proposedModule: z.string().trim().min(2).max(120).optional(),
  targetModule: z.string().trim().min(2).max(120).optional(),
  proposedOperation: z.string().trim().min(2).max(180).optional(),
  justification: z.string().trim().min(5).max(2_000)
}).superRefine((feedback, context) => {
  if (feedback.proposalType === 'new_domain' && !feedback.proposedDomain) {
    context.addIssue({ code: 'custom', path: ['proposedDomain'], message: 'Informe o domínio sugerido.' });
  }
  if (feedback.proposalType === 'new_module' && (!feedback.targetDomain || !feedback.proposedModule)) {
    context.addIssue({ code: 'custom', message: 'Informe o domínio alvo e o módulo sugerido.' });
  }
  if (feedback.proposalType === 'new_operation' && (!feedback.targetModule || !feedback.proposedOperation)) {
    context.addIssue({ code: 'custom', message: 'Informe o módulo alvo e a operação sugerida.' });
  }
});

const reviewRequest = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('approve'),
    module: z.string().trim().min(1).max(120).refine(value => value !== 'n/a', 'Selecione um módulo da taxonomia ou marque uma lacuna.'),
    operation: z.string().trim().min(1).max(180).refine(value => value !== 'n/a', 'Selecione uma operação da taxonomia ou marque uma lacuna.'),
    notes: z.string().trim().max(2_000).optional()
  }),
  z.object({
    action: z.literal('taxonomy_gap'),
    notes: z.string().trim().max(2_000).optional(),
    taxonomyFeedback: taxonomyFeedbackRequest.optional()
  })
]);

const ingestionRequest = z.object({
  user_story: z.string().min(1),
  project: z.string().min(1).max(160),
  story_id: z.string().min(1).max(80),
  run_id: z.string().min(1).max(80),
  review_status: z.string().min(1).max(40),
  final: z.object({
    final_rows: z.array(z.object({ module: z.string(), operation: z.string() })),
    final_confidence: z.number().min(0).max(1)
  }).passthrough(),
  uncertainty: z.object({
    uncertainty_score: z.number().min(0).max(1),
    consensus_ratio: z.number().min(0).max(1)
  }).passthrough()
}).passthrough();

const qualitySource = z.enum(['taxonomy_heuristic', 'user']);
const qualityPlanScopeRequest = z.object({
  project: z.string().trim().min(1).max(160),
  sprint: z.string().trim().min(1).max(120),
  storyIds: z.array(z.string().regex(/^\d+$/)).min(1).max(100)
});
const sprintCreateRequest = z.object({
  project: z.string().trim().min(1).max(160),
  name: z.string().trim().min(1).max(120),
  status: z.enum(['planning', 'active', 'completed']).default('planning')
});
const sprintStatusRequest = z.object({ status: z.enum(['planning', 'active', 'completed']) });
const sprintStoriesRequest = z.object({ classificationIds: z.array(z.string().regex(/^\d+$/)).min(1).max(500) });
const qualityPlanRequest = z.object({
  status: z.enum(['draft', 'approved']),
  storyIds: z.array(z.string().regex(/^\d+$/)).min(1).max(100),
  questions: z.array(z.object({
    id: z.string().trim().max(80).optional().default(''),
    text: z.string().trim().min(1).max(500),
    source: qualitySource
  })).max(500),
  acceptanceCriteria: z.array(z.object({
    id: z.string().trim().max(80).optional().default(''),
    text: z.string().trim().min(1).max(500),
    source: qualitySource
  })).max(500),
  testCases: z.array(z.object({
    id: z.string().trim().max(80).optional().default(''),
    title: z.string().trim().min(1).max(500),
    type: z.enum(['positive', 'negative', 'boundary', 'security']),
    priority: z.enum(['high', 'medium']),
    source: qualitySource,
    assumption: z.boolean(),
    preconditions: z.array(z.string().trim().min(1).max(500)).max(30).optional().default([]),
    testData: z.string().trim().max(2_000).optional().default(''),
    steps: z.array(z.string().trim().min(1).max(1_000)).max(30).optional().default([]),
    expectedResult: z.string().trim().max(2_000).optional().default(''),
    linkedCriteria: z.array(z.string().trim().min(1).max(80)).max(30).optional().default([]),
    automation: z.enum(['manual', 'candidate']).optional().default('manual')
  })).max(1_000)
}).superRefine((plan, context) => {
  if (plan.status !== 'approved') return;
  if (!plan.testCases.length) {
    context.addIssue({ code: 'custom', path: ['testCases'], message: 'Inclua ao menos um caso de teste antes de aprovar.' });
  }
  plan.testCases.forEach((testCase, index) => {
    if (!testCase.steps.length) context.addIssue({ code: 'custom', path: ['testCases', index, 'steps'], message: 'Descreva ao menos um passo para cada caso aprovado.' });
    if (!testCase.expectedResult) context.addIssue({ code: 'custom', path: ['testCases', index, 'expectedResult'], message: 'Informe o resultado esperado de cada caso aprovado.' });
  });
  const criterionIds = plan.acceptanceCriteria.map((criterion, index) => criterion.id || `AC-${String(index + 1).padStart(3, '0')}`);
  const linkedCriteria = new Set(plan.testCases.flatMap(testCase => testCase.linkedCriteria));
  criterionIds.forEach((id, index) => {
    if (!linkedCriteria.has(id)) context.addIssue({ code: 'custom', path: ['acceptanceCriteria', index], message: 'Todo critério de aceitação precisa estar ligado a pelo menos um caso de teste.' });
  });
});
const storyDetailsRequest = z.object({
  tasks: z.array(z.object({ id: z.string().optional(), title: z.string().trim().min(1).max(500), done: z.boolean() })).max(100),
  functionalRequirements: z.array(z.object({ id: z.string().optional(), description: z.string().trim().min(1).max(1000) })).max(100),
  nonFunctionalRequirements: z.array(z.object({ id: z.string().optional(), description: z.string().trim().min(1).max(1000), type: z.string().trim().min(1).max(80), metric: z.string().trim().min(1).max(120) })).max(100)
});
const taxonomyOperationRequest = z.object({ domain: z.string().trim().min(2).max(120).optional(), module: z.string().trim().min(2).max(120), operation: z.string().trim().min(2).max(180), description: z.string().trim().min(5).max(1000), version: z.string().trim().min(1).max(40).optional() });
const taxonomyDomainRequest = z.object({ domain: z.string().trim().min(2).max(120), description: z.string().trim().min(5).max(1000), version: z.string().trim().min(1).max(40).optional() });
const taxonomyVersionRequest = z.object({ version: z.string().trim().min(1).max(40) });

function isAuthorizedInternalRequest(req: Request, res: Response) {
  const configuredKey = process.env.INGEST_API_KEY;
  if (!configuredKey) {
    if (process.env.VERCEL) {
      res.status(503).json({ error: 'INGEST_API_KEY não foi configurada no ambiente.' });
      return false;
    }
    return true;
  }
  const suppliedKey = req.header('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const expected = Buffer.from(configuredKey);
  const supplied = Buffer.from(suppliedKey);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    res.status(401).json({ error: 'Credencial de ingestão inválida.' });
    return false;
  }
  return true;
}

export const apiRouter = Router();

apiRouter.get('/health', async (_req, res) => {
  await query('SELECT 1');
  res.json({ status: 'ok', service: 'us-agent-api', database: 'connected' });
});

apiRouter.get('/taxonomy', async (req, res) => {
  res.json(await loadTaxonomy(typeof req.query.version === 'string' ? req.query.version : undefined));
});

apiRouter.get('/context', async (_req, res) => {
  res.json(await loadApplicationContext());
});

apiRouter.get('/stories', async (req, res) => {
  const stories = await loadStories();
  const requestedLimit = Number(req.query.limit ?? 250);
  const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 10_000) : 250;
  res.json(filterStories(stories, String(req.query.status ?? ''), String(req.query.search ?? ''), limit));
});

apiRouter.get('/dashboard', async (_req, res) => {
  res.json(buildDashboard(await loadStories()));
});

apiRouter.get('/quality-plans', async (_req, res) => {
  res.json(await loadQualityPlans(await loadStories()));
});

apiRouter.get('/sprints', async (_req, res) => {
  res.json(await loadProjectSprints());
});

apiRouter.post('/sprints', async (req, res) => {
  const parsed = sprintCreateRequest.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: 'Informe projeto, nome e status válidos para a sprint.' });
  try {
    const sprint = await createProjectSprint(parsed.data);
    if (!sprint) return void res.status(404).json({ error: 'Projeto não encontrado.' });
    res.status(201).json(sprint);
  } catch (reason) {
    if ((reason as { code?: string }).code === '23505') return void res.status(409).json({ error: 'Já existe uma sprint com esse nome neste projeto.' });
    throw reason;
  }
});

apiRouter.patch('/sprints/:id/status', async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return void res.status(400).json({ error: 'Identificador de sprint inválido.' });
  const parsed = sprintStatusRequest.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: 'Status de sprint inválido.' });
  const sprint = await updateProjectSprintStatus(req.params.id, parsed.data.status);
  if (!sprint) return void res.status(404).json({ error: 'Sprint não encontrada.' });
  res.json(sprint);
});

apiRouter.put('/sprints/:id/stories', async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return void res.status(400).json({ error: 'Identificador de sprint inválido.' });
  const parsed = sprintStoriesRequest.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: 'Selecione ao menos uma User Story.' });
  try {
    const changed = await assignStoriesToSprint(req.params.id, parsed.data.classificationIds);
    if (!changed) return void res.status(404).json({ error: 'Sprint não encontrada.' });
    const context = await loadApplicationContext();
    await syncQualityPlanForSprint(req.params.id, context.user.id);
    for (const previousSprintId of changed.previousSprintIds.filter(id => id !== req.params.id)) await syncQualityPlanForSprint(previousSprintId, context.user.id);
    res.json({ sprintId: req.params.id, classificationIds: parsed.data.classificationIds });
  } catch (reason) {
    res.status(400).json({ error: (reason as Error).message });
  }
});

apiRouter.post('/quality-plans/scopes', async (req, res) => {
  const parsed = qualityPlanScopeRequest.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Informe projeto, sprint e ao menos uma User Story para criar o plano.' });
    return;
  }
  const stories = (await loadStories()).filter(story => parsed.data.storyIds.includes(story.id) && story.project === parsed.data.project);
  if (stories.length !== parsed.data.storyIds.length) {
    res.status(400).json({ error: 'Uma ou mais histórias não pertencem ao projeto selecionado.' });
    return;
  }
  const plan = buildQualityPlanScope({ id: '', project: parsed.data.project, sprint: parsed.data.sprint, stories, status: 'draft' });
  const context = await loadApplicationContext();
  const saved = await createQualityPlanScope(context.user.id, { ...plan, storyIds: parsed.data.storyIds, status: 'draft' });
  if (!saved) {
    res.status(404).json({ error: 'Projeto não encontrado.' });
    return;
  }
  if (saved.conflict) {
    res.status(409).json({ error: 'Já existe um plano para este projeto e sprint.' });
    return;
  }
  res.status(201).json({ ...plan, id: saved.id, status: 'draft', updatedAt: saved.updated_at, updatedBy: context.user.displayName });
});

apiRouter.put('/quality-plans/:id', async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) {
    res.status(400).json({ error: 'Identificador de plano inválido.' });
    return;
  }
  const parsed = qualityPlanRequest.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Plano de qualidade inválido.', details: parsed.error.issues });
    return;
  }
  const context = await loadApplicationContext();
  const saved = await saveQualityPlanScope(req.params.id, context.user.id, parsed.data);
  if (!saved) {
    res.status(404).json({ error: 'Plano de qualidade não encontrado.' });
    return;
  }
  res.json({ id: req.params.id, status: parsed.data.status, updatedAt: saved.updated_at, updatedBy: context.user.displayName });
});
apiRouter.post('/taxonomy/operations', async (req, res) => { const parsed = taxonomyOperationRequest.safeParse(req.body); if (!parsed.success) return void res.status(400).json({ error: 'Dados da operação inválidos.' }); await addTaxonomyOperation(parsed.data); res.status(201).json(await loadTaxonomy()); });
apiRouter.post('/taxonomy/domains', async (req, res) => { const parsed = taxonomyDomainRequest.safeParse(req.body); if (!parsed.success) return void res.status(400).json({ error: 'Dados do domínio inválidos.' }); await addTaxonomyDomain(parsed.data); res.status(201).json(await loadTaxonomy()); });
apiRouter.post('/taxonomy/versions', async (req, res) => { const parsed = taxonomyVersionRequest.safeParse(req.body); if (!parsed.success) return void res.status(400).json({ error: 'Versão inválida.' }); await createTaxonomyVersion(parsed.data.version); res.status(201).json(await loadTaxonomy()); });

apiRouter.post('/taxonomy/fallback-suggestions/:id/apply', async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return void res.status(400).json({ error: 'Identificador da sugestão inválido.' });
  const result = await applyFallbackSuggestion(req.params.id);
  if (!result) return void res.status(404).json({ error: 'Sugestão de fallback não encontrada.' });
  if (result.status === 'applied' || result.status === 'already_applied') {
    return void res.json({ status: result.status, taxonomy: await loadTaxonomy() });
  }
  const messages = {
      not_actionable: 'Esta sugestão não representa um domínio ou uma operação adicionável.',
      target_domain_not_found: 'O domínio alvo da sugestão não existe na taxonomia ativa.',
      target_module_not_found: 'O módulo alvo da operação sugerida não existe na taxonomia ativa.',
    no_active_taxonomy: 'Nenhuma taxonomia ativa foi encontrada.'
  };
  res.status(422).json({ error: messages[result.status] });
});

apiRouter.get('/classifications/:id/details', async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return void res.status(400).json({ error: 'Identificador de classificação inválido.' });
  res.json(await loadStoryDetails(req.params.id));
});
apiRouter.get('/classifications/:id/review-context', async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return void res.status(400).json({ error: 'Identificador de classificação inválido.' });
  const context = await loadReviewContext(req.params.id);
  if (!context) return void res.status(404).json({ error: 'Classificação não encontrada.' });
  res.json(context);
});
apiRouter.put('/classifications/:id/details', async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return void res.status(400).json({ error: 'Identificador de classificação inválido.' });
  const parsed = storyDetailsRequest.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: 'Detalhes da história inválidos.', details: parsed.error.issues });
  if (!await saveStoryDetails(req.params.id, parsed.data)) return void res.status(404).json({ error: 'História não encontrada.' });
  res.json(await loadStoryDetails(req.params.id));
});

apiRouter.post('/classify', async (req, res) => {
  const parsed = classifyRequest.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: 'Envie de 1 a 100 histórias válidas.',
      details: parsed.error.issues
    });
    return;
  }

  if (!await isExecutionModeActive(parsed.data.mode)) {
    res.status(400).json({ error: 'O modo de classifica\u00e7\u00e3o selecionado n\u00e3o est\u00e1 dispon\u00edvel.' });
    return;
  }

  const taxonomy = await loadTaxonomy();
  const previews = parsed.data.mode === 'preview'
    ? parsed.data.stories.map(text => ({ text, ...classifyPreview(text, taxonomy) }))
    : await Promise.all(parsed.data.stories.map(async text => ({ text, ...await classifyWithAi(text, taxonomy) })));
  res.status(201).json(await savePreviewClassifications(parsed.data.project, parsed.data.sprint, previews, parsed.data.mode));
});

apiRouter.patch('/classifications/:id/review', async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) {
    res.status(400).json({ error: 'Identificador de classificação inválido.' });
    return;
  }
  const parsed = reviewRequest.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Dados de revisão inválidos.', details: parsed.error.issues });
    return;
  }
  const result = await saveReview({ classificationId: req.params.id, ...parsed.data });
  if (!result) {
    res.status(404).json({ error: 'Classificação não encontrada.' });
    return;
  }
  if ('notReviewable' in result) {
    res.status(409).json({ error: `A classificação já está no estado ${result.status}.` });
    return;
  }
  res.json(result);
});

apiRouter.post('/internal/classifications', async (req, res) => {
  if (!isAuthorizedInternalRequest(req, res)) return;
  const parsed = ingestionRequest.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Resultado de classificação inválido.', details: parsed.error.issues });
    return;
  }
  const classificationId = await withTransaction(client =>
    importRecord(client, parsed.data as HistoricalResult, 0)
  );
  res.status(201).json({ id: classificationId });
});

apiRouter.post('/import', upload.single('file'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'Arquivo ausente.' });
    return;
  }

  res.json({
    filename: req.file.originalname,
    stories: parseImportedStories(req.file.buffer.toString('utf8'))
  });
});
