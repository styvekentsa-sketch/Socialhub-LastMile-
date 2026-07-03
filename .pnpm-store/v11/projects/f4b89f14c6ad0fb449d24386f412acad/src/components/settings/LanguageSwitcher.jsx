import { motion } from 'framer-motion'
import { useLanguage } from '../../context/languageContext.js'

export default function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage()

  return (
    <div
      className="flex h-8 items-center rounded-lg border border-zinc-300 bg-zinc-100 p-0.5 dark:border-zinc-800 dark:bg-zinc-900"
      role="group"
      aria-label={t('controls.language')}
    >
      {['en', 'fr'].map((option) => {
        const isActive = language === option

        return (
          <button
            key={option}
            type="button"
            onClick={() => setLanguage(option)}
            aria-pressed={isActive}
            className={`relative grid h-6 min-w-8 place-items-center rounded-md px-1.5 text-[10px] font-semibold uppercase transition-colors ${isActive ? 'text-zinc-950' : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-500 dark:hover:text-zinc-200'}`}
          >
            {isActive && (
              <motion.span
                layoutId="language-active-indicator"
                className="absolute inset-0 rounded-md bg-amber-500 shadow-sm"
                transition={{ type: 'spring', stiffness: 480, damping: 34 }}
              />
            )}
            <span className="relative z-10">{option}</span>
          </button>
        )
      })}
    </div>
  )
}
