import { AnimatePresence, motion } from 'framer-motion'
import { Moon, Sun } from 'lucide-react'
import { useLanguage } from '../../context/languageContext.js'
import { useTheme } from '../../context/themeContext.js'

export default function ThemeToggle() {
  const { t } = useLanguage()
  const { isDark, toggleTheme } = useTheme()
  const label = isDark ? t('controls.themeLight') : t('controls.themeDark')

  return (
    <motion.button
      type="button"
      onClick={toggleTheme}
      whileTap={{ scale: 0.9 }}
      className="grid size-8 place-items-center rounded-md border border-zinc-300 bg-zinc-100 text-zinc-600 transition-colors hover:text-zinc-950 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      title={label}
      aria-label={label}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={isDark ? 'moon' : 'sun'}
          initial={{ opacity: 0, rotate: -180, scale: 0.7 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 180, scale: 0.7 }}
          transition={{ duration: 0.24, ease: 'easeOut' }}
        >
          {isDark ? <Moon aria-hidden="true" size={15} /> : <Sun aria-hidden="true" size={16} />}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  )
}
