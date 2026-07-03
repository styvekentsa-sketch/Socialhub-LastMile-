import { io } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL?.trim() || undefined

export const createPaymentSocket = (paymentReference) => io(SOCKET_URL, {
  auth: { paymentReference },
  autoConnect: false,
  forceNew: true,
  transports: ['websocket', 'polling'],
})
