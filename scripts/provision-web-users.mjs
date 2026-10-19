import assert from 'node:assert/strict';
import pg from 'pg';
import { migrationConnection } from './lib/deployment-migrations.mjs';
import { loadWebUsers, provisionWebUsers } from './lib/web-user-provisioning.mjs';

async function main() {
  const [mode, inputFlag, path, targetFlag, expectedTarget, ...extra] = process.argv.slice(2);
  assert.ok(['--dry-run', '--apply'].includes(mode) && inputFlag === '--input' && path && !extra.length,
    'Use --dry-run --input ignored-users.json | --apply --input ignored-users.json --expect-target host:port/database.');
  assert.ok(mode === '--apply' ? targetFlag === '--expect-target' && expectedTarget : !targetFlag, 'Apply requires an explicit expected target.');
  const users = await loadWebUsers(path), { connectionString, target } = migrationConnection(process.env);
  if (mode === '--apply') assert.equal(expectedTarget, target, 'Expected target differs from connection.');
  const client = new pg.Client({ connectionString, connectionTimeoutMillis: 10000 });
  try {
    await client.connect();
    const result = await provisionWebUsers(client, users, mode === '--apply');
    console.log(JSON.stringify({ target, readOnly: mode === '--dry-run', users: result }, null, 2));
  } finally { await client.end(); }
}
main().catch(error => {
  console.error(error.code ? `User provisioning failed (${error.code}).` : 'User provisioning failed. Check input, migration 026 and expected target; existing passwords are never overwritten.');
  process.exitCode = 1;
});
