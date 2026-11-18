import { Menu, Route as RouteIcon, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useSearchParams } from 'react-router-dom'
import { ROLE_DASHBOARDS, useAuth } from '../context/auth.js'
import SearchBar from './components/SearchBar.jsx'
import { useMarketplaceText } from './i18n.js'
import './marketplace.css'

const NAV_LINKS = [
  { to: '/catalogue', key: 'nav.catalog' },
  { to: '/boutiques', key: 'nav.shops' },
  { to: '/suivi', key: 'nav.tracking' },
  { to: '/devenir-partenaire', key: 'nav.partner' },
]

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
        : 'bg-white text-zinc-950 hover:bg-zinc-200'} ${className}`}
    >
      {t(isConnected ? 'nav.mySpace' : 'nav.signIn')}
    </Link>
  )
}

function Header() {
  const { t } = useMarketplaceText()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  // Le menu mobile est lie a la page ou il a ete ouvert : il se referme de lui-meme apres une navigation
  const [menuOpenedOn, setMenuOpenedOn] = useState(null)
  const isMenuOpen = menuOpenedOn === location.pathname
  const setIsMenuOpen = (update) => setMenuOpenedOn((openedOn) => {
    const wasOpen = openedOn === location.pathname
    const nextOpen = typeof update === 'function' ? update(wasOpen) : update
    return nextOpen ? location.pathname : null
  })
  // Sur le catalogue, la recherche de l'en-tete reflete la recherche en cours
  const currentQuery = location.pathname === '/catalogue' ? searchParams.get('q') || '' : ''

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800 bg-[#09090b]">
      <div className="mk-container flex h-16 items-center gap-6">
        <Logo />
        <nav aria-label={t('nav.main')} className="hidden items-center gap-4 lg:flex xl:gap-6">
          {NAV_LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} className={navLinkClass}>{t(link.key)}</NavLink>
          ))}
        </nav>
        <div className="ml-auto hidden w-full max-w-xs md:block xl:max-w-sm">
          <SearchBar key={currentQuery} defaultValue={currentQuery} id="mk-header-search" />
        </div>
        <div className="ml-auto flex items-center gap-3 md:ml-0">
          <LanguageToggle />
          <AccountButton className="hidden sm:inline-flex" />
          <button
            type="button"
            onClick={() => setIsMenuOpen((open) => !open)}
            aria-expanded={isMenuOpen}
            aria-controls="mk-mobile-menu"
            aria-label={t(isMenuOpen ? 'nav.closeMenu' : 'nav.openMenu')}
            className="grid size-9 place-items-center rounded-lg border border-zinc-800 text-zinc-300 hover:text-white lg:hidden"
          >
            {isMenuOpen ? <X aria-hidden="true" size={18} /> : <Menu aria-hidden="true" size={18} />}
          </button>
        </div>
      </div>

      {isMenuOpen && (
        <div id="mk-mobile-menu" className="border-t border-zinc-800 lg:hidden">
          <div className="mk-container flex flex-col gap-4 py-4">
            <div className="md:hidden">
              <SearchBar key={currentQuery} defaultValue={currentQuery} id="mk-mobile-search" />
            </div>
            <nav aria-label={t('nav.main')} className="flex flex-col">
              {NAV_LINKS.map((link) => (
                <NavLink key={link.to} to={link.to} className={(state) => `${navLinkClass(state)} border-b border-zinc-900 py-3`}>
                  {t(link.key)}
                </NavLink>
              ))}
            </nav>
            <AccountButton className="flex sm:hidden" />
          </div>
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

  // Retour en haut de page a chaque changement de page
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [location.pathname])

  return (
    <div ref={scrollRef} data-surface="marketplace" className="mk-root h-dvh overflow-y-auto">
      <Header />
      <main id="mk-main">
        <Outlet context={{ scrollRef }} />
      </main>
      <Footer />
    </div>
  )
}
