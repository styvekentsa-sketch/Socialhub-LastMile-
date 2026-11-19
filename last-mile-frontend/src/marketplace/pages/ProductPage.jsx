import { BadgeCheck, ChevronRight, CircleAlert, CreditCard, Minus, Package, Plus, ShieldCheck, ShoppingCart, Store, Truck, Zap } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useCart } from '../cart/cartContext.js'
import { usePreferences } from '../collections/collectionsContext.js'
import EmptyState from '../components/EmptyState.jsx'
import ProductCard from '../components/ProductCard.jsx'
import CompareButton from '../components/CompareButton.jsx'
import ReviewForm from '../components/ReviewForm.jsx'
import { RatingSummary, StarRating } from '../components/StarRating.jsx'
import VerifiedBadge from '../components/VerifiedBadge.jsx'
import WishlistButton from '../components/WishlistButton.jsx'
import { useMarketplaceText } from '../i18n.js'
import { fetchProductDetails, getErrorKey, isRequestCancelled } from '../services/marketplaceApi.js'
import usePageTitle from '../usePageTitle.js'

const LOW_STOCK_THRESHOLD = 5
const ZOOM = 2.2

/** Colonne 1 : image, zoom au survol (souris) centre sur le curseur. */
function ZoomImage({ product }) {
  const { t } = useMarketplaceText()
  const [hasError, setHasError] = useState(false)
  const imageRef = useRef(null)

  // Le point de zoom suit le curseur, sans re-rendu React
  const onMouseMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * 100
    const y = ((event.clientY - rect.top) / rect.height) * 100
    if (imageRef.current) imageRef.current.style.transformOrigin = `${x}% ${y}%`
  }

  if (!product.image_url || hasError) {
    return (
      <div className="relative grid aspect-square place-items-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-600" role="img" aria-label={t('product.noImage')}>
        <Package aria-hidden="true" size={56} strokeWidth={1.25} />
      </div>
    )
  }

  return (
    <div>
      <div onMouseMove={onMouseMove} className="group relative aspect-square cursor-zoom-in overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
        <img
          ref={imageRef}
          src={product.image_url}
          alt={product.name}
          onError={() => setHasError(true)}
          style={{ '--mk-zoom': ZOOM }}
          className="absolute inset-0 size-full object-cover transition-transform duration-200 ease-out group-hover:[transform:scale(var(--mk-zoom))]"
        />
      </div>
      <p className="mt-2 hidden text-center text-xs text-zinc-500 md:block">{t('productPro.zoomHint')}</p>
    </div>
  )
}

function StockLine({ stock }) {
  const { t } = useMarketplaceText()
  if (stock <= 0) return <p className="text-sm font-semibold text-zinc-500">{t('productPro.outOfStock')}</p>
  if (stock <= LOW_STOCK_THRESHOLD) return <p className="text-sm font-semibold text-amber-500">{t('productPro.lowStock', { count: stock })}</p>
  return <p className="text-sm font-semibold text-emerald-400">{t('productPro.inStock')}</p>
}

/** Colonne 3 : encart d'achat (prix, stock, quantite, panier, commande directe, reassurance). */
function BuyBox({ product }) {
  const { t, formatPrice } = useMarketplaceText()
  const navigate = useNavigate()
  const cart = useCart()
  const deliveryZone = usePreferences()?.deliveryZone
  const [quantity, setQuantity] = useState(1)
  const isPaused = Boolean(product.shop.paused)
  const isAvailable = product.stock > 0 && !isPaused
  const maxQuantity = Math.max(1, Math.min(product.stock, 99))
  const stepButton = 'grid size-10 place-items-center text-zinc-300 transition-colors hover:text-white disabled:opacity-30'

  return (
    <aside aria-label={t('productPro.buyNow')} className="rounded-lg border border-zinc-800 bg-[var(--mk-surface)] p-5 lg:sticky lg:top-36">
      <p className="text-2xl font-semibold text-white">{formatPrice(product.price)}</p>
      <div className="mt-2"><StockLine stock={product.stock} /></div>
      {isPaused && <p role="status" className="mt-4 rounded-lg border border-zinc-700 px-3 py-2.5 text-sm text-zinc-300">{t('productPro.shopPaused')}</p>}
      {deliveryZone && isAvailable && <p className="mt-2 text-xs text-zinc-400">{t('prefs.deliveryTo', { zone: deliveryZone })}</p>}

      {isAvailable && (
        <div className="mt-5 space-y-3">
          <div className="flex items-center justify-between gap-4">
            <span id="mk-quantity-label" className="text-sm text-zinc-300">{t('productPage.quantity')}</span>
            <div role="group" aria-labelledby="mk-quantity-label" className="flex h-10 items-center rounded-lg border border-zinc-800 bg-[var(--mk-bg)]">
              <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1} aria-label={t('productPage.decrease')} className={stepButton}><Minus aria-hidden="true" size={16} /></button>
              <span className="w-10 text-center text-sm font-semibold tabular-nums text-white" aria-live="polite">{quantity}</span>
              <button type="button" onClick={() => setQuantity((q) => Math.min(maxQuantity, q + 1))} disabled={quantity >= maxQuantity} aria-label={t('productPage.increase')} className={stepButton}><Plus aria-hidden="true" size={16} /></button>
            </div>
          </div>
          <button type="button" onClick={() => cart.addItem(product, quantity)} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-400">
            <ShoppingCart aria-hidden="true" size={16} />
            {t('productPro.addToCart')}
          </button>
          <button type="button" onClick={() => navigate(`/shop/${product.shop.slug}/commande?produit=${product.id}&quantite=${quantity}`)} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--mk-contrast)] px-4 text-sm font-semibold text-[var(--mk-on-contrast)] transition-colors hover:bg-[var(--mk-contrast-hover)]">
            <Zap aria-hidden="true" size={16} />
            {t('productPro.buyNow')}
          </button>
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <WishlistButton product={product} variant="button" />
        <CompareButton product={product} />
      </div>

      <div className="mt-5 space-y-4 border-t border-zinc-800 pt-5">
        <div className="flex gap-3">
          <Truck aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-amber-500" />
          <div>
            <p className="text-sm font-semibold text-white">{t('productPro.shippedBy')}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">{t('productPro.shippedByText')}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <CreditCard aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-zinc-500" />
          <p className="text-xs leading-relaxed text-zinc-400">{t('productPro.securePayment')}</p>
        </div>
        <div className="flex gap-3">
          <ShieldCheck aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-zinc-500" />
          <p className="text-xs leading-relaxed text-zinc-400">{t('productPage.guaranteePrivacy')}</p>
        </div>
      </div>
    </aside>
  )
}

function RatingDistribution({ distribution, total }) {
  const { t } = useMarketplaceText()
  return (
    <ul className="space-y-2">
      {[5, 4, 3, 2, 1].map((stars) => {
        const count = distribution[stars] || 0
        const percent = total ? Math.round((count / total) * 100) : 0
        return (
          <li key={stars} className="flex items-center gap-3 text-xs text-zinc-400">
            <span className="w-16 shrink-0">{t('productPro.starsRow', { stars })}</span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-800" aria-hidden="true"><span className="block h-full rounded-full bg-amber-500" style={{ width: `${percent}%` }} /></span>
            <span className="w-10 shrink-0 text-right tabular-nums">{percent} %</span>
          </li>
        )
      })}
    </ul>
  )
}

function ReviewsPanel({ productId, stats, reviews, onPublished }) {
  const { t, language } = useMarketplaceText()
  const formatDate = (value) => new Date(value).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="grid gap-10 lg:grid-cols-12">
      <div className="space-y-6 lg:col-span-4">
        <div>
          <p className="text-4xl font-semibold text-white">{stats.count ? stats.avg.toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US', { maximumFractionDigits: 1 }) : '–'}</p>
          <div className="mt-2"><RatingSummary value={stats.avg} count={stats.count} size={16} /></div>
        </div>
        <RatingDistribution distribution={stats.distribution} total={stats.count} />
        <ReviewForm productId={productId} onPublished={onPublished} />
      </div>
      <div className="lg:col-span-8">
        {reviews.length === 0 ? (
          <p className="rounded-lg border border-zinc-800 px-5 py-8 text-center text-sm text-zinc-400">{t('productPro.noReviewsYet')}</p>
        ) : (
          <ul className="divide-y divide-zinc-800 rounded-lg border border-zinc-800">
            {reviews.map((review) => (
              <li key={review.id} className="p-5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <StarRating value={review.rating} size={14} />
                  <span className="text-sm font-semibold text-white">{review.author}</span>
                  {review.is_verified_purchase && <span className="inline-flex items-center gap-1 text-xs text-emerald-400"><BadgeCheck aria-hidden="true" size={13} />{t('rating.verifiedPurchase')}</span>}
                  <span className="text-xs text-zinc-500">{formatDate(review.created_at)}</span>
                </div>
                {review.comment && <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-zinc-300">{review.comment}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function ProductDetails({ data }) {
  const { t, formatNumber, formatPrice } = useMarketplaceText()
  const { product } = data
  const tabsId = useId()
  const [activeTab, setActiveTab] = useState('reviews')
  // Avis publies pendant la visite : ajoutes localement, sans recharger la page
  const [newReviews, setNewReviews] = useState([])
  usePageTitle(t('productPage.pageTitle', { name: product.name }))

  const reviews = [...newReviews, ...data.reviews]
  const distribution = { ...data.rating_distribution }
  newReviews.forEach((review) => { distribution[review.rating] = (distribution[review.rating] || 0) + 1 })
  const count = data.review_count + newReviews.length
  const avg = count ? ((data.avg_rating || 0) * data.review_count + newReviews.reduce((sum, r) => sum + r.rating, 0)) / count : null
  const stats = { avg, count, distribution }

  const features = [
    ['productPro.featureCategory', product.category || '–'],
    ['productPro.featureShop', product.shop.name],
    ['productPro.featureStock', product.stock > 0 ? t('productPage.stockLeft', { count: formatNumber(product.stock) }) : t('productPro.outOfStock')],
    ['productPro.featureRef', `LM-P${String(product.id).padStart(5, '0')}`],
  ]
  const tabs = [
    { id: 'reviews', label: t('productPro.reviewsTab', { count }) },
    { id: 'similar', label: t('productPro.similarTab') },
  ]

  const onTabKeyDown = (event) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    const next = activeTab === 'reviews' ? 'similar' : 'reviews'
    setActiveTab(next)
    document.getElementById(`${tabsId}-tab-${next}`)?.focus()
  }

  return (
    <div className="mk-container py-8">
      <nav aria-label={t('productPage.breadcrumb')} className="mb-6">
        <ol className="flex flex-wrap items-center gap-1 text-sm text-zinc-500">
          <li><Link to="/catalogue" className="hover:text-white">{t('productPage.catalog')}</Link></li>
          {product.category && (
            <>
              <li aria-hidden="true"><ChevronRight size={14} /></li>
              <li><Link to={`/catalogue?category=${encodeURIComponent(product.category)}`} className="hover:text-white">{product.category}</Link></li>
            </>
          )}
          <li aria-hidden="true"><ChevronRight size={14} /></li>
          <li aria-current="page" className="max-w-[60vw] truncate text-zinc-300">{product.name}</li>
        </ol>
      </nav>

      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-5"><ZoomImage product={product} /></div>

        <div className="flex flex-col gap-6 lg:col-span-4">
          <div>
            <h1 className="text-2xl font-semibold leading-snug text-white md:text-3xl">{product.name}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
              <Link to={`/shop/${product.shop.slug}`} className="inline-flex items-center gap-1.5 text-sm text-zinc-300 underline-offset-4 hover:text-white hover:underline">
                <Store aria-hidden="true" size={15} className="text-zinc-500" />
                {t('productPage.soldBy')} {product.shop.name}
              </Link>
              {product.shop.verified && <VerifiedBadge />}
            </div>
            <button type="button" onClick={() => setActiveTab('reviews')} className="mt-3 block text-left" aria-controls={`${tabsId}-panel-reviews`}>
              <RatingSummary value={stats.avg} count={stats.count} size={15} />
            </button>
          </div>

          <p className="border-y border-zinc-800 py-4 text-3xl font-semibold text-white">{formatPrice(product.price)}</p>

          <section aria-labelledby="mk-description-title">
            <h2 id="mk-description-title" className="text-sm font-semibold text-white">{t('productPage.description')}</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-zinc-400">{product.description || t('productPage.noDescription')}</p>
          </section>

          <section aria-labelledby="mk-features-title">
            <h2 id="mk-features-title" className="text-sm font-semibold text-white">{t('productPro.features')}</h2>
            <dl className="mt-3 divide-y divide-zinc-800 rounded-lg border border-zinc-800 text-sm">
              {features.map(([key, value]) => (
                <div key={key} className="grid grid-cols-5 gap-3 px-4 py-2.5">
                  <dt className="col-span-2 text-zinc-500">{t(key)}</dt>
                  <dd className="col-span-3 truncate text-zinc-200">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        <div className="md:col-span-2 lg:col-span-3"><BuyBox product={{ ...product, avg_rating: data.avg_rating, review_count: data.review_count }} /></div>
      </div>

      <section className="mt-14 border-t border-zinc-800 pt-2">
        <div role="tablist" aria-label={t('productPro.tabsLabel')} className="flex gap-6 border-b border-zinc-800">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              id={`${tabsId}-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`${tabsId}-panel-${tab.id}`}
              tabIndex={activeTab === tab.id ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={onTabKeyDown}
              className={`-mb-px h-12 border-b-2 text-sm transition-colors ${activeTab === tab.id ? 'border-amber-500 font-semibold text-white' : 'border-transparent text-zinc-400 hover:text-white'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div id={`${tabsId}-panel-reviews`} role="tabpanel" aria-labelledby={`${tabsId}-tab-reviews`} hidden={activeTab !== 'reviews'} className="pt-8">
          <ReviewsPanel productId={product.id} stats={stats} reviews={reviews} onPublished={(review) => setNewReviews((current) => [review, ...current])} />
        </div>
        <div id={`${tabsId}-panel-similar`} role="tabpanel" aria-labelledby={`${tabsId}-tab-similar`} hidden={activeTab !== 'similar'} className="pt-8">
          {data.similar_products.length
            ? <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:gap-6">{data.similar_products.map((item) => <ProductCard key={item.id} product={item} />)}</div>
            : <p className="text-sm text-zinc-400">{t('productPro.noSimilar')}</p>}
        </div>
      </section>
    </div>
  )
}

export default function ProductPage() {
  const { t } = useMarketplaceText()
  const { id } = useParams()
  const [attempt, setAttempt] = useState(0)
  const requestKey = `${id}#${attempt}`
  // Etat derive : tant que la reponse ne correspond pas a la requete en cours, la page est en chargement
  const [response, setResponse] = useState({ key: null, status: 'loading', data: null, errorKey: null })
  const status = response.key === requestKey ? response.status : 'loading'

  useEffect(() => {
    const controller = new AbortController()
    fetchProductDetails(id, { signal: controller.signal })
      .then((data) => setResponse({ key: requestKey, status: 'ready', data, errorKey: null }))
      .catch((error) => {
        if (!isRequestCancelled(error)) setResponse({ key: requestKey, status: 'error', data: null, errorKey: getErrorKey(error) })
      })
    return () => controller.abort()
  }, [id, requestKey])

  if (status === 'loading') {
    return (
      <div className="mk-container grid gap-8 py-8 md:grid-cols-2 lg:grid-cols-12 lg:gap-10" aria-hidden="true">
        <div className="mt-10 aspect-square rounded-lg border border-zinc-800 bg-zinc-900 lg:col-span-5" />
        <div className="mt-10 space-y-4 lg:col-span-4"><div className="h-8 w-3/4 rounded bg-zinc-900" /><div className="h-4 w-1/2 rounded bg-zinc-900" /><div className="h-8 w-1/3 rounded bg-zinc-900" /><div className="h-24 rounded-lg border border-zinc-800" /></div>
        <div className="mt-10 h-72 rounded-lg border border-zinc-800 md:col-span-2 lg:col-span-3" />
      </div>
    )
  }

  if (status === 'error') {
    const isMissing = response.errorKey === 'errors.notFound' || response.errorKey === 'errors.badRequest'
    return (
      <div className="mk-container py-16">
        <EmptyState
          tone={isMissing ? 'neutral' : 'error'}
          icon={isMissing ? Package : CircleAlert}
          title={isMissing ? t('productPage.notFoundTitle') : t('errors.title')}
          text={isMissing ? t('productPage.notFoundText') : t(response.errorKey)}
          action={isMissing
            ? <Link to="/catalogue" className="inline-flex h-10 items-center rounded-lg border border-zinc-700 px-4 text-sm font-semibold text-white hover:border-zinc-500">{t('productPage.backToCatalog')}</Link>
            : <button type="button" onClick={() => setAttempt((n) => n + 1)} className="h-10 rounded-lg border border-zinc-700 px-4 text-sm font-semibold text-white hover:border-zinc-500">{t('errors.retry')}</button>}
        />
      </div>
    )
  }

  // key : quantite, onglet et avis ajoutes repartent de zero en changeant de produit
  return <ProductDetails key={response.data.product.id} data={response.data} />
}
