import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import express, { type Request, type RequestHandler } from 'express';
import { query } from '../database/pool.js';
import { isLocalDevelopmentRequest } from '../routes/internal-authorization.js';
import { markBrowserSession } from './browser-identity.js';

const scrypt = promisify(scryptCallback);
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const duration = 8 * 60 * 60 * 1000;
export function privateWebConfig() {
  try {
    const url = new URL(process.env.WEB_APP_ORIGIN ?? '');
    const development = !process.env.VERCEL && process.env.NODE_ENV !== 'production';
    if (url.origin !== process.env.WEB_APP_ORIGIN || (url.protocol !== 'https:' &&
      !(development && url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) return undefined;
    return { origin: url.origin, host: url.host, secure: url.protocol === 'https:',
      cookie: url.protocol === 'https:' ? '__Host-us-agent-session' : 'us-agent-session' };
  } catch { return undefined; }
}

export async function verifyWebPassword(password: string, stored: string) {
  if (!/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(stored)) return false;
  const [, salt, expected] = stored.split(':');
  const actual = await scrypt(password, salt, 64) as Buffer;
  return timingSafeEqual(actual, Buffer.from(expected, 'hex'));
}

function permitted(req: Request, config: NonNullable<ReturnType<typeof privateWebConfig>>, mutation = false) {
  return req.header('host') === config.host && req.header('sec-fetch-site') !== 'cross-site' &&
    (mutation ? req.header('origin') === config.origin : !req.header('origin') || req.header('origin') === config.origin);
}
function cookieToken(req: Request, name: string) {
  const tokens = (req.header('cookie') ?? '').split(';').map(value => value.trim()).filter(value => value.startsWith(`${name}=`));
  if (tokens.length !== 1) return undefined;
  const value = tokens[0].slice(name.length + 1);
  return /^[a-f0-9]{64}$/.test(value) ? value : undefined;
}
async function sessionValid(req: Request, config: NonNullable<ReturnType<typeof privateWebConfig>>) {
  const token = cookieToken(req, config.cookie);
  if (!token) return undefined;
  const result = await query<{ username: string }>(`SELECT u.username FROM web_sessions s JOIN web_users u ON u.username = s.username
    WHERE s.token_sha256 = $1 AND s.credential_sha256 = encode(sha256(convert_to(u.password_hash, 'UTF8')), 'hex')
      AND u.active AND s.expires_at > NOW()`, [digest(token)]);
  return result.rows[0]?.username;
}
function sessionUnavailable(res: express.Response) {
  return res.status(503).json({ error: 'Acesso privado indisponível. Confira a configuração e aplique as migrations 025 e 026.' });
}
const cookieOptions = (secure: boolean) => ({ httpOnly: true, secure, sameSite: 'strict' as const, path: '/' });

export const browserSessionAuthentication: RequestHandler = async (req, res, next) => {
  const config = privateWebConfig();
  // A supplied integration credential is always checked as Bearer, never rescued by a cookie.
  if (!config || req.header('authorization') !== undefined || !permitted(req, config, !['GET', 'HEAD', 'OPTIONS'].includes(req.method))) return next();
  try { const username = await sessionValid(req, config); if (username) markBrowserSession(req, username); next(); }
  catch { sessionUnavailable(res); }
};

export const webSessionRouter = express.Router();
webSessionRouter.use((_req, res, next) => {
  res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' }); next();
});
webSessionRouter.use((req, res, next) => {
  const config = privateWebConfig();
  if (!config) {
    if (req.method === 'GET' && isLocalDevelopmentRequest(req) && !process.env.INGEST_API_KEY && !process.env.WEB_ACCESS_PASSWORD_HASH && !process.env.WEB_APP_ORIGIN) {
      res.json({ enabled: false, authenticated: true }); return;
    }
    sessionUnavailable(res); return;
  }
  if (!permitted(req, config, !['GET', 'HEAD'].includes(req.method))) { res.status(403).json({ error: 'Origem não autorizada.' }); return; }
  next();
});
webSessionRouter.get('/session', async (req, res) => {
  try { const username = await sessionValid(req, privateWebConfig()!); res.json({ enabled: true, authenticated: Boolean(username), ...(username ? { username } : {}) }); }
  catch { sessionUnavailable(res); }
});
webSessionRouter.post('/session', express.json({ limit: '2kb' }), async (req, res) => {
  const config = privateWebConfig()!;
  const password = req.body?.password;
  const username = req.body?.username;
  if (typeof username !== 'string' || !/^[a-z][a-z0-9._-]{0,63}$/.test(username) || typeof password !== 'string' || password.length < 1 || password.length > 1024 || Object.keys(req.body).some(key => !['username', 'password'].includes(key))) {
    res.status(400).json({ error: 'Informe usuário e senha de acesso.' }); return;
  }
  try {
    const limit = await query<{ attempts: number }>(`INSERT INTO web_login_limits (scope, window_start, attempts) VALUES ('private_workspace', NOW(), 1)
      ON CONFLICT (scope) DO UPDATE SET
        attempts = CASE WHEN web_login_limits.window_start <= NOW() - INTERVAL '1 minute' THEN 1 ELSE web_login_limits.attempts + 1 END,
        window_start = CASE WHEN web_login_limits.window_start <= NOW() - INTERVAL '1 minute' THEN NOW() ELSE web_login_limits.window_start END
      RETURNING attempts`);
    if (limit.rows[0].attempts > 10) { res.set('Retry-After', '60').status(429).json({ error: 'Muitas tentativas. Aguarde um minuto.' }); return; }
    const user = (await query<{ username: string; password_hash: string; active: boolean }>('SELECT username, password_hash, active FROM web_users WHERE username = $1', [username])).rows[0];
    // Run scrypt for unknown users too, so the error and password work do not disclose the roster.
    const stored = user?.password_hash ?? `scrypt:${'0'.repeat(32)}:${'0'.repeat(128)}`;
    const verified = await verifyWebPassword(password, stored);
    if (!user?.active || !verified) { res.status(401).json({ error: 'Usuário ou senha inválidos.' }); return; }
    const old = cookieToken(req, config.cookie);
    if (old) await query('DELETE FROM web_sessions WHERE token_sha256 = $1', [digest(old)]);
    await query('DELETE FROM web_sessions WHERE expires_at <= NOW()');
    const token = randomBytes(32).toString('hex');
    await query('INSERT INTO web_sessions (token_sha256, credential_sha256, expires_at, username) VALUES ($1, $2, $3, $4)', [digest(token), digest(user.password_hash), new Date(Date.now() + duration), username]);
    res.cookie(config.cookie, token, { ...cookieOptions(config.secure), maxAge: duration }).json({ authenticated: true, username });
  } catch { sessionUnavailable(res); }
});
webSessionRouter.delete('/session', async (req, res) => {
  const config = privateWebConfig()!, token = cookieToken(req, config.cookie);
  try {
    if (token) await query('DELETE FROM web_sessions WHERE token_sha256 = $1', [digest(token)]);
    res.clearCookie(config.cookie, cookieOptions(config.secure)).json({ authenticated: false });
  } catch { sessionUnavailable(res); }
});
webSessionRouter.use((error: unknown, _req: Request, res: express.Response, _next: express.NextFunction) => {
  // Body parser errors may contain the submitted body; never log an authentication body.
  res.status(400).json({ error: 'Requisição de acesso inválida.' });
});
