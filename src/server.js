const app = require('./app');
const env = require('./config/env');
const { pool } = require('./config/db');

async function start() {
  await pool.query('SELECT 1');
  app.listen(env.port,()=>console.log(`${env.appName} listening on http://localhost:${env.port}`));
}

start().catch(error=>{console.error('Startup failed',error);process.exit(1)});
