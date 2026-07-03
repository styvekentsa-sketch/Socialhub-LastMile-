import { useEffect, useMemo, useState } from 'react'
import AuthSplash from '../components/auth/AuthSplash.jsx'
import authService from '../services/authService.js'
import { AUTH_UNAUTHORIZED_EVENT } from '../services/api.js'
import { clearAuthToken, getAuthToken, persistAuthToken } from '../services/tokenStorage.js'
import { AuthContext } from './auth.js'
import { resolveAvatarUrl } from '../utils/avatar.js'

const normalizeUser = (user) => ({
  ...user,
  avatar: resolveAvatarUrl(user?.avatar),
})

export default function AuthProvider({ children }) {
  const [token, setToken] = useState(null)
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const handleUnauthorized = () => {
      setToken(null)
      setUser(null)
    }

    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized)
    return () => window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized)
  }, [])

  useEffect(() => {
    let isMounted = true

    const hydrateSession = async () => {
      const storedToken = getAuthToken()

      if (!storedToken) {
        return
      }

      try {
        const data = await authService.getCurrentUser()

        if (!data?.user?.role) {
          throw new Error('INVALID_SESSION_RESPONSE')
        }

        if (isMounted) {
          setToken(storedToken)
          setUser(normalizeUser(data.user))
        }
      } catch {
        clearAuthToken()
      }
    }

    hydrateSession().finally(() => {
      if (isMounted) {
        setIsLoading(false)
      }
    })

    return () => {
      isMounted = false
    }
  }, [])

  const authenticate = (payload, expectedRole, rememberMe = false) => {
    const authenticatedUser = payload?.user

    if (!payload?.token || !authenticatedUser?.role) {
      const error = new Error('INVALID_AUTH_RESPONSE')
      error.code = 'INVALID_AUTH_RESPONSE'
      throw error
    }

    if (authenticatedUser.role !== expectedRole) {
      const error = new Error('ROLE_MISMATCH')
      error.code = 'ROLE_MISMATCH'
      throw error
    }

    persistAuthToken(payload.token, rememberMe)
    setToken(payload.token)
    setUser(normalizeUser(authenticatedUser))

    return authenticatedUser.role
  }

  const updateUser = (updates) => {
    setUser((currentUser) => currentUser
      ? normalizeUser({ ...currentUser, ...updates })
      : currentUser)
  }

  const logout = () => {
    clearAuthToken()
    setToken(null)
    setUser(null)
  }

  const value = useMemo(() => ({
    authenticate,
    isAuthenticated: Boolean(token && user),
    isLoading,
    logout,
    token,
    updateUser,
    user,
  }), [isLoading, token, user])

  if (isLoading) {
    return <AuthSplash />
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
