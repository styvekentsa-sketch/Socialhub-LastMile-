import { AnimatePresence, motion } from 'framer-motion'
import { CalendarDays, CheckCircle2, LoaderCircle, Mail, Phone, ShieldCheck, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import UserAvatar from '../components/profile/UserAvatar.jsx'
import userService from '../services/userService.js'
import { resolveAvatarUrl } from '../utils/avatar.js'
import { useAuth } from './auth.js'
import { AvatarViewerContext } from './avatarViewerContext.js'
import { useLanguage } from './languageContext.js'

const ROLE_STYLES = {
  admin: 'border-rose-500/25 bg-rose-500/10 text-rose-300',
  driver: 'border-sky-500/25 bg-sky-500/10 text-sky-300',
  merchant: 'border-amber-500/25 bg-amber-500/10 text-amber-300',
}

export default function AvatarViewerProvider({ children }) {
  const { user: authenticatedUser } = useAuth()
  const { language, t } = useLanguage()
  const [viewer, setViewer] = useState(null)
  const [details, setDetails] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(false)

  const closeAvatar = useCallback(() => {
    setViewer(null)
    setDetails(null)
    setError(false)
  }, [])

  const openAvatar = useCallback((user, options = {}) => {
    if (!user) {
      return
    }

    setViewer({
      inspect: Boolean(options.inspect && authenticatedUser?.role === 'admin'),
      user,
    })
    setDetails(null)
    setError(false)
  }, [authenticatedUser?.role])

  useEffect(() => {
    if (!viewer?.inspect || !viewer.user?.id) {
      return undefined
    }

    let isMounted = true
    setIsLoading(true)

    userService.getUserDetails(viewer.user.id)
      .then((data) => {
        if (isMounted) {
          setDetails(data?.user || null)
        }
      })
      .catch(() => {
        if (isMounted) {
          setError(true)
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [viewer])

  useEffect(() => {
    if (!viewer) {
      return undefined
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeAvatar()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [closeAvatar, viewer])

  const value = useMemo(() => ({ closeAvatar, openAvatar }), [closeAvatar, openAvatar])
  const displayedUser = details || viewer?.user
  const avatarUrl = resolveAvatarUrl(displayedUser?.avatar)
  const activityItems = details?.role === 'merchant'
    ? [{ label: t('avatarViewer.ordersCreated'), value: details.metrics?.orders_created || 0 }]
    : [
        { label: t('avatarViewer.deliveriesAssigned'), value: details?.metrics?.deliveries_assigned || 0 },
        { label: t('avatarViewer.deliveriesCompleted'), value: details?.metrics?.deliveries_completed || 0 },
      ]

  return (
    <AvatarViewerContext.Provider value={value}>
      {children}
      <AnimatePresence>
        {viewer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeAvatar}
            className="fixed inset-0 z-[100] overflow-y-auto bg-zinc-950/82 p-4 backdrop-blur-md"
            role="presentation"
          >
            <div className="flex min-h-full items-center justify-center py-6">
              <motion.div
                initial={{ opacity: 0, scale: 0.88, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 8 }}
                transition={{ type: 'spring', stiffness: 340, damping: 30 }}
                onClick={(event) => event.stopPropagation()}
                className="relative w-full max-w-lg"
                role="dialog"
                aria-modal="true"
                aria-label={t('avatarViewer.title')}
              >
                <button
                  type="button"
                  onClick={closeAvatar}
                  className="absolute right-0 top-0 z-10 grid size-10 place-items-center rounded-full border border-zinc-700 bg-zinc-900/90 text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
                  aria-label={t('common.close')}
                  title={t('common.close')}
                >
                  <X aria-hidden="true" size={18} />
                </button>

                <div className="flex justify-center px-12">
                  {avatarUrl ? (
                    <motion.img
                      layoutId={`avatar-${displayedUser?.id || 'current'}`}
                      src={avatarUrl}
                      alt={t('avatarViewer.avatarAlt', { name: displayedUser?.name || '' })}
                      className="size-64 max-w-full rounded-full border border-zinc-700 object-cover shadow-2xl sm:size-72"
                    />
                  ) : (
                    <UserAvatar className="size-64 max-w-full text-5xl shadow-2xl sm:size-72" user={displayedUser} />
                  )}
                </div>

                {!viewer.inspect && (
                  <p className="mt-5 text-center text-sm font-medium text-zinc-200">{displayedUser?.name}</p>
                )}

                {viewer.inspect && (
                  <motion.section
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.12 }}
                    className="mt-6 rounded-lg border border-zinc-800 bg-zinc-900 p-5 shadow-2xl"
                  >
                    {isLoading ? (
                      <div className="grid min-h-36 place-items-center"><LoaderCircle aria-hidden="true" className="animate-spin text-amber-500" size={22} /></div>
                    ) : error || !details ? (
                      <p className="py-8 text-center text-sm text-rose-400">{t('avatarViewer.loadError')}</p>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-800 pb-4">
                          <div className="min-w-0">
                            <h2 className="truncate text-base font-semibold text-zinc-100">{details.name}</h2>
                            <p className="mt-1 text-xs text-zinc-500">ID #{details.id}</p>
                          </div>
                          <span className={`rounded-md border px-2 py-1 text-[11px] font-medium ${ROLE_STYLES[details.role] || ROLE_STYLES.driver}`}>{t(`roles.${details.role}`)}</span>
                        </div>

                        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                          <div className="min-w-0"><dt className="flex items-center gap-2 text-xs text-zinc-500"><Mail aria-hidden="true" size={14} />{t('profile.email')}</dt><dd className="mt-1 truncate text-sm text-zinc-200">{details.email}</dd></div>
                          <div><dt className="flex items-center gap-2 text-xs text-zinc-500"><Phone aria-hidden="true" size={14} />{t('profile.phone')}</dt><dd className="mt-1 text-sm text-zinc-200">{details.phone}</dd></div>
                          <div><dt className="flex items-center gap-2 text-xs text-zinc-500"><CalendarDays aria-hidden="true" size={14} />{t('avatarViewer.joinedAt')}</dt><dd className="mt-1 text-sm text-zinc-200">{new Intl.DateTimeFormat(language === 'fr' ? 'fr-FR' : 'en-US', { dateStyle: 'medium' }).format(new Date(details.created_at))}</dd></div>
                          <div><dt className="flex items-center gap-2 text-xs text-zinc-500"><ShieldCheck aria-hidden="true" size={14} />{t('avatarViewer.accountStatus')}</dt><dd className="mt-1 flex items-center gap-2 text-sm text-emerald-400"><CheckCircle2 aria-hidden="true" size={14} />{t('avatarViewer.active')}</dd></div>
                        </dl>

                        <div className="mt-5 grid gap-2 sm:grid-cols-2">
                          {activityItems.map((item) => (
                            <div key={item.label} className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                              <p className="text-xs text-zinc-500">{item.label}</p>
                              <p className="mt-2 text-xl font-semibold text-zinc-100">{item.value}</p>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </motion.section>
                )}
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </AvatarViewerContext.Provider>
  )
}
