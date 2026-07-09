import { motion } from 'framer-motion'
import { AlertTriangle, ClipboardList, LoaderCircle, RefreshCw, Search, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import TrackingMap from '../components/map/TrackingMap.jsx'
import { useLanguage } from '../context/languageContext.js'
import { useSocket } from '../context/socketContext.js'
import useAutoRefresh from '../hooks/useAutoRefresh.js'
import orderService from '../services/orderService.js'

const ACTIVE_STATUSES = new Set(['assigned', 'picking', 'in_transit', 'picked_up'])

const orderMatchesSearch = (order, searchQuery) => {
  const query = searchQuery.trim().toLocaleLowerCase()

  if (!query) {
    return true
  }

  const orderIdQuery = query.replace(/^cmd[-\s#]*/, '').replace(/^#/, '')
  return String(order.id).includes(orderIdQuery)
    || String(order.client_name || '').toLocaleLowerCase().includes(query)
    || String(order.client_phone || '').toLocaleLowerCase().includes(query)
}

const formatTimestamp = (value, language) => {
  if (!value) {
    return '--:--'
  }

  return new Intl.DateTimeFormat(language === 'fr' ? 'fr-FR' : 'en-US', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(new Date(value))
}

export default function Tracking() {
  const { orderId: routeOrderId } = useParams()
  const { language, t } = useLanguage()
  const { socket } = useSocket()
  const [orders, setOrders] = useState([])
  const [selectedOrderId, setSelectedOrderId] = useState('')
  const [trackingOrder, setTrackingOrder] = useState(null)
  const [history, setHistory] = useState([])
  const [isLoadingOrders, setIsLoadingOrders] = useState(true)
  const [isLoadingTracking, setIsLoadingTracking] = useState(false)
  const [error, setError] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const loadHistory = useCallback(async (orderId) => {
    const data = await orderService.getOrderTracking(orderId)
    setHistory(Array.isArray(data) ? data : [])
  }, [])

  const loadOrders = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setIsLoadingOrders(true)
    }
    setError(false)

    try {
      const data = await orderService.getOrders()
      const nextOrders = Array.isArray(data) ? data : []
      const preferredOrder = nextOrders.find((order) => String(order.id) === String(routeOrderId))
        || nextOrders.find((order) => ACTIVE_STATUSES.has(order.status))
        || nextOrders[0]
      setOrders(nextOrders)
      setSelectedOrderId((currentOrderId) => (
        nextOrders.some((order) => String(order.id) === String(currentOrderId))
          ? currentOrderId
          : preferredOrder ? String(preferredOrder.id) : ''
      ))
    } catch {
      setError(true)
    } finally {
      if (!silent) {
        setIsLoadingOrders(false)
      }
    }
  }, [routeOrderId])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  useEffect(() => {
    if (!selectedOrderId) {
      setTrackingOrder(null)
      setHistory([])
      return undefined
    }

    let isMounted = true
    setIsLoadingTracking(true)
    setError(false)

    Promise.all([
      orderService.getOrderTrackingState(selectedOrderId),
      orderService.getOrderTracking(selectedOrderId),
    ])
      .then(([orderData, historyData]) => {
        if (isMounted) {
          setTrackingOrder(orderData)
          setHistory(Array.isArray(historyData) ? historyData : [])
        }
      })
      .catch(() => {
        if (isMounted) {
          setError(true)
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingTracking(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [selectedOrderId])

  const refreshTrackingSilently = useCallback(async () => {
    await loadOrders({ silent: true })

    if (!selectedOrderId) {
      return
    }

    try {
      const [orderData, historyData] = await Promise.all([
        orderService.getOrderTrackingState(selectedOrderId),
        orderService.getOrderTracking(selectedOrderId),
      ])
      setTrackingOrder(orderData)
      setHistory(Array.isArray(historyData) ? historyData : [])
      setError(false)
    } catch {
      setError(true)
    }
  }, [loadOrders, selectedOrderId])

  useAutoRefresh(refreshTrackingSilently, ['orders'])

  useEffect(() => {
    const handleLocationUpdate = (payload = {}) => {
      if (Number(payload.order_id) !== Number(selectedOrderId)) {
        return
      }

      setTrackingOrder((currentOrder) => currentOrder ? {
        ...currentOrder,
        driver_latitude: payload.latitude,
        driver_longitude: payload.longitude,
        driver_position_accuracy: payload.accuracy,
        driver_position_captured_at: payload.captured_at,
        driver_position_heading: payload.heading,
        driver_position_speed: payload.speed,
        driver_position_updated_at: payload.updated_at,
      } : currentOrder)
    }

    const handleStatusUpdate = (payload = {}) => {
      const orderId = Number(payload.order_id ?? payload.orderId)

      setOrders((currentOrders) => currentOrders.map((order) => (
        Number(order.id) === orderId ? { ...order, status: payload.status } : order
      )))

      if (orderId === Number(selectedOrderId)) {
        setTrackingOrder((currentOrder) => currentOrder ? { ...currentOrder, status: payload.status } : currentOrder)
        loadHistory(orderId).catch(() => setError(true))
      }
    }

    socket.on('driver_location_updated', handleLocationUpdate)
    socket.on('order_status_updated', handleStatusUpdate)

    return () => {
      socket.off('driver_location_updated', handleLocationUpdate)
      socket.off('order_status_updated', handleStatusUpdate)
    }
  }, [loadHistory, selectedOrderId, socket])

  const timeline = useMemo(() => history.map((entry, index) => ({
    ...entry,
    active: index === 0,
  })), [history])

  const filteredOrders = useMemo(
    () => orders.filter((order) => orderMatchesSearch(order, searchQuery)),
    [orders, searchQuery],
  )

  useEffect(() => {
    setSelectedOrderId((currentOrderId) => {
      if (filteredOrders.some((order) => String(order.id) === String(currentOrderId))) {
        return currentOrderId
      }

      return filteredOrders[0] ? String(filteredOrders[0].id) : ''
    })
  }, [filteredOrders])

  return (
    <div className="mx-auto w-full max-w-[1480px] p-4 sm:p-6 lg:p-8">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-100">{t('tracking.title')}</h2>
          <p className="mt-1 text-sm text-zinc-500">{t('tracking.subtitle')}</p>
        </div>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end">
          <label className="relative block min-w-0 sm:w-80">
            <span className="sr-only">{t('tracking.searchPlaceholder')}</span>
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="field pl-9 pr-9"
              placeholder={t('tracking.searchPlaceholder')}
            />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery('')} className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label={t('tracking.clearSearch')} title={t('tracking.clearSearch')}>
                <X aria-hidden="true" size={15} />
              </button>
            )}
          </label>
          {filteredOrders.length > 0 && (
            <label className="block min-w-0 sm:w-64">
              <span className="sr-only">{t('tracking.selectOrder')}</span>
              <select value={selectedOrderId} onChange={(event) => setSelectedOrderId(event.target.value)} className="field">
                {filteredOrders.map((order) => (
                  <option key={order.id} value={order.id}>#{order.id} · {order.client_name}</option>
                ))}
              </select>
            </label>
          )}
          <button type="button" onClick={() => loadOrders()} disabled={isLoadingOrders} className="grid size-11 shrink-0 place-items-center rounded-md border border-zinc-200 text-zinc-500 hover:bg-white hover:text-zinc-900 disabled:opacity-50 dark:border-zinc-800 dark:hover:bg-zinc-900 dark:hover:text-zinc-100" aria-label={t('tracking.refresh')} title={t('tracking.refresh')}>
            <RefreshCw aria-hidden="true" className={isLoadingOrders ? 'animate-spin' : ''} size={16} />
          </button>
        </div>
      </div>

      {isLoadingOrders || isLoadingTracking ? (
        <div className="grid min-h-[390px] place-items-center rounded-lg border border-zinc-800 bg-zinc-950">
          <LoaderCircle aria-hidden="true" className="animate-spin text-amber-500" size={24} />
        </div>
      ) : error ? (
        <div className="grid min-h-64 place-items-center rounded-lg border border-rose-500/20 bg-rose-500/5 p-6 text-center">
          <div><AlertTriangle aria-hidden="true" className="mx-auto text-rose-500" size={22} /><p className="mt-3 text-sm text-zinc-500">{t('tracking.loadError')}</p></div>
        </div>
      ) : !trackingOrder ? (
        <div className="grid min-h-64 place-items-center rounded-lg border border-zinc-200 bg-white p-6 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <div><ClipboardList aria-hidden="true" className="mx-auto text-zinc-500" size={22} /><p className="mt-3 text-sm text-zinc-500">{t(searchQuery ? 'tracking.noSearchResults' : 'tracking.noOrders')}</p></div>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.75fr)]">
          <TrackingMap order={trackingOrder} />

          <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{t('tracking.logTitle')}</h3>
            {timeline.length === 0 ? (
              <p className="mt-5 text-sm text-zinc-500">{t('tracking.noHistory')}</p>
            ) : (
              <div className="mt-6 space-y-0">
                {timeline.map((step, index) => (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04 }}
                    className="relative flex gap-3 pb-7 last:pb-0"
                  >
                    {index < timeline.length - 1 && <span className="absolute left-[7px] top-4 h-full w-px bg-zinc-300 dark:bg-zinc-700" />}
                    <span className="relative mt-1 flex size-[15px] shrink-0 items-center justify-center rounded-full border-4 border-white dark:border-zinc-900">
                      {step.active && <span className="absolute size-3 animate-ping rounded-full bg-amber-400/65" />}
                      <span className={`relative size-[7px] rounded-full ${step.active ? 'bg-amber-500' : 'bg-zinc-400 dark:bg-zinc-600'}`} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className={`text-sm font-medium ${step.active ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-800 dark:text-zinc-200'}`}>{t(`status.${step.status}`)}</p>
                        <time className="shrink-0 font-mono text-[10px] text-zinc-400 dark:text-zinc-600">{formatTimestamp(step.created_at, language)}</time>
                      </div>
                      <p className="mt-1 truncate text-xs text-zinc-500">{t('tracking.changedBy', { name: step.operator_name })}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
