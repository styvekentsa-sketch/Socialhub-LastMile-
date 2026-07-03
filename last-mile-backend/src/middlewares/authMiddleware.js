// FILE: src/middlewares/authMiddleware.js
import jwt from 'jsonwebtoken';

const createUnauthorizedError = (message) => {
  const error = new Error(message);
  error.statusCode = 401;
  return error;
};

export const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw createUnauthorizedError('Acces refuse. Token manquant.');
    }

    const token = authHeader.slice(7).trim();

    if (!token) {
      throw createUnauthorizedError('Acces refuse. Token manquant.');
    }

    if (!process.env.JWT_SECRET) {
      throw new Error('Configuration JWT manquante.');
    }

    req.user = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      error.message = 'Token invalide ou expire.';
      error.statusCode = 401;
    }

    if (error.statusCode) {
      res.status(error.statusCode);
    }

    return next(error);
  }
};

export const authenticateJWT = protect;

export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Acces interdit. Autorisation insuffisante.' });
    }

    return next();
  };
};
