import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("❌ THIẾU DATABASE_URL: Vui lòng cấu hình biến môi trường DATABASE_URL!");
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.on('error', (err) => {
  console.error('Lỗi kết nối PostgreSQL:', err);
});

export const query = async (text, params) => {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  // console.log(`[SQL] executed query in ${duration}ms:`, { text, rows: res.rowCount });
  return res;
};

export const getClient = async () => {
  const client = await pool.connect();
  return client;
};

export const checkDBConnection = async () => {
  try {
    const res = await query('SELECT NOW()');
    console.log('✅ Kết nối PostgreSQL thành công! Time:', res.rows[0].now);
  } catch (err) {
    console.error('❌ Lỗi kết nối PostgreSQL:', err.message);
  }
};
