import api from './api.js'

const authService = {
  async register(userData) {
    const response = await api.post('/api/auth/register', userData)
    return response.data
  },

  async login(credentials) {
    const response = await api.post('/api/auth/login', credentials)
    return response.data
  },

  async getCurrentUser() {
    const response = await api.get('/api/auth/me')
    return response.data
  },
}

export default authService
