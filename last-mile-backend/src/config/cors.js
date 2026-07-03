import dotenv from 'dotenv';

dotenv.config();

const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);

if (process.env.NODE_ENV === 'production' && allowedOrigins.length === 0) {
  throw new Error('CORS_ORIGIN doit etre configure en production.');
}

const validateOrigin = (origin, callback) => {
  if (!origin) {
    return callback(null, true);
  }

  const normalizedOrigin = origin.replace(/\/$/, '');

  if (allowedOrigins.includes(normalizedOrigin)) {
    return callback(null, true);
  }

  const error = new Error('Origine non autorisee par CORS.');
  error.statusCode = 403;
  return callback(error);
};

export const corsOptions = {
  allowedHeaders: ['Authorization', 'Content-Type'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  origin: validateOrigin
};

export const socketCorsOptions = {
  credentials: true,
  methods: ['GET', 'POST'],
  origin: validateOrigin
};
