import api from './api.js'

const publicShopService = {
  async getShop(slug) {
    const response = await api.get(`/api/public/shops/${encodeURIComponent(slug)}`)
    return response.data
  },

  async checkout(checkoutData) {
    const response = await api.post('/api/public/checkout', checkoutData)
    return response.data
  },

  async getPayment(paymentReference) {
    const response = await api.get(`/api/public/payments/${encodeURIComponent(paymentReference)}`)
    return response.data
  },
}

export default publicShopService
