import { Package } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMarketplaceText } from '../i18n.js'

const LOW_STOCK_THRESHOLD = 5

function StockBadge({ stock }) {
  const { t } = useMarketplaceText()

  if (stock <= 0) {
    return <span className="rounded-md border border-zinc-800 px-2 py-0.5 text-xs text-zinc-500">{t('product.outOfStock')}</span>
  }

  if (stock <= LOW_STOCK_THRESHOLD) {
    return <span className="rounded-md border border-amber-500/40 px-2 py-0.5 text-xs text-amber-500">{t('product.lowStock', { count: stock })}</span>
  }

  return <span className="rounded-md border border-zinc-700 px-2 py-0.5 text-xs text-zinc-300">{t('product.inStock')}</span>
}

/** Carte produit : photo, titre, boutique, prix en FCFA, etat du stock. */
export default function ProductCard({ product }) {
  const { t, formatPrice } = useMarketplaceText()
  const [hasImageError, setHasImageError] = useState(false)
  const showImage = product.image_url && !hasImageError

  return (
    <Link
      to={`/produits/${product.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-lg border border-zinc-800 bg-[#111113] transition-colors hover:border-zinc-600"
    >
      <div className="relative aspect-[4/3] overflow-hidden border-b border-zinc-800 bg-zinc-900">
        {showImage ? (
          <img
            src={product.image_url}
            alt={product.name}
            loading="lazy"
            onError={() => setHasImageError(true)}
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-zinc-600" role="img" aria-label={t('product.noImage')}>
            <Package aria-hidden="true" size={32} strokeWidth={1.5} />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        {product.category && <span className="text-xs text-zinc-500">{product.category}</span>}
        <h3 className="line-clamp-2 text-[15px] font-semibold text-white group-hover:underline group-hover:underline-offset-4">
          {product.name}
        </h3>
        <p className="truncate text-[13px] text-zinc-400">{t('product.soldBy', { shop: product.shop.name })}</p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          <span className="text-[15px] font-semibold text-white">{formatPrice(product.price)}</span>
          <StockBadge stock={product.stock} />
        </div>
      </div>
    </Link>
  )
}
