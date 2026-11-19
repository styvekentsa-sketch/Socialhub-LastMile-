import { CircleCheck, Heart, Menu, Moon, PackageSearch, Route as RouteIcon, Settings2, ShoppingCart, Store, Sun, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useSearchParams } from 'react-router-dom'
import { ROLE_DASHBOARDS, useAuth } from '../context/auth.js'
import CartProvider from './cart/CartProvider.jsx'
import { useCart } from './cart/cartContext.js'
import CollectionsProvider from './collections/CollectionsProvider.jsx'
import { useCompare, useCurrency, useWishlist } from './collections/collectionsContext.js'
import CartDrawer from './components/CartDrawer.jsx'
import CompareDrawer from './components/CompareDrawer.jsx'
import PreferencesDrawer from './components/PreferencesDrawer.jsx'
import { CURRENCIES, CURRENCY_CODES } from './currency/currencyConfig.js'
import SearchAutocomplete from './components/SearchAutocomplete.jsx'
import { useMarketplaceText } from './i18n.js'
import { fetchMarketplaceHome } from './services/marketplaceApi.js'
import { readMarketplaceTheme, saveMarketplaceTheme } from './theme.js'
import './marketplace.css'

const NAV_LINKS = [
  { to: '/catalogue', key: 'nav.catalog' },
  { to: '/boutiques', key: 'nav.shops' },
  { to: '/suivi', key: 'nav.tracking' },
  { to: '/devenir-partenaire', key: 'nav.partner' },
]

const SECONDARY_LINKS = NAV_LINKS.filter((link) => ['/boutiques', '/devenir-partenaire'].includes(link.to))

const navLinkClass = ({ isActive }) => (
  `whitespace-nowrap text-sm transition-colors ${isActive ? 'font-semibold text-white' : 'text-zinc-400 hover:text-white'}`
)

function Logo() {
  const { t } = useMarketplaceText()

  return (
    <Link to="/" className="flex shrink-0 items-center gap-2" aria-label={t('brand')}>
      <span className="grid size-8 place-items-center rounded-lg bg-amber-500 text-zinc-950">
        <RouteIcon aria-hidden="true" size={18} strokeWidth={2.2} />
      </span>
      <span className="text-[15px] font-semibold text-white">{t('brand')}</span>
    </Link>
  )
}

function LanguageToggle() {
  const { t, language, setLanguage } = useMarketplaceText()

  return (
    <div role="group" aria-label={t('nav.language')} className="flex h-8 items-center rounded-lg border border-zinc-800 p-0.5 text-xs">
      {['fr', 'en'].map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLanguage(code)}
          aria-pressed={language === code}
          className={`h-full rounded-md px-2 uppercase transition-colors ${language === code ? 'bg-zinc-800 font-semibold text-white' : 'text-zinc-500 hover:text-white'}`}
        >
          {code}
        </button>
      ))}
    </div>
  )
}

// « Se connecter » pour un visiteur, « Mon espace » (tableau de bord du role) pour un utilisateur connecte.
// className doit fournir l'affichage (ex. 'hidden sm:inline-flex') : aucune classe display n'est imposee ici.
function AccountButton({ className = 'inline-flex' }) {
  const { t } = useMarketplaceText()
  const { isAuthenticated, isLoading, user } = useAuth()

  if (isLoading) {
    return <span aria-hidden="true" className={`h-9 w-28 rounded-lg border border-zinc-800 ${className}`} />
  }

  const isConnected = isAuthenticated && ROLE_DASHBOARDS[user?.role]

  return (
    <Link
      to={isConnected ? ROLE_DASHBOARDS[user.role] : '/login'}
      className={`h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-lg px-4 text-sm font-semibold transition-colors ${isConnected
        ? 'border border-zinc-700 text-white hover:border-zinc-500'
        : 'bg-[var(--mk-contrast)] text-[var(--mk-on-contrast)] hover:bg-[var(--mk-contrast-hover)]'} ${className}`}
    >
      {t(isConnected ? 'nav.mySpace' : 'nav.signIn')}
    </Link>
  )
}

// Espace vendeur : tableau de bord pour un marchand connecte, sinon connexion
function useSellerSpaceLink() {
  const { isAuthenticated, user } = useAuth()
  return isAuthenticated && user?.role === 'merchant' ? ROLE_DASHBOARDS.merchant : '/login'
}

// Selecteur de devise discret (affichage uniquement, paiement en FCFA)
function CurrencySelect({ className = '' }) {
  const { t } = useMarketplaceText()
  const { currency, setCurrency } = useCurrency()

  return (
    <label className={className}>
      <span className="sr-only">{t('currency.label')}</span>
      <select
        value={currency}
        onChange={(event) => setCurrency(event.target.value)}
        title={t('currency.label')}
        className="mk-input mk-select h-8 w-auto rounded-lg py-0 pl-2 pr-7 text-xs font-semibold text-zinc-300 [background-position:right_6px_center]"
      >
        {CURRENCY_CODES.map((code) => <option key={code} value={code}>{CURRENCIES[code].label}</option>)}
      </select>
    </label>
  )
}

// Bascule clair / sombre du portail (independante du theme de l'espace prive)
function ThemeToggle({ theme, onToggle }) {
  const { t } = useMarketplaceText()
  const isDark = theme === 'dark'
  const label = t(isDark ? 'theme.toLight' : 'theme.toDark')

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      title={label}
      className="grid size-8 shrink-0 place-items-center rounded-lg border border-zinc-800 text-zinc-400 transition-colors hover:border-zinc-600 hover:text-white"
    >
      {isDark ? <Sun aria-hidden="true" size={15} /> : <Moon aria-hidden="true" size={15} />}
    </button>
  )
}

function PreferencesButton({ onOpen }) {
  const { t } = useMarketplaceText()

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={t('prefs.open')}
      title={t('prefs.title')}
      className="grid size-8 shrink-0 place-items-center rounded-lg border border-zinc-800 text-zinc-400 transition-colors hover:border-zinc-600 hover:text-white"
    >
      <Settings2 aria-hidden="true" size={15} />
    </button>
  )
}

function WishlistLink() {
  const { t, formatNumber } = useMarketplaceText()
  const { count } = useWishlist()

  return (
    <NavLink
      to="/wishlist"
      aria-label={t('wishlist.headerLabel', { count })}
      title={t('wishlist.title')}
      className={({ isActive }) => `relative grid size-9 shrink-0 place-items-center rounded-lg border transition-colors ${isActive ? 'border-zinc-500 text-white' : 'border-zinc-800 text-zinc-300 hover:border-zinc-600 hover:text-white'}`}
    >
      <Heart aria-hidden="true" size={17} />
      {count > 0 && (
        <span aria-hidden="true" className="absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[11px] font-bold tabular-nums text-[#fff]">
          {count > 99 ? '99+' : formatNumber(count)}
        </span>
      )}
    </NavLink>
  )
}

function CartButton() {
  const { t, formatNumber } = useMarketplaceText()
  const cart = useCart()

  return (
    <button
      type="button"
      onClick={cart.open}
      aria-label={t('header.cartLabel', { count: cart.count })}
      className="relative inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-zinc-800 px-2.5 text-sm text-zinc-200 transition-colors hover:border-zinc-600 hover:text-white"
    >
      <ShoppingCart aria-hidden="true" size={18} />
      <span className="hidden text-sm font-semibold xl:inline">{t('header.cart')}</span>
      {cart.count > 0 && (
        <span aria-hidden="true" className="absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-amber-500 px-1 text-[11px] font-bold tabular-nums text-zinc-950">
          {cart.count > 99 ? '99+' : formatNumber(cart.count)}
        </span>
      )}
    </button>
  )
}

// Confirmation discrete apres un ajout au panier (disparait seule apres 4 s)
function CartNotice() {
  const { t } = useMarketplaceText()
  const { notice, dismissNotice, open } = useCart()
  // La barre du comparateur occupe le bas gauche : la confirmation remonte au-dessus sur mobile
  const hasCompareBar = useCompare().count > 0

  useEffect(() => {
    if (!notice) return undefined
    const timer = window.setTimeout(dismissNotice, 4000)
    return () => window.clearTimeout(timer)
  }, [notice, dismissNotice])

  return (
    <div aria-live="polite" className={`pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4 sm:bottom-4 sm:justify-end sm:px-6 ${hasCompareBar ? 'bottom-20' : 'bottom-4'}`}>
      {notice && (
        <div key={notice.key} className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-lg border border-zinc-700 bg-[var(--mk-surface-raised)] px-4 py-3 shadow-2xl">
          <CircleCheck aria-hidden="true" size={18} className="shrink-0 text-emerald-400" />
          <p className="min-w-0 flex-1 truncate text-sm text-zinc-200">{t('cart.added', { name: notice.name })}</p>
          <button type="button" onClick={open} className="shrink-0 text-sm font-semibold text-amber-500 hover:text-amber-400">{t('cart.view')}</button>
        </div>
      )}
    </div>
  )
}

const quickLinkClass = 'hidden h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2 text-sm text-zinc-300 transition-colors hover:text-white lg:inline-flex'
const categoryHref = (name) => `/catalogue?category=${encodeURIComponent(name)}`

function CategoryBar({ categories }) {
  const { t } = useMarketplaceText()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const activeCategory = location.pathname === '/catalogue' ? searchParams.get('category') || '' : null
  const itemClass = (isActive) => `inline-flex h-10 shrink-0 items-center whitespace-nowrap border-b-2 px-1 text-[13px] transition-colors ${isActive ? 'border-amber-500 font-semibold text-white' : 'border-transparent text-zinc-400 hover:text-white'}`

  return (
    <nav aria-label={t('header.categoriesNav')} className="hidden border-t border-zinc-800 md:block">
      <div className="mk-container flex items-center gap-6">
        <ul className="mk-scroll-x flex min-w-0 flex-1 items-center gap-5">
          <li><Link to="/catalogue" className={itemClass(activeCategory === '')}>{t('header.allCategories')}</Link></li>
          {categories.map((category) => (
            <li key={category.name}><Link to={categoryHref(category.name)} className={itemClass(activeCategory === category.name)}>{category.name}</Link></li>
          ))}
        </ul>
        <div className="flex shrink-0 items-center gap-5 border-l border-zinc-800 pl-6">
          {SECONDARY_LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} className={({ isActive }) => itemClass(isActive)}>{t(link.key)}</NavLink>
          ))}
        </div>
      </div>
    </nav>
  )
}

function Header({ categories, theme, onToggleTheme, onOpenPreferences }) {
  const { t } = useMarketplaceText()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const sellerSpace = useSellerSpaceLink()
  // Le menu mobile est lie a la page ou il a ete ouvert : il se referme de lui-meme apres une navigation
  const [menuOpenedOn, setMenuOpenedOn] = useState(null)
  const isMenuOpen = menuOpenedOn === location.pathname
  const toggleMenu = () => setMenuOpenedOn((openedOn) => (openedOn === location.pathname ? null : location.pathname))
  // Sur le catalogue, la recherche de l'en-tete reflete la recherche en cours
  const isCatalog = location.pathname === '/catalogue'
  const currentQuery = isCatalog ? searchParams.get('q') || '' : ''
  const currentCategory = isCatalog ? searchParams.get('category') || '' : ''
  const searchKey = `${currentQuery}|${currentCategory}`

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800 bg-[var(--mk-bg)]">
      <div className="mk-container flex h-16 items-center gap-4 lg:gap-6">
        <Logo />
        <div className="hidden min-w-0 flex-1 md:block">
          <SearchAutocomplete key={searchKey} categories={categories} defaultQuery={currentQuery} defaultCategory={currentCategory} />
        </div>
        <div className="ml-auto flex items-center gap-2 md:ml-0 lg:gap-3">
          <Link to="/suivi" className={quickLinkClass} title={t('header.trackParcel')}><PackageSearch aria-hidden="true" size={16} /><span className="sr-only 2xl:not-sr-only">{t('header.trackParcel')}</span></Link>
          <Link to={sellerSpace} className={quickLinkClass} title={t('header.sellerSpace')}><Store aria-hidden="true" size={16} /><span className="sr-only 2xl:not-sr-only">{t('header.sellerSpace')}</span></Link>
          <LanguageToggle />
          <CurrencySelect className="hidden 2xl:block" />
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          <PreferencesButton onOpen={onOpenPreferences} />
          <AccountButton className="hidden sm:inline-flex" />
          <WishlistLink />
          <CartButton />
          <button
            type="button"
            onClick={toggleMenu}
            aria-expanded={isMenuOpen}
            aria-controls="mk-mobile-menu"
            aria-label={t(isMenuOpen ? 'nav.closeMenu' : 'nav.openMenu')}
            className="grid size-9 place-items-center rounded-lg border border-zinc-800 text-zinc-300 hover:text-white lg:hidden"
          >
            {isMenuOpen ? <X aria-hidden="true" size={18} /> : <Menu aria-hidden="true" size={18} />}
          </button>
        </div>
      </div>
      <div className="mk-container pb-3 md:hidden">
        <SearchAutocomplete key={searchKey} categories={categories} defaultQuery={currentQuery} defaultCategory={currentCategory} />
      </div>
      <CategoryBar categories={categories} />

      {isMenuOpen && (
        <div id="mk-mobile-menu" className="max-h-[70dvh] overflow-y-auto border-t border-zinc-800 lg:hidden">
          <nav aria-label={t('nav.main')} className="mk-container flex flex-col py-2">
            {[...NAV_LINKS, { to: sellerSpace, key: 'header.sellerSpace' }].map((link) => (
              <NavLink key={link.key} to={link.to} className={(state) => `${navLinkClass(state)} border-b border-zinc-900 py-3`}>
                {t(link.key)}
              </NavLink>
            ))}
            {categories.length > 0 && (
              <ul className="flex flex-wrap gap-2 py-3 md:hidden" aria-label={t('header.categoriesNav')}>
                {categories.map((category) => (
                  <li key={category.name}>
                    <Link to={categoryHref(category.name)} className="inline-flex h-8 items-center rounded-lg border border-zinc-800 px-3 text-xs text-zinc-300">{category.name}</Link>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-center gap-3 py-3 sm:hidden">
              <CurrencySelect />
              <span className="text-xs text-zinc-500">{t('currency.label')}</span>
            </div>
            <AccountButton className="my-3 flex sm:hidden" />
          </nav>
        </div>
      )}
    </header>
  )
}

function Footer() {
  const { t } = useMarketplaceText()
  const columns = [
    {
      title: t('footer.explore'),
      links: NAV_LINKS.map((link) => ({ to: link.to, label: t(link.key) })),
    },
    {
      // Devenir partenaire : pages de presentation ; espaces existants : connexion
      title: t('footer.partners'),
      links: [
        { to: '/devenir-vendeur', label: t('footer.becomeSeller') },
        { to: '/devenir-livreur', label: t('footer.becomeDriver') },
        { to: '/login', label: t('footer.sellerSpace') },
        { to: '/login', label: t('footer.driverSpace') },
        { to: '/login', label: t('footer.adminSpace') },
      ],
    },
  ]

  return (
    <footer className="border-t border-zinc-800">
      <div className="mk-container grid grid-cols-1 gap-8 py-12 sm:grid-cols-2 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <Logo />
          <p className="mt-4 max-w-sm text-sm text-zinc-400">{t('footer.tagline')}</p>
        </div>
        {columns.map((column) => (
          <div key={column.title} className="lg:col-span-2">
            <h2 className="text-sm font-semibold text-white">{column.title}</h2>
            <ul className="mt-4 space-y-3">
              {column.links.map((link) => (
                <li key={link.label}>
                  <Link to={link.to} className="text-sm text-zinc-400 transition-colors hover:text-white">{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div className="lg:col-span-3">
          <h2 className="text-sm font-semibold text-white">{t('footer.guarantees')}</h2>
          <ul className="mt-4 space-y-3 text-sm text-zinc-400">
            <li>{t('footer.guaranteePayment')}</li>
            <li>{t('footer.guaranteeTracking')}</li>
            <li>{t('footer.guaranteePrivacy')}</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-zinc-800">
        <div className="mk-container py-6 text-xs text-zinc-500">
          {t('footer.rights', { year: new Date().getFullYear() })}
        </div>
      </div>
    </footer>
  )
}

/**
 * Mise en page du portail public, independante de MainLayout (espace prive).
 * Le CSS global bloque le defilement de <body> : le portail porte donc son propre conteneur defilant.
 */
export default function MarketplaceLayout() {
  const location = useLocation()
  const scrollRef = useRef(null)
  const [categories, setCategories] = useState([])
  // Theme clair par defaut ; preference du visiteur conservee (localStorage « mk_theme »)
  const [theme, setTheme] = useState(readMarketplaceTheme)
  const changeTheme = (next) => {
    saveMarketplaceTheme(next)
    setTheme(next)
  }
  const toggleTheme = () => changeTheme(theme === 'dark' ? 'light' : 'dark')
  const [arePreferencesOpen, setArePreferencesOpen] = useState(false)
  const closePreferences = useCallback(() => setArePreferencesOpen(false), [])

  // Retour en haut de page a chaque changement de page
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [location.pathname])

  // Categories de l'en-tete (selecteur de recherche et barre secondaire), partagees avec les pages
  useEffect(() => {
    const controller = new AbortController()
    fetchMarketplaceHome({ signal: controller.signal })
      .then((data) => setCategories(data.categories || []))
      .catch(() => undefined)
    return () => controller.abort()
  }, [])

  return (
    <CollectionsProvider>
    <CartProvider>
      <div ref={scrollRef} data-surface="marketplace" data-mk-theme={theme} className="mk-root h-dvh overflow-y-auto">
        <Header categories={categories} theme={theme} onToggleTheme={toggleTheme} onOpenPreferences={() => setArePreferencesOpen(true)} />
        <main id="mk-main">
          <Outlet context={{ scrollRef, categories }} />
        </main>
        <Footer />
        <CartNotice />
        <CompareDrawer />
        <PreferencesDrawer isOpen={arePreferencesOpen} onClose={closePreferences} theme={theme} onThemeChange={changeTheme} />
        <CartDrawer />
      </div>
    </CartProvider>
    </CollectionsProvider>
  )
}
