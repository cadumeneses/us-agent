import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { pool } from './pool.js';

const migrationsDirectory = fileURLToPath(new URL('../../../../database/migrations/', import.meta.url));

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock(hashtext('us_agent_schema_migrations'))");
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const files = (await readdir(migrationsDirectory)).filter(file => file.endsWith('.sql')).sort();
    for (const file of files) {
      const applied = await client.query('SELECT 1 FROM schema_migrations WHERE name = $1', [file]);
      if (applied.rowCount) continue;

      console.log(`Applying migration ${file}`);
      await client.query('BEGIN');
      try {
        await client.query(await readFile(new URL(`../../../../database/migrations/${file}`, import.meta.url), 'utf8'));
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock(hashtext('us_agent_schema_migrations'))").catch(() => undefined);
    client.release();
    await pool.end();
  }
}

migrate().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
