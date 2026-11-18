import { randomInt } from 'node:crypto';

// Code de suivi public : LM-XXXX-XXXX, tire au hasard (generateur cryptographique), NON sequentiel.
// Alphabet sans caracteres ambigus a la lecture ou a la dictee : ni 0/O, ni 1/I/L.
// 31^8 ≈ 8,5 x 10^11 combinaisons : impossible a deviner en essayant au hasard,
// d'autant que la route de suivi est limitee en debit.
export const TRACKING_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const TRACKING_CODE_PATTERN = /^LM-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/;

const randomBlock = () => Array.from({ length: 4 }, () => TRACKING_CODE_ALPHABET[randomInt(TRACKING_CODE_ALPHABET.length)]).join('');

export const generateTrackingCode = () => `LM-${randomBlock()}-${randomBlock()}`;

/** Accepte la saisie d'un visiteur (minuscules, espaces) et renvoie le code normalise, ou null. */
export const normalizeTrackingCode = (value) => {
  const code = String(value || '').trim().toUpperCase().replace(/\s+/g, '');
  return TRACKING_CODE_PATTERN.test(code) ? code : null;
};

const isTrackingCodeCollision = (error) => (
  error?.code === 'ER_DUP_ENTRY' && String(error.message).includes('uq_orders_tracking_code')
);

/**
 * Insere une commande avec un code de suivi neuf. En cas de collision (extremement rare),
 * un autre code est tire. Une erreur de cle dupliquee n'annule pas la transaction InnoDB en cours.
 * runInsert(code) doit executer l'INSERT et renvoyer son resultat.
 */
export const insertWithTrackingCode = async (runInsert, maxAttempts = 5) => {
  for (let attempt = 1; ; attempt += 1) {
    const trackingCode = generateTrackingCode();

    try {
      const result = await runInsert(trackingCode);
      return { result, trackingCode };
    } catch (error) {
      if (!isTrackingCodeCollision(error) || attempt >= maxAttempts) {
        throw error;
      }
    }
  }
};
