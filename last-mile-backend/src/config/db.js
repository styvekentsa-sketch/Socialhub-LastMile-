import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const parsePositiveInteger = (value, fallback) => {
  const parsedValue = Number.parseInt(value, 10);
  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : fallback;
};

const getSslConfig = () => {
  if (process.env.DB_SSL !== 'true') {
    return undefined;
  }

  return {
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false'
  };
};

const getDatabaseConfig = () => {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const ssl = getSslConfig();

  if (!databaseUrl) {
    return {
      host: process.env.DB_HOST || 'localhost',
      port: parsePositiveInteger(process.env.DB_PORT, 3306),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'e-commerce',
      ...(ssl ? { ssl } : {})
    };
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL est invalide.');
  }

  if (!['mysql:', 'mysql2:'].includes(parsedUrl.protocol)) {
    throw new Error('DATABASE_URL doit utiliser le protocole mysql://.');
  }

  const database = decodeURIComponent(parsedUrl.pathname.replace(/^\//, ''));

  if (!parsedUrl.hostname || !parsedUrl.username || !database) {
    throw new Error('DATABASE_URL doit contenir un hote, un utilisateur et une base de donnees.');
  }

  return {
    host: parsedUrl.hostname,
    port: parsePositiveInteger(parsedUrl.port, 3306),
    user: decodeURIComponent(parsedUrl.username),
    password: decodeURIComponent(parsedUrl.password),
    database,
    ...(ssl ? { ssl } : {})
  };
};

const pool = mysql.createPool({
  ...getDatabaseConfig(),
  waitForConnections: true,
  connectionLimit: parsePositiveInteger(process.env.DB_CONNECTION_LIMIT, 10),
  queueLimit: 0
});

export default pool;
