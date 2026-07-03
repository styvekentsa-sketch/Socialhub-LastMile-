import { AnimatePresence, motion } from 'framer-motion'
import {
  ChevronDown,
  CircleUserRound,
  LogOut,
  Map,
  MapPinned,
  Package,
  PackagePlus,
  Route as RouteIcon,
  Store,
  Truck,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/auth.js'
import { useLanguage } from '../../context/languageContext.js'
import { useSocket } from '../../context/socketContext.js'
import LanguageSwitcher from '../settings/LanguageSwitcher.jsx'
import ThemeToggle from '../settings/ThemeToggle.jsx'
import AvatarTrigger from '../profile/AvatarTrigger.jsx'
import UserAvatar from '../profile/UserAvatar.jsx'
import { disconnectSocket } from '../../services/socket.js'

const NAVIGATION_BY_ROLE = {
  merchant: [
    { to: '/orders', labelKey: 'nav.orders', icon: Package },
    { to: '/create', labelKey: 'nav.create', icon: PackagePlus },
    { to: '/catalog', labelKey: 'nav.catalog', icon: Store },
    { to: '/tracking', labelKey: 'nav.tracking', icon: MapPinned },
    { to: '/profile', labelKey: 'nav.profile', icon: CircleUserRound },
  ],
  driver: [
    { to: '/deliveries', labelKey: 'nav.deliveries', mobileLabelKey: 'nav.deliveriesMobile', icon: Truck },
    { to: '/map', labelKey: 'nav.map', icon: Map },
    { to: '/profile', labelKey: 'nav.profile', icon: CircleUserRound },
  ],
  admin: [
    { to: '/orders', labelKey: 'nav.orders', icon: Package },
    { to: '/tracking', labelKey: 'nav.tracking', icon: MapPinned },
    { to: '/profile', labelKey: 'nav.profile', icon: CircleUserRound },
  ],
}

const ALL_SECTIONS = [
  ...NAVIGATION_BY_ROLE.merchant,
  ...NAVIGATION_BY_ROLE.driver,
  ...NAVIGATION_BY_ROLE.admin,
]

const getCurrentSection = (pathname) => {
  return [...ALL_SECTIONS]
    .sort((a, b) => b.to.length - a.to.length)
    .find((item) => pathname === item.to || pathname.startsWith(`${item.to}/`))
}

function Brand({ t }) {
  return (
    <div className="flex h-18 items-center gap-3 border-b border-zinc-200 px-5 dark:border-zinc-800">
      <span className="grid size-9 place-items-center rounded-lg bg-amber-500 text-zinc-950 shadow-[0_0_24px_rgba(245,158,11,0.16)]">
        <RouteIcon aria-hidden="true" size={19} strokeWidth={2.2} />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-zinc-950 dark:text-zinc-50">{t('common.brand')}</p>
        <p className="truncate text-xs text-zinc-500">{t('common.console')}</p>
      </div>
    </div>
  )
}

function DesktopSidebar({ items, t, user }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 md:flex">
      <Brand t={t} />
      <nav className="flex-1 space-y-1 px-3 py-5" aria-label={t('nav.mainLabel')}>
        {items.map(({ to, labelKey, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => [
              'group relative flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors',
              isActive
                ? 'bg-zinc-100 text-zinc-950 dark:bg-zinc-900 dark:text-zinc-50'
                : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900/60 dark:hover:text-zinc-200',
            ].join(' ')}
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span
                    layoutId="desktop-active-indicator"
                    className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-amber-500"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  />
                )}
                <Icon
                  aria-hidden="true"
                  className={isActive ? 'text-amber-500' : 'text-zinc-400 group-hover:text-zinc-700 dark:text-zinc-600 dark:group-hover:text-zinc-300'}
                  size={19}
                  strokeWidth={1.8}
                />
                <span>{t(labelKey)}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="flex items-center gap-3 border-t border-zinc-200 p-3 dark:border-zinc-800">
        <AvatarTrigger className="size-9" user={user} />
        <NavLink to="/profile" className="min-w-0 flex-1 rounded-md py-2 pr-2 transition-colors hover:text-amber-500">
          <span className="block min-w-0">
            <span className="block truncate text-xs font-semibold text-zinc-800 dark:text-zinc-200">{user.name}</span>
            <span className="mt-0.5 block text-[11px] text-zinc-500">{t(`roles.${user.role}`)}</span>
          </span>
        </NavLink>
      </div>
    </aside>
  )
}

function MobileNavigation({ items, t, user }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/80 md:hidden"
      aria-label={t('nav.mobileLabel')}
    >
      <div className="mx-auto grid h-18 max-w-md" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map(({ to, labelKey, mobileLabelKey, icon: Icon }) => (
          <NavLink key={to} to={to} className="relative min-w-0">
            {({ isActive }) => (
              <motion.div
                whileTap={{ scale: 0.92 }}
                transition={{ type: 'spring', stiffness: 520, damping: 26 }}
                className="flex h-full min-w-0 flex-col items-center justify-center gap-1"
              >
                {to === '/profile' ? (
                  <UserAvatar
                    className={`size-6 ${isActive ? 'border-amber-500' : ''}`}
                    user={user}
                    aria-hidden="true"
                  />
                ) : (
                  <Icon
                    aria-hidden="true"
                    className={isActive ? 'text-amber-500' : 'text-zinc-400 dark:text-zinc-500'}
                    size={21}
                    strokeWidth={1.9}
                  />
                )}
                <span className={`max-w-full truncate px-1 text-[11px] font-medium ${isActive ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-500'}`}>
                  {t(mobileLabelKey || labelKey)}
                </span>
                {isActive && (
                  <motion.span
                    layoutId="mobile-active-indicator"
                    className="absolute bottom-1.5 h-1 w-1 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(251,191,36,0.8)]"
                    transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                  />
                )}
              </motion.div>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

function Header({ isConnected, onLogout, title, user, t }) {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const profileMenuRef = useRef(null)

  useEffect(() => {
    const closeProfileMenu = (event) => {
      if (!profileMenuRef.current?.contains(event.target)) {
        setIsProfileMenuOpen(false)
      }
    }

    document.addEventListener('pointerdown', closeProfileMenu)
    return () => document.removeEventListener('pointerdown', closeProfileMenu)
  }, [])

  return (
    <header className="flex h-20 shrink-0 items-center justify-between border-b border-zinc-200 bg-white/95 px-3 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/95 sm:px-5 md:h-18 lg:px-8">
      <div className="min-w-0">
        <div className="mb-1 flex items-center gap-2 md:hidden">
          <RouteIcon aria-hidden="true" className="text-amber-500" size={15} />
          <span className="text-[10px] font-semibold text-zinc-500">LAST MILE</span>
        </div>
        <h1 className="max-w-28 truncate text-sm font-semibold text-zinc-950 dark:text-zinc-50 sm:max-w-none sm:text-lg">{title}</h1>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-2 pr-1 sm:border-r sm:border-zinc-200 sm:pr-3 dark:sm:border-zinc-800">
          <span className="relative flex size-2">
            {isConnected && <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-70" />}
            <span className={`relative inline-flex size-2 rounded-full ${isConnected ? 'animate-pulse bg-emerald-500' : 'bg-zinc-400 dark:bg-zinc-600'}`} />
          </span>
          <span className="hidden text-xs font-medium text-zinc-500 lg:inline">{t(isConnected ? 'header.realtime' : 'header.offline')}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>

        <div ref={profileMenuRef} className="relative flex items-center gap-2 sm:ml-1">
          <AvatarTrigger className="size-8" user={user} />
          <button
            type="button"
            onClick={() => setIsProfileMenuOpen((isOpen) => !isOpen)}
            className="flex min-w-0 items-center gap-2 rounded-md py-1 text-left"
            aria-expanded={isProfileMenuOpen}
          >
            <span className="hidden min-w-0 lg:block">
              <span className="block max-w-36 truncate text-xs font-semibold text-zinc-800 dark:text-zinc-200">{user.name}</span>
              <span className="block text-[11px] text-zinc-500">{t(`roles.${user.role}`)}</span>
            </span>
            <ChevronDown aria-hidden="true" className={`text-zinc-400 transition-transform dark:text-zinc-600 ${isProfileMenuOpen ? 'rotate-180' : ''}`} size={15} />
          </button>

          <AnimatePresence>
            {isProfileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                className="absolute right-0 top-11 z-50 w-52 overflow-hidden rounded-lg border border-zinc-200 bg-white p-1.5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
                role="menu"
              >
                <NavLink to="/profile" onClick={() => setIsProfileMenuOpen(false)} className="flex h-10 items-center gap-3 rounded-md px-3 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white" role="menuitem">
                  <CircleUserRound aria-hidden="true" size={17} />
                  {t('nav.profile')}
                </NavLink>
                <button type="button" onClick={onLogout} className="flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm text-rose-600 transition-colors hover:bg-rose-500/10 dark:text-rose-400" role="menuitem">
                  <LogOut aria-hidden="true" size={17} />
                  {t('common.logout')}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  )
}

export default function MainLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { logout, user: authenticatedUser } = useAuth()
  const { t } = useLanguage()
  const { isConnected } = useSocket()
  const user = authenticatedUser
  const navigationItems = NAVIGATION_BY_ROLE[user.role] || []
  const currentSection = getCurrentSection(location.pathname)

  const handleLogout = () => {
    disconnectSocket()
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="h-screen overflow-hidden bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <DesktopSidebar items={navigationItems} t={t} user={user} />

      <div className="flex h-full min-w-0 flex-col md:pl-60">
        <Header isConnected={isConnected} onLogout={handleLogout} title={t(currentSection?.labelKey || 'header.overview')} user={user} t={t} />
        <main className="min-h-0 flex-1 overflow-y-auto pb-24 md:pb-0">
          <Outlet context={{ user }} />
        </main>
      </div>

      <MobileNavigation items={navigationItems} t={t} user={user} />
    </div>
  )
}
