import api from './api.js'

// Parametres du compte connecte (/api/settings)
const settingsService = {
  async getSettings() {
    const response = await api.get('/api/settings/profile')
    return response.data
  },

  /** payload : { name, email, phone, shop?: { name, slug, description, pickup_address, default_city, status } } */
  async updateProfile(payload) {
    const response = await api.put('/api/settings/profile', payload)
    return response.data
  },

  /** Reponse : { message, token } (nouveau jeton : les autres sessions sont revoquees) */
  async changePassword(currentPassword, newPassword) {
    const response = await api.put('/api/settings/password', { current_password: currentPassword, new_password: newPassword })
    return response.data
  },

  async revokeOtherSessions() {
    const response = await api.post('/api/settings/sessions/revoke-others')
    return response.data
  },

  async updateNotifications(notifications, language) {
    const response = await api.put('/api/settings/notifications', { notifications, language })
    return response.data
  },
}

export default settingsService
