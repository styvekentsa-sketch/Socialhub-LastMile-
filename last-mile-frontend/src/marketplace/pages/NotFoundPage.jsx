import { Link } from 'react-router-dom'
import { useMarketplaceText } from '../i18n.js'
import usePageTitle from '../usePageTitle.js'

/** Page 404 publique : toute URL inconnue (hors routes privees explicites) aboutit ici. */
export default function NotFoundPage() {
  const { t } = useMarketplaceText()
  usePageTitle(t('notFound.pageTitle'))

  return (
    <div className="mk-container py-24">
      <p className="font-mono text-sm text-amber-500">{t('notFound.code')}</p>
      <h1 className="mt-4 text-4xl font-semibold text-white">{t('notFound.title')}</h1>
      <p className="mt-4 max-w-xl text-base text-zinc-400">{t('notFound.text')}</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link to="/" className="inline-flex h-11 items-center rounded-lg bg-[var(--mk-contrast)] px-5 text-sm font-semibold text-[var(--mk-on-contrast)] transition-colors hover:bg-[var(--mk-contrast-hover)]">{t('notFound.home')}</Link>
        <Link to="/catalogue" className="inline-flex h-11 items-center rounded-lg border border-zinc-700 px-5 text-sm font-semibold text-white transition-colors hover:border-zinc-500">{t('notFound.catalog')}</Link>
        <Link to="/suivi" className="inline-flex h-11 items-center rounded-lg border border-zinc-700 px-5 text-sm font-semibold text-white transition-colors hover:border-zinc-500">{t('notFound.tracking')}</Link>
      </div>
    </div>
  )
}
