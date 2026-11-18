import { motion } from 'framer-motion'
import { CircleCheck, CircleX, Settings2, Share2, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { SOCIAL_PLATFORMS } from './socialPlatforms.js'

/**
 * Rapport de diffusion d'un produit sur les reseaux du marchand : succes ou echec par canal.
 * report : reponse de POST /api/merchant/products/:id/publish ({ total, sent, results: [...] }).
 */
export default function PublishReportSheet({ productName, report, onClose, t }) {
  const hasChannels = report.total > 0

  return (
    <>
      <motion.button type="button" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-50 bg-zinc-950/72 backdrop-blur-sm" aria-label={t('common.close')} />
      <motion.section initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 340, damping: 34 }} className="fixed inset-x-0 bottom-0 z-[60] mx-auto max-h-[92dvh] max-w-2xl overflow-y-auto rounded-t-lg border border-b-0 border-zinc-200 bg-white px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950 sm:px-6" role="dialog" aria-modal="true" aria-labelledby="publish-report-title">
        <span className="mx-auto block h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-700" />
        <div className="mt-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase text-amber-600 dark:text-amber-400">SocialHub</p>
            <h2 id="publish-report-title" className="mt-1 text-lg font-semibold text-zinc-950 dark:text-zinc-100">{t('socialChannels.publish.title')}</h2>
            <p className="mt-1 truncate text-sm text-zinc-500">{productName}</p>
          </div>
          <button type="button" onClick={onClose} className="grid size-9 shrink-0 place-items-center rounded-md text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900" aria-label={t('common.close')}><X aria-hidden="true" size={18} /></button>
        </div>

        {hasChannels ? (
          <>
            <p className={`mt-5 text-sm font-semibold ${report.failed ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`} role="status">
              {t('socialChannels.publish.summary', { sent: report.sent, total: report.total })}
            </p>
            <ul className="mt-4 space-y-2">
              {report.results.map((result) => {
                const Icon = SOCIAL_PLATFORMS[result.platform]?.icon || Share2
                const isSent = result.status === 'sent'
                return (
                  <li key={result.channel_id} className={`rounded-md border p-3 ${isSent ? 'border-zinc-200 dark:border-zinc-800' : 'border-rose-500/30 bg-rose-500/5'}`}>
                    <div className="flex items-center gap-3">
                      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-amber-500/12 text-amber-600 dark:text-amber-400"><Icon aria-hidden="true" size={15} /></span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{result.channel_name}</p>
                        <p className="text-[11px] text-zinc-500">{SOCIAL_PLATFORMS[result.platform]?.label || result.platform}</p>
                      </div>
                      <span className={`flex shrink-0 items-center gap-1.5 text-xs font-semibold ${isSent ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {isSent ? <CircleCheck aria-hidden="true" size={15} /> : <CircleX aria-hidden="true" size={15} />}
                        {t(isSent ? 'socialChannels.publish.sent' : 'socialChannels.publish.failed')}
                      </span>
                    </div>
                    {!isSent && result.error && <p className="mt-2 break-words pl-11 text-xs text-rose-600 dark:text-rose-300">{result.error}</p>}
                  </li>
                )
              })}
            </ul>
          </>
        ) : (
          <p className="mt-5 rounded-md border border-zinc-200 px-3 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">{t('socialChannels.publish.noChannels')}</p>
        )}

        <Link to="/social" className="mt-5 flex h-11 items-center justify-center gap-2 rounded-md border border-zinc-200 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900">
          <Settings2 aria-hidden="true" size={16} />
          {t('socialChannels.publish.configure')}
        </Link>
      </motion.section>
    </>
  )
}
