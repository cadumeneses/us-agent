import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import { apiRouter } from './routes/api.js';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', apiRouter);
  app.use((_req, res) => res.status(404).json({ error: 'Endpoint not found.' }));

  const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    console.error(error);
    res.status(500).json({ error: 'Internal API error.' });
  };
  app.use(errorHandler);

  return app;
}
