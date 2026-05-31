/**
 * EventFlow — PostgreSQL Database Client
 *
 * Direct PostgreSQL connection using pg (node-postgres).
 * Replaces Supabase client for local/self-hosted deployments.
 */

import { Pool, QueryResult, QueryResultRow } from 'pg';

// ============================================================
// Connection pool (singleton)
// ============================================================

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const connectionString =
      process.env.DATABASE_URL ||
      process.env.NEXT_PUBLIC_DATABASE_URL ||
      'postgresql://postgres:postgres@localhost:5432/eventflow';

    // Log the connection target (host/user/db only — never the password) so
    // misconfigured DATABASE_URL is obvious in container logs.
    try {
      const u = new URL(connectionString);
      console.log(`[db] connecting -> ${u.username}@${u.hostname}:${u.port || '5432'}${u.pathname}`);
    } catch {
      console.log('[db] connecting -> (could not parse DATABASE_URL)');
    }

    pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    // Log pool errors (don't crash)
    pool.on('error', (err) => {
      console.error('[db] Unexpected pool error:', err.message);
    });
  }
  return pool;
}

// ============================================================
// Query helpers
// ============================================================

export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const client = getPool();
  try {
    const result = await client.query<T>(text, params);
    return result;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[db] Query error:', msg, { text: text.slice(0, 120) });
    throw new Error(`Database query failed: ${msg}`);
  }
}

export async function querySingle<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<T | null> {
  const result = await query<T>(text, params);
  return result.rows?.[0] ?? null;
}

export async function queryMany<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<T[]> {
  const result = await query<T>(text, params);
  return result.rows ?? [];
}

// ============================================================
// Transaction helper
// ============================================================

export async function transaction<T>(
  callback: (client: any) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// ============================================================
// Health check
// ============================================================

export async function healthCheck(): Promise<boolean> {
  try {
    await query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

// ============================================================
// Cleanup (for tests / graceful shutdown)
// ============================================================

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export default { query, querySingle, queryMany, transaction, healthCheck, closePool };