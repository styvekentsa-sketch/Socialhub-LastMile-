import { Heart, ShoppingCart, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getApiStatus } from '../../services/api.js'
import { useCart } from '../cart/cartContext.js'
import { useWishlist } from '../collections/collectionsContext.js'
import EmptyState from '../components/EmptyState.jsx'
import ProductThumb from '../components/ProductThumb.jsx'
import { RatingSummary } from '../components/StarRating.jsx'
import VerifiedBadge from '../components/VerifiedBadge.jsx'
import { useMarketplaceText } from '../i18n.js'
import { fetchProductDetails, isRequestCancelled } from '../services/marketplaceApi.js'
import usePageTitle from '../usePageTitle.js'

const REFRESH_LIMIT = 30

/** Page « Mes favoris » (/wishlist) : instantanes locaux, actualises en arriere-plan (prix, stock, note). */
export default function WishlistPage() {
  const { t, formatPrice, formatNumber } = useMarketplaceText()
  const wishlist = useWishlist()
  const cart = useCart()
  usePageTitle(t('wishlist.pageTitle'))

  const { items, refresh } = wishlist
  // Produits a actualiser : ceux presents a l'ouverture de la page
  const [initialIds] = useState(() => items.slice(0, REFRESH_LIMIT).map((item) => item.id))

  // Actualisation a l'ouverture : un produit supprime du catalogue (404) est retire des favoris
  useEffect(() => {
    if (!initialIds.length) return undefined
    const controller = new AbortController()
    const ids = initialIds
    Promise.allSettled(ids.map((id) => fetchProductDetails(id, { signal: controller.signal }))).then((results) => {
      if (results.some((result) => result.status === 'rejected' && isRequestCancelled(result.reason))) return
      const fresh = results.filter((result) => result.status === 'fulfilled').map((result) => ({
        ...result.value.product,
        avg_rating: result.value.avg_rating,
        review_count: result.value.review_count,
      }))
      const missing = ids.filter((id, index) => results[index].status === 'rejected' && getApiStatus(results[index].reason) === 404)
      refresh(fresh, missing)
    })
    return () => controller.abort()
  }, [initialIds, refresh])

  return (
    <div className="mk-container py-10">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <h1 className="text-3xl font-semibold text-white">{t('wishlist.title')}</h1>
          <p className="mt-2 text-sm text-zinc-400">{t('wishlist.count', { count: formatNumber(items.length) })}</p>
        </div>
        <p className="text-xs text-zinc-500">{t('wishlist.storageNote')}</p>
      </div>

      {items.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            icon={Heart}
            title={t('wishlist.empty')}
            text={t('wishlist.emptyHint')}
            action={<Link to="/catalogue" className="inline-flex h-10 items-center rounded-lg bg-[var(--mk-contrast)] px-4 text-sm font-semibold text-[var(--mk-on-contrast)] hover:bg-[var(--mk-contrast-hover)]">{t('wishlist.browse')}</Link>}
          />
        </div>
      ) : (
        <ul className="mt-8 grid gap-4 md:grid-cols-2">
          {items.map((item) => (
            <li key={item.id} className="flex gap-4 rounded-lg border border-zinc-800 bg-[var(--mk-surface)] p-4">
              <Link to={`/produits/${item.id}`} className="relative size-24 shrink-0 overflow-hidden rounded-md border border-zinc-800 bg-zinc-900 sm:size-28">
                <ProductThumb src={item.image_url} iconSize={24} />
              </Link>
              <div className="flex min-w-0 flex-1 flex-col">
                <Link to={`/produits/${item.id}`} className="line-clamp-2 text-[15px] font-semibold text-white hover:underline">{item.name}</Link>
                <span className="mt-0.5 flex min-w-0 items-center gap-1 text-[13px] text-zinc-400">
                  <span className="truncate">{t('product.soldBy', { shop: item.shop.name })}</span>
                  {item.shop.verified && <VerifiedBadge compact />}
                </span>
                <RatingSummary value={item.avg_rating} count={item.review_count} size={12} className="mt-1" />
                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3">
                  <span className="text-[15px] font-semibold text-white">{formatPrice(item.price)}</span>
                  <div className="flex items-center gap-2">
                    {item.stock > 0 ? (
                      <button type="button" onClick={() => cart.addItem(item, 1)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-amber-500 px-3 text-sm font-semibold text-zinc-950 hover:bg-amber-400">
                        <ShoppingCart aria-hidden="true" size={15} />
                        {t('wishlist.addToCart')}
                      </button>
                    ) : (
                      <span className="text-xs text-zinc-500">{t('wishlist.unavailable')}</span>
                    )}
                    <button type="button" onClick={() => wishlist.remove(item.id)} className="grid size-9 place-items-center rounded-lg border border-zinc-800 text-zinc-500 hover:text-white" aria-label={t('wishlist.remove', { name: item.name })} title={t('wishlist.removeShort')}>
                      <Trash2 aria-hidden="true" size={15} />
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
