import pkg from 'pg';
const { Pool } = pkg;

import dotenv from 'dotenv';
dotenv.config(); // ✅ FIXED (no custom path)

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Required for Neon / Render
  },
});

// Guard check
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL is missing. Set it in your environment variables.');
  process.exit(1);
}

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
        type VARCHAR(50) NOT NULL,
        text TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('✅ Database tables initialized');
  } catch (err) {
    console.error('❌ Error connecting to database:', err.message);
    process.exit(1);
  } finally {
    if (client) client.release();
  }
};

export { pool, initDB };
export default pool;