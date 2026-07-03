import { useEffect, useMemo, useState } from 'react'
import socket, { connectSocket, disconnectSocket } from '../services/socket.js'
import { useAuth } from './auth.js'
import { SocketContext } from './socketContext.js'

export default function SocketProvider({ children }) {
  const { token } = useAuth()
  const [isConnected, setIsConnected] = useState(socket.connected)

  useEffect(() => {
    const handleConnect = () => setIsConnected(true)
    const handleDisconnect = () => setIsConnected(false)
    const handleConnectError = () => setIsConnected(false)

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on('connect_error', handleConnectError)

    if (token) {
      connectSocket(token)
    } else {
      disconnectSocket()
    }

    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off('connect_error', handleConnectError)
      disconnectSocket()
    }
  }, [token])

  const value = useMemo(() => ({ isConnected, socket }), [isConnected])

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
}
