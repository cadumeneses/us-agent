import express, { type ErrorRequestHandler } from 'express';
import { apiRouter } from './routes/api.js';
import { apiBoundary } from './security/api-boundary.js';
import { testCaseReviewRouter } from './routes/test-case-review.js';
import { browserSessionAuthentication, webSessionRouter } from './security/web-sessions.js';
import { projectStoriesRouter } from './routes/project-stories.js';
import { configurableRecommendationsRouter } from './routes/configurable-recommendations.js';
import { organizationAccess, organizationAccessRouter } from './security/organization-access.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', false);
  app.use('/api/auth', webSessionRouter);
  app.use('/api', browserSessionAuthentication);
  app.use('/api', apiBoundary);
  app.use('/api', organizationAccess);
  app.use(express.json({ limit: '1mb' }));
  app.use('/api/access', organizationAccessRouter);
  app.use('/api', projectStoriesRouter);
  app.use('/api/internal', configurableRecommendationsRouter);
  app.use('/api/internal/test-case-reviews', testCaseReviewRouter);
  app.use('/api', apiRouter);
  app.use((_req, res) => res.status(404).json({ error: 'Endpoint not found.' }));

  const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    console.error(error);
    res.status(500).json({ error: 'Internal API error.' });
  };
  app.use(errorHandler);

  return app;
}
