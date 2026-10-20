import { currentActor } from '../security/request-context.js';
import { Router, type ErrorRequestHandler } from 'express';
import { z } from 'zod';
import { definitionIdentitySchema } from '../domain/recommender-definition.js';
import { isAuthorizedInternalRequest } from './internal-authorization.js';
import { createRecommendationRun, listRecommendationRuns, loadRecommendationRun, replayRecommendationRun, RecommendationRequestError } from '../services/recommendation-runs.js';
import { DatasetRequestError } from '../services/recommender-datasets.js';
import { TestCaseCatalogRequestError } from '../services/test-case-catalogs.js';
import { bindRecommendationTarget, decideRecommendationItem, previewRecommendationDestination, recommendationReview, createNfrCopy } from '../services/recommendation-review.js';
import { classificationIdentity } from '../domain/recommendation-review.js';

export const recommendationRunsRouter = Router();
recommendationRunsRouter.use((req, res, next) => { if (isAuthorizedInternalRequest(req, res)) next(); });
const path = z.strictObject({ id: z.uuid() });
recommendationRunsRouter.post('/', async (req, res) => {
  res.status(201).json(await createRecommendationRun(req.body, currentActor()));
});
recommendationRunsRouter.get('/', async (req, res) => {
  const options = z.strictObject({ definitionId: definitionIdentitySchema.shape.id.optional(), datasetId: definitionIdentitySchema.shape.id.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(30), offset: z.coerce.number().int().min(0).max(100000).default(0) }).parse(req.query);
  res.json(await listRecommendationRuns(options));
});
recommendationRunsRouter.get('/:id', async (req, res) => { res.json(await loadRecommendationRun(path.parse(req.params).id)); });
recommendationRunsRouter.get('/:id/review', async (req, res) => { res.json(await recommendationReview(path.parse(req.params).id)); });
recommendationRunsRouter.get('/:id/destinations/:classificationId', async (req, res) => {
  const params = z.strictObject({ id: z.uuid(), classificationId: classificationIdentity }).parse(req.params);
  res.json(await previewRecommendationDestination(params.id, params.classificationId));
});
recommendationRunsRouter.post('/:id/target', async (req, res) => {
  res.json(await bindRecommendationTarget(path.parse(req.params).id, req.body, currentActor()));
});
recommendationRunsRouter.post('/:id/decisions', async (req, res) => {
  res.json(await decideRecommendationItem(path.parse(req.params).id, req.body, currentActor()));
});
recommendationRunsRouter.post('/:id/copies', async (req,res) => {
  res.status(201).json(await createNfrCopy(path.parse(req.params).id,req.body,currentActor()));
});
recommendationRunsRouter.post('/:id/replay', async (req, res) => {
  if (req.body !== undefined && !z.strictObject({}).safeParse(req.body).success) throw new RecommendationRequestError(400, 'Replay usa apenas os snapshots registrados.');
  res.json(await replayRecommendationRun(path.parse(req.params).id));
});
const errors: ErrorRequestHandler = (error, _req, res, next) => {
  if (error instanceof RecommendationRequestError || error instanceof DatasetRequestError || error instanceof TestCaseCatalogRequestError) { res.status(error.status).json({ error: error.message }); return; }
  if (error instanceof z.ZodError) { res.status(422).json({ error: 'Execução ou parâmetros inválidos.', issues: error.issues }); return; }
  if (['40001', '40P01'].includes((error as { code?: string }).code ?? '')) { res.status(409).json({ error: 'Os dados mudaram durante a revisão. Recarregue e tente novamente.' }); return; }
  next(error);
};
recommendationRunsRouter.use(errors);
