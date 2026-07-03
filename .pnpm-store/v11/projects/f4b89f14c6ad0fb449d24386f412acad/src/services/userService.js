import api from './api.js'

const userService = {
  async updateProfile(data) {
    const response = await api.put('/api/users/profile', data)
    return response.data
  },

  async uploadAvatar(formDataOrBase64) {
    const response = await api.put('/api/users/profile/avatar', formDataOrBase64)
    return response.data
  },

  async getUserDetails(id) {
    const response = await api.get(`/api/users/${id}`)
    return response.data
  },
}

export default userService
