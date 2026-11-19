import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMarketplaceText } from '../i18n.js'

// Pages affichees : 1, ..., page - 1, page, page + 1, ..., derniere
const pageWindow = (page, totalPages) => {
  const pages = new Set([1, totalPages, page - 1, page, page + 1])
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b)
  return sorted.flatMap((p, index) => (index > 0 && p - sorted[index - 1] > 1 ? ['gap', p] : [p]))
}

const buttonClass = 'inline-flex h-9 min-w-9 items-center justify-center gap-1 rounded-lg border px-3 text-sm transition-colors'

export default function Pagination({ page, totalPages, onPageChange }) {
  const { t } = useMarketplaceText()

  if (!totalPages || totalPages <= 1) {
    return null
  }

  return (
    <nav aria-label={t('pagination.label')} className="flex flex-wrap items-center justify-between gap-4 border-t border-zinc-800 pt-6">
      <p className="text-sm text-zinc-500" aria-live="polite">{t('pagination.status', { page, total: totalPages })}</p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className={`${buttonClass} border-zinc-800 text-zinc-300 hover:border-zinc-600 disabled:pointer-events-none disabled:opacity-40`}
        >
          <ChevronLeft aria-hidden="true" size={16} />
          <span className="hidden sm:inline">{t('pagination.previous')}</span>
        </button>
        {pageWindow(page, totalPages).map((item, index) => (item === 'gap'
          ? <span key={`gap-${index}`} className="px-1 text-sm text-zinc-600">…</span>
          : (
            <button
              key={item}
              type="button"
              onClick={() => onPageChange(item)}
              aria-current={item === page ? 'page' : undefined}
              aria-label={t('pagination.page', { page: item })}
              className={`${buttonClass} ${item === page ? 'border-[var(--mk-contrast)] bg-[var(--mk-contrast)] font-semibold text-[var(--mk-on-contrast)]' : 'border-zinc-800 text-zinc-300 hover:border-zinc-600'}`}
            >
              {item}
            </button>
          )))}
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className={`${buttonClass} border-zinc-800 text-zinc-300 hover:border-zinc-600 disabled:pointer-events-none disabled:opacity-40`}
        >
          <span className="hidden sm:inline">{t('pagination.next')}</span>
          <ChevronRight aria-hidden="true" size={16} />
        </button>
      </div>
    </nav>
  )
}
