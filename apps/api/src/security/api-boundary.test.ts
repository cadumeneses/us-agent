import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { request as httpRequest } from 'node:http';
import test from 'node:test';
import express, { type Request } from 'express';
import { apiBoundary } from './api-boundary.js';
import { isLocalDevelopmentRequest } from '../routes/internal-authorization.js';

const envKeys = ['INGEST_API_KEY', 'NODE_ENV', 'VERCEL', 'API_ACCESS_MODE', 'API_ALLOWED_ORIGINS'] as const;
function environment(values: Partial<Record<typeof envKeys[number], string>> = {}) {
  for (const key of envKeys) { if (values[key] === undefined) delete process.env[key]; else process.env[key] = values[key]; }
}

test('API boundary rejects requests before handlers or body/upload parsing, across legacy and configurable routes', async t => {
  const saved = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
  // Importing the app does not open a database connection; denied routes never touch it.
  const { createApp } = await import('../app.js');
  const app = express(); app.disable('x-powered-by');
  let writes = 0;
  app.use('/probe', apiBoundary, express.json(), (_req, res) => { writes++; res.json({ ok: true }); });
  app.use(createApp());
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const root = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const send = (path = '/probe', options: RequestInit = {}) => fetch(root + path, options);
  try {
    environment({ NODE_ENV: 'production', INGEST_API_KEY: 'synthetic-test-credential' });
    const routes = [
      ['GET', '/api/context'], ['GET', '/api/stories'], ['GET', '/api/dashboard'], ['GET', '/api/taxonomy'], ['GET', '/api/health'],
      ['PUT', '/api/project-research-profile'], ['POST', '/api/sprints'], ['PATCH', '/api/sprints/1/status'], ['PUT', '/api/sprints/1/stories'],
      ['POST', '/api/taxonomy/operations'], ['POST', '/api/classify'], ['PATCH', '/api/classifications/1/review'],
      ['GET', '/api/classifications/1/details'], ['PUT', '/api/classifications/1/details'], ['GET', '/api/classifications/1/nfr-context'],
      ['POST', '/api/classifications/1/nfr-runs'], ['POST', '/api/nfr-runs/1/decisions'],
      ['POST', '/api/import'], ['POST', '/api/internal/classifications'],
      ['GET', '/api/internal/recommender-taxonomies'], ['GET', '/api/internal/recommender-definitions'],
      ['GET', '/api/internal/recommender-datasets'], ['GET', '/api/internal/recommendation-runs'],
      ['GET', '/api/internal/test-case-catalogs'], ['POST', '/api/internal/test-case-catalogs/test/versions/1/publish'],
      ['GET', '/api/internal/test-case-catalogs/test/versions/1/original'], ['POST', '/api/internal/test-case-catalogs/test/versions/1/retire'],
      ['POST', '/api/internal/recommender-datasets/imports/preview'], ['POST', '/api/internal/recommendation-runs/id/decisions'],
      ['GET', '/api/internal/test-case-reviews/id'], ['GET', '/api/internal/test-case-reviews/id/items/key'],
      ['POST', '/api/internal/test-case-reviews/id/target'], ['POST', '/api/internal/test-case-reviews/id/decisions'], ['POST', '/api/internal/test-case-reviews/id/copies'],
    ];
    for (const [method, path] of routes) {
      const response = await send(path, { method });
      assert.equal(response.status, 401, `${method} ${path}`);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(response.headers.get('access-control-allow-origin'), null);
      assert.equal(response.headers.get('x-powered-by'), null);
      assert.doesNotMatch(await response.text(), /synthetic-test-credential/);
    }
    // A malformed body must not reach the parser before authorization.
    assert.equal((await send('/probe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' })).status, 401);
    for (const authorization of ['wrong', 'synthetic-test-credential', 'Bearer wrong', 'Basic synthetic-test-credential', 'Bearer synthetic-test-credential extra']) {
      assert.equal((await send('/probe', { headers: { authorization } })).status, 401);
    }
    assert.equal(writes, 0);
    assert.equal((await send('/probe', { method: 'POST', headers: { authorization: 'Bearer synthetic-test-credential' } })).status, 200);
    assert.equal(writes, 1);
    const authorized = { authorization: 'Bearer synthetic-test-credential' };
    // A production request fails closed when the organization registry is unavailable.
    const { pool } = await import('../database/pool.js');
    const unavailableRegistry = t.mock.method(pool, 'query', async () => { throw new Error('Test registry unavailable'); });
    try {
      assert.equal((await send('/api/classifications/invalid/details', { headers: authorized })).status, 503);
    } finally { unavailableRegistry.mock.restore(); }
    environment({ INGEST_API_KEY: 'synthetic-test-credential' });
    assert.equal((await send('/api/classifications/invalid/details', { headers: authorized })).status, 400);
    const form = new FormData(); form.set('file', new Blob(['Como usuário, quero consultar meu cadastro para conferir os dados.']), 'synthetic.txt');
    const imported = await send('/api/import', { method: 'POST', headers: authorized, body: form });
    assert.equal(imported.status, 200);
    assert.equal((await imported.json() as { stories: string[] }).stories.length, 1);
    for (const values of [{ NODE_ENV: 'production' }, { VERCEL: '1' }, { API_ACCESS_MODE: 'protected' }, { API_ACCESS_MODE: 'typo' }]) {
      environment(values);
      assert.equal((await send()).status, 503);
    }
    environment();
    assert.equal((await send()).status, 200);
    // fetch normalizes Host in some Node releases; send the hostile Host on the wire explicitly.
    const hostileHostStatus = await new Promise<number | undefined>((resolve, reject) => {
      const req = httpRequest(root + '/probe', { headers: { Host: 'attacker.example' } }, res => { res.resume(); resolve(res.statusCode); });
      req.on('error', reject); req.end();
    });
    assert.equal(hostileHostStatus, 503);
    for (const header of ['Forwarded', 'X-Forwarded-For', 'X-Forwarded-Host', 'X-Forwarded-Proto', 'X-Real-IP']) {
      assert.equal((await send('/probe', { headers: { [header]: '127.0.0.1' } })).status, 503, header);
    }
    for (const origin of ['https://attacker.example', 'null', 'http://localhost:5173.attacker.example', 'http://localhost:5173/']) {
      assert.equal((await send('/probe', { method: 'POST', headers: { origin } })).status, 403, origin);
    }
    assert.equal((await send('/probe', { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
    for (const origin of [root, 'http://localhost:5173']) {
      const response = await send('/probe', { method: 'POST', headers: { origin, 'Sec-Fetch-Site': 'same-site' } });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('access-control-allow-origin'), origin);
      assert.match(response.headers.get('vary') ?? '', /Origin/);
    }
    const beforePreflight = writes;
    assert.equal((await send('/probe', { method: 'OPTIONS', headers: { origin: root, 'Access-Control-Request-Method': 'POST' } })).status, 204);
    assert.equal((await send('/probe', { method: 'OPTIONS' })).status, 403);
    assert.equal(writes, beforePreflight);
    environment({ NODE_ENV: 'production', INGEST_API_KEY: 'synthetic-test-credential', API_ALLOWED_ORIGINS: 'https://web.example' });
    const response = await send('/probe', { method: 'POST', headers: { origin: 'https://web.example', 'Sec-Fetch-Site': 'cross-site', authorization: 'Bearer synthetic-test-credential' } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), 'https://web.example');
    assert.equal((await send('/probe', { headers: { origin: 'https://web.example' } })).status, 401);
    assert.equal((await send('/probe', { headers: { origin: 'https://web.example.attacker.example', authorization: 'Bearer synthetic-test-credential' } })).status, 403);
    environment({ API_ALLOWED_ORIGINS: 'https://web.example' });
    assert.equal((await send('/probe', { headers: { origin: 'https://web.example', 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
  } finally {
    for (const key of envKeys) { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; }
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test('local development uses the socket peer and exact local Host, never spoofed request IPs', () => {
  const saved = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
  environment();
  const request = (peer: string, host: string) => ({ socket: { remoteAddress: peer }, ip: '127.0.0.1', header: (key: string) => key === 'host' ? host : undefined }) as unknown as Request;
  try {
    for (const peer of ['127.0.0.1', '::1', '::ffff:127.0.0.1']) {
      for (const host of ['localhost:3333', '127.0.0.1:3333', '[::1]:3333']) assert.equal(isLocalDevelopmentRequest(request(peer, host)), true);
    }
    for (const peer of ['203.0.113.1', '10.0.0.1', '::ffff:203.0.113.1']) assert.equal(isLocalDevelopmentRequest(request(peer, 'localhost:3333')), false);
    for (const host of ['localhost.attacker.example', '127.0.0.1.attacker.example', '127.1', '2130706433', 'attacker.example']) assert.equal(isLocalDevelopmentRequest(request('127.0.0.1', host)), false);
  } finally { for (const key of envKeys) { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; } }
});
