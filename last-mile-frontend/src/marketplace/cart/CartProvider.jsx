import { useCallback, useEffect, useMemo, useState } from 'react'
import { CartContext } from './cartContext.js'
import { loadCart, MAX_QUANTITY, saveCart } from './cartStorage.js'

const clampQuantity = (quantity, stock) => Math.max(1, Math.min(Math.floor(quantity) || 1, stock > 0 ? stock : MAX_QUANTITY, MAX_QUANTITY))

/** Panier multi-boutiques du portail : articles groupes par boutique au moment du paiement. */
export default function CartProvider({ children }) {
  const [lines, setLines] = useState(loadCart)
  const [isOpen, setIsOpen] = useState(false)
  // Confirmation affichee apres un ajout (cle unique pour relancer le minuteur)
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    saveCart(lines)
  }, [lines])

  // Synchronisation entre onglets (ex. panier vide par le paiement dans un autre onglet)
  useEffect(() => {
    const onStorage = (event) => {
      if (event.key === 'last-mile-marketplace-cart') setLines(loadCart())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  /** product : carte produit de l'API (id, name, price, image_url, stock, shop { slug, name }) */
  const addItem = useCallback((product, quantity = 1) => {
    setLines((current) => {
      const existing = current.find((line) => line.productId === product.id)
      if (existing) {
        return current.map((line) => (line.productId === product.id
          ? { ...line, stock: Number(product.stock), price: Number(product.price), quantity: clampQuantity(line.quantity + quantity, Number(product.stock)) }
          : line))
      }
      return [...current, {
        productId: product.id,
        name: product.name,
        price: Number(product.price),
        imageUrl: product.image_url || null,
        shopSlug: product.shop.slug,
        shopName: product.shop.name,
        stock: Number(product.stock),
        quantity: clampQuantity(quantity, Number(product.stock)),
      }]
    })
    setNotice({ key: Date.now(), name: product.name })
  }, [])

  const open = useCallback(() => { setNotice(null); setIsOpen(true) }, [])
  const close = useCallback(() => setIsOpen(false), [])
  const dismissNotice = useCallback(() => setNotice(null), [])

  const clearAll = useCallback(() => { setLines([]); setNotice(null) }, [])

  /** Retire du panier les articles d'une boutique (apres paiement confirme de sa commande). */
  const clearShop = useCallback((shopSlug) => {
    setLines((current) => current.filter((line) => line.shopSlug !== shopSlug))
  }, [])

  const updateQuantity = useCallback((productId, quantity) => {
    setLines((current) => current.map((line) => (line.productId === productId ? { ...line, quantity: clampQuantity(quantity, line.stock) } : line)))
  }, [])

  const removeItem = useCallback((productId) => {
    setLines((current) => current.filter((line) => line.productId !== productId))
  }, [])

  const value = useMemo(() => {
    const groups = Object.values(lines.reduce((acc, line) => {
      acc[line.shopSlug] ||= { shopSlug: line.shopSlug, shopName: line.shopName, lines: [], subtotal: 0 }
      acc[line.shopSlug].lines.push(line)
      acc[line.shopSlug].subtotal += line.price * line.quantity
      return acc
    }, {}))
    return {
      lines,
      groups,
      count: lines.reduce((total, line) => total + line.quantity, 0),
      total: lines.reduce((total, line) => total + line.price * line.quantity, 0),
      isOpen,
      open,
      close,
      notice,
      dismissNotice,
      addItem,
      updateQuantity,
      removeItem,
      clearShop,
      clearAll,
    }
  }, [lines, isOpen, notice, open, close, dismissNotice, addItem, updateQuantity, removeItem, clearShop, clearAll])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}
