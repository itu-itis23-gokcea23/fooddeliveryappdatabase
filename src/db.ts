import { Pool, QueryResult } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Supabase requires SSL. This also works fine locally if your DB supports SSL.
  ssl: process.env.PGSSLMODE === 'disable' ? undefined : { rejectUnauthorized: false },
});

pool.on('connect', () => {
  console.log('Connected to the PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Eager check so you see DB issues immediately at startup (DNS/SSL/password/etc.)
pool
  .connect()
  .then((client) => client.release())
  .catch((err) => {
    console.error('Failed to connect to PostgreSQL. Check DATABASE_URL / internet / SSL.', err);
  });

export const query = async (text: string, params?: any[]): Promise<QueryResult> => {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  console.log('Executed query', { text, duration, rows: res.rowCount });
  return res;
};

export const getClient = () => pool.connect();

