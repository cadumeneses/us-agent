import assert from 'node:assert/strict';
import test from 'node:test';
import { loadMigrationRelease, migrationConnection, sqlHash, applyMigrationRelease, migrationPrefix } from './lib/deployment-migrations.mjs';

test('deployment release pins all reviewed migrations and excludes untracked local SQL', async () => {
  const migrations = await loadMigrationRelease();
  assert.equal(migrations.length, 32);
  assert.equal(migrations.at(-1).name, '031_organizations_and_audit.sql');
  const previous = migrationPrefix(migrations, '028_configurable_project_recommendations.sql');
  assert.equal(previous.length, 29);
  assert.equal(previous.at(-1).name, '028_configurable_project_recommendations.sql');
  assert.ok(!previous.some(row => row.name === '029_legacy_taxonomy_staging.sql'));
  assert.throws(() => migrationPrefix(migrations, 'unknown.sql'), /Unknown/);
  assert.ok(!migrations.some(row => row.name === '016_sheet_source_links.sql'));
  assert.equal(sqlHash('SELECT 1;\r\n'), sqlHash('SELECT 1;\n'));
  assert.notEqual(sqlHash('SELECT 1;\n'), sqlHash('SELECT 2;\n'));
});

test('deployment connection never falls back to runtime or local URLs and rejects poolers', () => {
  assert.throws(() => migrationConnection({ DATABASE_URL: 'postgres://user:secret@runtime/db' }), /MIGRATION_DATABASE_URL/);
  for (const value of ['not-a-url', 'https://example.com/db', 'postgres://u:p@ep-test-pooler.neon.tech/db', 'postgres://u:p@host/db?pgbouncer=true']) {
    assert.throws(() => migrationConnection({ MIGRATION_DATABASE_URL: value }));
  }
  const result = migrationConnection({ DATABASE_URL_UNPOOLED: 'postgres://user:secret@ep-test.neon.tech/db?sslmode=require' });
  assert.equal(result.target, 'ep-test.neon.tech:5432/db');
  assert.ok(!result.target.includes('secret'));
});

test('failed SQL rolls back without recording migration and releases the advisory lock', async () => {
  const queries = [];
  const client = { query: async (sql, params) => {
    queries.push({ sql, params });
    if (sql.startsWith('SELECT pg_try')) return { rows: [{ acquired: true }] };
    if (sql.startsWith('SELECT 1 FROM')) return { rowCount: 0 };
    if (sql === 'BROKEN SQL') throw Object.assign(Error('private database details'), { code: '42601' });
    return { rows: [] };
  } };
  await assert.rejects(applyMigrationRelease(client, [{ name: '001_test.sql', sql: 'BROKEN SQL' }]), /001_test.sql; PostgreSQL code: 42601/);
  assert.ok(queries.some(row => row.sql === 'ROLLBACK'));
  assert.ok(!queries.some(row => row.sql.startsWith('INSERT INTO schema_migrations')));
  assert.ok(queries.at(-1).sql.startsWith('SELECT pg_advisory_unlock'));
});

test('concurrent runner cannot create tables or apply SQL while the migration lock is held', async () => {
  const queries = [];
  await assert.rejects(applyMigrationRelease({ query: async sql => {
    queries.push(sql); return { rows: [{ acquired: false }] };
  } }, []), /holds the database lock/);
  assert.equal(queries.length, 1);
});

test('an already applied migration is skipped and later migration is committed once', async () => {
  const queries = [], applied = ['001_old.sql'];
  const client = { query: async (sql, params) => {
    queries.push(sql);
    if (sql.startsWith('SELECT pg_try')) return { rows: [{ acquired: true }] };
    if (sql.startsWith('SELECT 1 FROM')) return { rowCount: applied.includes(params[0]) ? 1 : 0 };
    if (sql.startsWith('INSERT INTO')) applied.push(params[0]);
    if (sql.startsWith('SELECT current_schema')) return { rows: [{ schema: 'public', database: 'test' }] };
    if (sql.startsWith('SELECT to_regclass')) return { rows: [{ present: true }] };
    if (sql.startsWith('SELECT name FROM')) return { rows: applied.map(name => ({ name })) };
    return { rows: [] };
  } };
  const status = await applyMigrationRelease(client, [{ name: '001_old.sql', sql: 'DO NOT RUN' }, { name: '002_new.sql', sql: 'SELECT 2' }]);
  assert.ok(!queries.includes('DO NOT RUN'));
  assert.equal(queries.filter(sql => sql === 'COMMIT').length, 1);
  assert.deepEqual(status.pending, []);
});
