import { createContext, useContext } from 'react'

export const CurrencyContext = createContext(null)
export const WishlistContext = createContext(null)
export const CompareContext = createContext(null)
export const PreferencesContext = createContext(null)

/** Devise d'affichage ; hors du portail (aucun fournisseur), les prix restent en FCFA. */
export const useCurrency = () => useContext(CurrencyContext)
/** null hors du portail : les composants masquent alors leurs boutons favoris / comparer. */
export const useWishlist = () => useContext(WishlistContext)
export const useCompare = () => useContext(CompareContext)
/** Zone de livraison par defaut et historique de recherche (null hors du portail). */
export const usePreferences = () => useContext(PreferencesContext)

/** Instantane minimal d'un produit (carte ou fiche de l'API) : aucune donnee personnelle. */
export const toSnapshot = (product) => ({
  id: Number(product.id),
  name: String(product.name || ''),
  price: Number(product.price) || 0,
  image_url: product.image_url || null,
  category: product.category || null,
  stock: Math.max(0, Number(product.stock) || 0),
  avg_rating: product.avg_rating ?? null,
  review_count: Number(product.review_count) || 0,
  shop: { name: String(product.shop?.name || ''), slug: String(product.shop?.slug || ''), verified: Boolean(product.shop?.verified) },
})
