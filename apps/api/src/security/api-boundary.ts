import cors from 'cors';
import type { Request, RequestHandler } from 'express';
import { isAuthorizedInternalRequest, isLocalDevelopmentRequest } from '../routes/internal-authorization.js';
import { hasBrowserSession } from './browser-identity.js';

function originUrl(value: string) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && url.origin === value ? url : undefined;
  } catch { return undefined; }
}

export function isAllowedOrigin(req: Request, origin: string) {
  const url = originUrl(origin);
  if (!url) return false;
  if (hasBrowserSession(req) && origin === process.env.WEB_APP_ORIGIN) return true;
  // Host/protocol are never taken from client-supplied forwarding headers.
  if (url.host === req.header('host') && url.protocol === `${req.protocol}:`) return true;
  if (isLocalDevelopmentRequest(req) && ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://[::1]:5173'].includes(origin)) return true;
  return Boolean(process.env.INGEST_API_KEY) && (process.env.API_ALLOWED_ORIGINS ?? '').split(',').map(value => value.trim()).some(value => originUrl(value)?.origin === origin);
}

const allowedCors = cors({ origin: true, methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'], allowedHeaders: ['Content-Type', 'Authorization', 'X-Organization-Id'], maxAge: 600 });

// Run before body parsers, uploads and every API router, including legacy RNF routes.
export const apiBoundary: RequestHandler = (req, res, next) => {
  res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
  res.vary('Origin');
  const origin = req.header('origin');
  const allowedOrigin = origin !== undefined && isAllowedOrigin(req, origin);
  if ((origin !== undefined && !allowedOrigin) || (req.header('sec-fetch-site') === 'cross-site' && !(allowedOrigin && process.env.INGEST_API_KEY))) {
    res.status(403).json({ error: 'Origem da requisição não autorizada.' });
    return;
  }
  // A valid preflight discloses no data and cannot run a route. Actual requests authenticate below.
  if (req.method === 'OPTIONS') {
    if (!origin) { res.sendStatus(403); return; }
    allowedCors(req, res, next);
    return;
  }
  if (!isAuthorizedInternalRequest(req, res)) return;
  if (origin) allowedCors(req, res, next);
  else next();
};
