import { attachDatabasePool } from '@vercel/functions';
import pg, { type PoolClient, type QueryResult, type QueryResultRow } from 'pg';

const { Pool } = pg;
const localDatabaseUrl = 'postgresql://us_agent:us_agent_local@localhost:5432/us_agent';
const connectionString = process.env.DATABASE_URL
  ?? process.env.POSTGRES_URL
  ?? (!process.env.VERCEL && process.env.NODE_ENV !== 'production' ? localDatabaseUrl : undefined);

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
  return pool.query<Row>(text, values);
}

export async function withTransaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
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
