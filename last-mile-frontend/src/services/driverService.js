import api from './api.js'

const driverService = {
  async updateCurrentLocation(position) {
    const response = await api.put('/api/drivers/location', position)
    return response.data
  },

  async getAvailableDrivers() {
    const response = await api.get('/api/drivers/available')
    return response.data
  },
}

export default driverService
