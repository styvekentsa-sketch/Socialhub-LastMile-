import { divIcon } from 'leaflet'
import { motion } from 'framer-motion'
import { useEffect } from 'react'
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet'
import { useLanguage } from '../../context/languageContext.js'

const DOUALA_CENTER = [4.0511, 9.7679]
const TILE_URL = import.meta.env.VITE_MAP_TILE_URL

const driverIcon = divIcon({
  className: 'map-div-icon',
  html: `
    <span class="relative flex size-10 items-center justify-center">
      <span class="absolute size-8 animate-ping rounded-full bg-amber-400/25"></span>
      <span class="relative grid size-8 place-items-center rounded-full border-2 border-zinc-950 bg-amber-500 text-zinc-950 shadow-[0_0_18px_rgba(245,158,11,0.75)]">
        <svg aria-hidden="true" viewBox="0 0 24 24" width="17" height="17" fill="currentColor">
          <path d="m3 11 18-8-8 18-2-8-8-2Z"></path>
        </svg>
      </span>
    </span>
  `,
  iconAnchor: [20, 20],
  iconSize: [40, 40],
})

const destinationIcon = divIcon({
  className: 'map-div-icon',
  html: `
    <span class="delivery-map-marker flex size-10 items-center justify-center">
      <svg aria-hidden="true" viewBox="0 0 24 24" width="34" height="34" fill="#10b981" stroke="#09090b" stroke-width="1.4">
        <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"></path>
        <circle cx="12" cy="10" r="2.5" fill="#09090b" stroke="none"></circle>
      </svg>
    </span>
  `,
  iconAnchor: [20, 35],
  iconSize: [40, 40],
})

function TrackingBounds({ destination, driver }) {
  const map = useMap()
  const destinationLatitude = destination?.[0]
  const destinationLongitude = destination?.[1]
  const driverLatitude = driver?.[0]
  const driverLongitude = driver?.[1]

  useEffect(() => {
    if (!Number.isFinite(destinationLatitude) || !Number.isFinite(destinationLongitude)) {
      return
    }

    const destinationPoint = [destinationLatitude, destinationLongitude]

    if (Number.isFinite(driverLatitude) && Number.isFinite(driverLongitude)) {
      map.fitBounds([[driverLatitude, driverLongitude], destinationPoint], {
        animate: true,
        duration: 0.65,
        maxZoom: 15,
        padding: [54, 54],
      })
    } else {
      map.setView(destinationPoint, 14, { animate: true })
    }
  }, [destinationLatitude, destinationLongitude, driverLatitude, driverLongitude, map])

  return null
}

export default function TrackingMap({ order }) {
  const { t } = useLanguage()
  const destination = Number.isFinite(Number(order?.latitude)) && Number.isFinite(Number(order?.longitude))
    ? [Number(order.latitude), Number(order.longitude)]
    : null
  const driver = Number.isFinite(Number(order?.driver_latitude)) && Number.isFinite(Number(order?.driver_longitude))
    ? [Number(order.driver_latitude), Number(order.driver_longitude)]
    : null
  const center = driver || destination || DOUALA_CENTER

  return (
    <section className="last-mile-map relative min-h-[390px] overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950" aria-label={t('tracking.mapLabel')}>
      <MapContainer
        center={center}
        zoom={13}
        minZoom={3}
        maxZoom={19}
        zoomControl={false}
        scrollWheelZoom
        touchZoom
        worldCopyJump
        className="absolute inset-0 z-0 size-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url={TILE_URL}
          subdomains="abcd"
        />
        <TrackingBounds destination={destination} driver={driver} />
        {destination && (
          <Marker position={destination} icon={destinationIcon} zIndexOffset={10}>
            <Tooltip className="map-tooltip" direction="top" offset={[0, -28]}>{t('tracking.deliveryPoint')}</Tooltip>
          </Marker>
        )}
        {driver && (
          <Marker position={driver} icon={driverIcon} zIndexOffset={20}>
            <Tooltip className="map-tooltip" direction="top" offset={[0, -18]}>{t('tracking.driverPosition')}</Tooltip>
          </Marker>
        )}
        {driver && destination && (
          <Polyline
            positions={[driver, destination]}
            pathOptions={{ color: '#f59e0b', dashArray: '7 9', opacity: 0.62, weight: 2 }}
          />
        )}
      </MapContainer>

      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute left-4 top-4 z-20 rounded-md border border-emerald-500/25 bg-zinc-950/88 px-3 py-2 shadow-xl backdrop-blur-md"
      >
        <p className="font-mono text-xs font-semibold text-zinc-100">CMD-{order?.id}</p>
        <p className="mt-1 flex items-center gap-2 text-[11px] text-emerald-400">
          <span className="relative flex size-1.5">
            {driver && <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-70" />}
            <span className={`relative inline-flex size-1.5 rounded-full ${driver ? 'bg-emerald-500' : 'bg-zinc-600'}`} />
          </span>
          {t(driver ? 'tracking.activePosition' : 'tracking.waitingPosition')}
        </p>
      </motion.div>
    </section>
  )
}
