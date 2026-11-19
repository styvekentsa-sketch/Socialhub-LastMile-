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

/** Reponse : { product, related_products } */
export const fetchProduct = async (productId, { signal } = {}) => {
  const { data } = await api.get(`/api/public/products/${encodeURIComponent(productId)}`, { signal })
  return data
}

/** params : { q, page, limit } ; reponse : { items, pagination } */
export const fetchShops = async (params = {}, { signal } = {}) => {
  const { data } = await api.get('/api/public/shops', { params: compactParams(params), signal })
  return data
}

/**
 * Suivi public par code (LM-XXXX-XXXX). Reponse anonymisee :
 * { tracking_code, status, is_final, progress: { steps, current_step_index }, shop, created_at, updated_at, history }
 */
export const fetchTracking = async (code, { signal } = {}) => {
  const { data } = await api.get(`/api/public/tracking/${encodeURIComponent(code)}`, { signal })
  return data
}

// ---------- API « marketplace pro » (/api/marketplace) ----------

/** params : { q, category, min_price, max_price, in_stock, merchant_id, sort: newest|price_asc|price_desc|top_rated, page, limit } */
export const fetchMarketplaceProducts = async (params = {}, { signal } = {}) => {
  const { data } = await api.get('/api/marketplace/products', { params: compactParams(params), signal })
  return data
}

/** Autocompletion : { products: [5 max], categories: [3 max] } */
export const fetchSuggestions = async (q, { signal } = {}) => {
  const { data } = await api.get('/api/marketplace/suggestions', { params: { q }, signal })
  return data
}

/** Fiche enrichie : { product, avg_rating, review_count, rating_distribution, reviews, similar_products } */
export const fetchProductDetails = async (productId, { signal } = {}) => {
  const { data } = await api.get(`/api/marketplace/products/${encodeURIComponent(productId)}`, { signal })
  return data
}

/** payload : { rating, customer_name, comment, tracking_code } ; reponse : { review } */
export const postReview = async (productId, payload) => {
  const { data } = await api.post(`/api/marketplace/products/${encodeURIComponent(productId)}/reviews`, payload)
  return data
}

/** Vitrine : { shop, products: { items, pagination, sort } } */
export const fetchShopShowcase = async (slug, params = {}, { signal } = {}) => {
  const { data } = await api.get(`/api/marketplace/shops/${encodeURIComponent(slug)}`, { params: compactParams(params), signal })
  return data
}

export const isRequestCancelled = (error) => error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError'

/** Cle de message d'erreur (voir i18n.js) adaptee a la reponse du serveur. */
export const getErrorKey = (error) => {
  const status = getApiStatus(error)
  if (status === 429) return 'errors.rateLimited'
  if (status === 400) return 'errors.badRequest'
  if (status === 404) return 'errors.notFound'
  return 'errors.generic'
}
