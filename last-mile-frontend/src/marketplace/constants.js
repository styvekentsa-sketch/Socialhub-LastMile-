// Tris acceptes par GET /api/marketplace/products (marketplaceProController : PRO_SORTS)
export const SORT_OPTIONS = ['newest', 'price_asc', 'price_desc', 'top_rated']

// Anciennes valeurs d'URL (premiere version du catalogue) converties vers les nouvelles
export const LEGACY_SORTS = { recent: 'newest', name: 'newest' }

// Quartiers desservis (identiques a la liste du paiement /shop/:slug/commande et du serveur)
export const DELIVERY_ZONES = ['Akwa', 'Bonamoussadi', 'Ndogbong', 'Bonapriso', 'Deido']
export const DELIVERY_ZONE_KEY = 'last-mile-marketplace-zone'
