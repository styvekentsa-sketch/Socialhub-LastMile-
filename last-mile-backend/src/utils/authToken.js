import jwt from 'jsonwebtoken';

/** Jeton de session (24 h) portant la version de session de l'utilisateur (voir tokenVersionService). */
export const signSessionToken = (user, tokenVersion = 0) => jwt.sign(
  { id: user.id, role: user.role, tv: Number(tokenVersion) || 0 },
  process.env.JWT_SECRET,
  { expiresIn: '24h' }
);
