import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  Phone,
  Route as RouteIcon,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import LanguageSwitcher from '../components/settings/LanguageSwitcher.jsx'
import ThemeToggle from '../components/settings/ThemeToggle.jsx'
import { ROLE_DASHBOARDS, useAuth } from '../context/auth.js'
import { useLanguage } from '../context/languageContext.js'
import authService from '../services/authService.js'
import { getApiStatus } from '../services/api.js'

const roles = [
  { value: 'merchant', labelKey: 'roles.merchant' },
  { value: 'driver', labelKey: 'roles.driver' },
]

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      delayChildren: 0.1,
      staggerChildren: 0.065,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] },
  },
}

function AuthToast({ toast, onClose, t }) {
  const isSuccess = toast?.type === 'success'

  return (
    <AnimatePresence>
      {toast && (
        <motion.aside
          initial={{ opacity: 0, y: -28, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -18, scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          className={`fixed inset-x-3 top-3 z-[100] mx-auto flex max-w-md items-center gap-3 rounded-lg border p-3 shadow-[0_16px_44px_rgba(0,0,0,0.2)] backdrop-blur-md ${isSuccess ? 'border-emerald-500/25 bg-emerald-50/95 text-emerald-800 dark:bg-emerald-950/95 dark:text-emerald-200' : 'border-rose-500/25 bg-rose-50/95 text-rose-800 dark:bg-rose-950/95 dark:text-rose-200'}`}
          role="status"
          aria-live="polite"
        >
          <span className={`grid size-9 shrink-0 place-items-center rounded-md ${isSuccess ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`}>
            {isSuccess ? <CheckCircle2 aria-hidden="true" size={18} /> : <AlertTriangle aria-hidden="true" size={18} />}
          </span>
          <p className="min-w-0 flex-1 text-xs font-medium leading-5">{toast.message}</p>
          <button type="button" onClick={onClose} className="grid size-7 shrink-0 place-items-center rounded-md opacity-60 transition-opacity hover:opacity-100" aria-label={t('register.closeToast')}>
            <X aria-hidden="true" size={15} />
          </button>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}

export default function Register() {
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuth()
  const { t } = useLanguage()
  const redirectTimerRef = useRef(null)
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    passwordConfirmation: '',
    role: 'merchant',
  })
  const [showPasswords, setShowPasswords] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    return () => window.clearTimeout(redirectTimerRef.current)
  }, [])

  const updateField = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    setToast(null)
  }

  const selectRole = (role) => {
    setForm((current) => ({ ...current, role }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setToast(null)

    if (form.password !== form.passwordConfirmation) {
      setToast({ type: 'error', message: t('register.errors.passwordMismatch') })
      return
    }

    setIsSubmitting(true)

    try {
      await authService.register({
        name: form.name,
        email: form.email,
        phone: form.phone,
        password: form.password,
        role: form.role,
      })

      setToast({ type: 'success', message: t('register.success') })
      setForm({
        name: '',
        email: '',
        phone: '',
        password: '',
        passwordConfirmation: '',
        role: 'merchant',
      })
      redirectTimerRef.current = window.setTimeout(() => {
        navigate('/login', { replace: true })
      }, 1800)
    } catch (requestError) {
      const messageKey = getApiStatus(requestError) === 409
        ? 'register.errors.emailExists'
        : 'register.errors.unavailable'
      setToast({ type: 'error', message: t(messageKey) })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isAuthenticated) {
    return <Navigate to={ROLE_DASHBOARDS[user.role]} replace />
  }

  return (
    <motion.main
      initial={{ opacity: 0, x: 18 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 18 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="relative h-screen overflow-hidden bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100"
    >
      <AuthToast toast={toast} onClose={() => setToast(null)} t={t} />
      <div className="pointer-events-none absolute inset-x-0 top-1/2 hidden h-px bg-zinc-200 dark:bg-zinc-900 md:block" />
      <div className="pointer-events-none absolute inset-y-0 left-1/2 hidden w-px bg-zinc-200 dark:bg-zinc-900 md:block" />

      <div className="relative flex h-full items-stretch justify-center md:items-center md:p-6">
        <motion.section
          initial="hidden"
          animate="visible"
          variants={containerVariants}
          className="flex h-full w-full flex-col overflow-y-auto bg-zinc-50 px-6 pb-8 pt-7 dark:bg-zinc-950 md:h-auto md:max-h-[calc(100vh-3rem)] md:max-w-[460px] md:overflow-y-auto md:rounded-lg md:border md:border-zinc-200 md:bg-white md:p-8 md:shadow-[0_0_80px_rgba(245,158,11,0.08)] md:dark:border-zinc-800 md:dark:bg-zinc-900"
          aria-labelledby="register-title"
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

          <motion.div variants={itemVariants} className="mt-9">
            <div className="mb-3 flex items-center gap-2 text-xs font-medium text-amber-600 dark:text-amber-400">
              <ShieldCheck aria-hidden="true" size={15} />
              {t('register.secure')}
            </div>
            <h1 id="register-title" className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">{t('register.title')}</h1>
            <p className="mt-2 text-sm leading-6 text-zinc-500">{t('register.description')}</p>
          </motion.div>

          <form onSubmit={handleSubmit} className="mt-6 flex min-h-[530px] flex-1 flex-col md:min-h-0">
            <motion.div variants={itemVariants}>
              <span className="mb-2 block text-xs font-medium text-zinc-600 dark:text-zinc-400">{t('login.workspace')}</span>
              <div className="grid grid-cols-2 gap-1 rounded-lg border border-zinc-300 bg-zinc-100 p-1 dark:border-zinc-800 dark:bg-zinc-950" role="group" aria-label={t('register.roleSelector')}>
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
                          layoutId="register-role-indicator"
                          className="absolute inset-0 rounded-md bg-amber-500"
                          transition={{ type: 'spring', stiffness: 450, damping: 34 }}
                        />
                      )}
                      <span className="relative z-10">{t(role.labelKey)}</span>
                    </button>
                  )
                })}
              </div>
            </motion.div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <motion.label variants={itemVariants} className="block sm:col-span-2">
                <span className="auth-label">{t('register.fullName')}</span>
                <span className="group relative block">
                  <UserRound aria-hidden="true" className="auth-icon" size={16} />
                  <input required name="name" value={form.name} onChange={updateField} className="auth-field" placeholder={t('register.namePlaceholder')} autoComplete="name" />
                </span>
              </motion.label>

              <motion.label variants={itemVariants} className="block sm:col-span-2">
                <span className="auth-label">{t('register.email')}</span>
                <span className="group relative block">
                  <Mail aria-hidden="true" className="auth-icon" size={16} />
                  <input required name="email" type="email" value={form.email} onChange={updateField} className="auth-field" placeholder={t('register.emailPlaceholder')} autoComplete="email" />
                </span>
              </motion.label>

              <motion.label variants={itemVariants} className="block sm:col-span-2">
                <span className="auth-label">{t('register.phone')}</span>
                <span className="group relative block">
                  <Phone aria-hidden="true" className="auth-icon" size={16} />
                  <input required name="phone" type="tel" value={form.phone} onChange={updateField} className="auth-field" placeholder={t('register.phonePlaceholder')} autoComplete="tel" />
                </span>
              </motion.label>

              <motion.label variants={itemVariants} className="block">
                <span className="auth-label">{t('register.password')}</span>
                <span className="group relative block">
                  <LockKeyhole aria-hidden="true" className="auth-icon" size={16} />
                  <input required name="password" type={showPasswords ? 'text' : 'password'} value={form.password} onChange={updateField} className="auth-field" placeholder={t('register.passwordPlaceholder')} autoComplete="new-password" />
                </span>
              </motion.label>

              <motion.label variants={itemVariants} className="block">
                <span className="auth-label">{t('register.confirmPassword')}</span>
                <span className="group relative block">
                  <LockKeyhole aria-hidden="true" className="auth-icon" size={16} />
                  <input required name="passwordConfirmation" type={showPasswords ? 'text' : 'password'} value={form.passwordConfirmation} onChange={updateField} className="auth-field auth-field-action" placeholder={t('register.confirmPlaceholder')} autoComplete="new-password" />
                  <button
                    type="button"
                    onClick={() => setShowPasswords((visible) => !visible)}
                    className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-600 dark:hover:bg-zinc-900 dark:hover:text-zinc-300"
                    title={t(showPasswords ? 'register.hidePassword' : 'register.showPassword')}
                    aria-label={t(showPasswords ? 'register.hidePassword' : 'register.showPassword')}
                  >
                    {showPasswords ? <EyeOff aria-hidden="true" size={17} /> : <Eye aria-hidden="true" size={17} />}
                  </button>
                </span>
              </motion.label>
            </div>

            <motion.div variants={itemVariants} className="mt-auto pt-6">
              <motion.button
                type="submit"
                disabled={isSubmitting}
                whileTap={isSubmitting ? undefined : { scale: 0.98 }}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-amber-500 px-4 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? <LoaderCircle aria-hidden="true" className="animate-spin" size={18} /> : <ArrowRight aria-hidden="true" size={18} />}
                {t(isSubmitting ? 'register.submitting' : 'register.submit')}
              </motion.button>
              <p className="mt-4 text-center font-mono text-[10px] text-zinc-400 dark:text-zinc-700">{t('register.encrypted')}</p>
              <p className="mt-3 text-center text-xs text-zinc-500">
                {t('register.hasAccount')}{' '}
                <Link to="/login" className="font-semibold text-amber-600 transition-colors hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300">
                  {t('register.signIn')}
                </Link>
              </p>
            </motion.div>
          </form>
        </motion.section>
      </div>
    </motion.main>
  )
}
