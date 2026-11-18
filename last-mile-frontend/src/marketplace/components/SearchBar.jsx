import { Search } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMarketplaceText } from '../i18n.js'

/**
 * Barre de recherche du portail. Par defaut, elle ouvre le catalogue filtre (/catalogue?q=...).
 * size : 'md' (en-tete) ou 'lg' (page d'accueil).
 */
export default function SearchBar({ defaultValue = '', size = 'md', onSearch, id = 'mk-search' }) {
  const { t } = useMarketplaceText()
  const navigate = useNavigate()
  const [value, setValue] = useState(defaultValue)
  const isLarge = size === 'lg'

  const handleSubmit = (event) => {
    event.preventDefault()
    const query = value.trim()

    if (onSearch) {
      onSearch(query)
      return
    }

    navigate(query ? `/catalogue?q=${encodeURIComponent(query)}` : '/catalogue')
  }

  return (
    <form role="search" onSubmit={handleSubmit} className="flex w-full items-stretch">
      <label htmlFor={id} className="sr-only">{t('search.label')}</label>
      <div className="relative flex-1">
        <Search aria-hidden="true" size={isLarge ? 18 : 16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input
          id={id}
          type="search"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          maxLength={100}
          placeholder={t('search.placeholder')}
          autoComplete="off"
          className={`mk-input rounded-r-none ${isLarge ? 'h-12 pl-10 text-base' : 'pl-9'}`}
        />
      </div>
      <button
        type="submit"
        className={`shrink-0 rounded-r-lg border border-l-0 border-amber-500 bg-amber-500 px-4 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-400 ${isLarge ? 'h-12 px-6' : 'h-10'}`}
      >
        {t('search.submit')}
      </button>
    </form>
  )
}
