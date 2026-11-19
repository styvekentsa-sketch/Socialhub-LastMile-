import { BadgeCheck, GitCompareArrows, Trash2, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useCompare } from '../collections/collectionsContext.js'
import { useMarketplaceText } from '../i18n.js'
import ProductThumb from './ProductThumb.jsx'
import { RatingSummary } from './StarRating.jsx'

function Availability({ stock }) {
  const { t } = useMarketplaceText()
  if (stock <= 0) return <span className="text-zinc-500">{t('productPro.outOfStock')}</span>
  if (stock <= 5) return <span className="text-amber-500">{t('productPro.lowStock', { count: stock })}</span>
  return <span className="text-emerald-400">{t('productPro.inStock')}</span>
}

/** Barre flottante du comparateur + panneau de comparaison (Prix, Note, Disponibilite, Vendeur). */
export default function CompareDrawer() {
  const { t, formatPrice } = useMarketplaceText()
  const compare = useCompare()
  const closeRef = useRef(null)
  const isOpen = Boolean(compare?.isOpen)
  const close = compare?.close

  useEffect(() => {
    if (!isOpen) return undefined
    closeRef.current?.focus()
    const onKeyDown = (event) => { if (event.key === 'Escape') close() }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen, close])

  if (!compare || compare.count === 0) return null

  const { items } = compare
  const lowestPrice = Math.min(...items.map((item) => item.price))
  const rated = items.filter((item) => item.review_count > 0)
  const bestRating = rated.length > 1 ? Math.max(...rated.map((item) => Number(item.avg_rating))) : null
  const rows = [
    { key: 'price', label: t('compare.price'), render: (item) => (
      <span className="flex flex-col gap-1">
        <span className="text-base font-semibold text-white">{formatPrice(item.price)}</span>
        {items.length > 1 && item.price === lowestPrice && <span className="text-xs font-semibold text-emerald-400">{t('compare.bestPrice')}</span>}
      </span>
    ) },
    { key: 'rating', label: t('compare.rating'), render: (item) => (
      <span className="flex flex-col gap-1">
        <RatingSummary value={item.avg_rating} count={item.review_count} size={13} />
        {bestRating !== null && item.review_count > 0 && Number(item.avg_rating) === bestRating && <span className="text-xs font-semibold text-amber-500">{t('compare.bestRating')}</span>}
      </span>
    ) },
    { key: 'availability', label: t('compare.availability'), render: (item) => <span className="text-sm"><Availability stock={item.stock} /></span> },
    { key: 'seller', label: t('compare.seller'), render: (item) => (
      <Link to={`/shop/${item.shop.slug}`} onClick={compare.close} className="inline-flex items-center gap-1 text-sm text-zinc-200 hover:text-white hover:underline">
        <span className="truncate">{item.shop.name}</span>
        {item.shop.verified && <BadgeCheck role="img" aria-label={t('rating.verified')} size={14} className="shrink-0 text-sky-400" />}
      </Link>
    ) },
  ]

  return (
    <>
      {/* Barre flottante : rappel des articles selectionnes */}
      {!isOpen && (
        <div className="fixed bottom-4 left-4 z-[55] flex items-center gap-3 rounded-lg border border-zinc-700 bg-[var(--mk-surface-raised)] py-2 pl-3 pr-2 shadow-2xl" role="region" aria-label={t('compare.barLabel', { count: compare.count, max: compare.max })}>
          <div className="flex -space-x-2" aria-hidden="true">
            {items.map((item) => (
              <span key={item.id} className="relative size-8 overflow-hidden rounded-md border border-zinc-700 bg-zinc-900">
                <ProductThumb src={item.image_url} iconSize={14} />
              </span>
            ))}
          </div>
          <button type="button" onClick={compare.open} className="inline-flex h-9 items-center gap-2 rounded-md bg-[var(--mk-contrast)] px-3 text-sm font-semibold text-[var(--mk-on-contrast)] hover:bg-[var(--mk-contrast-hover)]">
            <GitCompareArrows aria-hidden="true" size={15} />
            {t('compare.open', { count: compare.count })}
          </button>
          <button type="button" onClick={compare.clear} className="grid size-9 place-items-center rounded-md text-zinc-500 hover:text-white" aria-label={t('compare.clear')} title={t('compare.clear')}>
            <X aria-hidden="true" size={16} />
          </button>
        </div>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-[70]">
          <button type="button" tabIndex={-1} onClick={compare.close} className="absolute inset-0 bg-black/70" aria-label={t('compare.close')} />
          <section role="dialog" aria-modal="true" aria-labelledby="mk-compare-title" className="absolute inset-x-0 bottom-0 flex max-h-[90dvh] flex-col border-t border-zinc-800 bg-[var(--mk-bg)] md:inset-x-auto md:left-1/2 md:top-1/2 md:bottom-auto md:w-[min(960px,calc(100vw-48px))] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-lg md:border">
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-zinc-800 px-5">
              <div>
                <h2 id="mk-compare-title" className="text-base font-semibold text-white">{t('compare.title')}</h2>
                <p className="text-xs text-zinc-500">{t('compare.barLabel', { count: compare.count, max: compare.max })}</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={compare.clear} className="h-9 rounded-lg px-3 text-sm text-zinc-400 hover:text-white">{t('compare.clear')}</button>
                <button ref={closeRef} type="button" onClick={compare.close} className="grid size-9 place-items-center rounded-lg border border-zinc-800 text-zinc-400 hover:text-white" aria-label={t('compare.close')}>
                  <X aria-hidden="true" size={18} />
                </button>
              </div>
            </div>
            <div className="overflow-auto">
              <table className="w-full min-w-[560px] table-fixed border-collapse text-left">
                <caption className="sr-only">{t('compare.title')}</caption>
                <thead>
                  <tr>
                    <td className="w-32 border-b border-zinc-800 p-4" />
                    {items.map((item) => (
                      <th key={item.id} scope="col" className="border-b border-l border-zinc-800 p-4 align-top font-normal">
                        <div className="relative aspect-[4/3] overflow-hidden rounded-md border border-zinc-800 bg-zinc-900">
                          <ProductThumb src={item.image_url} iconSize={24} />
                        </div>
                        <Link to={`/produits/${item.id}`} onClick={compare.close} className="mt-3 line-clamp-2 block text-sm font-semibold text-white hover:underline">{item.name}</Link>
                        <button type="button" onClick={() => compare.remove(item.id)} className="mt-2 inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-white">
                          <Trash2 aria-hidden="true" size={12} />
                          {t('compare.remove')}
                        </button>
                      </th>
                    ))}
                    {items.length < compare.max && (
                      <td className="border-b border-l border-zinc-800 p-4 align-middle text-center text-xs text-zinc-500">{t('compare.addMore', { count: compare.max - items.length })}</td>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.key}>
                      <th scope="row" className="border-b border-zinc-800 p-4 text-xs font-semibold uppercase text-zinc-500">{row.label}</th>
                      {items.map((item) => <td key={item.id} className="border-b border-l border-zinc-800 p-4 align-top">{row.render(item)}</td>)}
                      {items.length < compare.max && <td className="border-b border-l border-zinc-800" />}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </>
  )
}
