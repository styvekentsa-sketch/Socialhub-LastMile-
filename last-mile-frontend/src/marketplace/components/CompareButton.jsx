import { Check, GitCompareArrows } from 'lucide-react'
import { useCompare } from '../collections/collectionsContext.js'
import { useMarketplaceText } from '../i18n.js'

/** Bouton « Comparer » de la fiche produit : ajoute / retire l'article (3 articles maximum). */
export default function CompareButton({ product }) {
  const { t } = useMarketplaceText()
  const compare = useCompare()
  if (!compare) return null

  const isAdded = compare.has(product.id)
  const isBlocked = !isAdded && compare.isFull

  const onClick = () => {
    if (isAdded) {
      compare.remove(product.id)
    } else if (compare.add(product)) {
      compare.open()
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        disabled={isBlocked}
        aria-pressed={isAdded}
        title={isAdded ? t('compare.remove') : undefined}
        className={`inline-flex h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg border px-2 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${isAdded ? 'border-sky-400/40 text-sky-300 hover:border-sky-300' : 'border-zinc-700 text-white hover:border-zinc-500'}`}
      >
        {isAdded ? <Check aria-hidden="true" size={16} /> : <GitCompareArrows aria-hidden="true" size={16} />}
        {t(isAdded ? 'compare.added' : 'compare.add')}
      </button>
      {isBlocked && <p className="mt-1.5 text-xs text-zinc-500">{t('compare.full')}</p>}
    </div>
  )
}
