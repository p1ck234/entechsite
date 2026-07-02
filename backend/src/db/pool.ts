import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

export const resolveDatabaseUrl = (): string => {
  let databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl || databaseUrl.includes('{{') || databaseUrl.trim() === '') {
    const pgHost = process.env.PGHOST;
    const pgPort = process.env.PGPORT || '5432';
    const pgUser = process.env.PGUSER;
    const pgPassword = process.env.PGPASSWORD;
    const pgDatabase = process.env.PGDATABASE;

    if (pgHost && pgUser && pgPassword && pgDatabase) {
      databaseUrl = `postgresql://${pgUser}:${pgPassword}@${pgHost}:${pgPort}/${pgDatabase}`;
      console.log('✅ DATABASE_URL собран из переменных PostgreSQL');
    } else {
      databaseUrl =
        process.env.POSTGRES_URL ||
        process.env.POSTGRES_DATABASE_URL ||
        process.env.DATABASE_CONNECTION_STRING ||
        '';
    }

    if ((!databaseUrl || databaseUrl.includes('{{') || databaseUrl.trim() === '') && !pgHost) {
      const possibleServiceNames = ['Postgres', 'PostgreSQL', 'Database', 'Postgresql', 'DB', 'pg'];

      for (const serviceName of possibleServiceNames) {
        const possibleKeys = [
          `${serviceName}_DATABASE_URL`,
          `${serviceName.toUpperCase()}_DATABASE_URL`,
          `${serviceName.toLowerCase()}_DATABASE_URL`,
        ];

        for (const key of possibleKeys) {
          if (process.env[key] && !process.env[key]!.includes('{{')) {
            databaseUrl = process.env[key]!;
            console.log(`✅ DATABASE_URL найден в переменной: ${key}`);
            break;
          }
        }

        if (databaseUrl && !databaseUrl.includes('{{')) {
          break;
        }
      }
    }

    if (!databaseUrl || databaseUrl.includes('{{') || databaseUrl.trim() === '') {
      console.warn('⚠️ DATABASE_URL не найден в переменных окружения');
      console.warn('📦 Используем fallback Railway internal URL');
      databaseUrl =
        'postgresql://postgres:fMRvspHdgKpSjCIPQDizWQFwpYPNNtJf@postgres.railway.internal:5432/railway';
    } else {
      console.log('✅ DATABASE_URL найден в переменных окружения');
    }
  }

  return databaseUrl;
};

const connectionString = resolveDatabaseUrl();

export const pool = new Pool({
  connectionString,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error:', error);
});

export const getDatabaseUrl = (): string => connectionString;
