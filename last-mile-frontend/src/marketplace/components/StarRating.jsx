import { Star } from 'lucide-react'
import { useMarketplaceText } from '../i18n.js'

/** Etoiles en lecture seule, remplissage partiel (ex. 4,5) ; value null = aucune note. */
export function StarRating({ value, size = 14, className = '' }) {
  const { t } = useMarketplaceText()
  const rating = Math.max(0, Math.min(5, Number(value) || 0))
  const label = value === null || value === undefined ? t('rating.noReviews') : t('rating.outOf', { value: rating.toFixed(1).replace('.0', '') })

  return (
    <span role="img" aria-label={label} className={`relative inline-flex shrink-0 ${className}`}>
      <span className="flex text-zinc-700" aria-hidden="true">
        {Array.from({ length: 5 }, (_, i) => <Star key={i} size={size} fill="currentColor" strokeWidth={0} />)}
      </span>
      <span className="absolute inset-y-0 left-0 flex overflow-hidden text-amber-500" style={{ width: `${(rating / 5) * 100}%` }} aria-hidden="true">
        {Array.from({ length: 5 }, (_, i) => <Star key={i} size={size} fill="currentColor" strokeWidth={0} className="shrink-0" />)}
      </span>
    </span>
  )
}

/** Note + nombre d'avis sur une ligne (ex. « ★★★★☆ 4,5 · 2 avis »). */
export function RatingSummary({ value, count, size = 14, className = '' }) {
  const { t, language } = useMarketplaceText()
  if (!count) {
    return <span className={`text-xs text-zinc-500 ${className}`}>{t('rating.noReviews')}</span>
  }
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs text-zinc-400 ${className}`}>
      <StarRating value={value} size={size} />
      <span className="font-semibold text-zinc-200">{Number(value).toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US', { maximumFractionDigits: 1 })}</span>
      <span>· {t('rating.reviews', { count })}</span>
    </span>
  )
}

/** Saisie d'une note de 1 a 5 (groupe radio accessible au clavier). */
export function StarInput({ value, onChange, label }) {
  const { t } = useMarketplaceText()

  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1">
      {[1, 2, 3, 4, 5].map((stars) => (
        <button
          key={stars}
          type="button"
          role="radio"
          aria-checked={value === stars}
          aria-label={t('productPro.starLabel', { count: stars })}
          onClick={() => onChange(stars)}
          className={`grid size-9 place-items-center rounded-lg border transition-colors ${stars <= value ? 'border-amber-500/50 text-amber-500' : 'border-zinc-800 text-zinc-600 hover:text-zinc-400'}`}
        >
          <Star aria-hidden="true" size={18} fill={stars <= value ? 'currentColor' : 'none'} />
        </button>
      ))}
    </div>
  )
}
