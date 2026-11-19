import { BadgeCheck } from 'lucide-react'
import { useMarketplaceText } from '../i18n.js'

/** Badge « Boutique verifiee » ; compact = icone seule (avec libelle accessible). */
export default function VerifiedBadge({ compact = false, className = '' }) {
  const { t } = useMarketplaceText()

  if (compact) {
    return <BadgeCheck role="img" aria-label={t('rating.verified')} size={14} className={`shrink-0 text-sky-400 ${className}`} />
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border border-sky-400/30 px-2 py-0.5 text-xs font-medium text-sky-300 ${className}`}>
      <BadgeCheck aria-hidden="true" size={13} />
      {t('rating.verified')}
    </span>
  )
}
