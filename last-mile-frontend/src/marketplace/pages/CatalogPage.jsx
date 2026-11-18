import { CircleAlert, SlidersHorizontal } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import EmptyState from '../components/EmptyState.jsx'
import Filters from '../components/Filters.jsx'
import { SORT_OPTIONS } from '../constants.js'
import Pagination from '../components/Pagination.jsx'
import ProductCard from '../components/ProductCard.jsx'
import { useMarketplaceText } from '../i18n.js'
import { fetchMarketplaceHome, fetchProducts, getErrorKey, isRequestCancelled } from '../services/marketplaceApi.js'
import usePageTitle from '../usePageTitle.js'

const PAGE_SIZE = 24
const FILTER_KEYS = ['q', 'category', 'sort', 'min_price', 'max_price', 'in_stock']

// L'URL est la seule source de verite : ?q=&category=&sort=&min_price=&max_price=&in_stock=&page=
const readValues = (searchParams) => ({
  q: searchParams.get('q') || '',
  category: searchParams.get('category') || '',
  sort: SORT_OPTIONS.includes(searchParams.get('sort')) ? searchParams.get('sort') : 'recent',
  min_price: searchParams.get('min_price') || '',
  max_price: searchParams.get('max_price') || '',
  in_stock: searchParams.get('in_stock') === 'true',
  page: Math.max(1, Number.parseInt(searchParams.get('page'), 10) || 1),
})

const ResultSkeletons = () => (
  <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:gap-6" aria-hidden="true">
    {Array.from({ length: 6 }, (_, index) => (
      <div key={index} className="overflow-hidden rounded-lg border border-zinc-800">
        <div className="aspect-[4/3] bg-zinc-900" />
        <div className="space-y-2 p-4"><div className="h-4 w-3/4 rounded bg-zinc-900" /><div className="h-3 w-1/2 rounded bg-zinc-900" /></div>
      </div>
    ))}
  </div>
)

export default function CatalogPage() {
  const { t, formatNumber } = useMarketplaceText()
  const { scrollRef } = useOutletContext() || {}
  const [searchParams, setSearchParams] = useSearchParams()
  const values = useMemo(() => readValues(searchParams), [searchParams])
  const [categories, setCategories] = useState([])
  const [attempt, setAttempt] = useState(0)
  // Le resultat affiche est celui de la derniere requete terminee ; tant que sa cle differe de
  // la requete en cours, la page est en chargement (etat derive, sans setState dans l'effet)
  const requestKey = `${searchParams.toString()}#${attempt}`
  const [response, setResponse] = useState({ key: null, status: 'loading', items: [], pagination: null, errorKey: null })
  const result = response.key === requestKey ? response : { ...response, status: 'loading' }
  const [areFiltersOpen, setAreFiltersOpen] = useState(false)
  usePageTitle(t('catalog.pageTitle'))

  // Categories (avec leur nombre de produits) pour la barre de filtres
  useEffect(() => {
    const controller = new AbortController()
    fetchMarketplaceHome({ signal: controller.signal })
      .then((data) => setCategories(data.categories))
      .catch(() => undefined)
    return () => controller.abort()
  }, [])

  // Produits : rechargement a chaque changement de l'URL ; la requete precedente est annulee
  useEffect(() => {
    const controller = new AbortController()
    fetchProducts({
      q: values.q,
      category: values.category,
      sort: values.sort,
      min_price: values.min_price,
      max_price: values.max_price,
      in_stock: values.in_stock ? 'true' : '',
      page: values.page,
      limit: PAGE_SIZE,
    }, { signal: controller.signal })
      .then((data) => setResponse({ key: requestKey, status: 'ready', items: data.items, pagination: data.pagination, errorKey: null }))
      .catch((error) => {
        if (!isRequestCancelled(error)) setResponse({ key: requestKey, status: 'error', items: [], pagination: null, errorKey: getErrorKey(error) })
      })
    return () => controller.abort()
  }, [values, requestKey])

  // Modifie l'URL ; tout changement de filtre ramene a la page 1
  const updateParams = useCallback((patch, { keepPage = false } = {}) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      Object.entries(patch).forEach(([key, value]) => {
        const isDefault = value === '' || value === null || value === undefined || (key === 'sort' && value === 'recent') || (key === 'page' && value === 1)
        if (isDefault) next.delete(key)
        else next.set(key, String(value))
      })
      if (!keepPage) next.delete('page')
      return next
    })
  }, [setSearchParams])

  const resetFilters = useCallback(() => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      FILTER_KEYS.forEach((key) => next.delete(key))
      next.delete('page')
      return next
    })
  }, [setSearchParams])

  const changePage = (page) => {
    updateParams({ page }, { keepPage: true })
    scrollRef?.current?.scrollTo({ top: 0 })
  }

  const total = result.pagination?.total ?? 0

  return (
    <div className="mk-container py-12">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <h1 className="text-3xl font-semibold text-white">{values.q ? t('catalog.resultsFor', { q: values.q }) : t('catalog.title')}</h1>
          <p className="mt-2 text-sm text-zinc-400" aria-live="polite">
            {result.status === 'ready' && (total === 1 ? t('catalog.countOne') : t('catalog.count', { count: formatNumber(total) }))}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAreFiltersOpen((open) => !open)}
          aria-expanded={areFiltersOpen}
          aria-controls="mk-filters"
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-zinc-700 px-4 text-sm font-semibold text-white lg:hidden"
        >
          <SlidersHorizontal aria-hidden="true" size={16} />
          {t(areFiltersOpen ? 'catalog.hideFilters' : 'catalog.showFilters')}
        </button>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-12">
        <aside id="mk-filters" aria-label={t('catalog.filters')} className={`${areFiltersOpen ? 'block' : 'hidden'} lg:col-span-3 lg:block`}>
          <div className="lg:sticky lg:top-24">
            <Filters
              key={`${values.min_price}|${values.max_price}`}
              values={values}
              categories={categories}
              onChange={updateParams}
              onReset={resetFilters}
            />
          </div>
        </aside>

        <section className="flex flex-col gap-8 lg:col-span-9" aria-label={t('catalog.title')}>
          {result.status === 'loading' && <ResultSkeletons />}
          {result.status === 'error' && (
            <EmptyState
              tone="error"
              icon={CircleAlert}
              title={t('errors.title')}
              text={t(result.errorKey)}
              action={(
                <div className="flex flex-wrap justify-center gap-3">
                  <button type="button" onClick={() => setAttempt((n) => n + 1)} className="h-10 rounded-lg border border-zinc-700 px-4 text-sm font-semibold text-white hover:border-zinc-500">{t('errors.retry')}</button>
                  <button type="button" onClick={resetFilters} className="h-10 rounded-lg px-4 text-sm text-zinc-400 underline underline-offset-4 hover:text-white">{t('catalog.reset')}</button>
                </div>
              )}
            />
          )}
          {result.status === 'ready' && (result.items.length ? (
            <>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:gap-6">
                {result.items.map((product) => <ProductCard key={product.id} product={product} />)}
              </div>
              <Pagination page={result.pagination.page} totalPages={result.pagination.total_pages} onPageChange={changePage} />
            </>
          ) : (
            <EmptyState
              title={t('empty.noResultsTitle')}
              text={t('empty.noResultsText')}
              action={<button type="button" onClick={resetFilters} className="h-10 rounded-lg border border-zinc-700 px-4 text-sm font-semibold text-white hover:border-zinc-500">{t('catalog.reset')}</button>}
            />
          ))}
        </section>
      </div>
    </div>
  )
}
