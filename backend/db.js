const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { Pool } = require('pg');

let pool;
if (process.env.DB_URL && process.env.DB_URL.trim() !== '') {
  // Use a single connection string (e.g., from Supabase)
  pool = new Pool({
    connectionString: process.env.DB_URL,
    ssl: { rejectUnauthorized: false },
  });
} else {
  // Use discrete env vars
  const ssl =
    String(process.env.DB_SSL).toLowerCase() === 'true'
      ? { rejectUnauthorized: false }
      : false;

  pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    ssl,
    max: 10,
  });
}

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
