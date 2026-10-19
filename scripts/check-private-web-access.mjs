// Integration verification against a disposable schema in the project's LOCAL PostgreSQL.
import assert from 'node:assert/strict';
import { randomBytes, createHash } from 'node:crypto';
import pg from 'pg';
import { loadMigrationRelease, applyMigrationRelease, migrationStatus } from './lib/deployment-migrations.mjs';
import { prepareWebUsers, provisionWebUsers } from './lib/web-user-provisioning.mjs';

const schema = `private_web_check_${randomBytes(12).toString('hex')}`;
assert.match(schema, /^private_web_check_[a-f0-9]{24}$/);
const url = 'postgresql://us_agent:us_agent_local@127.0.0.1:5432/us_agent';
const admin = new pg.Client({ connectionString: url, connectionTimeoutMillis: 10000 });
let client, server, pool, created = false;
try {
  await admin.connect(); await admin.query(`CREATE SCHEMA ${schema}`); created = true;
  const scoped = `${url}?options=${encodeURIComponent(`-c search_path=${schema}`)}`;
  client = new pg.Client({ connectionString: scoped }); await client.connect();
  const migrations = await loadMigrationRelease();
  const initial = await migrationStatus(client, migrations);
  assert.equal(initial.pending.length, 27);
  await applyMigrationRelease(client, migrations);
  assert.deepEqual((await migrationStatus(client, migrations)).pending, []);
  let reapplied = 0; await applyMigrationRelease(client, migrations, () => reapplied++); assert.equal(reapplied, 0);
  process.env.DATABASE_URL = scoped; process.env.NODE_ENV = 'test'; process.env.API_ACCESS_MODE = 'protected';
  process.env.INGEST_API_KEY = 'synthetic-integration-key-not-used-by-browser';
  delete process.env.VERCEL; delete process.env.DATABASE_SSL;
  const password = 'synthetic-private-password-for-tests';
  const usernames = ['mirko', 'danyllo', 'emanuel', 'carlos', 'ademar'];
  const seed = await prepareWebUsers(password, usernames);
  assert.equal(new Set(seed.users.map(user => user.passwordHash)).size, 5);
  assert.ok((await provisionWebUsers(client, seed.users)).every(row => row.status === 'would_create'));
  assert.equal((await client.query('SELECT COUNT(*)::int AS count FROM web_users')).rows[0].count, 0);
  assert.ok((await provisionWebUsers(client, seed.users, true)).every(row => row.status === 'created'));
  const reseed = await prepareWebUsers('different-fixture-password', usernames);
  assert.ok((await provisionWebUsers(client, reseed.users, true)).every(row => row.status === 'existing_unchanged'));
  const { createApp } = await import('../apps/api/dist/app.js');
  ({ pool } = await import('../apps/api/dist/database/pool.js'));
  server = createApp().listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  process.env.WEB_APP_ORIGIN = origin; process.env.API_ALLOWED_ORIGINS = origin;
  const request = (path, options = {}) => fetch(origin + path, options);
  const login = (value, extra = {}, username = 'mirko') => request('/api/auth/session', { method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json', ...extra }, body: JSON.stringify({ username, password: value }) });
  assert.equal((await request('/api/context')).status, 401);
  assert.deepEqual(await (await request('/api/auth/session')).json(), { enabled: true, authenticated: false });
  assert.equal((await login('incorrect')).status, 401);
  assert.equal((await login(password, {}, 'unknown')).status, 401);
  assert.equal((await login(password, { Origin: 'https://attacker.example' })).status, 403);
  const response = await login(password); assert.equal(response.status, 200);
  const setCookie = response.headers.get('set-cookie');
  assert.match(setCookie, /HttpOnly/); assert.match(setCookie, /SameSite=Strict/); assert.match(setCookie, /Path=\//);
  assert.doesNotMatch(setCookie, /synthetic|password|scrypt/);
  const cookie = setCookie.split(';')[0], token = cookie.split('=')[1];
  const row = (await client.query('SELECT * FROM web_sessions')).rows[0];
  assert.equal(row.username, 'mirko');
  assert.equal(row.token_sha256, createHash('sha256').update(token).digest('hex'));
  assert.ok(!JSON.stringify(row).includes(token));
  const headers = { Cookie: cookie, Origin: origin };
  assert.equal((await request('/api/context', { headers })).status, 200);
  assert.equal((await (await request('/api/auth/session', { headers })).json()).username, 'mirko');
  for (const username of usernames.slice(1)) {
    const other = await login(password, {}, username); assert.equal(other.status, 200);
    const otherCookie = other.headers.get('set-cookie').split(';')[0];
    const state = await (await request('/api/auth/session', { headers: { Cookie: otherCookie } })).json();
    assert.equal(state.username, username);
  }
  assert.equal((await request('/api/internal/recommender-definitions', { headers })).status, 200);
  assert.equal((await request('/api/context', { headers: { ...headers, Authorization: 'Bearer wrong' } })).status, 401);
  assert.equal((await request('/api/context', { headers: { ...headers, Origin: 'https://attacker.example' } })).status, 403);
  assert.equal((await request('/api/projects', { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'csrf-attempt' }) })).status, 401);
  assert.equal((await request('/api/auth/session', { method: 'DELETE', headers })).status, 200);
  assert.equal((await request('/api/context', { headers })).status, 401);
  const login2 = await login(password), cookie2 = login2.headers.get('set-cookie').split(';')[0];
  await client.query("UPDATE web_sessions SET expires_at = NOW() - INTERVAL '1 second'");
  assert.equal((await request('/api/context', { headers: { Cookie: cookie2 } })).status, 401);
  const login3 = await login(password), cookie3 = login3.headers.get('set-cookie').split(';')[0];
  await client.query('UPDATE web_users SET password_hash = $1 WHERE username = $2', [reseed.users[0].passwordHash, 'mirko']);
  assert.equal((await request('/api/context', { headers: { Cookie: cookie3 } })).status, 401);
  await client.query("UPDATE web_login_limits SET attempts = 1 WHERE scope = 'private_workspace'");
  const activeLogin = await login(password, {}, 'carlos'), activeCookie = activeLogin.headers.get('set-cookie').split(';')[0];
  await client.query("UPDATE web_users SET active = FALSE WHERE username = 'carlos'");
  assert.equal((await request('/api/context', { headers: { Cookie: activeCookie } })).status, 401);
  assert.equal((await login(password, {}, 'carlos')).status, 401);
  // The durable global bucket limits login attempts across Function instances.
  await client.query("UPDATE web_login_limits SET attempts = 10 WHERE scope = 'private_workspace'");
  assert.equal((await login('incorrect')).status, 429);
  // Production cookie attributes are independent of untrusted proxy headers.
  process.env.VERCEL = '1'; process.env.WEB_APP_ORIGIN = 'https://us-agent-api.vercel.app';
  const { privateWebConfig } = await import('../apps/api/dist/security/web-sessions.js');
  assert.equal(privateWebConfig().secure, true); assert.equal(privateWebConfig().cookie, '__Host-us-agent-session');
  console.log(JSON.stringify({ passed: true, migrationCount: migrations.length, checks: ['fresh_database', 'idempotent_migrations', 'anonymous_denied', 'login',
    'five_user_logins', 'distinct_salts', 'provisioning_dry_run', 'existing_passwords_preserved', 'username_in_session', 'disabled_user_revokes',
    'cookie_flags', 'hashed_server_token', 'legacy_and_internal_routes', 'invalid_bearer_not_rescued', 'csrf_denied', 'logout_revokes', 'expiry', 'password_rotation', 'distributed_login_limit', 'production_secure_cookie'] }));
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  if (pool) await pool.end();
  if (client) await client.end();
  if (created) await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  await admin.end();
}
