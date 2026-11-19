import { CalendarDays, CircleAlert, Store } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useLocation, useOutletContext, useParams, useSearchParams } from 'react-router-dom'
import { resolveAvatarUrl } from '../../utils/avatar.js'
import EmptyState from '../components/EmptyState.jsx'
import Pagination from '../components/Pagination.jsx'
import ProductCard from '../components/ProductCard.jsx'
import { RatingSummary } from '../components/StarRating.jsx'
import VerifiedBadge from '../components/VerifiedBadge.jsx'
import { SORT_OPTIONS } from '../constants.js'
import { useMarketplaceText } from '../i18n.js'
import { fetchShopShowcase, getErrorKey, isRequestCancelled } from '../services/marketplaceApi.js'
import usePageTitle from '../usePageTitle.js'

const PAGE_SIZE = 24
const DEFAULT_SORT = 'newest'
// Parametres du parcours d'achat : les anciens liens /shop/:slug?produit=... et le retour de paiement
// (Flutterwave) arrivent ici et sont transmis tels quels a la page de commande de la boutique.
const CHECKOUT_PARAMS = ['produit', 'quantite', 'panier', 'payment_reference', 'tx_ref', 'transaction_id', 'status']

const initialsOf = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]?.toUpperCase()).join('')

function ShopHeader({ shop }) {
  const { t, formatNumber, language } = useMarketplaceText()
  const [hasAvatarError, setHasAvatarError] = useState(false)
  const avatarUrl = shop.avatar ? resolveAvatarUrl(shop.avatar) : null
  const memberSince = shop.member_since
    ? new Date(shop.member_since).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { month: 'long', year: 'numeric' })
    : null
  const stats = [
    ['shopPage.statProducts', shop.product_count],
    ['shopPage.statInStock', shop.in_stock_count],
    ['shopPage.statDeliveries', shop.deliveries_completed],
    ['shopPage.statReviews', shop.review_count],
  ]

  return (
    <section className="border-b border-zinc-800">
      {/* Banniere sobre : degrade discret et trame, sans image */}
      <div className="h-28 border-b border-zinc-800 mk-shop-banner md:h-36" aria-hidden="true" />
      <div className="mk-container">
        <div className="-mt-10 flex flex-col gap-6 pb-8 md:-mt-12 md:flex-row md:items-end md:justify-between">
          <div className="flex items-end gap-4">
            <span className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 text-xl font-semibold text-zinc-300 md:size-24">
              {avatarUrl && !hasAvatarError
                ? <img src={avatarUrl} alt="" onError={() => setHasAvatarError(true)} className="size-full object-cover" />
                : initialsOf(shop.name)}
            </span>
            <div className="min-w-0 pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold text-white md:text-3xl">{shop.name}</h1>
                {shop.verified && <VerifiedBadge />}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                <RatingSummary value={shop.avg_rating} count={shop.review_count} size={14} />
                {memberSince && <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500"><CalendarDays aria-hidden="true" size={13} />{t('shopPage.memberSince', { date: memberSince })}</span>}
              </div>
            </div>
          </div>
        </div>
        {shop.paused && <p role="status" className="mb-6 max-w-3xl rounded-lg border border-zinc-700 px-4 py-3 text-sm text-zinc-300">{t('shopPage.paused')}</p>}
        {shop.description && <p className="max-w-3xl pb-6 text-sm leading-relaxed text-zinc-400">{shop.description}</p>}
        <dl className="grid grid-cols-2 border-t border-zinc-800 md:grid-cols-4">
          {stats.map(([key, value], index) => (
            <div key={key} className={`px-1 py-5 md:px-6 ${index > 0 ? 'md:border-l md:border-zinc-800' : 'md:pl-0'} ${index % 2 === 1 ? 'border-l border-zinc-800 pl-4 md:pl-6' : ''} ${index > 1 ? 'border-t border-zinc-800 md:border-t-0' : ''}`}>
              <dt className="text-xs text-zinc-500">{t(key)}</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums text-white">{formatNumber(value || 0)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}

function ShopShowcase({ slug }) {
  const { t, formatNumber } = useMarketplaceText()
  const { scrollRef } = useOutletContext() || {}
  const [searchParams, setSearchParams] = useSearchParams()
  const sort = SORT_OPTIONS.includes(searchParams.get('sort')) ? searchParams.get('sort') : DEFAULT_SORT
  const page = Math.max(1, Number.parseInt(searchParams.get('page'), 10) || 1)
  const [attempt, setAttempt] = useState(0)
  const requestKey = `${slug}|${sort}|${page}#${attempt}`
  // Etat derive : la boutique deja chargee reste affichee pendant un changement de tri ou de page
  const [response, setResponse] = useState({ key: null, status: 'loading', data: null, errorKey: null })
  const status = response.key === requestKey ? response.status : 'loading'
  const shop = response.data?.shop?.slug === slug ? response.data.shop : null
  usePageTitle(shop ? t('shopPage.pageTitle', { name: shop.name }) : t('shopPage.notFoundTitle'))

  useEffect(() => {
    const controller = new AbortController()
    fetchShopShowcase(slug, { sort, page, limit: PAGE_SIZE }, { signal: controller.signal })
      .then((data) => setResponse({ key: requestKey, status: 'ready', data, errorKey: null }))
      .catch((error) => {
        if (!isRequestCancelled(error)) setResponse({ key: requestKey, status: 'error', data: null, errorKey: getErrorKey(error) })
      })
    return () => controller.abort()
  }, [slug, sort, page, requestKey])

  const update = (patch) => setSearchParams((current) => {
    const next = new URLSearchParams(current)
    Object.entries(patch).forEach(([key, value]) => {
      if (value === null || (key === 'sort' && value === DEFAULT_SORT) || (key === 'page' && value === 1)) next.delete(key)
      else next.set(key, String(value))
    })
    return next
  })

  if (status === 'error') {
    const isMissing = response.errorKey === 'errors.notFound' || response.errorKey === 'errors.badRequest'
    return (
      <div className="mk-container py-16">
        <EmptyState
          tone={isMissing ? 'neutral' : 'error'}
          icon={isMissing ? Store : CircleAlert}
          title={isMissing ? t('shopPage.notFoundTitle') : t('errors.title')}
          text={isMissing ? t('shopPage.notFoundText') : t(response.errorKey)}
          action={isMissing
            ? <Link to="/boutiques" className="inline-flex h-10 items-center rounded-lg border border-zinc-700 px-4 text-sm font-semibold text-white hover:border-zinc-500">{t('shopPage.backToShops')}</Link>
            : <button type="button" onClick={() => setAttempt((n) => n + 1)} className="h-10 rounded-lg border border-zinc-700 px-4 text-sm font-semibold text-white hover:border-zinc-500">{t('errors.retry')}</button>}
        />
      </div>
    )
  }

  if (!shop) {
    return (
      <div aria-hidden="true">
        <div className="h-28 border-b border-zinc-800 bg-[var(--mk-surface)] md:h-36" />
        <div className="mk-container space-y-4 py-8"><div className="h-8 w-64 rounded bg-zinc-900" /><div className="h-4 w-96 max-w-full rounded bg-zinc-900" /><div className="h-20 rounded-lg border border-zinc-800" /></div>
      </div>
    )
  }

  const products = response.data.products
  const total = products.pagination?.total ?? 0

  return (
    <>
      <ShopHeader shop={shop} />
      <section className="mk-container py-10" aria-labelledby="mk-shop-products">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="mk-shop-products" className="text-xl font-semibold text-white">{t('shopPage.catalogTitle')}</h2>
            <p className="mt-1 text-sm text-zinc-500">{total === 1 ? t('catalog.countOne') : t('catalog.count', { count: formatNumber(total) })}</p>
          </div>
          <label className="flex items-center gap-3 text-sm text-zinc-400">
            {t('shopPage.sort')}
            <select value={sort} onChange={(event) => update({ sort: event.target.value, page: null })} className="mk-input mk-select w-auto min-w-48">
              {SORT_OPTIONS.map((option) => <option key={option} value={option}>{t(`catalog.sorts.${option}`)}</option>)}
            </select>
          </label>
        </div>
        <div className={`transition-opacity ${status === 'loading' ? 'opacity-50' : ''}`} aria-busy={status === 'loading'}>
          {products.items.length
            ? <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-6">{products.items.map((product) => <ProductCard key={product.id} product={product} />)}</div>
            : <EmptyState title={t('empty.noProductsTitle')} text={t('empty.noProductsText')} />}
        </div>
        <div className="mt-8">
          <Pagination
            page={products.pagination.page}
            totalPages={products.pagination.total_pages}
            onPageChange={(next) => { update({ page: next }); scrollRef?.current?.scrollTo({ top: 0 }) }}
          />
        </div>
      </section>
    </>
  )
}

/** Vitrine publique d'une boutique (/shop/:slug). Le paiement se fait sur /shop/:slug/commande. */
export default function ShopPage() {
  const { slug } = useParams()
  const location = useLocation()
  const params = useMemo(() => new URLSearchParams(location.search), [location.search])

  if (CHECKOUT_PARAMS.some((key) => params.has(key))) {
    return <Navigate to={`/shop/${encodeURIComponent(slug)}/commande${location.search}`} replace />
  }
  return <ShopShowcase key={slug} slug={slug} />
}
