// Devises d'affichage du portail. Les prix restent stockes, filtres et payes en francs CFA (XAF) :
// la conversion ne concerne que l'affichage.
//
// Taux configurables : nombre de francs CFA pour 1 unite de devise.
// - EUR : parite fixe du franc CFA (1 EUR = 655,957 XAF).
// - USD : taux indicatif, a ajuster via VITE_MARKETPLACE_RATE_USD (fichier .env du frontend).
const readRate = (value, fallback) => {
  const rate = Number(value)
  return Number.isFinite(rate) && rate > 0 ? rate : fallback
}

export const CURRENCIES = {
  XAF: { code: 'XAF', label: 'FCFA', rate: 1, decimals: 0 },
  EUR: { code: 'EUR', label: 'EUR', rate: readRate(import.meta.env.VITE_MARKETPLACE_RATE_EUR, 655.957), decimals: 2 },
  USD: { code: 'USD', label: 'USD', rate: readRate(import.meta.env.VITE_MARKETPLACE_RATE_USD, 600), decimals: 2 },
}

export const DEFAULT_CURRENCY = 'XAF'
export const CURRENCY_CODES = Object.keys(CURRENCIES)

/** Montant en XAF converti dans la devise d'affichage. */
export const convertFromXaf = (amount, code) => (Number(amount) || 0) / (CURRENCIES[code] || CURRENCIES.XAF).rate
