import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock3,
  LoaderCircle,
  MapPin,
  PackageCheck,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Send,
  Truck,
  UserRound,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import StatusToast from '../components/notifications/StatusToast.jsx'
import AvatarTrigger from '../components/profile/AvatarTrigger.jsx'
import { useAuth } from '../context/auth.js'
import { useLanguage } from '../context/languageContext.js'
import { useSocket } from '../context/socketContext.js'
import useAutoRefresh from '../hooks/useAutoRefresh.js'
import { getApiErrorMessage } from '../services/api.js'
import driverService from '../services/driverService.js'
import orderService from '../services/orderService.js'

const EMPTY_FORM = {
  client_name: '',
  client_phone: '',
  delivery_address: '',
  latitude: '',
  longitude: '',
}

const STATUS_META = {
  pending: { className: 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-300', dotClass: 'bg-amber-500', pingClass: 'bg-amber-400' },
  assigned: { className: 'border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-300', dotClass: 'bg-sky-500', pingClass: 'bg-sky-400' },
  picking: { className: 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-300', dotClass: 'bg-amber-500', pingClass: 'bg-amber-400' },
  in_transit: { className: 'border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-300', dotClass: 'bg-sky-500', pingClass: 'bg-sky-400' },
  picked_up: { className: 'border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-300', dotClass: 'bg-sky-500', pingClass: 'bg-sky-400' },
  delivered: { className: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300', dotClass: 'bg-emerald-500', pingClass: 'bg-emerald-400' },
  failed: { className: 'border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-300', dotClass: 'bg-rose-500', pingClass: 'bg-rose-400' },
  cancelled: { className: 'border-zinc-300 bg-zinc-100 text-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400', dotClass: 'bg-zinc-500' },
}

const ACTIVE_STATUSES = new Set(['pending', 'assigned', 'picking', 'in_transit', 'picked_up'])

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

const formatDate = (value, language, t) => {
  if (!value) {
    return t('dashboard.unknownDate')
  }

  return new Intl.DateTimeFormat(language === 'fr' ? 'fr-FR' : 'en-US', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(new Date(value))
}

function StatusBadge({ status, t }) {
  const meta = STATUS_META[status] || {
    className: 'border-zinc-300 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400',
    dotClass: 'bg-zinc-500',
  }

  return (
    <span className={`inline-flex items-center gap-2 rounded-md border px-2 py-1 text-[11px] font-medium ${meta.className}`}>
      <span className="relative flex size-1.5 shrink-0">
        {meta.pingClass && <span className={`absolute inline-flex size-full animate-ping rounded-full opacity-70 ${meta.pingClass}`} />}
        <span className={`relative inline-flex size-1.5 rounded-full ${meta.dotClass}`} />
      </span>
      {t(`status.${status}`)}
    </span>
  )
}

function StatCard({ label, mobileLabel, value, icon: Icon, tone }) {
  return (
    <article className="min-w-0 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900 sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-[11px] font-medium text-zinc-500 sm:text-xs">
          <span className="sm:hidden">{mobileLabel}</span>
          <span className="hidden sm:inline">{label}</span>
        </p>
        <Icon aria-hidden="true" className={tone} size={16} strokeWidth={1.8} />
      </div>
      <p className="mt-3 text-xl font-semibold text-zinc-950 dark:text-zinc-50 sm:text-2xl">{value}</p>
    </article>
  )
}

function OrderForm({ error, form, isSubmitting, onChange, onSubmit, t }) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col">
      <div className="space-y-4">
        <label className="block">
          <span className="mb-2 block text-xs font-medium text-zinc-600 dark:text-zinc-400">{t('form.clientName')}</span>
          <span className="group relative block">
            <UserRound aria-hidden="true" className="form-icon" size={16} />
            <input required name="client_name" value={form.client_name} onChange={onChange} className="form-field" placeholder={t('form.clientPlaceholder')} />
          </span>
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-medium text-zinc-600 dark:text-zinc-400">{t('form.phone')}</span>
          <span className="group relative block">
            <Phone aria-hidden="true" className="form-icon" size={16} />
            <input required name="client_phone" type="tel" value={form.client_phone} onChange={onChange} className="form-field" placeholder={t('form.phonePlaceholder')} />
          </span>
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-medium text-zinc-600 dark:text-zinc-400">{t('form.address')}</span>
          <span className="group relative block">
            <MapPin aria-hidden="true" className="form-icon" size={16} />
            <input required name="delivery_address" value={form.delivery_address} onChange={onChange} className="form-field" placeholder={t('form.addressPlaceholder')} />
          </span>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block min-w-0">
            <span className="mb-2 block text-xs font-medium text-zinc-600 dark:text-zinc-400">{t('form.latitude')}</span>
            <input required name="latitude" type="number" step="any" value={form.latitude} onChange={onChange} className="coordinate-field" placeholder="4.0511" />
          </label>
          <label className="block min-w-0">
            <span className="mb-2 block text-xs font-medium text-zinc-600 dark:text-zinc-400">{t('form.longitude')}</span>
            <input required name="longitude" type="number" step="any" value={form.longitude} onChange={onChange} className="coordinate-field" placeholder="9.7679" />
          </label>
        </div>
      </div>

      <div className="min-h-11 pt-3" aria-live="polite">
        {error && <p className="text-xs leading-5 text-rose-300">{error}</p>}
      </div>

      <motion.button
        type="submit"
        disabled={isSubmitting}
        whileTap={isSubmitting ? undefined : { scale: 0.98 }}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-amber-500 px-4 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? <LoaderCircle aria-hidden="true" className="animate-spin" size={17} /> : <Send aria-hidden="true" size={17} />}
        {t(isSubmitting ? 'form.submitting' : 'form.submit')}
      </motion.button>
    </form>
  )
}

function LoadingState({ t }) {
  return (
    <div className="space-y-3 p-4 sm:p-5" aria-label={t('dashboard.loading')}>
      {[1, 2, 3, 4].map((item) => (
        <div key={item} className="h-16 animate-pulse rounded-md bg-zinc-200/70 dark:bg-zinc-800/70" />
      ))}
    </div>
  )
}

function EmptyState({ canCreate, onCreate, t }) {
  return (
    <div className="grid min-h-72 place-items-center p-6 text-center">
      <div>
        <span className="mx-auto grid size-11 place-items-center rounded-lg bg-zinc-100 text-zinc-500 dark:bg-zinc-800">
          <ClipboardList aria-hidden="true" size={20} />
        </span>
        <h3 className="mt-4 text-sm font-semibold text-zinc-800 dark:text-zinc-200">{t('dashboard.emptyTitle')}</h3>
        <p className="mt-2 text-xs text-zinc-500">{t('dashboard.emptyDetail')}</p>
        {canCreate && (
          <button type="button" onClick={onCreate} className="mt-5 text-sm font-semibold text-amber-400 hover:text-amber-300">
            {t('dashboard.createFirst')}
          </button>
        )}
      </div>
    </div>
  )
}

function OrderMembers({ order, t }) {
  const merchant = {
    avatar: order.merchant_avatar,
    email: order.merchant_email,
    id: order.merchant_id,
    name: order.merchant_name,
    phone: order.merchant_phone,
    role: 'merchant',
  }
  const driver = order.driver_id ? {
    avatar: order.driver_avatar,
    email: order.driver_email,
    id: order.driver_id,
    name: order.driver_name || t('roles.driver'),
    phone: order.driver_phone,
    role: 'driver',
  } : null

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5" title={t('roles.merchant')}>
        <AvatarTrigger className="size-7 text-[10px]" inspect user={merchant} />
        <span className="hidden max-w-24 truncate text-[11px] text-zinc-500 xl:block">{merchant.name}</span>
      </div>
      {driver && (
        <div className="flex items-center gap-1.5" title={t('roles.driver')}>
          <AvatarTrigger className="size-7 text-[10px]" inspect user={driver} />
          <span className="hidden max-w-24 truncate text-[11px] text-zinc-500 xl:block">{driver.name}</span>
        </div>
      )}
    </div>
  )
}

function DriverAssignment({ assigningOrderId, drivers, isLoading, onAssign, onLoad, order, t }) {
  const [isOpen, setIsOpen] = useState(false)
  const isAssigning = Number(assigningOrderId) === Number(order.id)
  const isAnotherAssignmentRunning = assigningOrderId !== null && !isAssigning

  const toggleMenu = () => {
    const nextOpen = !isOpen
    setIsOpen(nextOpen)

    if (nextOpen) {
      onLoad()
    }
  }

  if (order.status !== 'pending') {
    return (
      <span className="text-xs text-zinc-500">
        {order.driver_id ? t('dashboard.driverAssigned', { id: order.driver_id }) : t('dashboard.noAction')}
      </span>
    )
  }

  return (
    <div className="min-w-[190px]">
      <button
        type="button"
        onClick={toggleMenu}
        disabled={isAssigning || isAnotherAssignmentRunning}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-zinc-300 px-3 text-xs font-medium text-zinc-700 transition-colors hover:border-amber-500/60 dark:border-zinc-700 dark:text-zinc-300"
        aria-expanded={isOpen}
      >
        <span className="flex min-w-0 items-center gap-2">
          {isAssigning ? <LoaderCircle aria-hidden="true" className="shrink-0 animate-spin" size={14} /> : <Truck aria-hidden="true" className="shrink-0 text-amber-500" size={14} />}
          <span className="truncate">{t(isAssigning ? 'dashboard.assigning' : 'dashboard.assignDriver')}</span>
        </span>
        <ChevronDown aria-hidden="true" className={`shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} size={14} />
      </button>

      <AnimatePresence>
        {isOpen && !isAssigning && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2 overflow-hidden rounded-md border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950"
          >
            {isLoading ? (
              <div className="flex h-11 items-center justify-center"><LoaderCircle aria-hidden="true" className="animate-spin text-amber-500" size={16} /></div>
            ) : drivers.length ? drivers.map((driver) => (
              <button
                key={driver.id}
                type="button"
                onClick={async () => {
                  try {
                    await onAssign(order.id, driver)
                    setIsOpen(false)
                  } catch {
                    return
                  }
                }}
                className="flex w-full items-center gap-2 border-b border-zinc-200 px-3 py-2.5 text-left text-xs text-zinc-700 transition-colors last:border-b-0 hover:bg-amber-500/10 dark:border-zinc-800 dark:text-zinc-300"
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-sky-500/10 text-sky-500"><Truck aria-hidden="true" size={13} /></span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{driver.name}</span>
                  <span className="mt-0.5 block text-[10px] text-zinc-500">#{driver.id}</span>
                </span>
              </button>
            )) : (
              <p className="px-3 py-3 text-xs text-zinc-500">{t('dashboard.noDrivers')}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function DesktopOrders({ assignment, isAdmin, language, orders, refreshVersion, t }) {
  return (
    <motion.div key={refreshVersion} initial={{ opacity: 0.35 }} animate={{ opacity: 1 }} transition={{ duration: 0.32 }} className="hidden overflow-x-auto md:block">
      <table className="w-full min-w-[650px] border-collapse text-left text-sm">
        <thead className="bg-zinc-50 text-xs text-zinc-500 dark:bg-zinc-950/45">
          <tr>
            <th className="px-5 py-3 font-medium">{t('dashboard.table.order')}</th>
            <th className="px-5 py-3 font-medium">{t('dashboard.table.client')}</th>
            <th className="px-5 py-3 font-medium">{t('dashboard.table.destination')}</th>
            <th className="px-5 py-3 font-medium">{t('dashboard.table.status')}</th>
            {isAdmin && <th className="px-5 py-3 font-medium">{t('dashboard.table.members')}</th>}
            {isAdmin && <th className="px-5 py-3 font-medium">{t('dashboard.table.actions')}</th>}
            <th className="px-5 py-3 text-right font-medium">{t('dashboard.table.created')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {orders.map((order) => (
            <tr key={order.id} className="transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800/35">
              <td className="px-5 py-4 font-mono text-xs font-semibold text-zinc-800 dark:text-zinc-200">#{order.id}</td>
              <td className="px-5 py-4">
                <p className="font-medium text-zinc-700 dark:text-zinc-300">{order.client_name}</p>
                <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-600">{order.client_phone}</p>
              </td>
              <td className="max-w-52 px-5 py-4 text-zinc-500"><p className="truncate">{order.delivery_address}</p></td>
              <td className="px-5 py-4"><StatusBadge status={order.status} t={t} /></td>
              {isAdmin && <td className="px-5 py-4"><OrderMembers order={order} t={t} /></td>}
              {isAdmin && (
                <td className="px-5 py-4 align-top">
                  <DriverAssignment {...assignment} order={order} t={t} />
                </td>
              )}
              <td className="px-5 py-4 text-right font-mono text-[11px] text-zinc-400 dark:text-zinc-600">{formatDate(order.created_at, language, t)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </motion.div>
  )
}

function MobileOrders({ assignment, isAdmin, orders, refreshVersion, t }) {
  return (
    <motion.div key={refreshVersion} initial={{ opacity: 0.35 }} animate={{ opacity: 1 }} transition={{ duration: 0.32 }} className="divide-y divide-zinc-200 dark:divide-zinc-800 md:hidden">
      {orders.map((order) => (
        <article key={order.id} className="p-4">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-md bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              <Truck aria-hidden="true" size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-200">{order.client_name}</p>
                  <p className="mt-1 font-mono text-[11px] text-zinc-400 dark:text-zinc-600">{t('dashboard.table.order')} #{order.id}</p>
                </div>
                <StatusBadge status={order.status} t={t} />
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
                <MapPin aria-hidden="true" className="shrink-0" size={14} />
                <span className="truncate">{order.delivery_address}</span>
              </div>
              {isAdmin && <div className="mt-3"><OrderMembers order={order} t={t} /></div>}
              {isAdmin && <div className="mt-3"><DriverAssignment {...assignment} order={order} t={t} /></div>}
            </div>
          </div>
        </article>
      ))}
    </motion.div>
  )
}

export default function MerchantDashboard() {
  const { user } = useAuth()
  const { language, t } = useLanguage()
  const { socket } = useSocket()
  const location = useLocation()
  const navigate = useNavigate()
  const canCreate = user.role === 'merchant'
  const isAdmin = user.role === 'admin'
  const [orders, setOrders] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [formError, setFormError] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSheetOpen, setIsSheetOpen] = useState(location.pathname === '/orders/new')
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [successOrderId, setSuccessOrderId] = useState(null)
  const [notification, setNotification] = useState(null)
  const [drivers, setDrivers] = useState([])
  const [isLoadingDrivers, setIsLoadingDrivers] = useState(false)
  const [assigningOrderId, setAssigningOrderId] = useState(null)
  const [assignmentError, setAssignmentError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  const loadAvailableDrivers = useCallback(async () => {
    setIsLoadingDrivers(true)
    setAssignmentError('')

    try {
      const data = await driverService.getAvailableDrivers()
      setDrivers(Array.isArray(data) ? data : [])
    } catch (error) {
      setDrivers([])
      setAssignmentError(getApiErrorMessage(error, t('dashboard.driverLoadError')))
    } finally {
      setIsLoadingDrivers(false)
    }
  }, [t])

  const assignDriver = async (orderId, driver) => {
    setAssigningOrderId(orderId)
    setAssignmentError('')

    try {
      await orderService.assignOrderToDriver(orderId, driver.id)
      setOrders((currentOrders) => currentOrders.map((order) => (
        Number(order.id) === Number(orderId)
          ? {
              ...order,
              driver_avatar: driver.avatar,
              driver_id: driver.id,
              driver_name: driver.name,
              driver_phone: driver.phone,
              status: 'assigned',
            }
          : order
      )))
      setNotification({ id: `${orderId}-${Date.now()}`, orderId, status: 'assigned' })
    } catch (error) {
      setAssignmentError(getApiErrorMessage(error, t('dashboard.assignError')))
      throw error
    } finally {
      setAssigningOrderId(null)
    }
  }

  const fetchOrders = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setIsLoading(true)
    }

    setLoadError(false)

    try {
      const data = await orderService.getOrders()
      setOrders(Array.isArray(data) ? data : [])
      setRefreshVersion((version) => version + 1)
    } catch {
      setLoadError(true)
    } finally {
      if (!silent) {
        setIsLoading(false)
      }
    }
  }, [])

  const refreshOrdersSilently = useCallback(() => fetchOrders({ silent: true }), [fetchOrders])
  useAutoRefresh(refreshOrdersSilently, ['orders'])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  useEffect(() => {
    const handleStatusUpdate = (payload) => {
      const orderId = Number(payload.order_id ?? payload.orderId)
      const status = payload.status

      if (!Number.isInteger(orderId) || !status) {
        return
      }

      setOrders((currentOrders) => currentOrders.map((order) => (
        Number(order.id) === orderId
          ? { ...order, status, driver_id: payload.driver_id ?? order.driver_id }
          : order
      )))

      setNotification({
        id: `${orderId}-${Date.now()}`,
        orderId,
        status,
      })
    }

    socket.on('order_status_updated', handleStatusUpdate)
    return () => socket.off('order_status_updated', handleStatusUpdate)
  }, [socket])

  useEffect(() => {
    const handleOrderCreated = (payload = {}) => {
      const orderId = Number(payload.order_id ?? payload.orderId)

      fetchOrders({ silent: true })

      if (Number.isInteger(orderId) && orderId > 0) {
        setNotification({ id: `${orderId}-${Date.now()}`, orderId, status: 'pending' })
      }
    }

    socket.on('order_created', handleOrderCreated)
    return () => socket.off('order_created', handleOrderCreated)
  }, [fetchOrders, socket])

  useEffect(() => {
    if (!notification) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => setNotification(null), 4000)
    return () => window.clearTimeout(timeoutId)
  }, [notification])

  useEffect(() => {
    if (location.pathname === '/orders/new' && canCreate) {
      setIsSheetOpen(true)
    }
  }, [canCreate, location.pathname])

  const stats = useMemo(() => ({
    total: orders.length,
    active: orders.filter((order) => ACTIVE_STATUSES.has(order.status)).length,
    delivered: orders.filter((order) => order.status === 'delivered').length,
  }), [orders])

  const filteredOrders = useMemo(
    () => orders.filter((order) => orderMatchesSearch(order, searchQuery)),
    [orders, searchQuery],
  )

  const closeSheet = () => {
    setIsSheetOpen(false)
    setFormError('')

    if (location.pathname === '/orders/new') {
      navigate('/orders', { replace: true })
    }
  }

  const openSheet = () => {
    setFormError('')
    setIsSheetOpen(true)
  }

  const updateField = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    setFormError('')
  }

  const createOrder = async (event) => {
    event.preventDefault()
    setFormError('')
    setSuccessOrderId(null)
    setIsSubmitting(true)

    try {
      const payload = {
        ...form,
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
      }
      const data = await orderService.createOrder(payload)

      setForm(EMPTY_FORM)
      closeSheet()
      setSuccessOrderId(data.orderId)
      await fetchOrders({ silent: true })
    } catch {
      setFormError('dashboard.createError')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">
      <StatusToast notification={notification} onClose={() => setNotification(null)} />
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-100">{t('dashboard.title')}</h2>
          <p className="mt-1 text-sm text-zinc-500">{t('dashboard.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => fetchOrders()}
          disabled={isLoading}
          className="grid size-9 shrink-0 place-items-center rounded-md border border-zinc-200 text-zinc-500 transition-colors hover:bg-white hover:text-zinc-900 disabled:opacity-50 dark:border-zinc-800 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
          title={t('dashboard.refresh')}
          aria-label={t('dashboard.refresh')}
        >
          <RefreshCw aria-hidden="true" className={isLoading ? 'animate-spin' : ''} size={16} />
        </button>
      </div>

      <label className="relative mb-5 block max-w-xl">
        <span className="sr-only">{t('dashboard.searchPlaceholder')}</span>
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={17} />
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          className="h-11 w-full rounded-md border border-zinc-200 bg-white pl-10 pr-10 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-amber-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600"
          placeholder={t('dashboard.searchPlaceholder')}
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            aria-label={t('dashboard.clearSearch')}
            title={t('dashboard.clearSearch')}
          >
            <X aria-hidden="true" size={15} />
          </button>
        )}
      </label>

      <section className="grid grid-cols-3 gap-2 sm:gap-3" aria-label={t('dashboard.statsLabel')}>
        <StatCard label={t('dashboard.total')} mobileLabel={t('dashboard.totalMobile')} value={stats.total} icon={ClipboardList} tone="text-zinc-400" />
        <StatCard label={t('dashboard.active')} mobileLabel={t('dashboard.active')} value={stats.active} icon={Clock3} tone="text-cyan-400" />
        <StatCard label={t('dashboard.delivered')} mobileLabel={t('dashboard.delivered')} value={stats.delivered} icon={CheckCircle2} tone="text-emerald-400" />
      </section>

      <AnimatePresence>
        {successOrderId && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300"
          >
            <span className="flex items-center gap-2"><PackageCheck aria-hidden="true" size={16} />{t('dashboard.success', { id: successOrderId })}</span>
            <button type="button" onClick={() => setSuccessOrderId(null)} className="grid size-7 place-items-center rounded-md text-emerald-400 hover:bg-emerald-500/10" aria-label={t('common.close')}>
              <X aria-hidden="true" size={15} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`mt-5 grid items-start gap-5 ${canCreate ? 'lg:grid-cols-[minmax(0,1fr)_340px]' : ''}`}>
        <section className="min-w-0 overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-4 dark:border-zinc-800 sm:px-5">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{t('dashboard.listTitle')}</h3>
              <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-600">{t(filteredOrders.length === 1 ? 'dashboard.resultOne' : 'dashboard.resultMany', { count: filteredOrders.length })}</p>
            </div>
            <span className="flex items-center gap-2 text-[11px] text-zinc-400 dark:text-zinc-600">
              <span className="size-1.5 rounded-full bg-emerald-500" />{t('common.direct')}
            </span>
          </div>

          {isLoading ? (
            <LoadingState t={t} />
          ) : loadError ? (
            <div className="grid min-h-72 place-items-center p-6 text-center">
              <div>
                <AlertTriangle aria-hidden="true" className="mx-auto text-rose-400" size={22} />
                <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">{t('dashboard.loadError')}</p>
                <button type="button" onClick={() => fetchOrders()} className="mt-4 text-sm font-semibold text-amber-400 hover:text-amber-300">{t('dashboard.retry')}</button>
              </div>
            </div>
          ) : orders.length === 0 ? (
            <EmptyState canCreate={canCreate} onCreate={openSheet} t={t} />
          ) : filteredOrders.length === 0 ? (
            <div className="grid min-h-72 place-items-center p-6 text-center text-sm text-zinc-500">{t('dashboard.noResults')}</div>
          ) : (
            <>
              {assignmentError && <p className="border-b border-rose-500/20 bg-rose-500/10 px-4 py-2 text-xs text-rose-500">{assignmentError}</p>}
              <DesktopOrders
                assignment={{ assigningOrderId, drivers, isLoading: isLoadingDrivers, onAssign: assignDriver, onLoad: loadAvailableDrivers }}
                isAdmin={isAdmin}
                language={language}
                orders={filteredOrders}
                refreshVersion={refreshVersion}
                t={t}
              />
              <MobileOrders
                assignment={{ assigningOrderId, drivers, isLoading: isLoadingDrivers, onAssign: assignDriver, onLoad: loadAvailableDrivers }}
                isAdmin={isAdmin}
                orders={filteredOrders}
                refreshVersion={refreshVersion}
                t={t}
              />
            </>
          )}
        </section>

        {canCreate && (
          <aside className="sticky top-6 hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 lg:block">
            <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{t('dashboard.newOrder')}</h3>
              <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-600">{t('common.pendingStatus')}</p>
            </div>
            <div className="p-5">
              <OrderForm form={form} error={formError ? t(formError) : ''} isSubmitting={isSubmitting} onChange={updateField} onSubmit={createOrder} t={t} />
            </div>
          </aside>
        )}
      </div>

      {canCreate && (
        <motion.button
          type="button"
          onClick={openSheet}
          whileTap={{ scale: 0.9 }}
          className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 z-30 grid size-14 place-items-center rounded-full bg-amber-500 text-zinc-950 shadow-[0_10px_34px_rgba(245,158,11,0.28)] lg:hidden"
          title={t('dashboard.createAction')}
          aria-label={t('dashboard.createAction')}
        >
          <Plus aria-hidden="true" size={24} strokeWidth={2.2} />
        </motion.button>
      )}

      <AnimatePresence>
        {canCreate && isSheetOpen && (
          <>
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeSheet}
              className="fixed inset-0 z-50 bg-black/65 backdrop-blur-[2px] lg:hidden"
              aria-label={t('dashboard.closeForm')}
            />
            <motion.section
              role="dialog"
              aria-modal="true"
              aria-labelledby="create-order-title"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 34 }}
              className="fixed inset-x-0 bottom-0 z-[60] max-h-[88dvh] overflow-y-auto rounded-t-lg border-t border-zinc-200 bg-white px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-24px_60px_rgba(0,0,0,0.2)] dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-[0_-24px_60px_rgba(0,0,0,0.45)] lg:hidden"
            >
              <div className="mx-auto h-1 w-10 rounded-full bg-zinc-600" />
              <div className="mb-5 mt-4 flex items-start justify-between gap-4">
                <div>
                  <h3 id="create-order-title" className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{t('dashboard.newOrder')}</h3>
                  <p className="mt-1 text-xs text-zinc-500">{t('dashboard.sheetSubtitle')}</p>
                </div>
                <button type="button" onClick={closeSheet} className="grid size-8 place-items-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-200" aria-label={t('common.close')}>
                  <X aria-hidden="true" size={18} />
                </button>
              </div>
              <OrderForm form={form} error={formError ? t(formError) : ''} isSubmitting={isSubmitting} onChange={updateField} onSubmit={createOrder} t={t} />
            </motion.section>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
