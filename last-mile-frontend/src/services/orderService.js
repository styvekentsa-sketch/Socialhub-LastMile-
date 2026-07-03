import api from './api.js'

const orderService = {
  async createOrder(orderData) {
    const response = await api.post('/api/orders', orderData)
    return response.data
  },

  async getOrders() {
    const response = await api.get('/api/orders')
    return response.data
  },

  async getOrderDetails(id) {
    const response = await api.get(`/api/orders/${id}`)
    return response.data
  },

  async getOrderTracking(id) {
    const response = await api.get(`/api/orders/${id}/tracking`)
    return response.data
  },

  async getOrderTrackingState(id) {
    const response = await api.get(`/api/orders/${id}/tracking-state`)
    return response.data
  },

  async updateOrderStatus(id, status) {
    const response = await api.put(`/api/orders/${id}/status`, { status })
    return response.data
  },

  async assignOrderToDriver(id, driverId) {
    const response = await api.put(`/api/orders/${id}/assign`, { driver_id: driverId })
    return response.data
  },
}

export default orderService
