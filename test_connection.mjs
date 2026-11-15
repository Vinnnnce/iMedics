import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  command_timeout: 5000
});

try {
  console.log('Testing simple query...');
  const result = await pool.query('SELECT 1 as test');
  console.log('Connection works:', result.rows);
} catch (e) {
  console.error('Connection failed:', e.message);
} finally {
  await pool.end();
}
