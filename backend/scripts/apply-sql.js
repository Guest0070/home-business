import dotenv from 'dotenv';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

dotenv.config();

const sqlFiles = process.argv.slice(2);

if (sqlFiles.length === 0) {
  console.error('Usage: node scripts/apply-sql.js <sql-file> [sql-file...]');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is missing. Set it in backend/.env first.');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined
});

try {
  for (const sqlFile of sqlFiles) {
    const filePath = path.resolve(process.cwd(), sqlFile);
    const sql = await readFile(filePath, 'utf8');
    await pool.query(sql);
    console.log(`Applied ${sqlFile}`);
  }
} catch (error) {
  console.error('Failed to apply SQL');
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
