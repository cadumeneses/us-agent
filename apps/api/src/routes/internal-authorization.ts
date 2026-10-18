import { timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';

function loopbackAddress(value: string | undefined) {
  return value === '127.0.0.1' || value === '::1' || value === '::ffff:127.0.0.1';
}

export function isLocalDevelopmentRequest(req: Request) {
  if (process.env.VERCEL || !['', 'development', 'test'].includes(process.env.NODE_ENV ?? '')) return false;
  if (!['', 'local'].includes(process.env.API_ACCESS_MODE ?? '')) return false;
  if (!loopbackAddress(req.socket.remoteAddress)) return false;
  if (['forwarded', 'x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto', 'x-real-ip'].some(header => req.header(header) !== undefined)) return false;
  // Restrict Host as well as the actual peer to prevent DNS rebinding into a local API.
  return /^(?:localhost|127\.0\.0\.1|\[::1\])(?::[0-9]{1,5})?$/i.test(req.header('host') ?? '');
}

// Temporary technical boundary. This is not a person, role or organization identity.
export function isAuthorizedInternalRequest(req: Request, res: Response) {
  if (!['', 'local', 'protected'].includes(process.env.API_ACCESS_MODE ?? '')) {
    res.status(503).json({ error: 'Modo de acesso da API inválido.' });
    return false;
  }
  const configuredKey = process.env.INGEST_API_KEY;
  if (!configuredKey) {
    if (isLocalDevelopmentRequest(req) && req.header('authorization') === undefined) return true;
    res.status(503).json({ error: 'A proteção de acesso da API não foi configurada.' });
    return false;
  }
  const suppliedKey = /^Bearer ([^\s]+)$/i.exec(req.header('authorization') ?? '')?.[1] ?? '';
  const expected = Buffer.from(configuredKey);
  const supplied = Buffer.from(suppliedKey);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    res.status(401).json({ error: 'Credencial de ingestão inválida.' });
    return false;
  }
  return true;
}
