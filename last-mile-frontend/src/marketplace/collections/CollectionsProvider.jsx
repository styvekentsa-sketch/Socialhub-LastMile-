import { useCallback, useEffect, useMemo, useState } from 'react'
import { DELIVERY_ZONE_KEY, DELIVERY_ZONES } from '../constants.js'
import { CURRENCY_CODES, DEFAULT_CURRENCY } from '../currency/currencyConfig.js'
import { readStored, writeStored } from '../storage.js'
import { CompareContext, CurrencyContext, PreferencesContext, toSnapshot, WishlistContext } from './collectionsContext.js'

const CURRENCY_KEY = 'last-mile-marketplace-currency'
const WISHLIST_KEY = 'last-mile-marketplace-wishlist'
const COMPARE_KEY = 'last-mile-marketplace-compare'
const MAX_WISHLIST = 100
const MAX_COMPARE = 3
const SEARCHES_KEY = 'last-mile-marketplace-searches'
const MAX_SEARCHES = 6

const readSearches = () => {
  const value = readStored(SEARCHES_KEY, [])
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.trim()).slice(0, MAX_SEARCHES) : []
}

const readList = (key, max) => {
  const value = readStored(key, [])
  return Array.isArray(value)
    ? value.filter((item) => Number.isSafeInteger(Number(item?.id)) && item.shop?.slug).map(toSnapshot).slice(0, max)
    : []
}

// Liste persistee + synchronisation entre onglets
function usePersistedList(key, max) {
  const [items, setItems] = useState(() => readList(key, max))

  useEffect(() => { writeStored(key, items) }, [key, items])

  useEffect(() => {
    const onStorage = (event) => { if (event.key === key) setItems(readList(key, max)) }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [key, max])

  return [items, setItems]
}

/** Devise d'affichage, favoris et comparateur du portail (stockes dans le navigateur du visiteur). */
export default function CollectionsProvider({ children }) {
  const [currency, setCurrencyState] = useState(() => {
    const stored = readStored(CURRENCY_KEY, DEFAULT_CURRENCY)
    return CURRENCY_CODES.includes(stored) ? stored : DEFAULT_CURRENCY
  })
  const [wishlist, setWishlist] = usePersistedList(WISHLIST_KEY, MAX_WISHLIST)
  const [compare, setCompare] = usePersistedList(COMPARE_KEY, MAX_COMPARE)
  const [isCompareOpen, setIsCompareOpen] = useState(false)
  const [deliveryZone, setDeliveryZoneState] = useState(() => {
    const stored = readStored(DELIVERY_ZONE_KEY, '')
    return DELIVERY_ZONES.includes(stored) ? stored : ''
  })
  const [recentSearches, setRecentSearches] = useState(readSearches)

  const setDeliveryZone = useCallback((zone) => {
    const next = DELIVERY_ZONES.includes(zone) ? zone : ''
    setDeliveryZoneState(next)
    writeStored(DELIVERY_ZONE_KEY, next)
  }, [])
  /** Ajoute une recherche en tete de l'historique (sans doublon, 6 au plus). */
  const addRecentSearch = useCallback((query) => {
    const value = String(query || '').trim().slice(0, 100)
    if (value.length < 2) return
    setRecentSearches((current) => {
      const next = [value, ...current.filter((item) => item.toLowerCase() !== value.toLowerCase())].slice(0, MAX_SEARCHES)
      writeStored(SEARCHES_KEY, next)
      return next
    })
  }, [])
  const clearRecentSearches = useCallback(() => {
    setRecentSearches([])
    writeStored(SEARCHES_KEY, [])
  }, [])

  const setCurrency = useCallback((code) => {
    if (!CURRENCY_CODES.includes(code)) return
    setCurrencyState(code)
    writeStored(CURRENCY_KEY, code)
  }, [])

  const toggleWishlist = useCallback((product) => {
    setWishlist((current) => (current.some((item) => item.id === Number(product.id))
      ? current.filter((item) => item.id !== Number(product.id))
      : [toSnapshot(product), ...current].slice(0, MAX_WISHLIST)))
  }, [setWishlist])
  const removeFromWishlist = useCallback((id) => setWishlist((current) => current.filter((item) => item.id !== Number(id))), [setWishlist])
  const clearWishlist = useCallback(() => setWishlist([]), [setWishlist])
  /** Remplace les instantanes par les donnees fraiches de l'API (prix, stock, note). */
  const refreshWishlist = useCallback((freshProducts, missingIds = []) => {
    const fresh = new Map(freshProducts.map((product) => [Number(product.id), toSnapshot(product)]))
    setWishlist((current) => current.filter((item) => !missingIds.includes(item.id)).map((item) => fresh.get(item.id) || item))
  }, [setWishlist])

  // Ajout au comparateur : refuse au-dela de 3 articles (retourne false)
  const addToCompare = useCallback((product) => {
    if (compare.some((item) => item.id === Number(product.id))) return true
    if (compare.length >= MAX_COMPARE) return false
    setCompare((current) => [...current, toSnapshot(product)].slice(0, MAX_COMPARE))
    return true
  }, [compare, setCompare])
  const removeFromCompare = useCallback((id) => setCompare((current) => current.filter((item) => item.id !== Number(id))), [setCompare])
  const clearCompare = useCallback(() => { setCompare([]); setIsCompareOpen(false) }, [setCompare])
  const openCompare = useCallback(() => setIsCompareOpen(true), [])
  const closeCompare = useCallback(() => setIsCompareOpen(false), [])

  const currencyValue = useMemo(() => ({ currency, setCurrency }), [currency, setCurrency])
  const wishlistValue = useMemo(() => ({
    items: wishlist,
    count: wishlist.length,
    has: (id) => wishlist.some((item) => item.id === Number(id)),
    toggle: toggleWishlist,
    remove: removeFromWishlist,
    clear: clearWishlist,
    refresh: refreshWishlist,
  }), [wishlist, toggleWishlist, removeFromWishlist, clearWishlist, refreshWishlist])
  const preferencesValue = useMemo(() => ({
    deliveryZone,
    setDeliveryZone,
    recentSearches,
    addRecentSearch,
    clearRecentSearches,
  }), [deliveryZone, setDeliveryZone, recentSearches, addRecentSearch, clearRecentSearches])
  const compareValue = useMemo(() => ({
    items: compare,
    count: compare.length,
    max: MAX_COMPARE,
    isFull: compare.length >= MAX_COMPARE,
    has: (id) => compare.some((item) => item.id === Number(id)),
    add: addToCompare,
    remove: removeFromCompare,
    clear: clearCompare,
    // Le comparateur ne s'ouvre qu'avec au moins un article
    isOpen: isCompareOpen && compare.length > 0,
    open: openCompare,
    close: closeCompare,
  }), [compare, addToCompare, removeFromCompare, clearCompare, isCompareOpen, openCompare, closeCompare])

  return (
    <CurrencyContext.Provider value={currencyValue}>
      <WishlistContext.Provider value={wishlistValue}>
        <CompareContext.Provider value={compareValue}>
          <PreferencesContext.Provider value={preferencesValue}>{children}</PreferencesContext.Provider>
        </CompareContext.Provider>
      </WishlistContext.Provider>
    </CurrencyContext.Provider>
  )
}
