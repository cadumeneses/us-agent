import { attachDatabasePool } from '@vercel/functions';
import pg, { type PoolClient, type QueryResult, type QueryResultRow } from 'pg';
import { requestScope } from '../security/request-context.js';

const { Pool } = pg;
const localDatabaseUrl = 'postgresql://us_agent:us_agent_local@localhost:5432/us_agent';
const databaseTarget = process.env.DATABASE_TARGET ?? 'local';
const targetConnectionString = databaseTarget === 'neon'
  ? process.env.DATABASE_URL_NEON
  : databaseTarget === 'local'
    ? process.env.DATABASE_URL_LOCAL ?? localDatabaseUrl
    : undefined;
const connectionString = process.env.DATABASE_URL
  ?? process.env.POSTGRES_URL
  ?? targetConnectionString;

export const pool = new Pool({
  connectionString,
  max: Number(process.env.DATABASE_POOL_MAX ?? 5),
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 10_000,
  allowExitOnIdle: !process.env.VERCEL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined
});

if (process.env.VERCEL) attachDatabasePool(pool);

pool.on('error', error => {
  console.error('Unexpected PostgreSQL pool error', error);
});

export function query<Row extends QueryResultRow>(text: string, values: unknown[] = []): Promise<QueryResult<Row>> {
  if (!connectionString) {
    throw new Error('DATABASE_URL não foi configurada. Consulte o arquivo .env.example.');
  }
  if (requestScope.getStore()) return withTransaction(client => client.query<Row>(text,values));
  return pool.query<Row>(text, values);
}

export async function withTransaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const scope = requestScope.getStore();
    if (scope) {
      if (scope.schema) {
        if (!/^[a-z_][a-z0-9_]{0,62}$/.test(scope.schema)) throw new Error('Invalid organization schema.');
        await client.query(`SET LOCAL search_path TO "${scope.schema}", pg_catalog`);
      }
      const literal = (value: string) => "'" + value.replaceAll("'", "''") + "'";
      await client.query(`SET LOCAL app.actor = ${literal(scope.actor)}`);
      await client.query(`SET LOCAL app.organization_id = ${literal(scope.organizationId)}`);
    }
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
