import assert from 'node:assert/strict';
import pg from 'pg';
import { loadMigrationRelease, migrationConnection, migrationStatus, applyMigrationRelease } from './lib/deployment-migrations.mjs';

async function main() {
  const [mode, flag, expectedTarget, ...extra] = process.argv.slice(2);
  assert.ok(['--status', '--apply', '--verify-files'].includes(mode) && !extra.length, 'Use --verify-files | --status | --apply --expect-target host:port/database.');
  assert.ok(mode === '--apply' ? flag === '--expect-target' && expectedTarget : !flag, 'Applying requires --expect-target host:port/database; other modes take no arguments.');
  const migrations = await loadMigrationRelease();
  if (mode === '--verify-files') {
    console.log(JSON.stringify({ releaseVerified: true, migrations: migrations.map(row => row.name), hashFormat: 'sha256_utf8_lf' }, null, 2)); return;
  }
  const { connectionString, target } = migrationConnection(process.env);
  if (mode === '--apply') assert.equal(expectedTarget, target, 'Expected target differs from migration connection.');
  const client = new pg.Client({ connectionString, connectionTimeoutMillis: 10000 });
  try {
    await client.connect();
    if (mode === '--status') {
      await client.query('BEGIN READ ONLY');
      const status = await migrationStatus(client, migrations);
      await client.query('COMMIT');
      console.log(JSON.stringify({ target, readOnly: true, ...status }, null, 2));
    } else {
      const status = await applyMigrationRelease(client, migrations, name => console.log(`Applied ${name}`));
      console.log(JSON.stringify({ target, ...status }, null, 2));
    }
  } finally { await client.end(); }
}
main().catch(error => {
  // Connection errors can contain database details; never print the connection string.
  console.error(error.code ? `Deployment migration error (${error.code}). Check connection, SSL and permissions.` : error.message);
  process.exitCode = 1;
});
