import axios from 'axios'
import { clearAuthToken, getAuthToken } from './tokenStorage.js'

export const AUTH_UNAUTHORIZED_EVENT = 'auth:unauthorized'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL?.trim() || '/',
  timeout: 20000,
})

api.interceptors.request.use((config) => {
  const token = getAuthToken()

  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`)
  }

  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const requestUrl = error.config?.url || ''
    const isAuthenticationAttempt = /\/api\/auth\/(login|register)\/?$/.test(requestUrl)

    error.userMessage = error.response?.data?.message
      || error.response?.data?.error
      || (error.request ? 'Le serveur API est indisponible.' : error.message)

    if (status === 401 && !isAuthenticationAttempt) {
      clearAuthToken()

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT))

        if (window.location.pathname !== '/login') {
          window.location.replace('/login')
        }
      }
    }

    return Promise.reject(error)
  },
)

export const getApiStatus = (error) => error?.response?.status || null

export const isApiError = axios.isAxiosError

export const getApiErrorMessage = (error, fallback = 'Une erreur est survenue.') => (
  error?.userMessage || fallback
)

export default api
