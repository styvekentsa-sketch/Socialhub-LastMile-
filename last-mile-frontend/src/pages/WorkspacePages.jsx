import { AnimatePresence, motion } from 'framer-motion'
import {
  LoaderCircle,
  MapPinned,
  MapPin,
  Phone,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import DriverInteractiveMap from '../components/map/DriverInteractiveMap.jsx'
import { useLanguage } from '../context/languageContext.js'
import useDriverOrders from '../hooks/useDriverOrders.js'
import driverService from '../services/driverService.js'
import orderService from '../services/orderService.js'

function PageShell({ children }) {
  return <div className="mx-auto w-full max-w-[1480px] p-4 sm:p-6 lg:p-8">{children}</div>
}

function SectionHeading({ detail, title }) {
  return (
    <div className="mb-5">
      <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-100">{title}</h2>
      <p className="mt-1 text-sm text-zinc-500">{detail}</p>
    </div>
  )
}

const formatHistoryDate = (value, language) => {
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

function DeliveryDetailsSheet({ error, history, isLoading, language, onClose, order, t }) {
  return (
    <>
      <motion.button
        type="button"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-zinc-950/72 backdrop-blur-sm"
        aria-label={t('common.close')}
      />
      <motion.section
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 340, damping: 32 }}
        className="fixed inset-x-0 bottom-0 z-[60] mx-auto max-h-[88dvh] max-w-2xl overflow-y-auto rounded-t-lg border border-b-0 border-zinc-200 bg-white px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 sm:px-6"
        role="dialog"
        aria-modal="true"
        aria-label={t('deliveries.detailsTitle', { id: order.id })}
      >
        <span className="mx-auto block h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-700" />
        <div className="mt-4 flex items-start justify-between gap-4 border-b border-zinc-200 pb-4 dark:border-zinc-800">
          <div className="min-w-0">
            <p className="font-mono text-xs text-amber-600 dark:text-amber-400">#{order.id}</p>
            <h2 className="mt-1 truncate text-lg font-semibold text-zinc-950 dark:text-zinc-100">{order.client_name}</h2>
            <p className="mt-1 text-xs text-sky-500">{t(`status.${order.status}`)}</p>
          </div>
          <button type="button" onClick={onClose} className="grid size-9 shrink-0 place-items-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white" aria-label={t('common.close')}>
            <X aria-hidden="true" size={18} />
          </button>
        </div>

        <div className="grid gap-3 py-5 sm:grid-cols-2">
          <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
            <p className="text-xs text-zinc-500">{t('deliveries.clientPhone')}</p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="text-sm text-zinc-800 dark:text-zinc-200">{order.client_phone}</p>
              <a href={`tel:${order.client_phone}`} className="grid size-9 shrink-0 place-items-center rounded-full bg-emerald-500 text-zinc-950" aria-label={t('deliveries.callClient')} title={t('deliveries.callClient')}><Phone aria-hidden="true" size={16} /></a>
            </div>
          </div>
          <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
            <p className="text-xs text-zinc-500">{t('deliveries.coordinates')}</p>
            <p className="mt-2 font-mono text-xs text-zinc-800 dark:text-zinc-200">{order.latitude ?? '—'}, {order.longitude ?? '—'}</p>
          </div>
          <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800 sm:col-span-2">
            <p className="flex items-center gap-2 text-xs text-zinc-500"><MapPinned aria-hidden="true" size={15} />{t('deliveries.exactAddress')}</p>
            <p className="mt-2 text-sm leading-6 text-zinc-800 dark:text-zinc-200">{order.delivery_address}</p>
          </div>
        </div>

        <div className="border-t border-zinc-200 pt-5 dark:border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{t('tracking.logTitle')}</h3>
          {isLoading ? (
            <div className="grid min-h-28 place-items-center"><LoaderCircle aria-hidden="true" className="animate-spin text-amber-500" size={20} /></div>
          ) : error ? (
            <p className="mt-4 text-sm text-rose-500">{t('deliveries.historyError')}</p>
          ) : history.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">{t('tracking.noHistory')}</p>
          ) : (
            <div className="mt-5">
              {history.map((step, index) => (
                <div key={step.id} className="relative flex gap-3 pb-6 last:pb-0">
                  {index < history.length - 1 && <span className="absolute left-[7px] top-4 h-full w-px bg-zinc-300 dark:bg-zinc-700" />}
                  <span className={`relative mt-1 size-[15px] shrink-0 rounded-full border-4 border-white dark:border-zinc-900 ${index === 0 ? 'bg-amber-500 ring-2 ring-amber-500/20' : 'bg-zinc-400 dark:bg-zinc-600'}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{t(`status.${step.status}`)}</p>
                      <time className="shrink-0 font-mono text-[10px] text-zinc-400 dark:text-zinc-600">{formatHistoryDate(step.created_at, language)}</time>
                    </div>
                    <p className="mt-1 truncate text-xs text-zinc-500">{t('tracking.changedBy', { name: step.operator_name })}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.section>
    </>
  )
}

export function DeliveriesPage() {
  const { language, t } = useLanguage()
  const { error, isLoading, orders } = useDriverOrders()
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [history, setHistory] = useState([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [historyError, setHistoryError] = useState(false)

  useEffect(() => {
    if (!selectedOrder) {
      return undefined
    }

    let isMounted = true
    setIsLoadingHistory(true)
    setHistoryError(false)

    orderService.getOrderTracking(selectedOrder.id)
      .then((data) => {
        if (isMounted) {
          setHistory(Array.isArray(data) ? data : [])
        }
      })
      .catch(() => {
        if (isMounted) {
          setHistoryError(true)
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingHistory(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [selectedOrder])

  useEffect(() => {
    if (!selectedOrder) {
      return
    }

    const currentOrder = orders.find((order) => Number(order.id) === Number(selectedOrder.id))

    if (currentOrder && currentOrder.status !== selectedOrder.status) {
      setSelectedOrder(currentOrder)
    }
  }, [orders, selectedOrder])

  return (
    <PageShell>
      <SectionHeading title={t('deliveries.title')} detail={t('deliveries.subtitle')} />
      <section className="grid gap-3 md:grid-cols-2">
        {isLoading && <div className="col-span-full grid min-h-48 place-items-center"><LoaderCircle aria-hidden="true" className="animate-spin text-amber-500" size={22} /></div>}
        {!isLoading && error && <p className="col-span-full text-sm text-rose-500">{t('deliveries.loadError')}</p>}
        {!isLoading && !error && orders.length === 0 && <p className="col-span-full text-sm text-zinc-500">{t('deliveries.empty')}</p>}
        {orders.map((order, index) => (
          <motion.button key={order.id} type="button" whileTap={{ scale: 0.985 }} onClick={() => setSelectedOrder(order)} className="w-full rounded-lg border border-zinc-200 bg-white p-5 text-left transition-colors hover:border-amber-500/40 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs text-amber-600 dark:text-amber-400">#{order.id}</p>
                <h3 className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{order.client_name}</h3>
                <p className="mt-1 text-xs text-sky-500">{t(`status.${order.status}`)}</p>
              </div>
              <span className="font-mono text-xs text-zinc-400 dark:text-zinc-600">0{index + 1}</span>
            </div>
            <div className="mt-5 flex items-center gap-2 text-xs text-zinc-500">
              <MapPin aria-hidden="true" size={15} />
              {order.delivery_address}
            </div>
          </motion.button>
        ))}
      </section>
      <AnimatePresence>
        {selectedOrder && (
          <DeliveryDetailsSheet
            error={historyError}
            history={history}
            isLoading={isLoadingHistory}
            language={language}
            onClose={() => setSelectedOrder(null)}
            order={selectedOrder}
            t={t}
          />
        )}
      </AnimatePresence>
    </PageShell>
  )
}

export function DriverMapPage() {
  const { t } = useLanguage()
  const { error, isLoading, orders, updateStatus, updatingOrderId } = useDriverOrders()
  const [position, setPosition] = useState(null)
  const [locationError, setLocationError] = useState('')
  const isSendingLocationRef = useRef(false)
  const queuedLocationRef = useRef(null)
  const lastPositionRef = useRef(null)
  const activeOrder = useMemo(() => (
    orders.find((order) => !['delivered', 'failed', 'cancelled'].includes(order.status)) || orders[0] || null
  ), [orders])

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError(t('map.geolocationUnsupported'))
      return undefined
    }

    let isMounted = true

    const sendQueuedLocations = async (nextPosition) => {
      queuedLocationRef.current = nextPosition

      if (isSendingLocationRef.current) {
        return
      }

      isSendingLocationRef.current = true

      while (isMounted && queuedLocationRef.current) {
        const locationToSend = queuedLocationRef.current
        queuedLocationRef.current = null

        try {
          await driverService.updateCurrentLocation(locationToSend[0], locationToSend[1])
        } catch {
          if (isMounted) {
            setLocationError(t('map.locationSendError'))
          }
        }
      }

      isSendingLocationRef.current = false
    }

    const watchId = navigator.geolocation.watchPosition(({ coords }) => {
      if (!Number.isFinite(coords.latitude) || !Number.isFinite(coords.longitude)) {
        setLocationError(t('map.locationUnavailable'))
        return
      }

      const nextPosition = [coords.latitude, coords.longitude]
      const previousPosition = lastPositionRef.current

      if (previousPosition?.[0] === nextPosition[0] && previousPosition?.[1] === nextPosition[1]) {
        return
      }

      lastPositionRef.current = nextPosition
      setPosition(nextPosition)
      setLocationError('')
      sendQueuedLocations(nextPosition)
    }, (geolocationError) => {
      if (!isMounted) {
        return
      }

      const errorKey = geolocationError.code === geolocationError.PERMISSION_DENIED
        ? 'map.locationPermissionDenied'
        : geolocationError.code === geolocationError.TIMEOUT
          ? 'map.locationTimeout'
          : 'map.locationUnavailable'
      setLocationError(t(errorKey))
    }, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 15000,
    })

    return () => {
      isMounted = false
      queuedLocationRef.current = null
      navigator.geolocation.clearWatch(watchId)
    }
  }, [t])

  return (
    <PageShell>
      <SectionHeading title={t('map.title')} detail={t('map.subtitle')} />
      {isLoading ? (
        <div className="grid min-h-[440px] place-items-center rounded-lg border border-zinc-800 bg-zinc-950"><LoaderCircle aria-hidden="true" className="animate-spin text-amber-500" size={24} /></div>
      ) : (
        <DriverInteractiveMap
          error={error || locationError}
          isUpdating={Number(updatingOrderId) === Number(activeOrder?.id)}
          onStatusChange={updateStatus}
          order={activeOrder}
          position={position}
        />
      )}
    </PageShell>
  )
}
