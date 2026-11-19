// Limiteur de debit maison, en memoire, sans dependance externe.
// Fenetre fixe par adresse IP : au-dela de `max` requetes dans `windowMs`, reponse 429.
// En-tetes standard : RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset (+ Retry-After sur 429).
//
// Limite connue : l'etat est propre a chaque processus Node. Avec plusieurs instances derriere un
// repartiteur de charge, il faudra un stockage partage (Redis par exemple).
// Derriere un proxy, configurer TRUST_PROXY pour que req.ip soit l'IP reelle du visiteur.
const MAX_TRACKED_CLIENTS = 10000;

// keyGenerator : par defaut l'adresse IP ; peut etre l'utilisateur connecte (ex. limite par marchand)
const ipKey = (req) => req.ip || req.socket?.remoteAddress || 'inconnu';

export const createRateLimiter = ({ name, windowMs, max, keyGenerator = ipKey }) => {
  const clients = new Map();

  const purgeExpired = (now) => {
    for (const [key, entry] of clients) {
      if (entry.resetAt <= now) clients.delete(key);
    }
  };

  // Nettoyage periodique ; unref() pour ne pas empecher l'arret du processus
  setInterval(() => purgeExpired(Date.now()), windowMs).unref();

  return (req, res, next) => {
    const now = Date.now();
    const key = keyGenerator(req);
    let entry = clients.get(key);

    if (!entry || entry.resetAt <= now) {
      if (!entry && clients.size >= MAX_TRACKED_CLIENTS) {
        purgeExpired(now);
      }
      entry = { count: 0, resetAt: now + windowMs };
      clients.set(key, entry);
    }

    entry.count += 1;
    const resetInSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, max - entry.count)));
    res.setHeader('RateLimit-Reset', String(resetInSeconds));

    if (entry.count > max) {
      res.setHeader('Retry-After', String(resetInSeconds));
      // Reponse directe (pas next(error)) : un depassement de debit n'est pas une erreur serveur a journaliser
      return res.status(429).json({ error: `Trop de requetes (${name}). Reessayez dans ${resetInSeconds} s.` });
    }

    return next();
  };
};

// Suivi de colis : protege contre l'essai de codes au hasard
export const trackingRateLimiter = createRateLimiter({ name: 'suivi de colis', windowMs: 60 * 1000, max: 20 });

// Publication manuelle sur les reseaux sociaux : par marchand, pour ne pas faire bannir ses comptes
export const socialPublishRateLimiter = createRateLimiter({
  name: 'publication sociale',
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => `marchand-${req.user?.id ?? ipKey(req)}`
});

// Autocompletion : une requete par frappe, plafond plus large que la recherche
export const suggestionRateLimiter = createRateLimiter({ name: 'suggestions', windowMs: 60 * 1000, max: 120 });

// Depot d'avis : limite les essais de codes de suivi ou de numeros
export const reviewRateLimiter = createRateLimiter({ name: 'avis clients', windowMs: 15 * 60 * 1000, max: 20 });

// Catalogue et recherche produits
export const productSearchRateLimiter = createRateLimiter({ name: 'recherche produits', windowMs: 60 * 1000, max: 60 });

// Changement de mot de passe : 10 tentatives par quart d'heure et par compte (anti force brute du mot de passe actuel)
export const passwordChangeRateLimiter = createRateLimiter({
  name: 'changement de mot de passe',
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => `user:${req.user?.id ?? req.ip}`
});
