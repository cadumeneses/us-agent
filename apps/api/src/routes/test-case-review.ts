import { Router, type ErrorRequestHandler } from 'express';
import { z } from 'zod';
import { isAuthorizedInternalRequest } from './internal-authorization.js';
import { confirmTestTarget, decideTestItem, createTestCopy, testReview, testItemReview, TestReviewError } from '../services/test-case-review.js';
import { RecommendationRequestError } from '../services/recommendation-runs.js';
export const testCaseReviewRouter = Router();
testCaseReviewRouter.use((req, res, next) => { if (isAuthorizedInternalRequest(req, res)) next(); });
const identity = z.strictObject({ id: z.uuid() });
const actor = () => process.env.INGEST_API_KEY ? 'internal-api' : 'local-development';
testCaseReviewRouter.get('/:id', async (req, res) => { res.json(await testReview(identity.parse(req.params).id)); });
testCaseReviewRouter.post('/:id/target', async (req, res) => { res.json(await confirmTestTarget(identity.parse(req.params).id, req.body, actor())); });
testCaseReviewRouter.post('/:id/decisions', async (req, res) => { res.json(await decideTestItem(identity.parse(req.params).id, req.body, actor())); });
testCaseReviewRouter.post('/:id/copies', async (req, res) => { res.status(201).json(await createTestCopy(identity.parse(req.params).id, req.body, actor())); });
testCaseReviewRouter.get('/:id/items/:itemKey', async (req, res) => {
  const path = z.strictObject({ id: z.uuid(), itemKey: z.string().regex(/^[a-f0-9]{64}$/) }).parse(req.params);
  const page = z.strictObject({ limit: z.coerce.number().int().min(1).max(20).default(5), offset: z.coerce.number().int().min(0).max(100000).default(0) }).parse(req.query);
  res.json(await testItemReview(path.id, path.itemKey, page.limit, page.offset));
});
const errors: ErrorRequestHandler = (error, _req, res, next) => {
  if (error instanceof TestReviewError || error instanceof RecommendationRequestError) { res.status(error.status).json({ error: error.message }); return; }
  if (error instanceof z.ZodError) { res.status(422).json({ error: 'Invalid test assessment.', issues: error.issues }); return; }
  if (['40001', '40P01'].includes((error as { code?: string }).code ?? '')) { res.status(409).json({ error: 'Assessment changed concurrently. Reload and retry.' }); return; }
  next(error);
};
testCaseReviewRouter.use(errors);
