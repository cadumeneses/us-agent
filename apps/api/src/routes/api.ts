import { timingSafeEqual } from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { loadStories, loadTaxonomy } from '../repositories/data-repository.js';
import { classifyPreview, parseImportedStories } from '../services/classifier.js';
import { classifyWithAi } from '../services/ai-classifier.js';
import { buildDashboard, filterStories } from '../services/stories.js';
import { query, withTransaction } from '../database/pool.js';
import { loadApplicationContext } from '../repositories/application-repository.js';
import { savePreviewClassifications, saveReview } from '../services/classification-store.js';
import { importRecord, type HistoricalResult } from '../database/import-jsonl.js';
import { loadQualityPlans, saveQualityPlan } from '../services/quality-plans.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5_000_000 }
});

const classifyRequest = z.object({
  stories: z.array(z.string().min(10)).min(1).max(100),
  project: z.string().trim().min(1).max(160).default('Web'),
  mode: z.enum(['preview', 'committee']).default('committee')
});

const reviewRequest = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('approve'),
    module: z.string().trim().min(1).max(120),
    operation: z.string().trim().min(1).max(180),
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

const qualitySource = z.enum(['taxonomy_heuristic', 'user']);
const qualityPlanRequest = z.object({
  status: z.enum(['draft', 'approved']),
  questions: z.array(z.object({
    text: z.string().trim().min(1).max(500),
    source: qualitySource
  })).max(30),
  acceptanceCriteria: z.array(z.object({
    text: z.string().trim().min(1).max(500),
    source: qualitySource
  })).max(30),
  testCases: z.array(z.object({
    title: z.string().trim().min(1).max(500),
    type: z.enum(['positive', 'negative', 'boundary', 'security']),
    priority: z.enum(['high', 'medium']),
    source: qualitySource,
    assumption: z.boolean()
  })).max(50)
});

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

apiRouter.get('/taxonomy', async (_req, res) => {
  res.json(await loadTaxonomy());
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

apiRouter.put('/quality-plans/:id', async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) {
    res.status(400).json({ error: 'Identificador de classificação inválido.' });
    return;
  }
  const parsed = qualityPlanRequest.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Plano de qualidade inválido.', details: parsed.error.issues });
    return;
  }
  const context = await loadApplicationContext();
  const saved = await saveQualityPlan(req.params.id, context.user.id, parsed.data);
  if (!saved) {
    res.status(404).json({ error: 'Classificação não encontrada.' });
    return;
  }
  res.json({ id: req.params.id, status: parsed.data.status, updatedAt: saved.updated_at, updatedBy: context.user.displayName });
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

  const taxonomy = await loadTaxonomy();
  const previews = parsed.data.mode === 'preview'
    ? parsed.data.stories.map(text => ({ text, ...classifyPreview(text, taxonomy) }))
    : await Promise.all(parsed.data.stories.map(async text => ({ text, ...await classifyWithAi(text, taxonomy) })));
  res.status(201).json(await savePreviewClassifications(parsed.data.project, previews, parsed.data.mode));
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
