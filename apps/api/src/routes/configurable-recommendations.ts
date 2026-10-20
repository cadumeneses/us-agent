import { currentActor } from '../security/request-context.js';
import { Router, type ErrorRequestHandler } from 'express';
import { z } from 'zod';
import { contentReferenceSchema } from '../domain/dataset-import.js';
import { recommendationInputSchema } from '../domain/recommender-definition.js';
import { CONFIGURABLE_KNN } from '../services/configurable-knn.js';
import { ConfigurableRequestError, configurableProjectProfile, saveConfigurableProjectProfile } from '../services/configurable-project-profiles.js';
import { createConfigurableRun, loadConfigurableRun, replayConfigurableRun } from '../services/configurable-runs.js';
import { DefinitionRequestError, loadDefinitionVersion } from '../services/recommender-definitions.js';
import { DatasetRequestError } from '../services/recommender-datasets.js';
import { publishConfigurableDefinition } from '../services/publish-configurable-definition.js';
import { isAuthorizedInternalRequest } from './internal-authorization.js';

// Extension of the shared lifecycle. Historical method implementations remain unchanged.
export const configurableRecommendationsRouter = Router();
configurableRecommendationsRouter.use((req, res, next) => { if (isAuthorizedInternalRequest(req, res)) next(); });
const actor = () => currentActor();
configurableRecommendationsRouter.post('/recommender-definitions/:id/versions/:version/publish', async (req, res, next) => {
  const definition = await loadDefinitionVersion(String(req.params.id), String(req.params.version));
  if (definition.definition.method.id !== CONFIGURABLE_KNN) return next();
  const body = z.strictObject({ expectedDraftSha256: z.string().regex(/^[a-f0-9]{64}$/) }).parse(req.body);
  res.json(await publishConfigurableDefinition(definition.definition.id, definition.definition.version, actor(), body.expectedDraftSha256));
});
const profileBody = z.strictObject({ project: z.string().min(1).max(200), definition: contentReferenceSchema });
configurableRecommendationsRouter.post('/project-recommender-profile/load', async (req, res) => {
  const body = profileBody.parse(req.body);
  res.json(await configurableProjectProfile(body.project, body.definition));
});
configurableRecommendationsRouter.put('/project-recommender-profile', async (req, res) => {
  const body = profileBody.extend({ revision: z.number().int().nonnegative(), values: recommendationInputSchema.shape.values }).parse(req.body);
  res.json(await saveConfigurableProjectProfile(body.project, body.definition, body.revision, body.values));
});
configurableRecommendationsRouter.post('/recommendation-runs', async (req, res, next) => {
  const reference = contentReferenceSchema.parse(req.body?.definition);
  const definition = await loadDefinitionVersion(reference.id, reference.version);
  if (definition.definition.method.id !== CONFIGURABLE_KNN) return next();
  res.status(201).json(await createConfigurableRun(req.body, actor()));
});
configurableRecommendationsRouter.get('/recommendation-runs/:id', async (req, res, next) => {
  const id = z.uuid().parse(req.params.id);
  const run = await loadConfigurableRun(id);
  if (!run) return next();
  res.json(run);
});
configurableRecommendationsRouter.post('/recommendation-runs/:id/replay', async (req, res, next) => {
  const id = z.uuid().parse(req.params.id);
  if (!await loadConfigurableRun(id)) return next();
  z.strictObject({}).parse(req.body ?? {});
  res.json(await replayConfigurableRun(id));
});
const errors: ErrorRequestHandler = (error, _req, res, next) => {
  if (error instanceof z.ZodError) { res.status(422).json({ error: 'Invalid configuration or input.', issues: error.issues }); return; }
  if (error instanceof DatasetRequestError) {
    res.status(error.status).json({ error: error.status === 404 ? 'Publication not found.' : 'A selected publication is unavailable or its hash differs. Reload the configuration and dataset before running.' }); return;
  }
  if (error instanceof ConfigurableRequestError || error instanceof DefinitionRequestError) { res.status(error.status).json({ error: error.status === 404 ? 'Configuration not found.' : error.message }); return; }
  // Method contract failures are user input errors; unexpected database failures reach the common handler.
  if (error instanceof Error && !('code' in error)) { res.status(422).json({ error: error.message }); return; }
  next(error);
};
configurableRecommendationsRouter.use(errors);
