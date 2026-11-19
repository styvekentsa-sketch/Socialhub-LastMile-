import { createContext, useContext } from 'react'

export const CartContext = createContext(null)

export function useCart() {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error('useCart doit etre utilise dans CartProvider.')
  }
  return context
}
