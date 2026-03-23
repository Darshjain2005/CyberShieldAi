import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

// Guard: exit immediately if DATABASE_URL is not set
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL is missing. Set it in your environment variables.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Required for Neon DB / Render
  },
});

const initDB = async () => {
  let client;
  try {
    client = await pool.connect();
    console.log('✅ Database connected successfully');

    await client.query(`
      CREATE TABLE IF NOT EXISTS scans (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        hash VARCHAR(100),
        status VARCHAR(50) NOT NULL,
        confidence INTEGER NOT NULL,
        is_malicious BOOLEAN NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS activities (
        id SERIAL PRIMARY KEY,
        type VARCHAR(50) NOT NULL, -- CRITICAL, WARNING, INFO
        text TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('✅ Database tables initialized');
  } catch (err) {
    console.error('❌ Error connecting to database:', err.message);
    process.exit(1); // Stop the server if DB connection fails
  } finally {
    if (client) client.release();
  }
};

export { pool, initDB };
export default pool;
