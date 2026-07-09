import { divIcon } from 'leaflet'
import { motion } from 'framer-motion'
import { CheckCircle2, LoaderCircle, Minus, Navigation, PackageCheck, Plus, XCircle } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from 'react-leaflet'
import { useLanguage } from '../../context/languageContext.js'

const DOUALA_CENTER = [4.0511, 9.7679]
const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'

const parseCoordinate = (value, min, max) => {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const parsedValue = Number(value)
  return Number.isFinite(parsedValue) && parsedValue >= min && parsedValue <= max
    ? parsedValue
    : null
}

const driverIcon = divIcon({
  className: 'map-div-icon',
  html: `
    <span class="relative flex size-10 items-center justify-center">
      <span class="absolute size-7 animate-ping rounded-full bg-sky-400/40"></span>
      <span class="absolute size-5 rounded-full bg-sky-400/20"></span>
      <span class="relative size-3 rounded-full border-2 border-zinc-950 bg-sky-400 shadow-[0_0_16px_rgba(56,189,248,0.95)]"></span>
    </span>
  `,
  iconAnchor: [20, 20],
  iconSize: [40, 40],
})

const deliveryIcon = divIcon({
  className: 'map-div-icon',
  html: `
    <span class="delivery-map-marker flex size-10 items-center justify-center">
      <svg aria-hidden="true" viewBox="0 0 24 24" width="32" height="32" fill="#f59e0b" stroke="#09090b" stroke-width="1.4">
        <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"></path>
        <circle cx="12" cy="10" r="2.5" fill="#09090b" stroke="none"></circle>
      </svg>
    </span>
  `,
  iconAnchor: [20, 35],
  iconSize: [40, 40],
})

function MapFocus({ deliveryPosition, driverPosition }) {
  const map = useMap()
  const deliveryLatitude = deliveryPosition?.[0]
  const deliveryLongitude = deliveryPosition?.[1]
  const driverLatitude = driverPosition?.[0]
  const driverLongitude = driverPosition?.[1]

  useEffect(() => {
    if (Number.isFinite(driverLatitude) && Number.isFinite(driverLongitude)
      && Number.isFinite(deliveryLatitude) && Number.isFinite(deliveryLongitude)) {
      map.flyToBounds([
        [driverLatitude, driverLongitude],
        [deliveryLatitude, deliveryLongitude],
      ], {
        animate: true,
        duration: 0.65,
        maxZoom: 14,
        padding: [52, 52],
      })
      return
    }

    if (Number.isFinite(driverLatitude) && Number.isFinite(driverLongitude)) {
      map.setView([driverLatitude, driverLongitude], 16, { animate: true })
      return
    }

    if (Number.isFinite(deliveryLatitude) && Number.isFinite(deliveryLongitude)) {
      map.setView([deliveryLatitude, deliveryLongitude], 14, { animate: true })
      return
    }

    map.setView(DOUALA_CENTER, 13, { animate: true })
  }, [deliveryLatitude, deliveryLongitude, driverLatitude, driverLongitude, map])

  return null
}

export default function DriverInteractiveMap({ error, isUpdating, locationIssue, onStatusChange, order, position, positionAccuracy }) {
  const { t } = useLanguage()
  const mapRef = useRef(null)
  const driverLatitude = parseCoordinate(position?.[0], -90, 90)
  const driverLongitude = parseCoordinate(position?.[1], -180, 180)
  const deliveryLatitude = parseCoordinate(order?.latitude, -90, 90)
  const deliveryLongitude = parseCoordinate(order?.longitude, -180, 180)
  const driverPosition = driverLatitude !== null && driverLongitude !== null
    ? [driverLatitude, driverLongitude]
    : null
  const deliveryPosition = useMemo(() => (
    deliveryLatitude !== null && deliveryLongitude !== null
      ? [deliveryLatitude, deliveryLongitude]
      : null
  ), [deliveryLatitude, deliveryLongitude])
  const mapCenter = driverPosition || deliveryPosition || DOUALA_CENTER

  const runStatusChange = async (status) => {
    try {
      await onStatusChange(order.id, status)
    } catch {
      return
    }
  }

  const renderActions = () => {
    if (!order || ['delivered', 'failed', 'cancelled'].includes(order.status)) {
      return null
    }

    if (order.status === 'assigned') {
      return (
        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          disabled={isUpdating}
          onClick={() => runStatusChange('picking')}
          className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-md bg-amber-500 px-4 text-sm font-semibold text-zinc-950 disabled:opacity-60"
        >
          {isUpdating ? <LoaderCircle aria-hidden="true" className="animate-spin" size={17} /> : <Navigation aria-hidden="true" size={17} />}
          {t('driverActions.accept')}
        </motion.button>
      )
    }

    if (order.status === 'picking' || order.status === 'picked_up') {
      return (
        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          disabled={isUpdating}
          onClick={() => runStatusChange('in_transit')}
          className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-md bg-amber-500 px-4 text-sm font-semibold text-zinc-950 disabled:opacity-60"
        >
          {isUpdating ? <LoaderCircle aria-hidden="true" className="animate-spin" size={17} /> : <PackageCheck aria-hidden="true" size={17} />}
          {t('driverActions.startDelivery')}
        </motion.button>
      )
    }

    if (order.status === 'in_transit') {
      return (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            disabled={isUpdating}
            onClick={() => runStatusChange('delivered')}
            className="flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-500 px-3 text-sm font-semibold text-zinc-950 disabled:opacity-60"
          >
            <CheckCircle2 aria-hidden="true" size={17} />
            {t('driverActions.delivered')}
          </motion.button>
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            disabled={isUpdating}
            onClick={() => runStatusChange('failed')}
            className="flex h-11 items-center justify-center gap-2 rounded-md bg-rose-500 px-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            <XCircle aria-hidden="true" size={17} />
            {t('driverActions.failed')}
          </motion.button>
        </div>
      )
    }

    return null
  }

  return (
    <section
      className="last-mile-map relative h-[min(620px,calc(100dvh-12rem))] min-h-[440px] w-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 sm:min-h-[520px]"
      aria-label={t('map.interactiveLabel')}
    >
      <MapContainer
        ref={mapRef}
        center={mapCenter}
        zoom={13}
        minZoom={3}
        maxZoom={19}
        zoomControl={false}
        scrollWheelZoom
        touchZoom
        worldCopyJump
        className="z-0 size-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url={TILE_URL}
          subdomains="abcd"
        />
        <MapFocus deliveryPosition={deliveryPosition} driverPosition={driverPosition} />
        {driverPosition && (
          <Marker position={driverPosition} icon={driverIcon} zIndexOffset={20}>
            <Tooltip className="map-tooltip" direction="top" offset={[0, -14]}>{t('map.driverPosition')}</Tooltip>
          </Marker>
        )}
        {deliveryPosition && (
          <Marker key={`${deliveryPosition[0]}-${deliveryPosition[1]}`} position={deliveryPosition} icon={deliveryIcon} zIndexOffset={10}>
            <Tooltip className="map-tooltip" direction="top" offset={[0, -28]}>{t('map.deliveryPoint')}</Tooltip>
          </Marker>
        )}
      </MapContainer>

      <div className="absolute right-3 top-3 z-20 flex flex-col overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/92 shadow-xl backdrop-blur-md">
        <motion.button
          type="button"
          whileTap={{ scale: 0.9 }}
          onClick={() => mapRef.current?.zoomIn()}
          className="grid size-10 place-items-center text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-amber-400"
          aria-label={t('map.zoomIn')}
          title={t('map.zoomIn')}
        >
          <Plus aria-hidden="true" size={18} />
        </motion.button>
        <span className="mx-2 h-px bg-zinc-800" />
        <motion.button
          type="button"
          whileTap={{ scale: 0.9 }}
          onClick={() => mapRef.current?.zoomOut()}
          className="grid size-10 place-items-center text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-amber-400"
          aria-label={t('map.zoomOut')}
          title={t('map.zoomOut')}
        >
          <Minus aria-hidden="true" size={18} />
        </motion.button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18, duration: 0.35, ease: 'easeOut' }}
        className="absolute inset-x-3 bottom-7 z-20 rounded-lg border border-zinc-700 bg-zinc-950/88 p-3.5 shadow-2xl backdrop-blur-md sm:inset-x-5 sm:bottom-8 sm:p-4"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-md bg-amber-500 text-zinc-950">
              <Navigation aria-hidden="true" size={17} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-zinc-100">{order?.delivery_address || t('driverActions.noActiveOrder')}</p>
              <p className="truncate text-xs text-zinc-500">
                {order ? `${t('dashboard.table.order')} #${order.id} · ${t(`status.${order.status}`)}` : t('driverActions.waitingAssignment')}
              </p>
            </div>
          </div>
        </div>
        <p className={`mt-2 text-xs ${locationIssue ? 'text-rose-400' : driverPosition ? 'text-emerald-400' : 'text-zinc-500'}`}>
          {locationIssue
            ? t(`map.locationErrors.${locationIssue}`, { accuracy: Math.round(positionAccuracy || 0) })
            : driverPosition
              ? t('map.gpsActive', { accuracy: Math.round(positionAccuracy || 0) })
              : t('map.waitingGps')}
        </p>
        {error && <p className="mt-2 text-xs text-rose-400">{t('driverActions.updateError')}</p>}
        {renderActions()}
      </motion.div>
    </section>
  )
}
