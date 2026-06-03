import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
});

export async function query<T = any>(
  text: string,
  params?: any[],
): Promise<{ rows: T[]; rowCount: number | null }> {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV === "development" && duration > 100) {
    console.log("Slow query", {
      text: text.substring(0, 80),
      duration,
      rows: res.rowCount,
    });
  }
  return res;
}

/**
 * Runs `fn` inside a single database transaction on a dedicated connection.
 * Commits on success, rolls back on any thrown error (then re-throws).
 *
 * Usage:
 *   await withTransaction(async (txq) => {
 *     await txq('INSERT INTO ...', [...]);
 *     await txq('UPDATE ...', [...]);
 *   });
 *
 * `txq` has the same signature as `query` but always executes on the same
 * connection as the surrounding BEGIN/COMMIT/ROLLBACK.
 */
export async function withTransaction<T>(
  fn: (
    txq: <R = any>(
      text: string,
      params?: any[],
    ) => Promise<{ rows: R[]; rowCount: number | null }>,
  ) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const txq = <R = any>(text: string, params?: any[]) =>
      client.query(text, params) as unknown as Promise<{
        rows: R[];
        rowCount: number | null;
      }>;
    const result = await fn(txq);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
