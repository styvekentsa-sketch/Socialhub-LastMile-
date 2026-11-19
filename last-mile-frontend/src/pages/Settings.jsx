import { motion } from 'framer-motion'
import {
  Bell,
  CircleAlert,
  CircleCheck,
  ExternalLink,
  KeyRound,
  LoaderCircle,
  LogOut,
  Save,
  ShieldCheck,
  Store,
  UserRound,
} from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { useAuth } from '../context/auth.js'
import { useLanguage } from '../context/languageContext.js'
import { getApiErrorMessage } from '../services/api.js'
import settingsService from '../services/settingsService.js'

const TABS = [
  { id: 'profile', labelKey: 'settings.tabProfile', icon: UserRound },
  { id: 'security', labelKey: 'settings.tabSecurity', icon: ShieldCheck },
  { id: 'notifications', labelKey: 'settings.tabNotifications', icon: Bell },
]
const EVENTS = ['new_order', 'order_status', 'payment_received', 'daily_summary']
const CHANNELS = ['email', 'push']
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,58})[a-z0-9]$/
const CITIES = ['Douala', 'Yaoundé', 'Bafoussam', 'Garoua', 'Bamenda', 'Kribi', 'Limbé']

// Memes regles que le serveur : 10 caracteres, minuscule, majuscule, chiffre, symbole
const PASSWORD_RULES = [
  { key: 'length', test: (value) => value.length >= 10 },
  { key: 'lower', test: (value) => /[a-z]/.test(value) },
  { key: 'upper', test: (value) => /[A-Z]/.test(value) },
  { key: 'digit', test: (value) => /\d/.test(value) },
  { key: 'symbol', test: (value) => /[^A-Za-z0-9]/.test(value) },
]
const STRENGTH_LEVELS = [
  { key: 'weak', bar: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-400' },
  { key: 'fair', bar: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
  { key: 'good', bar: 'bg-sky-500', text: 'text-sky-600 dark:text-sky-400' },
  { key: 'strong', bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
]

const sectionClass = 'rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900'
const labelClass = 'mb-2 block text-xs font-medium text-zinc-500'
const primaryButton = 'inline-flex h-11 items-center justify-center gap-2 rounded-md bg-amber-500 px-5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-400 disabled:opacity-60'

function Feedback({ feedback }) {
  if (!feedback) return null
  const isSuccess = feedback.type === 'success'
  const Icon = isSuccess ? CircleCheck : CircleAlert
  return (
    <p role={isSuccess ? 'status' : 'alert'} className={`flex items-start gap-2 text-sm ${isSuccess ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
      <Icon aria-hidden="true" size={16} className="mt-0.5 shrink-0" />
      {feedback.message}
    </p>
  )
}

function Switch({ checked, onChange, label, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${checked ? 'bg-amber-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}
    >
      <span className={`inline-block size-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
    </button>
  )
}

// ---------------------------------------------------------------- Profil & boutique
function ProfileTab({ settings, onSaved }) {
  const { t } = useLanguage()
  const { updateUser } = useAuth()
  const [profile, setProfile] = useState({ name: settings.profile.name, email: settings.profile.email, phone: settings.profile.phone })
  const [shop, setShop] = useState(settings.shop)
  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const slugInvalid = shop && !SLUG_PATTERN.test(shop.slug)
  const slugChanged = shop && shop.slug !== settings.shop.slug

  const changeProfile = (event) => setProfile((current) => ({ ...current, [event.target.name]: event.target.value }))
  const changeShop = (event) => setShop((current) => ({ ...current, [event.target.name]: event.target.value }))

  const submit = async (event) => {
    event.preventDefault()
    if (slugInvalid) {
      setFeedback({ type: 'error', message: t('settings.slugHint') })
      return
    }
    setIsSaving(true)
    setFeedback(null)
    try {
      const data = await settingsService.updateProfile({ ...profile, ...(shop ? { shop } : {}) })
      onSaved(data)
      updateUser({ name: data.profile.name, email: data.profile.email, phone: data.profile.phone, ...(data.shop ? { shop_slug: data.shop.slug } : {}) })
      setFeedback({ type: 'success', message: t('settings.saved') })
    } catch (error) {
      setFeedback({ type: 'error', message: getApiErrorMessage(error, t('settings.saveError')) })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <section className={`${sectionClass} p-5 sm:p-6`} aria-labelledby="settings-personal">
        <h3 id="settings-personal" className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100"><UserRound aria-hidden="true" size={16} />{t('settings.personalTitle')}</h3>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className={labelClass}>{t('profile.fullName')}</span>
            <input required name="name" value={profile.name} onChange={changeProfile} maxLength={80} autoComplete="name" className="field" />
          </label>
          <label className="block">
            <span className={labelClass}>{t('profile.email')}</span>
            <input required name="email" type="email" value={profile.email} onChange={changeProfile} maxLength={160} autoComplete="email" className="field" />
          </label>
          <label className="block">
            <span className={labelClass}>{t('profile.phone')}</span>
            <input required name="phone" type="tel" value={profile.phone} onChange={changeProfile} maxLength={25} autoComplete="tel" className="field" />
          </label>
          <p className="text-xs text-zinc-500 sm:col-span-2">{t('settings.roleLabel')} : <span className="font-medium text-zinc-800 dark:text-zinc-200">{t(`roles.${settings.profile.role}`)}</span></p>
        </div>
      </section>

      {shop && (
        <section className={`${sectionClass} p-5 sm:p-6`} aria-labelledby="settings-shop">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 id="settings-shop" className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100"><Store aria-hidden="true" size={16} />{t('settings.shopTitle')}</h3>
              <p className="mt-1 text-xs text-zinc-500">{t('settings.shopSubtitle')}</p>
            </div>
            <a href={`/shop/${settings.shop.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 hover:underline dark:text-amber-400">
              {t('settings.viewShop')}<ExternalLink aria-hidden="true" size={13} />
            </a>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={labelClass}>{t('settings.shopName')}</span>
              <input required name="name" value={shop.name} onChange={changeShop} maxLength={120} className="field" />
            </label>
            <label className="block">
              <span className={labelClass}>{t('settings.shopSlug')}</span>
              <div className="flex">
                <span className="inline-flex items-center rounded-l-md border border-r-0 border-zinc-200 bg-zinc-50 px-3 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">/shop/</span>
                <input
                  required
                  name="slug"
                  value={shop.slug}
                  onChange={(event) => setShop((current) => ({ ...current, slug: event.target.value.toLowerCase().replace(/\s+/g, '-') }))}
                  maxLength={60}
                  aria-invalid={slugInvalid}
                  spellCheck="false"
                  className="field min-w-0 rounded-l-none"
                />
              </div>
              <span className={`mt-1.5 block text-xs ${slugInvalid ? 'text-rose-600 dark:text-rose-400' : 'text-zinc-500'}`}>
                {slugInvalid ? t('settings.slugHint') : slugChanged ? t('settings.slugWarning') : t('settings.slugHelp')}
              </span>
            </label>
            <label className="block sm:col-span-2">
              <span className={labelClass}>{t('settings.shopDescription')}</span>
              <textarea name="description" value={shop.description} onChange={changeShop} maxLength={1000} rows={4} className="field resize-y" style={{ height: 'auto', minHeight: '7rem', padding: '0.625rem 0.75rem' }} />
              <span className="mt-1 block text-right text-[11px] text-zinc-500">{shop.description.length} / 1000</span>
            </label>
            <label className="block">
              <span className={labelClass}>{t('settings.pickupAddress')}</span>
              <input name="pickup_address" value={shop.pickup_address} onChange={changeShop} maxLength={255} className="field" />
              <span className="mt-1.5 block text-xs text-zinc-500">{t('settings.pickupHelp')}</span>
            </label>
            <label className="block">
              <span className={labelClass}>{t('settings.defaultCity')}</span>
              <input name="default_city" list="settings-cities" value={shop.default_city} onChange={changeShop} maxLength={60} className="field" />
              <datalist id="settings-cities">{CITIES.map((city) => <option key={city} value={city} />)}</datalist>
            </label>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
            <div>
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{t(shop.status === 'open' ? 'settings.shopOpen' : 'settings.shopPaused')}</p>
              <p className="mt-0.5 text-xs text-zinc-500">{t(shop.status === 'open' ? 'settings.shopOpenHelp' : 'settings.shopPausedHelp')}</p>
            </div>
            <Switch checked={shop.status === 'open'} onChange={(isOpen) => setShop((current) => ({ ...current, status: isOpen ? 'open' : 'paused' }))} label={t('settings.shopStatusLabel')} />
          </div>
        </section>
      )}

      <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Feedback feedback={feedback} />
        <button type="submit" disabled={isSaving} className={`${primaryButton} sm:ml-auto`}>
          {isSaving ? <LoaderCircle aria-hidden="true" size={17} className="animate-spin" /> : <Save aria-hidden="true" size={17} />}
          {t('settings.save')}
        </button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------- Securite
function SecurityTab({ settings }) {
  const { t, language } = useLanguage()
  const { refreshToken } = useAuth()
  const strengthId = useId()
  const [form, setForm] = useState({ current: '', next: '', confirm: '' })
  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [revokeState, setRevokeState] = useState('idle') // idle | confirm | working
  const [revokeFeedback, setRevokeFeedback] = useState(null)

  const passed = PASSWORD_RULES.filter((rule) => rule.test(form.next))
  const score = form.next ? Math.min(3, Math.max(0, passed.length - 2)) : -1
  const isStrongEnough = passed.length === PASSWORD_RULES.length
  const mismatch = form.confirm && form.confirm !== form.next
  const formatDate = (value) => (value
    ? new Date(value).toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US', { dateStyle: 'long', timeStyle: 'short' })
    : t('settings.never'))

  const submit = async (event) => {
    event.preventDefault()
    if (!isStrongEnough || mismatch || !form.current) {
      setFeedback({ type: 'error', message: t(mismatch ? 'settings.passwordMismatch' : 'settings.passwordRequirements') })
      return
    }
    setIsSaving(true)
    setFeedback(null)
    try {
      const data = await settingsService.changePassword(form.current, form.next)
      refreshToken(data.token)
      setForm({ current: '', next: '', confirm: '' })
      setFeedback({ type: 'success', message: t('settings.passwordChanged') })
    } catch (error) {
      setFeedback({ type: 'error', message: error.response?.data?.code === 'INVALID_CURRENT_PASSWORD' ? t('settings.wrongCurrentPassword') : getApiErrorMessage(error, t('settings.saveError')) })
    } finally {
      setIsSaving(false)
    }
  }

  const revoke = async () => {
    setRevokeState('working')
    setRevokeFeedback(null)
    try {
      const data = await settingsService.revokeOtherSessions()
      refreshToken(data.token)
      setRevokeFeedback({ type: 'success', message: t('settings.sessionsRevoked') })
    } catch (error) {
      setRevokeFeedback({ type: 'error', message: getApiErrorMessage(error, t('settings.saveError')) })
    } finally {
      setRevokeState('idle')
    }
  }

  return (
    <div className="space-y-5">
      <section className={`${sectionClass} p-5 sm:p-6`} aria-labelledby="settings-password">
        <h3 id="settings-password" className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100"><KeyRound aria-hidden="true" size={16} />{t('settings.passwordTitle')}</h3>
        <form onSubmit={submit} className="mt-5 grid gap-4 sm:max-w-lg" noValidate>
          <label className="block">
            <span className={labelClass}>{t('settings.currentPassword')}</span>
            <input type="password" value={form.current} onChange={(e) => setForm((f) => ({ ...f, current: e.target.value }))} autoComplete="current-password" className="field" />
          </label>
          <label className="block">
            <span className={labelClass}>{t('settings.newPassword')}</span>
            <input type="password" value={form.next} onChange={(e) => setForm((f) => ({ ...f, next: e.target.value }))} autoComplete="new-password" aria-describedby={strengthId} maxLength={128} className="field" />
          </label>
          <div id={strengthId} aria-live="polite">
            <div className="grid grid-cols-4 gap-1.5" aria-hidden="true">
              {STRENGTH_LEVELS.map((level, index) => (
                <span key={level.key} className={`h-1.5 rounded-full ${score >= index ? STRENGTH_LEVELS[score].bar : 'bg-zinc-200 dark:bg-zinc-800'}`} />
              ))}
            </div>
            <p className={`mt-1.5 text-xs font-medium ${score >= 0 ? STRENGTH_LEVELS[score].text : 'text-zinc-500'}`}>
              {score >= 0 ? `${t('settings.strength')} : ${t(`settings.strength_${STRENGTH_LEVELS[score].key}`)}` : t('settings.passwordRequirements')}
            </p>
            <ul className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
              {PASSWORD_RULES.map((rule) => {
                const ok = rule.test(form.next)
                return (
                  <li key={rule.key} className={`flex items-center gap-1.5 ${ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-500'}`}>
                    <CircleCheck aria-hidden="true" size={13} className={ok ? '' : 'opacity-40'} />
                    {t(`settings.rule_${rule.key}`)}
                    <span className="sr-only">{ok ? t('settings.ruleOk') : t('settings.ruleMissing')}</span>
                  </li>
                )
              })}
            </ul>
          </div>
          <label className="block">
            <span className={labelClass}>{t('settings.confirmPassword')}</span>
            <input type="password" value={form.confirm} onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))} autoComplete="new-password" aria-invalid={Boolean(mismatch)} className="field" />
            {mismatch && <span className="mt-1.5 block text-xs text-rose-600 dark:text-rose-400">{t('settings.passwordMismatch')}</span>}
          </label>
          <Feedback feedback={feedback} />
          <button type="submit" disabled={isSaving} className={`${primaryButton} justify-self-start`}>
            {isSaving ? <LoaderCircle aria-hidden="true" size={17} className="animate-spin" /> : <KeyRound aria-hidden="true" size={17} />}
            {t('settings.changePassword')}
          </button>
          <p className="text-xs text-zinc-500">{t('settings.passwordSessionsNote')}</p>
        </form>
      </section>

      <section className={`${sectionClass} p-5 sm:p-6`} aria-labelledby="settings-sessions">
        <h3 id="settings-sessions" className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100"><ShieldCheck aria-hidden="true" size={16} />{t('settings.sessionsTitle')}</h3>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
          <div><dt className="text-xs text-zinc-500">{t('settings.lastLogin')}</dt><dd className="mt-1 text-zinc-900 dark:text-zinc-100">{formatDate(settings.profile.last_login_at)}</dd></div>
          <div><dt className="text-xs text-zinc-500">{t('settings.currentLogin')}</dt><dd className="mt-1 text-zinc-900 dark:text-zinc-100">{formatDate(settings.profile.current_login_at)}</dd></div>
          <div><dt className="text-xs text-zinc-500">{t('settings.memberSince')}</dt><dd className="mt-1 text-zinc-900 dark:text-zinc-100">{formatDate(settings.profile.member_since)}</dd></div>
        </dl>
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-zinc-200 pt-5 dark:border-zinc-800">
          {revokeState === 'confirm' ? (
            <>
              <p className="w-full text-sm text-zinc-700 dark:text-zinc-300">{t('settings.revokeConfirm')}</p>
              <button type="button" onClick={revoke} className="inline-flex h-10 items-center gap-2 rounded-md bg-rose-600 px-4 text-sm font-semibold text-white hover:bg-rose-500">
                <LogOut aria-hidden="true" size={16} />{t('settings.revokeConfirmButton')}
              </button>
              <button type="button" onClick={() => setRevokeState('idle')} className="inline-flex h-10 items-center rounded-md px-4 text-sm text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white">{t('settings.cancel')}</button>
            </>
          ) : (
            <button type="button" onClick={() => setRevokeState('confirm')} disabled={revokeState === 'working'} className="inline-flex h-10 items-center gap-2 rounded-md border border-rose-500/30 px-4 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-500/10 disabled:opacity-60 dark:text-rose-400">
              {revokeState === 'working' ? <LoaderCircle aria-hidden="true" size={16} className="animate-spin" /> : <LogOut aria-hidden="true" size={16} />}
              {t('settings.revokeOthers')}
            </button>
          )}
          <Feedback feedback={revokeFeedback} />
        </div>
        <p className="mt-3 text-xs text-zinc-500">{t('settings.revokeHelp')}</p>
      </section>
    </div>
  )
}

// ---------------------------------------------------------------- Notifications & preferences
function NotificationsTab({ settings, onSaved }) {
  const { t, language, setLanguage } = useLanguage()
  const [prefs, setPrefs] = useState(settings.notifications)
  const [uiLanguage, setUiLanguage] = useState(settings.language || language)
  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState(null)

  const toggle = (event, channel, value) => setPrefs((current) => ({ ...current, [event]: { ...current[event], [channel]: value } }))

  const submit = async () => {
    setIsSaving(true)
    setFeedback(null)
    try {
      const data = await settingsService.updateNotifications(prefs, uiLanguage)
      onSaved(data)
      setLanguage(uiLanguage)
      setFeedback({ type: 'success', message: t('settings.saved') })
    } catch (error) {
      setFeedback({ type: 'error', message: getApiErrorMessage(error, t('settings.saveError')) })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <section className={sectionClass} aria-labelledby="settings-alerts">
        <div className="p-5 sm:p-6">
          <h3 id="settings-alerts" className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100"><Bell aria-hidden="true" size={16} />{t('settings.alertsTitle')}</h3>
          <p className="mt-1 text-xs text-zinc-500">{t(`settings.alertsSubtitle_${settings.profile.role}`)}</p>
        </div>
        <table className="w-full border-t border-zinc-200 text-left text-sm dark:border-zinc-800">
          <thead>
            <tr className="text-xs text-zinc-500">
              <th scope="col" className="px-5 py-3 font-medium sm:px-6">{t('settings.event')}</th>
              {CHANNELS.map((channel) => <th key={channel} scope="col" className="w-20 px-3 py-3 text-center font-medium sm:w-28">{t(`settings.channel_${channel}`)}</th>)}
            </tr>
          </thead>
          <tbody>
            {EVENTS.map((event) => (
              <tr key={event} className="border-t border-zinc-200 dark:border-zinc-800">
                <th scope="row" className="px-5 py-4 font-normal sm:px-6">
                  <span className="block font-medium text-zinc-900 dark:text-zinc-100">{t(`settings.event_${event}`)}</span>
                  <span className="mt-0.5 block text-xs text-zinc-500">{t(`settings.event_${event}_help`)}</span>
                </th>
                {CHANNELS.map((channel) => (
                  <td key={channel} className="px-3 py-4 text-center">
                    <Switch checked={prefs[event][channel]} onChange={(value) => toggle(event, channel, value)} label={`${t(`settings.event_${event}`)} : ${t(`settings.channel_${channel}`)}`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className={`${sectionClass} p-5 sm:p-6`} aria-labelledby="settings-language">
        <h3 id="settings-language" className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{t('settings.languageTitle')}</h3>
        <p className="mt-1 text-xs text-zinc-500">{t('settings.languageHelp')}</p>
        <div role="radiogroup" aria-labelledby="settings-language" className="mt-4 inline-flex rounded-md border border-zinc-200 p-1 dark:border-zinc-800">
          {[['fr', 'Français'], ['en', 'English']].map(([code, label]) => (
            <button
              key={code}
              type="button"
              role="radio"
              aria-checked={uiLanguage === code}
              onClick={() => setUiLanguage(code)}
              className={`h-9 rounded px-4 text-sm transition-colors ${uiLanguage === code ? 'bg-amber-500 font-semibold text-zinc-950' : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Feedback feedback={feedback} />
        <button type="button" onClick={submit} disabled={isSaving} className={`${primaryButton} sm:ml-auto`}>
          {isSaving ? <LoaderCircle aria-hidden="true" size={17} className="animate-spin" /> : <Save aria-hidden="true" size={17} />}
          {t('settings.save')}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- Page
export default function Settings() {
  const { t } = useLanguage()
  const [activeTab, setActiveTab] = useState('profile')
  const [attempt, setAttempt] = useState(0)
  // Etat derive : tant que la reponse ne correspond pas a la tentative en cours, la page est en chargement
  const [response, setResponse] = useState({ attempt: null, settings: null, error: null })
  const isLoading = response.attempt !== attempt

  useEffect(() => {
    let isActive = true
    settingsService.getSettings()
      .then((settings) => { if (isActive) setResponse({ attempt, settings, error: null }) })
      .catch((error) => { if (isActive) setResponse({ attempt, settings: null, error: getApiErrorMessage(error, t('settings.loadError')) }) })
    return () => { isActive = false }
  }, [attempt, t])

  const onSaved = (data) => setResponse((current) => ({ ...current, settings: { profile: data.profile, shop: data.shop, notifications: data.notifications, language: data.language } }))

  const onTabKeyDown = (event) => {
    const index = TABS.findIndex((tab) => tab.id === activeTab)
    const offset = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!offset) return
    const next = TABS[(index + offset + TABS.length) % TABS.length].id
    setActiveTab(next)
    document.getElementById(`settings-tab-${next}`)?.focus()
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mx-auto w-full max-w-4xl p-4 pb-28 sm:p-6 lg:p-8">
      <header className="mb-6">
        <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-100">{t('settings.title')}</h2>
        <p className="mt-1 text-sm text-zinc-500">{t('settings.subtitle')}</p>
      </header>

      <div role="tablist" aria-label={t('settings.title')} className="mb-6 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-zinc-200 [scrollbar-width:none] dark:border-zinc-800">
        {TABS.map(({ id, labelKey, icon: Icon }) => (
          <button
            key={id}
            id={`settings-tab-${id}`}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            aria-controls={`settings-panel-${id}`}
            tabIndex={activeTab === id ? 0 : -1}
            onClick={() => setActiveTab(id)}
            onKeyDown={onTabKeyDown}
            className={`-mb-px inline-flex h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm transition-colors ${activeTab === id ? 'border-amber-500 font-semibold text-zinc-950 dark:text-white' : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'}`}
          >
            <Icon aria-hidden="true" size={16} />
            {t(labelKey)}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="space-y-4" aria-hidden="true">
          <div className={`${sectionClass} h-48 animate-pulse`} />
          <div className={`${sectionClass} h-64 animate-pulse`} />
        </div>
      )}
      {!isLoading && response.error && (
        <div className={`${sectionClass} p-6 text-center`}>
          <p className="text-sm text-rose-600 dark:text-rose-400">{response.error}</p>
          <button type="button" onClick={() => setAttempt((n) => n + 1)} className="mt-4 h-10 rounded-md border border-zinc-300 px-4 text-sm font-medium text-zinc-800 dark:border-zinc-700 dark:text-zinc-200">{t('settings.retry')}</button>
        </div>
      )}
      {!isLoading && response.settings && TABS.map(({ id }) => (
        <div key={id} id={`settings-panel-${id}`} role="tabpanel" aria-labelledby={`settings-tab-${id}`} hidden={activeTab !== id}>
          {id === 'profile' && <ProfileTab settings={response.settings} onSaved={onSaved} />}
          {id === 'security' && <SecurityTab settings={response.settings} />}
          {id === 'notifications' && <NotificationsTab settings={response.settings} onSaved={onSaved} />}
        </div>
      ))}
    </motion.div>
  )
}
