// Revocation des jetons JWT : chaque jeton porte la version de session de l'utilisateur (claim « tv »).
// Incrementer users.token_version invalide tous les jetons emis auparavant (« deconnecter les autres sessions »,
// changement de mot de passe). Les jetons emis avant cette fonctionnalite n'ont pas de « tv » : ils valent 0.
//
// Cache memoire court pour eviter une requete SQL a chaque appel authentifie. Le processus qui revoque
// met son cache a jour immediatement ; un eventuel autre processus le voit au plus tard apres CACHE_TTL_MS.
import pool from '../config/db.js';

const CACHE_TTL_MS = 30 * 1000;
const MAX_CACHE_ENTRIES = 5000;
const cache = new Map(); // userId -> { version, expiresAt }

const remember = (userId, version) => {
  if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value);
  cache.set(userId, { version, expiresAt: Date.now() + CACHE_TTL_MS });
};

/** Version courante (null si l'utilisateur n'existe plus). */
export const getTokenVersion = async (userId) => {
  const id = Number(userId);
  const cached = cache.get(id);
  if (cached && cached.expiresAt > Date.now()) return cached.version;

  const [rows] = await pool.query('SELECT token_version FROM users WHERE id = ?', [id]);
  const version = rows[0] ? Number(rows[0].token_version) : null;
  remember(id, version);
  return version;
};

/** Revoque tous les jetons existants de l'utilisateur ; retourne la nouvelle version. */
export const bumpTokenVersion = async (userId, connection = pool) => {
  const id = Number(userId);
  await connection.query('UPDATE users SET token_version = token_version + 1 WHERE id = ?', [id]);
  const [rows] = await connection.query('SELECT token_version FROM users WHERE id = ?', [id]);
  const version = Number(rows[0].token_version);
  remember(id, version);
  return version;
};

/** Le jeton decode correspond-il a la version de session courante ? */
export const isTokenCurrent = async (decoded) => {
  if (!decoded?.id) return false;
  const current = await getTokenVersion(decoded.id);
  return current !== null && Number(decoded.tv || 0) === current;
};
