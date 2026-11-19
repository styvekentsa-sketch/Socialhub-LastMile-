import { Heart } from 'lucide-react'
import { useWishlist } from '../collections/collectionsContext.js'
import { useMarketplaceText } from '../i18n.js'

/**
 * Bouton coeur (ajout / retrait des favoris).
 * variant « icon » : pastille ronde posee sur une image ; « button » : bouton avec libelle (fiche produit).
 */
export default function WishlistButton({ product, variant = 'icon', className = '' }) {
  const { t } = useMarketplaceText()
  const wishlist = useWishlist()
  if (!wishlist) return null

  const isSaved = wishlist.has(product.id)
  const label = t(isSaved ? 'wishlist.remove' : 'wishlist.add', { name: product.name })

  if (variant === 'button') {
    return (
      <button
        type="button"
        onClick={() => wishlist.toggle(product)}
        aria-pressed={isSaved}
        aria-label={label}
        className={`inline-flex h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg border px-2 text-[13px] font-semibold transition-colors ${isSaved ? 'border-rose-500/40 text-rose-400 hover:border-rose-400' : 'border-zinc-700 text-white hover:border-zinc-500'} ${className}`}
      >
        <Heart aria-hidden="true" size={16} fill={isSaved ? 'currentColor' : 'none'} />
        {t(isSaved ? 'wishlist.saved' : 'wishlist.save')}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={() => wishlist.toggle(product)}
      aria-pressed={isSaved}
      aria-label={label}
      title={label}
      className={`grid size-9 place-items-center rounded-full border border-zinc-700 bg-[var(--mk-bg)]/85 transition-colors hover:border-zinc-500 ${isSaved ? 'text-rose-400' : 'text-zinc-300 hover:text-white'} ${className}`}
    >
      <Heart aria-hidden="true" size={16} fill={isSaved ? 'currentColor' : 'none'} />
    </button>
  )
}
