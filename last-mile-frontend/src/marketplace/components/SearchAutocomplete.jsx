import { History, Search, Tag } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePreferences } from '../collections/collectionsContext.js'
import { useMarketplaceText } from '../i18n.js'
import { fetchSuggestions, isRequestCancelled } from '../services/marketplaceApi.js'

const MIN_LENGTH = 2
const DEBOUNCE_MS = 200

/**
 * Recherche avec selecteur de categorie et suggestions en temps reel (/api/marketplace/suggestions).
 * Combobox accessible : fleches haut/bas, Entree, Echap.
 */
export default function SearchAutocomplete({ categories = [], defaultQuery = '', defaultCategory = '', size = 'md' }) {
  const { t, formatPrice } = useMarketplaceText()
  const navigate = useNavigate()
  const listId = useId()
  const preferences = usePreferences()
  const recentSearches = preferences?.recentSearches || []
  const rootRef = useRef(null)
  const [query, setQuery] = useState(defaultQuery)
  const [category, setCategory] = useState(defaultCategory)
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [results, setResults] = useState({ forQuery: null, products: [], categories: [] })
  const trimmed = query.trim()
  const isLarge = size === 'lg'

  // Suggestions : requete differee de 200 ms ; seules les reponses de la saisie courante sont affichees
  useEffect(() => {
    if (trimmed.length < MIN_LENGTH) return undefined
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      fetchSuggestions(trimmed, { signal: controller.signal })
        .then((data) => setResults({ forQuery: trimmed, products: data.products, categories: data.categories }))
        .catch((error) => { if (!isRequestCancelled(error)) setResults({ forQuery: trimmed, products: [], categories: [] }) })
    }, DEBOUNCE_MS)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [trimmed])

  // Fermeture au clic en dehors
  useEffect(() => {
    const onPointerDown = (event) => { if (!rootRef.current?.contains(event.target)) setIsOpen(false) }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  const hasResults = trimmed.length >= MIN_LENGTH && results.forQuery === trimmed
  // Champ vide : recherches recentes ; saisie : suggestions du serveur
  const options = hasResults ? [
    ...results.products.map((product) => ({ key: `p-${product.id}`, type: 'product', item: product })),
    ...results.categories.map((item) => ({ key: `c-${item.name}`, type: 'category', item })),
    { key: 'all', type: 'all' },
  ] : (trimmed ? [] : recentSearches.map((item) => ({ key: `r-${item}`, type: 'recent', item })))
  const showList = isOpen && options.length > 0

  const goToResults = (text = trimmed) => {
    const params = new URLSearchParams()
    if (text) params.set('q', text)
    if (text) preferences?.addRecentSearch(text)
    if (category) params.set('category', category)
    setIsOpen(false)
    navigate(`/catalogue${params.toString() ? `?${params}` : ''}`)
  }

  const choose = (option) => {
    setIsOpen(false)
    setActiveIndex(-1)
    if (option.type === 'product') navigate(`/produits/${option.item.id}`)
    else if (option.type === 'category') navigate(`/catalogue?category=${encodeURIComponent(option.item.name)}`)
    else if (option.type === 'recent') { setQuery(option.item); goToResults(option.item) }
    else goToResults()
  }

  const onKeyDown = (event) => {
    if (event.key === 'ArrowDown' && options.length) {
      event.preventDefault()
      setIsOpen(true)
      setActiveIndex((index) => (index + 1) % options.length)
    } else if (event.key === 'ArrowUp' && options.length) {
      event.preventDefault()
      setActiveIndex((index) => (index <= 0 ? options.length - 1 : index - 1))
    } else if (event.key === 'Escape') {
      setIsOpen(false)
      setActiveIndex(-1)
    } else if (event.key === 'Enter' && showList && activeIndex >= 0) {
      event.preventDefault()
      choose(options[activeIndex])
    }
  }

  return (
    <div ref={rootRef} className="relative w-full">
      <form role="search" onSubmit={(event) => { event.preventDefault(); goToResults() }} className="flex w-full items-stretch">
        <label htmlFor={`${listId}-category`} className="sr-only">{t('header.categoryLabel')}</label>
        <select
          id={`${listId}-category`}
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className={`mk-input mk-select hidden w-auto max-w-40 shrink-0 rounded-r-none border-r-0 bg-[var(--mk-surface)] pr-8 text-xs text-zinc-300 sm:block ${isLarge ? 'h-12' : 'h-10'}`}
        >
          <option value="">{t('header.searchAll')}</option>
          {categories.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
        </select>
        <div className="relative min-w-0 flex-1">
          <Search aria-hidden="true" size={isLarge ? 18 : 16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="search"
            role="combobox"
            aria-label={t('search.label')}
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={showList && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
            value={query}
            onChange={(event) => { setQuery(event.target.value); setIsOpen(true); setActiveIndex(-1) }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={onKeyDown}
            maxLength={100}
            placeholder={t('search.placeholder')}
            autoComplete="off"
            className={`mk-input rounded-none pl-9 sm:rounded-l-none ${isLarge ? 'h-12 pl-10 text-base' : 'h-10'} rounded-l-lg sm:rounded-l-none`}
          />
        </div>
        <button type="submit" className={`shrink-0 rounded-r-lg bg-amber-500 px-4 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-400 ${isLarge ? 'h-12 px-6' : 'h-10'}`}>
          <span className="hidden sm:inline">{t('search.submit')}</span>
          <Search aria-hidden="true" size={16} className="sm:hidden" />
          <span className="sr-only sm:hidden">{t('search.submit')}</span>
        </button>
      </form>

      {showList && (
        <ul id={listId} role="listbox" className="absolute inset-x-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-zinc-800 bg-[var(--mk-surface)] py-1 shadow-2xl">
          {options.map((option, index) => {
            const isActive = index === activeIndex
            const base = `flex cursor-pointer items-center gap-3 px-3 py-2 text-sm ${isActive ? 'bg-zinc-800 text-white' : 'text-zinc-300 hover:bg-zinc-900'}`
            const isFirstCategory = option.type === 'category' && options[index - 1]?.type !== 'category'
            return (
              <li key={option.key} id={`${listId}-${index}`} role="option" aria-selected={isActive} onPointerDown={(event) => { event.preventDefault(); choose(option) }}>
                {index === 0 && option.type === 'recent' && <p className="px-3 pb-1 pt-1 text-[11px] font-semibold uppercase text-zinc-500">{t('search.recent')}</p>}
                {option.type === 'recent' && (
                  <div className={base}><History aria-hidden="true" size={14} className="text-zinc-500" /><span className="truncate">{option.item}</span></div>
                )}
                {index === 0 && option.type === 'product' && <p className="px-3 pb-1 pt-1 text-[11px] font-semibold uppercase text-zinc-500">{t('header.suggestionsProducts')}</p>}
                {isFirstCategory && <p className="border-t border-zinc-800 px-3 pb-1 pt-2 text-[11px] font-semibold uppercase text-zinc-500">{t('header.suggestionsCategories')}</p>}
                {option.type === 'product' && (
                  <div className={base}>
                    <span className="size-8 shrink-0 overflow-hidden rounded border border-zinc-800 bg-zinc-900">{option.item.image_url && <img src={option.item.image_url} alt="" className="size-full object-cover" />}</span>
                    <span className="min-w-0 flex-1 truncate">{option.item.name}</span>
                    <span className="shrink-0 text-xs text-zinc-400">{formatPrice(option.item.price)}</span>
                  </div>
                )}
                {option.type === 'category' && (
                  <div className={base}><Tag aria-hidden="true" size={14} className="text-zinc-500" /><span className="flex-1 truncate">{option.item.name}</span><span className="text-xs text-zinc-500">{option.item.product_count}</span></div>
                )}
                {option.type === 'all' && (
                  <div className={`${base} border-t border-zinc-800`}><Search aria-hidden="true" size={14} className="text-amber-500" /><span className="truncate">{t('header.seeAllResults', { q: trimmed })}</span></div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
