import { createContext, useContext } from 'react'

export const AuthContext = createContext(null)

export const ROLE_DASHBOARDS = {
  merchant: '/orders',
  driver: '/deliveries',
  admin: '/orders',
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth doit être utilisé dans AuthProvider.')
  }

  return context
}
