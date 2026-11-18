import api from './api.js'

// Canaux sociaux du marchand connecte (API /api/merchant). Les jetons ne sont jamais renvoyes en clair.
const socialChannelService = {
  async listChannels() {
    const response = await api.get('/api/merchant/channels')
    return response.data
  },

  // Creation, ou mise a jour si payload.id est fourni. Un jeton omis conserve la valeur enregistree.
  async saveChannel(payload) {
    const response = await api.post('/api/merchant/channels', payload)
    return response.data.channel
  },

  async deleteChannel(channelId) {
    const response = await api.delete(`/api/merchant/channels/${channelId}`)
    return response.data
  },

  // Diffusion manuelle d'un produit sur tous les canaux actifs ; renvoie le rapport par canal
  async publishProduct(productId) {
    const response = await api.post(`/api/merchant/products/${productId}/publish`)
    return response.data
  },
}

export default socialChannelService
