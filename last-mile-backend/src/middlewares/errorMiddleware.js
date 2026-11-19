// FILE: src/middlewares/errorMiddleware.js
export const notFoundHandler = (req, res, next) => {
  res.status(404).json({ error: `Route introuvable : ${req.originalUrl}` });
};

export const globalErrorHandler = (err, req, res, next) => {
  console.error('--- ERREUR CAPTUREE PAR LE MIDDLEWARE GLOBAL ---');
  console.error(err.stack);
  console.error('------------------------------------------------');

  const statusCode = err.statusCode || (res.statusCode === 200 ? 500 : res.statusCode);

  res.status(statusCode).json({
    error: err.message || 'Une erreur interne du serveur est survenue.',
    // Code metier (ex. INVALID_CURRENT_PASSWORD) pour les erreurs volontaires uniquement
    ...(err.statusCode && err.statusCode < 500 && typeof err.code === 'string' && /^[A-Z_]+$/.test(err.code) ? { code: err.code } : {}),
    stack: process.env.NODE_ENV === 'production' ? null : err.stack
  });
};
