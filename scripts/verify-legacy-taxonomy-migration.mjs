import assert from 'node:assert/strict';
import pg from 'pg';
import { migrationConnection } from './lib/deployment-migrations.mjs';
import { verifyLegacyTaxonomyImports } from './lib/legacy-taxonomy-verification.mjs';

const [flag, expectedTarget, ...extra] = process.argv.slice(2);
assert.ok(flag === '--expect-target' && expectedTarget && !extra.length, 'Use --expect-target host:port/database with a direct migration connection.');
const { connectionString, target } = migrationConnection(process.env);
assert.equal(expectedTarget, target, 'Verification target differs from configured connection.');
const client = new pg.Client({ connectionString, connectionTimeoutMillis: 10000 });
try {
  await client.connect();
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const report = await verifyLegacyTaxonomyImports(client);
  await client.query('COMMIT');
  console.log(JSON.stringify({ target, readOnly: true, verified: true, ...report }, null, 2));
} catch (error) {
  console.error(error.code ? `Verification failed (PostgreSQL ${error.code}).` : error.message);
  process.exitCode = 1;
} finally { await client.end(); }
