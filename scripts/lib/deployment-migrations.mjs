import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

export const releasePath = new URL('../../database/migrations.release.json', import.meta.url);
export const sqlHash = text => createHash('sha256').update(text.replaceAll('\r\n', '\n')).digest('hex');

export async function loadMigrationRelease() {
  const release = JSON.parse(await readFile(releasePath, 'utf8'));
  assert.equal(release.schemaVersion, 1);
  assert.equal(release.hashFormat, 'sha256_utf8_lf');
  assert.ok(release.migrations.length > 0);
  const names = release.migrations.map(row => row.name);
  assert.deepEqual(names, [...new Set(names)].sort(), 'Migration names must be unique and sorted.');
  return Promise.all(release.migrations.map(async row => {
    assert.match(row.name, /^\d{3}_[a-z0-9_]+\.sql$/);
    const sql = await readFile(new URL(`../../database/migrations/${row.name}`, import.meta.url), 'utf8');
    assert.equal(sqlHash(sql), row.sha256, `Migration differs from release: ${row.name}`);
    return { ...row, sql };
  }));
}

export function migrationConnection(env) {
  // Never use the application pool URL or a local fallback for deployment migrations.
  const connectionString = env.MIGRATION_DATABASE_URL || env.DATABASE_URL_UNPOOLED || env.POSTGRES_URL_NON_POOLING;
  assert.ok(connectionString, 'Configure MIGRATION_DATABASE_URL with the direct database URL.');
  let url;
  try { url = new URL(connectionString); } catch { throw Error('Invalid migration database URL.'); }
  assert.ok(['postgres:', 'postgresql:'].includes(url.protocol), 'Expected a PostgreSQL URL.');
  assert.ok(!/pooler/i.test(url.hostname) && url.searchParams.get('pgbouncer') !== 'true', 'Migrations require a direct connection, without pooler.');
  const database = decodeURIComponent(url.pathname.slice(1));
  assert.ok(url.hostname && database, 'Migration target requires host and database.');
  return { connectionString, target: `${url.hostname}:${url.port || '5432'}/${encodeURIComponent(database)}` };
}

export async function migrationStatus(client, migrations) {
  const { rows: [schema] } = await client.query('SELECT current_schema() AS schema, current_database() AS database');
  const { rows: [registry] } = await client.query("SELECT to_regclass('schema_migrations') IS NOT NULL AS present");
  const applied = registry.present ? (await client.query('SELECT name FROM schema_migrations ORDER BY name')).rows.map(row => row.name) : [];
  const expected = migrations.map(row => row.name);
  return { ...schema, applied, pending: expected.filter(name => !applied.includes(name)),
    outsideRelease: applied.filter(name => !expected.includes(name)) };
}

export async function applyMigrationRelease(client, migrations, onApplied = () => {}) {
  const { rows: [lock] } = await client.query("SELECT pg_try_advisory_lock(hashtext('us_agent_schema_migrations')) AS acquired");
  assert.ok(lock.acquired, 'Another migration runner holds the database lock.');
  try {
    await client.query("SET lock_timeout = '10s'");
    await client.query("SET statement_timeout = '120s'");
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
    for (const migration of migrations) {
      if ((await client.query('SELECT 1 FROM schema_migrations WHERE name = $1', [migration.name])).rowCount) continue;
      await client.query('BEGIN');
      try {
        await client.query(migration.sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [migration.name]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw Error(`Migration failed: ${migration.name}; PostgreSQL code: ${error.code ?? 'unknown'}.`);
      }
      onApplied(migration.name);
    }
    return await migrationStatus(client, migrations);
  } finally {
    await client.query("SELECT pg_advisory_unlock(hashtext('us_agent_schema_migrations'))");
  }
}
