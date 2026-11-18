import { ArrowRight, Bike, CircleAlert, PackageSearch, Store } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import EmptyState from '../components/EmptyState.jsx'
import ProductCard from '../components/ProductCard.jsx'
import SearchBar from '../components/SearchBar.jsx'
import ShopCard from '../components/ShopCard.jsx'
import { useMarketplaceText } from '../i18n.js'
import { fetchMarketplaceHome, getErrorKey, isRequestCancelled } from '../services/marketplaceApi.js'
import usePageTitle from '../usePageTitle.js'

const PRODUCT_GRID = 'grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-6'

function SectionHeader({ id, title, linkTo, linkLabel }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <h2 id={id} className="text-xl font-semibold text-white">{title}</h2>
      {linkTo && (
        <Link to={linkTo} className="inline-flex shrink-0 items-center gap-1 text-sm text-zinc-400 transition-colors hover:text-white">
          {linkLabel}
          <ArrowRight aria-hidden="true" size={14} />
        </Link>
      )}
    </div>
  )
}

function Hero({ stats, isLoading }) {
  const { t, formatNumber } = useMarketplaceText()
  const statRows = [
    ['home.statShops', stats?.shop_count],
    ['home.statProducts', stats?.products_in_stock],
    ['home.statDeliveries', stats?.deliveries_completed],
  ]

  return (
    <section className="border-b border-zinc-800">
      <div className="mk-container grid gap-12 py-16 lg:grid-cols-12 lg:py-24">
        <div className="lg:col-span-7">
          <p className="text-sm font-semibold text-amber-500">{t('home.eyebrow')}</p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight text-white md:text-5xl">{t('home.title')}</h1>
          <p className="mt-4 max-w-xl text-base text-zinc-400 md:text-lg">{t('home.text')}</p>
          <div className="mt-8 max-w-xl">
            <SearchBar size="lg" id="mk-hero-search" />
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/suivi" className="inline-flex h-10 items-center gap-2 rounded-lg border border-zinc-700 px-4 text-sm font-semibold text-white transition-colors hover:border-zinc-500">
              <PackageSearch aria-hidden="true" size={16} />
              {t('home.trackCta')}
            </Link>
            <Link to="/devenir-partenaire" className="inline-flex h-10 items-center gap-2 rounded-lg border border-zinc-700 px-4 text-sm font-semibold text-white transition-colors hover:border-zinc-500">
              <Store aria-hidden="true" size={16} />
              {t('home.sellCta')}
            </Link>
          </div>
        </div>

        <aside className="lg:col-span-5 lg:pl-8" aria-label={t('home.statsTitle')}>
          <div className="rounded-lg border border-zinc-800">
            <h2 className="border-b border-zinc-800 px-6 py-4 text-sm font-semibold text-white">{t('home.statsTitle')}</h2>
            <dl>
              {statRows.map(([key, value]) => (
                <div key={key} className="flex items-baseline justify-between gap-4 border-b border-zinc-800 px-6 py-5 last:border-b-0">
                  <dt className="text-sm text-zinc-400">{t(key)}</dt>
                  <dd className="text-2xl font-semibold text-white tabular-nums">
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

function CategoryBar({ categories }) {
  const { t, formatNumber } = useMarketplaceText()

  if (!categories?.length) return null

  return (
    <section className="border-b border-zinc-800" aria-labelledby="mk-categories-title">
      <div className="mk-container py-6">
        <h2 id="mk-categories-title" className="sr-only">{t('home.categoriesTitle')}</h2>
        <ul className="mk-scroll-x flex gap-2">
          <li className="shrink-0">
            <Link to="/catalogue" className="inline-flex h-9 items-center rounded-lg bg-white px-4 text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-200">
              {t('home.allCatalog')}
            </Link>
          </li>
          {categories.map((category) => (
            <li key={category.name} className="shrink-0">
              <Link
                to={`/catalogue?category=${encodeURIComponent(category.name)}`}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-800 px-4 text-sm text-zinc-300 transition-colors hover:border-zinc-600 hover:text-white"
              >
                {category.name}
                <span className="text-xs text-zinc-500">{formatNumber(category.product_count)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
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
              <span className="grid size-10 place-items-center rounded-lg border border-zinc-800 text-amber-500">
                <Icon aria-hidden="true" size={20} />
              </span>
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

const ProductSkeletons = () => (
  <div className={PRODUCT_GRID} aria-hidden="true">
    {Array.from({ length: 8 }, (_, index) => (
      <div key={index} className="overflow-hidden rounded-lg border border-zinc-800">
        <div className="aspect-[4/3] bg-zinc-900" />
        <div className="space-y-2 p-4"><div className="h-4 w-3/4 rounded bg-zinc-900" /><div className="h-3 w-1/2 rounded bg-zinc-900" /></div>
      </div>
    ))}
  </div>
)

export default function HomePage() {
  const { t } = useMarketplaceText()
  const [attempt, setAttempt] = useState(0)
  // Etat derive : tant que la reponse ne correspond pas a la tentative en cours, la page est en chargement
  const [response, setResponse] = useState({ attempt: null, status: 'loading', data: null, errorKey: null })
  usePageTitle(t('home.pageTitle'))

  useEffect(() => {
    const controller = new AbortController()
    fetchMarketplaceHome({ signal: controller.signal })
      .then((data) => setResponse({ attempt, status: 'ready', data, errorKey: null }))
      .catch((error) => {
        if (!isRequestCancelled(error)) setResponse({ attempt, status: 'error', data: null, errorKey: getErrorKey(error) })
      })
    return () => controller.abort()
  }, [attempt])

  const { data, errorKey } = response
  const status = response.attempt === attempt ? response.status : 'loading'
  const isLoading = status === 'loading'

  return (
    <>
      <Hero stats={data?.stats} isLoading={isLoading} />
      <CategoryBar categories={data?.categories} />

      <section className="mk-container py-16" aria-labelledby="mk-latest-title">
        <SectionHeader id="mk-latest-title" title={t('home.latestTitle')} linkTo="/catalogue" linkLabel={t('home.seeCatalog')} />
        {status === 'error' && (
          <EmptyState
            tone="error"
            icon={CircleAlert}
            title={t('errors.title')}
            text={t(errorKey)}
            action={<button type="button" onClick={() => setAttempt((n) => n + 1)} className="h-10 rounded-lg border border-zinc-700 px-4 text-sm font-semibold text-white hover:border-zinc-500">{t('errors.retry')}</button>}
          />
        )}
        {isLoading && <ProductSkeletons />}
        {status === 'ready' && (data.latest_products.length
          ? <div className={PRODUCT_GRID}>{data.latest_products.map((product) => <ProductCard key={product.id} product={product} />)}</div>
          : <EmptyState title={t('empty.noProductsTitle')} text={t('empty.noProductsText')} />)}
      </section>

      {status === 'ready' && (
        <section className="border-t border-zinc-800" aria-labelledby="mk-shops-title">
          <div className="mk-container py-16">
            <SectionHeader id="mk-shops-title" title={t('home.shopsTitle')} linkTo="/boutiques" linkLabel={t('home.seeShops')} />
            {data.featured_shops.length
              ? <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{data.featured_shops.map((shop) => <ShopCard key={shop.slug} shop={shop} />)}</div>
              : <p className="text-sm text-zinc-500">{t('empty.noShops')}</p>}
          </div>
        </section>
      )}

      <PartnerBand />
    </>
  )
}
