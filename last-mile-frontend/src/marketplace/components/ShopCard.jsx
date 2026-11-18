import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { resolveAvatarUrl } from '../../utils/avatar.js'
import { useMarketplaceText } from '../i18n.js'

const initialsOf = (name = '') => name
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((word) => word[0]?.toUpperCase())
  .join('')

/** Carte boutique : avatar, nom, nombre de produits, prix de depart, lien vers la boutique. */
export default function ShopCard({ shop }) {
  const { t, formatPrice } = useMarketplaceText()
  const [hasAvatarError, setHasAvatarError] = useState(false)
  const avatarUrl = shop.avatar ? resolveAvatarUrl(shop.avatar) : null

  return (
    <Link
      to={`/shop/${shop.slug}`}
      className="group flex items-center gap-4 rounded-lg border border-zinc-800 bg-[#111113] p-4 transition-colors hover:border-zinc-600"
    >
      <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 text-sm font-semibold text-zinc-300">
        {avatarUrl && !hasAvatarError
          ? <img src={avatarUrl} alt="" onError={() => setHasAvatarError(true)} className="size-full object-cover" />
          : initialsOf(shop.name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-white">{shop.name}</span>
        <span className="mt-0.5 block text-[13px] text-zinc-400">
          {shop.product_count === 1 ? t('shop.productsOne') : t('shop.products', { count: shop.product_count })}
          {shop.min_price !== null && ` · ${t('shop.from', { price: formatPrice(shop.min_price) })}`}
        </span>
      </span>
      <ArrowRight aria-label={t('shop.visit')} size={16} className="shrink-0 text-zinc-500 transition-colors group-hover:text-white" />
    </Link>
  )
}
