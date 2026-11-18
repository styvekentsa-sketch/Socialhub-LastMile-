import { useState } from 'react'
import { SORT_OPTIONS } from '../constants.js'
import { useMarketplaceText } from '../i18n.js'

const sectionTitle = 'text-sm font-semibold text-white'

/**
 * Filtres du catalogue. Les valeurs viennent de l'URL ; chaque changement est remonte via onChange(patch).
 * Les prix ne sont appliques qu'a la validation, pour ne pas relancer une recherche a chaque frappe.
 */
export default function Filters({ values, categories, onChange, onReset }) {
  const { t, formatNumber } = useMarketplaceText()
  const [minPrice, setMinPrice] = useState(values.min_price || '')
  const [maxPrice, setMaxPrice] = useState(values.max_price || '')
  const [priceError, setPriceError] = useState('')

  const applyPrices = (event) => {
    event.preventDefault()
    if (minPrice !== '' && maxPrice !== '' && Number(minPrice) > Number(maxPrice)) {
      setPriceError(t('catalog.invalidPrice'))
      return
    }
    setPriceError('')
    onChange({ min_price: minPrice, max_price: maxPrice })
  }

  const hasActiveFilters = Boolean(values.category || values.min_price || values.max_price || values.in_stock || values.q)

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <label htmlFor="mk-sort" className={sectionTitle}>{t('catalog.sort')}</label>
        <select
          id="mk-sort"
          value={values.sort}
          onChange={(event) => onChange({ sort: event.target.value })}
          className="mk-input mk-select"
        >
          {SORT_OPTIONS.map((sort) => <option key={sort} value={sort}>{t(`catalog.sorts.${sort}`)}</option>)}
        </select>
      </div>

      <fieldset className="flex flex-col gap-1">
        <legend className={`${sectionTitle} mb-2`}>{t('catalog.category')}</legend>
        {[{ name: '', product_count: null }, ...categories].map((category) => {
          const isActive = (values.category || '') === category.name
          return (
            <button
              key={category.name || 'all'}
              type="button"
              onClick={() => onChange({ category: category.name })}
              aria-pressed={isActive}
              className={`flex h-9 items-center justify-between rounded-lg px-3 text-left text-sm transition-colors ${isActive ? 'bg-zinc-800 font-semibold text-white' : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'}`}
            >
              <span className="truncate">{category.name || t('catalog.allCategories')}</span>
              {category.product_count !== null && <span className="text-xs text-zinc-500">{formatNumber(category.product_count)}</span>}
            </button>
          )
        })}
      </fieldset>

      <form onSubmit={applyPrices} className="flex flex-col gap-2" noValidate>
        <span className={sectionTitle}>{t('catalog.price')}</span>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">{t('catalog.min')}</span>
            <input type="number" inputMode="numeric" min="0" step="500" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} className="mk-input" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">{t('catalog.max')}</span>
            <input type="number" inputMode="numeric" min="0" step="500" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className="mk-input" />
          </label>
        </div>
        {priceError && <p role="alert" className="text-xs text-amber-500">{priceError}</p>}
        <button type="submit" className="h-9 rounded-lg border border-zinc-700 text-sm font-semibold text-white transition-colors hover:border-zinc-500">
          {t('catalog.apply')}
        </button>
      </form>

      <label className="flex cursor-pointer items-center gap-3 text-sm text-zinc-300">
        <input
          type="checkbox"
          checked={Boolean(values.in_stock)}
          onChange={(event) => onChange({ in_stock: event.target.checked ? 'true' : '' })}
          className="mk-checkbox"
        />
        {t('catalog.inStock')}
      </label>

      {hasActiveFilters && (
        <button
          type="button"
          onClick={() => { setMinPrice(''); setMaxPrice(''); setPriceError(''); onReset() }}
          className="self-start text-sm text-zinc-400 underline underline-offset-4 transition-colors hover:text-white"
        >
          {t('catalog.reset')}
        </button>
      )}
    </div>
  )
}
