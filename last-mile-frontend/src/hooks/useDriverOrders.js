import { useCallback, useEffect, useState } from 'react'
import { useSocket } from '../context/socketContext.js'
import orderService from '../services/orderService.js'

export default function useDriverOrders() {
  const { socket } = useSocket()
  const [orders, setOrders] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [updatingOrderId, setUpdatingOrderId] = useState(null)

  const refresh = useCallback(async () => {
    setError(null)

    try {
      const data = await orderService.getOrders()
      setOrders(Array.isArray(data) ? data : [])
    } catch (requestError) {
      setError(requestError)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const handleAssignment = () => refresh()
    const handleStatusUpdate = (payload = {}) => {
      const orderId = Number(payload.order_id ?? payload.orderId)

      if (!Number.isInteger(orderId) || !payload.status) {
        return
      }

      setOrders((currentOrders) => currentOrders.map((order) => (
        Number(order.id) === orderId ? { ...order, status: payload.status } : order
      )))
    }

    socket.on('order_assigned', handleAssignment)
    socket.on('order_status_updated', handleStatusUpdate)

    return () => {
      socket.off('order_assigned', handleAssignment)
      socket.off('order_status_updated', handleStatusUpdate)
    }
  }, [refresh, socket])

  const updateStatus = async (orderId, status) => {
    setUpdatingOrderId(orderId)
    setError(null)

    try {
      const data = await orderService.updateOrderStatus(orderId, status)
      setOrders((currentOrders) => currentOrders.map((order) => (
        Number(order.id) === Number(orderId) ? { ...order, status } : order
      )))
      socket.emit('driver_status_changed', { order_id: orderId, status })
      return data
    } catch (requestError) {
      setError(requestError)
      throw requestError
    } finally {
      setUpdatingOrderId(null)
    }
  }

  return { error, isLoading, orders, refresh, updateStatus, updatingOrderId }
}
