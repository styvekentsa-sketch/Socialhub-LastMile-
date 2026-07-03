import { io } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL?.trim() || undefined

const socket = io(SOCKET_URL, {
  autoConnect: false,
  transports: ['websocket', 'polling'],
})

let activeToken = null

export const connectSocket = (token) => {
  if (!token) {
    return socket
  }

  if (activeToken && activeToken !== token && socket.connected) {
    socket.disconnect()
  }

  activeToken = token
  socket.auth = { token }

  if (!socket.connected) {
    socket.connect()
  }

  return socket
}

export const disconnectSocket = () => {
  activeToken = null
  socket.auth = {}
  socket.disconnect()
}

export default socket
