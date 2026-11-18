import { CircleAlert, Search, Store } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import EmptyState from '../components/EmptyState.jsx'
import Pagination from '../components/Pagination.jsx'
import ShopCard from '../components/ShopCard.jsx'
import { useMarketplaceText } from '../i18n.js'
import { fetchShops, getErrorKey, isRequestCancelled } from '../services/marketplaceApi.js'
import usePageTitle from '../usePageTitle.js'

const PAGE_SIZE = 24

function ShopSearch({ defaultValue, onSearch }) {
  const { t } = useMarketplaceText()
  const [value, setValue] = useState(defaultValue)

  return (
    <form role="search" onSubmit={(event) => { event.preventDefault(); onSearch(value.trim()) }} className="flex w-full max-w-md">
      <label htmlFor="mk-shop-search" className="sr-only">{t('shopsPage.searchLabel')}</label>
      <div className="relative flex-1">
        <Search aria-hidden="true" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input id="mk-shop-search" type="search" value={value} onChange={(e) => setValue(e.target.value)} maxLength={100} placeholder={t('shopsPage.searchPlaceholder')} className="mk-input rounded-r-none pl-9" />
      </div>
      <button type="submit" className="h-10 shrink-0 rounded-r-lg border border-l-0 border-zinc-700 px-4 text-sm font-semibold text-white transition-colors hover:border-zinc-500">
        {t('search.submit')}
      </button>
    </form>
  )
}

export default function ShopsPage() {
  const { t, formatNumber } = useMarketplaceText()
  const { scrollRef } = useOutletContext() || {}
  const [searchParams, setSearchParams] = useSearchParams()
  const q = searchParams.get('q') || ''
  const page = Math.max(1, Number.parseInt(searchParams.get('page'), 10) || 1)
  const [attempt, setAttempt] = useState(0)
  const requestKey = `${q}|${page}#${attempt}`
  const [response, setResponse] = useState({ key: null, status: 'loading', items: [], pagination: null, errorKey: null })
  const status = response.key === requestKey ? response.status : 'loading'
  usePageTitle(t('shopsPage.pageTitle'))

  useEffect(() => {
    const controller = new AbortController()
    fetchShops({ q, page, limit: PAGE_SIZE }, { signal: controller.signal })
      .then((data) => setResponse({ key: requestKey, status: 'ready', items: data.items, pagination: data.pagination, errorKey: null }))
      .catch((error) => {
        if (!isRequestCancelled(error)) setResponse({ key: requestKey, status: 'error', items: [], pagination: null, errorKey: getErrorKey(error) })
      })
    return () => controller.abort()
  }, [q, page, requestKey])

  const search = (value) => setSearchParams(value ? { q: value } : {})
  const changePage = (nextPage) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      if (nextPage > 1) next.set('page', String(nextPage))
      else next.delete('page')
      return next
    })
    scrollRef?.current?.scrollTo({ top: 0 })
  }
  const total = response.pagination?.total ?? 0

  return (
    <div className="mk-container py-12">
      <div className="flex flex-col gap-6 border-b border-zinc-800 pb-8 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">{t('shopsPage.title')}</h1>
          <p className="mt-2 text-sm text-zinc-400">{t('shopsPage.subtitle')}</p>
        </div>
        <ShopSearch key={q} defaultValue={q} onSearch={search} />
      </div>

      <p className="mt-6 text-sm text-zinc-500" aria-live="polite">
        {status === 'ready' && (total === 1 ? t('shopsPage.countOne') : t('shopsPage.count', { count: formatNumber(total) }))}
      </p>

      <div className="mt-4 flex flex-col gap-8">
        {status === 'loading' && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
            {Array.from({ length: 6 }, (_, index) => <div key={index} className="h-20 rounded-lg border border-zinc-800 bg-zinc-900/40" />)}
          </div>
        )}
        {status === 'error' && (
          <EmptyState
            tone="error"
            icon={CircleAlert}
            title={t('errors.title')}
            text={t(response.errorKey)}
            action={<button type="button" onClick={() => setAttempt((n) => n + 1)} className="h-10 rounded-lg border border-zinc-700 px-4 text-sm font-semibold text-white hover:border-zinc-500">{t('errors.retry')}</button>}
          />
        )}
        {status === 'ready' && (response.items.length ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {response.items.map((shop) => <ShopCard key={shop.slug} shop={shop} />)}
            </div>
            <Pagination page={response.pagination.page} totalPages={response.pagination.total_pages} onPageChange={changePage} />
          </>
        ) : (
          <EmptyState icon={Store} title={t('shopsPage.emptyTitle')} text={t('shopsPage.emptyText')} />
        ))}
      </div>
    </div>
  )
}
