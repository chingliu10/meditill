require('dotenv').config();

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3000),
  databaseUrl: process.env.DATABASE_URL,
  sessionSecret: process.env.SESSION_SECRET || 'dev-only-change-me',
  appName: process.env.APP_NAME || 'MediTill',
  currency: process.env.APP_CURRENCY || 'TZS',
  timezone: process.env.APP_TIMEZONE || 'Africa/Dar_es_Salaam'
};

if (!env.databaseUrl) throw new Error('DATABASE_URL is required');

module.exports = env;
