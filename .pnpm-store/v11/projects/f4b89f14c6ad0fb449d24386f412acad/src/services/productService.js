import api from './api.js'

const productService = {
  async getMerchantProducts() {
    const response = await api.get('/api/products')
    return response.data
  },

  async createProduct(productData) {
    const response = await api.post('/api/products', productData)
    return response.data
  },

  async updateProductStock(productId, stock) {
    const response = await api.patch(`/api/products/${productId}/stock`, { stock })
    return response.data
  },

  async deleteProduct(productId) {
    const response = await api.delete(`/api/products/${productId}`)
    return response.data
  },
}

export default productService
