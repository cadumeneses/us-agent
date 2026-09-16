import { timingSafeEqual } from 'node:crypto';
import { nfrRouter } from './nfr.js';
import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { addTaxonomyDomain, addTaxonomyOperation, applyFallbackSuggestion, assignStoriesToSprint, createProjectSprint, createTaxonomyVersion, loadProjectSprints, loadReviewContext, loadStories, loadTaxonomy, updateProjectSprintStatus } from '../repositories/data-repository.js';
import { classifyPreview, parseImportedStories } from '../services/classifier.js';
import { classifyWithAi } from '../services/ai-classifier.js';
import { buildDashboard, filterStories } from '../services/stories.js';
import { query, withTransaction } from '../database/pool.js';
import { isExecutionModeActive, loadApplicationContext } from '../repositories/application-repository.js';
import { applySavedTaxonomyFeedback, savePreviewClassifications, saveReview, saveTaxonomyFeedback } from '../services/classification-store.js';
import { importRecord, type HistoricalResult } from '../database/import-jsonl.js';
import { loadStoryDetails, saveStoryDetails } from '../services/story-details.js';
import { technologiesSchema, projectResearchProfileSchema, loadProjectResearchProfile, saveProjectResearchProfile } from '../services/research-inputs.js';

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
  if (feedback.proposalType === 'new_operation' && (!feedback.targetDomain || !feedback.targetModule || !feedback.proposedOperation)) {
    context.addIssue({ code: 'custom', message: 'Informe o domínio, o módulo alvo e a operação sugerida.' });
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
    notes: z.string().trim().max(2_000).optional()
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

const sprintCreateRequest = z.object({
  project: z.string().trim().min(1).max(160),
  name: z.string().trim().min(1).max(120),
  status: z.enum(['planning', 'active', 'completed']).default('planning')
});
const sprintStatusRequest = z.object({ status: z.enum(['planning', 'active', 'completed']) });
const sprintStoriesRequest = z.object({ classificationIds: z.array(z.string().regex(/^\d+$/)).min(1).max(500) });
const storyDetailsRequest = z.object({
  tasks: z.array(z.object({ id: z.string().optional(), title: z.string().trim().min(1).max(500), done: z.boolean(), category: z.string().trim().max(160).optional(), technologies: technologiesSchema.optional() })).max(100),
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
apiRouter.use(nfrRouter);

apiRouter.get('/project-research-profile', async (req, res) => {
  const name = z.string().trim().min(1).max(160).safeParse(req.query.project);
  if (!name.success) return void res.status(400).json({ error: 'Informe o projeto.' });
  const profile = await loadProjectResearchProfile(name.data);
  if (!profile) return void res.status(404).json({ error: 'Projeto não encontrado.' });
  res.json(profile);
});

apiRouter.put('/project-research-profile', async (req, res) => {
  const name = z.string().trim().min(1).max(160).safeParse(req.query.project);
  const parsed = projectResearchProfileSchema.safeParse(req.body);
  if (!name.success || !parsed.success) return void res.status(400).json({ error: 'Perfil do projeto inválido.' });
  if (!await saveProjectResearchProfile(name.data, parsed.data)) return void res.status(404).json({ error: 'Projeto não encontrado.' });
  res.json(parsed.data);
});

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
    res.json({ sprintId: req.params.id, classificationIds: parsed.data.classificationIds });
  } catch (reason) {
    res.status(400).json({ error: (reason as Error).message });
  }
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
apiRouter.post('/classifications/:id/taxonomy-feedback', async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return void res.status(400).json({ error: 'Identificador da classificação inválido.' });
  const parsed = taxonomyFeedbackRequest.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: 'Dados da proposta de evolução inválidos.', details: parsed.error.issues });
  let saved;
  try {
    saved = await saveTaxonomyFeedback(req.params.id, parsed.data);
  } catch (reason) {
    return void res.status(422).json({ error: (reason as Error).message });
  }
  if (!saved) return void res.status(404).json({ error: 'Classificação não encontrada.' });
  res.status(201).json({ ...saved, taxonomy: await loadTaxonomy() });
});
apiRouter.post('/taxonomy/feedback/:id/apply', async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return void res.status(400).json({ error: 'Identificador da proposta inválido.' });
  let result;
  try {
    result = await applySavedTaxonomyFeedback(req.params.id);
  } catch (reason) {
    return void res.status(422).json({ error: (reason as Error).message });
  }
  if (!result) return void res.status(404).json({ error: 'Proposta de evolução não encontrada.' });
  if (result.status === 'not_actionable') return void res.status(422).json({ error: 'Solicitações de esclarecimento não alteram a taxonomia.' });
  res.json({ status: result.status, taxonomy: await loadTaxonomy() });
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
