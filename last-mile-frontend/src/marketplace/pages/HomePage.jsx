import { ArrowRight, BadgeCheck, Bike, CircleAlert, PackageSearch, ShieldCheck, Sparkles, Star, Store, Truck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import EmptyState from '../components/EmptyState.jsx'
import ProductCarousel from '../components/ProductCarousel.jsx'
import ShopCard from '../components/ShopCard.jsx'
import { useMarketplaceText } from '../i18n.js'
import { fetchMarketplaceHome, fetchMarketplaceProducts, getErrorKey, isRequestCancelled } from '../services/marketplaceApi.js'
import usePageTitle from '../usePageTitle.js'

const CAROUSEL_SIZE = 10

function Hero({ stats, isLoading }) {
  const { t, formatNumber } = useMarketplaceText()
  const promises = [
    { icon: Truck, title: 'homePro.promiseSpeed', text: 'homePro.promiseSpeedText' },
    { icon: ShieldCheck, title: 'homePro.promisePayment', text: 'homePro.promisePaymentText' },
    { icon: PackageSearch, title: 'homePro.promiseTracking', text: 'homePro.promiseTrackingText' },
  ]
  const statRows = [
    ['home.statShops', stats?.shop_count],
    ['home.statProducts', stats?.products_in_stock],
    ['home.statDeliveries', stats?.deliveries_completed],
  ]

  return (
    <section className="border-b border-zinc-800">
      <div className="mk-container grid gap-10 py-12 lg:grid-cols-12 lg:py-16">
        <div className="lg:col-span-7">
          <p className="text-sm font-semibold text-amber-500">{t('homePro.eyebrow')}</p>
          <h1 className="mt-4 max-w-2xl text-4xl font-semibold leading-tight text-white md:text-5xl">{t('homePro.title')}</h1>
          <p className="mt-4 max-w-xl text-base text-zinc-400 md:text-lg">{t('homePro.text')}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/catalogue" className="inline-flex h-11 items-center gap-2 rounded-lg bg-amber-500 px-5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-400">
              {t('home.seeCatalog')}
              <ArrowRight aria-hidden="true" size={16} />
            </Link>
            <Link to="/suivi" className="inline-flex h-11 items-center gap-2 rounded-lg border border-zinc-700 px-5 text-sm font-semibold text-white transition-colors hover:border-zinc-500">
              <PackageSearch aria-hidden="true" size={16} />
              {t('home.trackCta')}
            </Link>
          </div>
          <ul className="mt-10 grid gap-4 sm:grid-cols-3">
            {promises.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-3 sm:flex-col">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-zinc-800 text-amber-500"><Icon aria-hidden="true" size={18} /></span>
                <span>
                  <span className="block text-sm font-semibold text-white">{t(title)}</span>
                  <span className="mt-0.5 block text-[13px] text-zinc-400">{t(text)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <aside className="lg:col-span-5 lg:pl-8" aria-label={t('home.statsTitle')}>
          <div className="rounded-lg border border-zinc-800 bg-[var(--mk-surface)]">
            <h2 className="border-b border-zinc-800 px-6 py-4 text-sm font-semibold text-white">{t('home.statsTitle')}</h2>
            <dl>
              {statRows.map(([key, value]) => (
                <div key={key} className="flex items-baseline justify-between gap-4 border-b border-zinc-800 px-6 py-5 last:border-b-0">
                  <dt className="text-sm text-zinc-400">{t(key)}</dt>
                  <dd className="text-2xl font-semibold tabular-nums text-white">
                    {isLoading || value === undefined ? <span className="inline-block h-7 w-12 rounded bg-zinc-900" /> : formatNumber(value)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
          <p className="mt-4 text-sm text-zinc-500">{t('home.payments')}</p>
        </aside>
      </div>
    </section>
  )
}

function QuickAccess() {
  const { t } = useMarketplaceText()
  const cards = [
    { icon: Sparkles, title: 'homePro.quickNew', text: 'homePro.quickNewText', to: '/catalogue?sort=newest' },
    { icon: Star, title: 'homePro.quickTop', text: 'homePro.quickTopText', to: '/catalogue?sort=top_rated' },
    { icon: BadgeCheck, title: 'homePro.quickVerified', text: 'homePro.quickVerifiedText', to: '/boutiques' },
  ]

  return (
    <section className="mk-container pt-10" aria-label={t('homePro.quickNew')}>
      <ul className="grid gap-4 md:grid-cols-3">
        {cards.map(({ icon: Icon, title, text, to }) => (
          <li key={title}>
            <Link to={to} className="group flex items-center gap-4 rounded-lg border border-zinc-800 bg-[var(--mk-surface)] p-5 transition-colors hover:border-zinc-600">
              <span className="grid size-11 shrink-0 place-items-center rounded-lg border border-zinc-800 text-amber-500"><Icon aria-hidden="true" size={20} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-white">{t(title)}</span>
                <span className="mt-0.5 block text-[13px] text-zinc-400">{t(text)}</span>
              </span>
              <ArrowRight aria-hidden="true" size={16} className="shrink-0 text-zinc-500 transition-colors group-hover:text-white" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

function PartnerBand() {
  const { t } = useMarketplaceText()
  const offers = [
    { icon: Store, title: 'home.sellerTitle', text: 'home.sellerText', cta: 'home.sellerCta', to: '/devenir-vendeur' },
    { icon: Bike, title: 'home.driverTitle', text: 'home.driverText', cta: 'home.driverCta', to: '/devenir-livreur' },
  ]

  return (
    <section className="border-t border-zinc-800" aria-labelledby="mk-partner-title">
      <div className="mk-container py-16">
        <h2 id="mk-partner-title" className="mb-6 text-xl font-semibold text-white">{t('home.partnerTitle')}</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:gap-6">
          {offers.map(({ icon: Icon, title, text, cta, to }) => (
            <div key={title} className="flex flex-col rounded-lg border border-zinc-800 p-6">
              <span className="grid size-10 place-items-center rounded-lg border border-zinc-800 text-amber-500"><Icon aria-hidden="true" size={20} /></span>
              <h3 className="mt-4 text-lg font-semibold text-white">{t(title)}</h3>
              <p className="mt-2 flex-1 text-sm text-zinc-400">{t(text)}</p>
              <Link to={to} className="mt-6 inline-flex h-10 items-center gap-2 self-start rounded-lg bg-amber-500 px-4 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-400">
                {t(cta)}
                <ArrowRight aria-hidden="true" size={16} />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

const CarouselSkeleton = () => (
  <div className="mk-container py-12" aria-hidden="true">
    <div className="mb-6 h-6 w-48 rounded bg-zinc-900" />
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className={`overflow-hidden rounded-lg border border-zinc-800 ${index > 1 ? 'hidden sm:block' : ''} ${index > 2 ? 'sm:hidden lg:block' : ''}`}>
          <div className="aspect-[4/3] bg-zinc-900" />
          <div className="space-y-2 p-4"><div className="h-4 w-3/4 rounded bg-zinc-900" /><div className="h-3 w-1/2 rounded bg-zinc-900" /></div>
        </div>
      ))}
    </div>
  </div>
)

export default function HomePage() {
  const { t } = useMarketplaceText()
  const [attempt, setAttempt] = useState(0)
  // Etat derive : tant que la reponse ne correspond pas a la tentative en cours, la page est en chargement
  const [response, setResponse] = useState({ attempt: null, status: 'loading', data: null, errorKey: null })
  usePageTitle(t('homePro.pageTitle'))

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller
    Promise.all([
      fetchMarketplaceHome({ signal }),
      fetchMarketplaceProducts({ sort: 'newest', in_stock: 'true', limit: CAROUSEL_SIZE }, { signal }),
      fetchMarketplaceProducts({ sort: 'top_rated', limit: CAROUSEL_SIZE }, { signal }),
    ])
      .then(([home, newest, topRated]) => setResponse({
        attempt,
        status: 'ready',
        data: {
          stats: home.stats,
          shops: home.featured_shops,
          newest: newest.items,
          // « Les mieux notes » : seulement les produits ayant deja recu au moins un avis
          topRated: topRated.items.filter((product) => product.review_count > 0),
        },
        errorKey: null,
      }))
      .catch((error) => {
        if (!isRequestCancelled(error)) setResponse({ attempt, status: 'error', data: null, errorKey: getErrorKey(error) })
      })
    return () => controller.abort()
  }, [attempt])

  const { data, errorKey } = response
  const status = response.attempt === attempt ? response.status : 'loading'
  const isLoading = status === 'loading'
  // Boutiques officielles : les boutiques verifiees en premier, puis les autres boutiques actives
  const officialShops = data ? [...data.shops].sort((a, b) => Number(b.verified) - Number(a.verified)).slice(0, 6) : []

  return (
    <>
      <Hero stats={data?.stats} isLoading={isLoading} />
      <QuickAccess />

      {status === 'error' && (
        <div className="mk-container py-12">
          <EmptyState
            tone="error"
            icon={CircleAlert}
            title={t('errors.title')}
            text={t(errorKey)}
            action={<button type="button" onClick={() => setAttempt((n) => n + 1)} className="h-10 rounded-lg border border-zinc-700 px-4 text-sm font-semibold text-white hover:border-zinc-500">{t('errors.retry')}</button>}
          />
        </div>
      )}
      {isLoading && <><CarouselSkeleton /><CarouselSkeleton /></>}
      {status === 'ready' && (
        <>
          {data.newest.length
            ? <ProductCarousel id="mk-newest-title" title={t('homePro.newArrivals')} products={data.newest} seeAllTo="/catalogue?sort=newest" />
            : <div className="mk-container py-12"><EmptyState title={t('empty.noProductsTitle')} text={t('empty.noProductsText')} /></div>}
          <ProductCarousel id="mk-top-title" title={t('homePro.topRated')} products={data.topRated} seeAllTo="/catalogue?sort=top_rated" />

          <section className="border-t border-zinc-800" aria-labelledby="mk-shops-title">
            <div className="mk-container py-12">
              <div className="mb-6 flex items-end justify-between gap-4">
                <h2 id="mk-shops-title" className="text-xl font-semibold text-white">{t('homePro.officialShops')}</h2>
                <Link to="/boutiques" className="inline-flex shrink-0 items-center gap-1 text-sm text-zinc-400 transition-colors hover:text-white">
                  {t('homePro.seeAll')}
                  <ArrowRight aria-hidden="true" size={14} />
                </Link>
              </div>
              {officialShops.length
                ? <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{officialShops.map((shop) => <ShopCard key={shop.slug} shop={shop} />)}</div>
                : <p className="text-sm text-zinc-500">{t('empty.noShops')}</p>}
            </div>
          </section>

        </>
      )}

      <PartnerBand />
    </>
  )
}
