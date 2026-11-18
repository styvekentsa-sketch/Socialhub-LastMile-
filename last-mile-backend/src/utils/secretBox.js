import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// Chiffrement des identifiants des canaux sociaux (AES-256-GCM, chiffrement authentifie).
// Cle : SOCIAL_CREDENTIALS_KEY, 32 octets encodes en base64 (ou 64 caracteres hexadecimaux).
// Generer une cle : node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
// La cle ne doit jamais etre versionnee ni stockee en base : une copie de la base seule ne livre aucun jeton.
// Limite connue : changer la cle rend les identifiants deja enregistres illisibles (pas de rotation automatique).
const ALGORITHM = 'aes-256-gcm';

const createConfigError = () => {
  const error = new Error('Chiffrement des identifiants non configure : definir SOCIAL_CREDENTIALS_KEY (32 octets en base64).');
  error.statusCode = 503;
  return error;
};

const getKey = () => {
  const raw = process.env.SOCIAL_CREDENTIALS_KEY?.trim();
  if (!raw) throw createConfigError();
  const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  if (key.length !== 32) throw createConfigError();
  return key;
};

/** Chiffre un objet ; renvoie une enveloppe JSON (texte) a stocker en base. */
export const encryptJson = (value) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return JSON.stringify({
    v: 1,
    alg: ALGORITHM,
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: data.toString('base64')
  });
};

/** Dechiffre une enveloppe produite par encryptJson. Leve une erreur si elle a ete alteree ou si la cle a change. */
export const decryptJson = (envelope) => {
  const { v, iv, tag, data } = JSON.parse(envelope);
  if (v !== 1) throw new Error('Format d\'identifiants chiffres inconnu.');
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  const plain = Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]);
  return JSON.parse(plain.toString('utf8'));
};
