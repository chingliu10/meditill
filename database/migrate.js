const fs = require('fs');
const path = require('path');
const { pool } = require('../src/config/db');

async function run() {
  const client = await pool.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version varchar(120) PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const dir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
    for (const file of files) {
      const exists = await client.query('SELECT 1 FROM schema_migrations WHERE version=$1',[file]);
      if (exists.rowCount) continue;
      const sql = fs.readFileSync(path.join(dir,file),'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations(version) VALUES($1)',[file]);
        await client.query('COMMIT');
        console.log('Applied', file);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}
run().catch(e=>{ console.error(e); process.exit(1); });
