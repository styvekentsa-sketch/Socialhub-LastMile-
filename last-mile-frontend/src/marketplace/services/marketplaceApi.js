import api, { getApiStatus } from '../../services/api.js'

// Client des routes publiques de la marketplace (aucune authentification requise).
// Reutilise l'instance axios de l'application pour partager la meme URL d'API (VITE_API_URL).

// Retire les parametres vides pour garder des URL d'API propres
const compactParams = (params) => Object.fromEntries(
  Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '' && value !== false),
)

export const fetchMarketplaceHome = async ({ signal } = {}) => {
  const { data } = await api.get('/api/public/marketplace', { signal })
  return data
}

/**
 * params : { q, category, shop, min_price, max_price, in_stock, sort, page, limit }
 * Reponse : { items, pagination: { page, limit, total, total_pages }, filters }
 */
export const fetchProducts = async (params = {}, { signal } = {}) => {
  const { data } = await api.get('/api/public/products', { params: compactParams(params), signal })
  return data
}

export const isRequestCancelled = (error) => error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError'

/** Cle de message d'erreur (voir i18n.js) adaptee a la reponse du serveur. */
export const getErrorKey = (error) => {
  const status = getApiStatus(error)
  if (status === 429) return 'errors.rateLimited'
  if (status === 400) return 'errors.badRequest'
  return 'errors.generic'
}
