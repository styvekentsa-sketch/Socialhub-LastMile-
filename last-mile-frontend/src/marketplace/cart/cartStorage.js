// Panier du portail public, conserve dans le navigateur du visiteur (localStorage).
// Commodite par visiteur uniquement : le paiement relit toujours les prix et stocks reels cote serveur.
// Le stockage peut etre indisponible (navigation privee, donnees bloquees) : chaque acces est protege.
const STORAGE_KEY = 'last-mile-marketplace-cart'
const MAX_LINES = 50
export const MAX_QUANTITY = 99

const sanitizeLine = (line) => {
  const productId = Number(line?.productId)
  const quantity = Math.floor(Number(line?.quantity))
  if (!Number.isSafeInteger(productId) || productId < 1 || !Number.isFinite(quantity) || quantity < 1) return null
  if (typeof line.shopSlug !== 'string' || !line.shopSlug) return null
  return {
    productId,
    name: String(line.name || ''),
    price: Number(line.price) || 0,
    imageUrl: line.imageUrl || null,
    shopSlug: line.shopSlug,
    shopName: String(line.shopName || line.shopSlug),
    stock: Math.max(0, Number(line.stock) || 0),
    quantity: Math.min(quantity, MAX_QUANTITY),
  }
}

export const loadCart = () => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.map(sanitizeLine).filter(Boolean).slice(0, MAX_LINES) : []
  } catch {
    return []
  }
}

export const saveCart = (lines) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines.slice(0, MAX_LINES)))
  } catch {
    // Stockage indisponible : le panier reste valable pour la session en cours
  }
}

/** Retire du panier les articles d'une boutique (appele par le paiement de la boutique une fois la commande payee). */
export const removeShopFromStoredCart = (shopSlug) => {
  saveCart(loadCart().filter((line) => line.shopSlug !== shopSlug))
}

/** Parametre d'URL transmis au paiement de la boutique : « 12:2,15:1 » (produit:quantite). */
export const toCheckoutParam = (lines) => lines.map((line) => `${line.productId}:${line.quantity}`).join(',')
