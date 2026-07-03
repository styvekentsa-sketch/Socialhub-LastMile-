import { createContext, useContext } from 'react'

export const SocketContext = createContext(null)

export function useSocket() {
  const context = useContext(SocketContext)

  if (!context) {
    throw new Error('useSocket doit être utilisé dans SocketProvider.')
  }

  return context
}
