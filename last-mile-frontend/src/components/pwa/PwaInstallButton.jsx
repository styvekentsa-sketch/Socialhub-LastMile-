import { AnimatePresence, motion } from 'framer-motion'
import { Download, Share2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLanguage } from '../../context/languageContext.js'
import { getPwaInstallState, requestPwaInstall, subscribeToPwaInstall } from '../../services/pwaInstall.js'

export default function PwaInstallButton() {
  const { t } = useLanguage()
  const [installState, setInstallState] = useState(getPwaInstallState)
  const [isHelpOpen, setIsHelpOpen] = useState(false)

  useEffect(() => subscribeToPwaInstall((state) => {
    setInstallState(state)

    if (state.isInstalled) {
      setIsHelpOpen(false)
    }
  }), [])

  const installApplication = async () => {
    const outcome = await requestPwaInstall()

    if (outcome === 'unavailable') {
      setIsHelpOpen(true)
    }
  }

  if (installState.isInstalled) {
    return null
  }

  return (
    <>
      <motion.button
        type="button"
        whileTap={{ scale: 0.92 }}
        onClick={installApplication}
        className="grid size-9 place-items-center rounded-md border border-zinc-200 text-zinc-500 transition-colors hover:border-amber-500/50 hover:bg-amber-500/10 hover:text-amber-600 dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-amber-400"
        aria-label={t('install.action')}
        title={t('install.action')}
      >
        <Download aria-hidden="true" size={17} />
      </motion.button>

      <AnimatePresence>
        {isHelpOpen && (
          <>
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsHelpOpen(false)}
              className="fixed inset-0 z-[80] bg-zinc-950/75 backdrop-blur-sm"
              aria-label={t('common.close')}
            />
            <div className="pointer-events-none fixed inset-0 z-[90] flex items-end justify-center p-3 md:items-center">
              <motion.section
                initial={{ opacity: 0, y: 18, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.98 }}
                className="pointer-events-auto w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
                role="dialog"
                aria-modal="true"
                aria-labelledby="install-title"
              >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <img src="/icons/app-icon-192.png" alt="" className="size-14 rounded-lg" />
                  <div>
                    <h2 id="install-title" className="text-sm font-semibold text-zinc-950 dark:text-zinc-100">{t('install.title')}</h2>
                    <p className="mt-1 text-xs text-zinc-500">{t('install.description')}</p>
                  </div>
                </div>
                <button type="button" onClick={() => setIsHelpOpen(false)} className="grid size-8 shrink-0 place-items-center rounded-md text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label={t('common.close')}>
                  <X aria-hidden="true" size={16} />
                </button>
              </div>

              <p className="mt-5 flex items-start gap-2 rounded-md bg-zinc-100 p-3 text-xs leading-5 text-zinc-600 dark:bg-zinc-950 dark:text-zinc-400">
                <Share2 aria-hidden="true" className="mt-0.5 shrink-0 text-amber-500" size={16} />
                {t('install.instructions')}
              </p>

              <button
                type="button"
                onClick={() => setIsHelpOpen(false)}
                className="mt-3 flex h-11 w-full items-center justify-center rounded-md bg-amber-500 px-4 text-sm font-semibold text-zinc-950 hover:bg-amber-400"
              >
                {t('install.understood')}
              </button>
              </motion.section>
            </div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
