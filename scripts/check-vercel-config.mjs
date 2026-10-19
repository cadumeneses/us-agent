import assert from 'node:assert/strict';
import { migrationConnection, loadMigrationRelease } from './lib/deployment-migrations.mjs';

async function main() {
  const env = process.env, failures = [];
  const check = (name, valid) => { if (!valid) failures.push(name); return Boolean(valid); };
  const configured = value => value && !/replace-with|SUA_SENHA|SEU_ENDPOINT|example\.com/i.test(value);
  let database = false;
  try { const url = new URL(env.DATABASE_URL || env.POSTGRES_URL); database = ['postgres:', 'postgresql:'].includes(url.protocol); } catch {}
  const checks = {
    runtimeDatabase: check('DATABASE_URL (runtime)', database),
    apiCredential: check('INGEST_API_KEY (server only)', configured(env.INGEST_API_KEY) && env.INGEST_API_KEY.trim().length >= 32),
    protectedMode: check('API_ACCESS_MODE=protected', env.API_ACCESS_MODE === 'protected'),
    httpsOrigin: check('API_ALLOWED_ORIGINS (exact HTTPS web origin)', (env.API_ALLOWED_ORIGINS || '').split(',').some(value => {
      try { const url = new URL(value.trim()); return url.protocol === 'https:' && url.origin === value.trim(); } catch { return false; }
    })),
    noPublicApiSecret: check('Remove VITE_INGEST_API_KEY and VITE_WEB_ACCESS_PASSWORD_HASH', !env.VITE_INGEST_API_KEY && !env.VITE_WEB_ACCESS_PASSWORD_HASH),
    privateWebOrigin: check('WEB_APP_ORIGIN (exact HTTPS web origin)', (() => {
      try { const url = new URL(env.WEB_APP_ORIGIN); return url.protocol === 'https:' && url.origin === env.WEB_APP_ORIGIN && (env.API_ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).includes(url.origin); } catch { return false; }
    })())
  };
  try { migrationConnection(env); checks.directMigrationDatabase = true; }
  catch { checks.directMigrationDatabase = false; failures.push('MIGRATION_DATABASE_URL (direct connection)'); }
  const migrations = await loadMigrationRelease();
  console.log(JSON.stringify({ checks, migrationsInRelease: migrations.length, failures,
    browserAccess: 'database_users_with_server_sessions_requires_migrations_025_026_and_user_provisioning' }, null, 2));
  if (failures.length) process.exitCode = 1;
  const args = process.argv.slice(2);
  if (!args.length) return;
  assert.ok(args.length === 2 && args[0] === '--url', 'Use check-vercel-config [--url https://deployment.vercel.app].');
  const url = new URL(args[1]);
  assert.ok(url.protocol === 'https:' && url.pathname === '/' && !url.username && !url.password && !url.search && !url.hash, 'Use the exact HTTPS deployment origin.');
  const health = new URL('/api/health', url);
  const unauthenticated = await fetch(health, { redirect: 'error', signal: AbortSignal.timeout(15000) });
  console.log(JSON.stringify({ probe: 'unauthenticated_api', status: unauthenticated.status, expected: 401 }));
  if (unauthenticated.status !== 401) process.exitCode = 1;
  if (checks.apiCredential) {
    const authenticated = await fetch(health, { headers: { Authorization: `Bearer ${env.INGEST_API_KEY}` }, redirect: 'error', signal: AbortSignal.timeout(15000) });
    const body = await authenticated.json().catch(() => ({}));
    const connected = authenticated.ok && body.database === 'connected';
    console.log(JSON.stringify({ probe: 'authenticated_database_health', status: authenticated.status, connected }));
    if (!connected) process.exitCode = 1;
  }
}
main().catch(() => { console.error('Deployment check failed. Check options, network, credentials and target configuration; no secrets were printed.'); process.exitCode = 1; });
