import { ChevronRight, CircleAlert, CreditCard, Minus, Package, PackageSearch, Plus, ShieldCheck, ShoppingBag, Store } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import EmptyState from '../components/EmptyState.jsx'
import ProductCard from '../components/ProductCard.jsx'
import { useMarketplaceText } from '../i18n.js'
import { fetchProduct, getErrorKey, isRequestCancelled } from '../services/marketplaceApi.js'
import usePageTitle from '../usePageTitle.js'

function ProductImage({ product }) {
  const { t } = useMarketplaceText()
  const [hasError, setHasError] = useState(false)

  return (
    <div className="relative aspect-square overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
      {product.image_url && !hasError ? (
        <img src={product.image_url} alt={product.name} onError={() => setHasError(true)} className="absolute inset-0 size-full object-cover" />
      ) : (
        <div className="absolute inset-0 grid place-items-center text-zinc-600" role="img" aria-label={t('product.noImage')}>
          <Package aria-hidden="true" size={56} strokeWidth={1.25} />
        </div>
      )}
    </div>
  )
}

// Selection de quantite et passage au paiement de la boutique (panier par boutique)
function OrderPanel({ product }) {
  const { t } = useMarketplaceText()
  const navigate = useNavigate()
  const [quantity, setQuantity] = useState(1)
  const isAvailable = product.stock > 0
  const maxQuantity = Math.min(product.stock, 99)

  const order = () => {
    navigate(`/shop/${product.shop.slug}?produit=${product.id}&quantite=${quantity}`)
  }

  if (!isAvailable) {
    return <p className="rounded-lg border border-zinc-800 px-4 py-3 text-sm text-zinc-400">{t('productPage.outOfStock')}</p>
  }

  const stepButton = 'grid size-10 place-items-center text-zinc-300 transition-colors hover:text-white disabled:opacity-30'

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <span id="mk-quantity-label" className="text-sm font-semibold text-white">{t('productPage.quantity')}</span>
        <span className="text-xs text-zinc-500">{t('productPage.stockLeft', { count: product.stock })}</span>
      </div>
      <div className="flex gap-3">
        <div role="group" aria-labelledby="mk-quantity-label" className="flex h-10 items-center rounded-lg border border-zinc-800">
          <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1} aria-label={t('productPage.decrease')} className={stepButton}>
            <Minus aria-hidden="true" size={16} />
          </button>
          <span className="w-10 text-center text-sm font-semibold tabular-nums text-white" aria-live="polite">{quantity}</span>
          <button type="button" onClick={() => setQuantity((q) => Math.min(maxQuantity, q + 1))} disabled={quantity >= maxQuantity} aria-label={t('productPage.increase')} className={stepButton}>
            <Plus aria-hidden="true" size={16} />
          </button>
        </div>
        <button type="button" onClick={order} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-400">
          <ShoppingBag aria-hidden="true" size={16} />
          {t('productPage.order')}
        </button>
      </div>
      <p className="text-xs text-zinc-500">{t('productPage.checkoutNote')}</p>
    </div>
  )
}

function ProductDetails({ product, related }) {
  const { t, formatPrice } = useMarketplaceText()
  usePageTitle(t('productPage.pageTitle', { name: product.name }))
  const guarantees = [
    [CreditCard, 'productPage.guaranteePayment'],
    [PackageSearch, 'productPage.guaranteeTracking'],
    [ShieldCheck, 'productPage.guaranteePrivacy'],
  ]

  return (
    <div className="mk-container py-8">
      <nav aria-label={t('productPage.breadcrumb')} className="mb-8">
        <ol className="flex flex-wrap items-center gap-1 text-sm text-zinc-500">
          <li><Link to="/catalogue" className="hover:text-white">{t('productPage.catalog')}</Link></li>
          {product.category && (
            <>
              <li aria-hidden="true"><ChevronRight size={14} /></li>
              <li><Link to={`/catalogue?category=${encodeURIComponent(product.category)}`} className="hover:text-white">{product.category}</Link></li>
            </>
          )}
          <li aria-hidden="true"><ChevronRight size={14} /></li>
          <li aria-current="page" className="truncate text-zinc-300">{product.name}</li>
        </ol>
      </nav>

      <div className="grid gap-8 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-7">
          <ProductImage product={product} />
        </div>

        <div className="flex flex-col gap-8 lg:col-span-5">
          <div>
            {product.category && <p className="text-sm text-zinc-500">{product.category}</p>}
            <h1 className="mt-1 text-3xl font-semibold text-white">{product.name}</h1>
            <p className="mt-4 text-2xl font-semibold text-white">{formatPrice(product.price)}</p>
          </div>

          {/* Boutique : nom et lien uniquement, aucune coordonnee */}
          <Link to={`/shop/${product.shop.slug}`} className="group flex items-center gap-3 rounded-lg border border-zinc-800 p-4 transition-colors hover:border-zinc-600">
            <span className="grid size-10 place-items-center rounded-lg border border-zinc-800 text-zinc-400"><Store aria-hidden="true" size={18} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs text-zinc-500">{t('productPage.soldBy')}</span>
              <span className="block truncate text-sm font-semibold text-white">{product.shop.name}</span>
            </span>
            <span className="text-sm text-zinc-400 group-hover:text-white">{t('productPage.visitShop')}</span>
          </Link>

          <OrderPanel product={product} />

          <section aria-labelledby="mk-description-title" className="border-t border-zinc-800 pt-6">
            <h2 id="mk-description-title" className="text-sm font-semibold text-white">{t('productPage.description')}</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-zinc-400">{product.description || t('productPage.noDescription')}</p>
          </section>

          <section aria-labelledby="mk-guarantees-title" className="border-t border-zinc-800 pt-6">
            <h2 id="mk-guarantees-title" className="text-sm font-semibold text-white">{t('productPage.guarantees')}</h2>
            <ul className="mt-3 space-y-3">
              {guarantees.map(([Icon, key]) => (
                <li key={key} className="flex items-center gap-3 text-sm text-zinc-400">
                  <Icon aria-hidden="true" size={16} className="shrink-0 text-zinc-500" />
                  {t(key)}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      {related.length > 0 && (
        <section aria-labelledby="mk-related-title" className="mt-16 border-t border-zinc-800 pt-12">
          <h2 id="mk-related-title" className="mb-6 text-xl font-semibold text-white">{t('productPage.relatedTitle')}</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:gap-6">
            {related.map((item) => <ProductCard key={item.id} product={item} />)}
          </div>
        </section>
      )}
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
    fetchProduct(id, { signal: controller.signal })
      .then((data) => setResponse({ key: requestKey, status: 'ready', data, errorKey: null }))
      .catch((error) => {
        if (!isRequestCancelled(error)) setResponse({ key: requestKey, status: 'error', data: null, errorKey: getErrorKey(error) })
      })
    return () => controller.abort()
  }, [id, requestKey])

  if (status === 'loading') {
    return (
      <div className="mk-container grid gap-8 py-8 lg:grid-cols-12 lg:gap-12" aria-hidden="true">
        <div className="mt-12 aspect-square rounded-lg border border-zinc-800 bg-zinc-900 lg:col-span-7" />
        <div className="mt-12 space-y-4 lg:col-span-5"><div className="h-8 w-3/4 rounded bg-zinc-900" /><div className="h-6 w-1/3 rounded bg-zinc-900" /><div className="h-20 rounded-lg border border-zinc-800" /></div>
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

  // key : la quantite choisie repart a 1 en changeant de produit
  return <ProductDetails key={response.data.product.id} product={response.data.product} related={response.data.related_products} />
}
