import api from './api.js'

const driverService = {
  async updateCurrentLocation(lat, lng) {
    const response = await api.put('/api/drivers/location', {
      latitude: lat,
      longitude: lng,
    })
    return response.data
  },

  async getAvailableDrivers() {
    const response = await api.get('/api/drivers/available')
    return response.data
  },
}

export default driverService
