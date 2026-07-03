import { AnimatePresence, motion } from 'framer-motion'
import { Radio, X } from 'lucide-react'
import { useLanguage } from '../../context/languageContext.js'

function ToastContent({ notification, onClose, t }) {
  return (
    <>
      <span className="grid size-9 shrink-0 place-items-center rounded-md bg-amber-500/10 text-amber-400">
        <Radio aria-hidden="true" size={17} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{t('toast.title', { id: notification.orderId, status: t(`status.${notification.status}`) })}</p>
        <p className="mt-1 truncate text-[11px] text-zinc-500">{t('toast.statusUpdated', { id: notification.orderId })}</p>
      </div>
      <button type="button" onClick={onClose} className="grid size-7 shrink-0 place-items-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-200" aria-label={t('toast.close')}>
        <X aria-hidden="true" size={15} />
      </button>
    </>
  )
}

export default function StatusToast({ notification, onClose }) {
  const { t } = useLanguage()

  return (
    <AnimatePresence>
      {notification && (
        <>
          <motion.aside
            key={`mobile-${notification.id}`}
            initial={{ opacity: 0, y: -72 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -72 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="fixed inset-x-3 top-3 z-[90] flex items-center gap-3 rounded-lg border border-zinc-200 bg-white/95 p-3 shadow-[0_14px_38px_rgba(0,0,0,0.16)] backdrop-blur-md dark:border-zinc-700 dark:bg-zinc-900/95 dark:shadow-[0_14px_38px_rgba(0,0,0,0.42)] md:hidden"
            role="status"
          >
            <ToastContent notification={notification} onClose={onClose} t={t} />
          </motion.aside>

          <motion.aside
            key={`desktop-${notification.id}`}
            initial={{ opacity: 0, x: 72, y: 12 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, x: 72 }}
            transition={{ type: 'spring', stiffness: 360, damping: 32 }}
            className="fixed bottom-6 right-6 z-[90] hidden w-[360px] items-center gap-3 rounded-lg border border-amber-500/35 bg-white p-4 shadow-[0_18px_50px_rgba(0,0,0,0.18)] dark:bg-zinc-900 dark:shadow-[0_18px_50px_rgba(0,0,0,0.48)] md:flex"
            role="status"
          >
            <ToastContent notification={notification} onClose={onClose} t={t} />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
