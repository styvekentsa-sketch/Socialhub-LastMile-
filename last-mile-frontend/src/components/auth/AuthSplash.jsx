import { motion } from 'framer-motion'
import { Route as RouteIcon } from 'lucide-react'
import { useLanguage } from '../../context/languageContext.js'

export default function AuthSplash() {
  const { t } = useLanguage()

  return (
    <main className="grid h-screen place-items-center overflow-hidden bg-zinc-950 text-zinc-100">
      <div className="flex flex-col items-center gap-5" role="status" aria-label={t('auth.restoringSession')}>
        <div className="relative grid size-14 place-items-center rounded-lg border border-zinc-800 bg-zinc-900 text-amber-500">
          <RouteIcon aria-hidden="true" size={24} strokeWidth={1.8} />
          <motion.span
            className="absolute -inset-2 rounded-xl border border-transparent border-t-amber-500"
            animate={{ rotate: 360 }}
            transition={{ duration: 0.9, ease: 'linear', repeat: Infinity }}
          />
        </div>
        <span className="font-mono text-[10px] text-zinc-600">LAST MILE</span>
      </div>
    </main>
  )
}
