import { motion } from 'framer-motion'
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  Route as RouteIcon,
  ShieldCheck,
} from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import LanguageSwitcher from '../components/settings/LanguageSwitcher.jsx'
import ThemeToggle from '../components/settings/ThemeToggle.jsx'
import { ROLE_DASHBOARDS, useAuth } from '../context/auth.js'
import { useLanguage } from '../context/languageContext.js'
import authService from '../services/authService.js'
import { getApiStatus, isApiError } from '../services/api.js'

const roles = [
  { value: 'merchant', labelKey: 'roles.merchant' },
  { value: 'driver', labelKey: 'roles.driver' },
  { value: 'admin', labelKey: 'roles.admin' },
]

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      delayChildren: 0.12,
      staggerChildren: 0.09,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] },
  },
}

export default function Login() {
  const navigate = useNavigate()
  const { authenticate, isAuthenticated, user } = useAuth()
  const { t } = useLanguage()
  const [form, setForm] = useState({
    email: '',
    password: '',
    role: 'merchant',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const updateField = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    setError('')
  }

  const selectRole = (role) => {
    setForm((current) => ({ ...current, role }))
    setError('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const data = await authService.login(form)
      const authenticatedRole = authenticate(data, form.role, rememberMe)
      navigate(ROLE_DASHBOARDS[authenticatedRole], { replace: true })
    } catch (requestError) {
      if (isApiError(requestError)) {
        setError(t(getApiStatus(requestError) === 401 ? 'login.errors.invalidCredentials' : 'login.errors.unavailable'))
      } else if (requestError.code === 'ROLE_MISMATCH') {
        setError(t('login.errors.roleMismatch'))
      } else if (requestError.code === 'INVALID_AUTH_RESPONSE') {
        setError(t('login.errors.invalidResponse'))
      } else {
        setError(t('login.errors.unexpected'))
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isAuthenticated) {
    return <Navigate to={ROLE_DASHBOARDS[user.role]} replace />
  }

  return (
    <motion.main
      initial={{ opacity: 0, x: -18 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -18 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="relative h-screen overflow-hidden bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100"
    >
      <div className="pointer-events-none absolute inset-x-0 top-1/2 hidden h-px bg-zinc-200 dark:bg-zinc-900 md:block" />
      <div className="pointer-events-none absolute inset-y-0 left-1/2 hidden w-px bg-zinc-200 dark:bg-zinc-900 md:block" />

      <div className="relative flex h-full items-stretch justify-center md:items-center md:p-6">
        <motion.section
          initial="hidden"
          animate="visible"
          variants={containerVariants}
          className="flex h-full w-full flex-col overflow-y-auto bg-zinc-50 px-6 pb-8 pt-7 dark:bg-zinc-950 md:h-auto md:min-h-[610px] md:max-w-[440px] md:overflow-visible md:rounded-lg md:border md:border-zinc-200 md:bg-white md:p-8 md:shadow-[0_0_80px_rgba(245,158,11,0.08)] md:dark:border-zinc-800 md:dark:bg-zinc-900"
          aria-labelledby="login-title"
        >
          <motion.div variants={itemVariants} className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-amber-500 text-zinc-950 shadow-[0_0_24px_rgba(245,158,11,0.16)]">
                <RouteIcon aria-hidden="true" size={20} strokeWidth={2.2} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-zinc-950 dark:text-zinc-50">{t('common.brand')}</p>
                <p className="truncate text-xs text-zinc-500">{t('common.console')}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <LanguageSwitcher />
              <ThemeToggle />
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="mt-12 md:mt-10">
            <div className="mb-3 flex items-center gap-2 text-xs font-medium text-amber-600 dark:text-amber-400">
              <ShieldCheck aria-hidden="true" size={15} />
              {t('login.secure')}
            </div>
            <h1 id="login-title" className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">{t('login.title')}</h1>
            <p className="mt-2 text-sm leading-6 text-zinc-500">{t('login.description')}</p>
          </motion.div>

          <form onSubmit={handleSubmit} className="mt-8 flex min-h-[400px] flex-1 flex-col md:min-h-0">
            <motion.div variants={itemVariants}>
              <span className="mb-2 block text-xs font-medium text-zinc-600 dark:text-zinc-400">{t('login.workspace')}</span>
              <div className="grid grid-cols-3 gap-1 rounded-lg border border-zinc-300 bg-zinc-100 p-1 dark:border-zinc-800 dark:bg-zinc-950" role="group" aria-label={t('login.roleSelector')}>
                {roles.map((role) => {
                  const isActive = form.role === role.value

                  return (
                    <button
                      key={role.value}
                      type="button"
                      onClick={() => selectRole(role.value)}
                      aria-pressed={isActive}
                      className={`relative h-9 min-w-0 rounded-md px-2 text-xs font-medium transition-colors ${isActive ? 'text-zinc-950' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'}`}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="login-role-indicator"
                          className="absolute inset-0 rounded-md bg-amber-500"
                          transition={{ type: 'spring', stiffness: 450, damping: 34 }}
                        />
                      )}
                      <span className="relative z-10 block truncate">{t(role.labelKey)}</span>
                    </button>
                  )
                })}
              </div>
            </motion.div>

            <motion.label variants={itemVariants} className="mt-5 block">
              <span className="mb-2 block text-xs font-medium text-zinc-600 dark:text-zinc-400">{t('login.email')}</span>
              <span className="group relative block">
                <Mail aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 transition-colors group-focus-within:text-amber-500 dark:text-zinc-600" size={17} />
                <input
                  required
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={updateField}
                  placeholder={t('login.emailPlaceholder')}
                  className="h-11 w-full rounded-md border border-zinc-300 bg-white pl-10 pr-3 text-sm text-zinc-900 outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-zinc-400 focus:border-amber-500 focus:shadow-[0_0_0_3px_rgba(245,158,11,0.08)] dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-600"
                />
              </span>
            </motion.label>

            <motion.label variants={itemVariants} className="mt-5 block">
              <span className="mb-2 block text-xs font-medium text-zinc-600 dark:text-zinc-400">{t('login.password')}</span>
              <span className="group relative block">
                <LockKeyhole aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 transition-colors group-focus-within:text-amber-500 dark:text-zinc-600" size={17} />
                <input
                  required
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={form.password}
                  onChange={updateField}
                  placeholder={t('login.passwordPlaceholder')}
                  className="h-11 w-full rounded-md border border-zinc-300 bg-white pl-10 pr-11 text-sm text-zinc-900 outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-zinc-400 focus:border-amber-500 focus:shadow-[0_0_0_3px_rgba(245,158,11,0.08)] dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-600 dark:hover:bg-zinc-900 dark:hover:text-zinc-300"
                  title={t(showPassword ? 'login.hidePassword' : 'login.showPassword')}
                  aria-label={t(showPassword ? 'login.hidePassword' : 'login.showPassword')}
                >
                  {showPassword ? <EyeOff aria-hidden="true" size={17} /> : <Eye aria-hidden="true" size={17} />}
                </button>
              </span>
            </motion.label>

            <motion.div variants={itemVariants} className="mt-4 flex items-center justify-between gap-4">
              <motion.button
                type="button"
                role="checkbox"
                aria-checked={rememberMe}
                onClick={() => setRememberMe((isRemembered) => !isRemembered)}
                whileTap={{ scale: 0.97 }}
                className="flex min-w-0 items-center gap-2.5 text-xs font-medium text-zinc-600 dark:text-zinc-400"
              >
                <motion.span
                  animate={{
                    backgroundColor: rememberMe ? '#f59e0b' : 'rgba(0,0,0,0)',
                    borderColor: rememberMe ? '#f59e0b' : '#3f3f46',
                  }}
                  transition={{ duration: 0.18 }}
                  className="grid size-[18px] shrink-0 place-items-center rounded-[4px] border"
                >
                  {rememberMe && (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.45, rotate: -20 }}
                      animate={{ opacity: 1, scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 520, damping: 28 }}
                    >
                      <Check aria-hidden="true" className="text-zinc-950" size={13} strokeWidth={2.6} />
                    </motion.span>
                  )}
                </motion.span>
                <span className="truncate">{t('login.rememberMe')}</span>
              </motion.button>

              <p className="shrink-0 text-right text-xs text-zinc-500">
                <span className="hidden sm:inline">{t('login.noAccount')}{' '}</span>
                <Link to="/register" className="font-semibold text-amber-600 transition-colors hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300">
                  {t('login.register')}
                </Link>
              </p>
            </motion.div>

            <motion.div variants={itemVariants} className="min-h-12 pt-3" aria-live="polite">
              {error && (
                <p className="rounded-md border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs leading-5 text-rose-600 dark:text-rose-300">
                  {error}
                </p>
              )}
            </motion.div>

            <motion.div variants={itemVariants} className="mt-auto pt-5 md:pt-1">
              <motion.button
                type="submit"
                disabled={isSubmitting}
                whileTap={isSubmitting ? undefined : { scale: 0.98 }}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-amber-500 px-4 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? (
                  <LoaderCircle aria-hidden="true" className="animate-spin" size={18} />
                ) : (
                  <ArrowRight aria-hidden="true" size={18} />
                )}
                {t(isSubmitting ? 'login.submitting' : 'login.submit')}
              </motion.button>
              <p className="mt-4 text-center font-mono text-[10px] text-zinc-400 dark:text-zinc-700">{t('login.encrypted')}</p>
            </motion.div>
          </form>
        </motion.section>
      </div>
    </motion.main>
  )
}
