import { Check, CircleAlert, CircleX, PackageSearch, RefreshCw, ShieldCheck } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import EmptyState from '../components/EmptyState.jsx'
import { useMarketplaceText } from '../i18n.js'
import { fetchTracking, getErrorKey, isRequestCancelled } from '../services/marketplaceApi.js'
import usePageTitle from '../usePageTitle.js'

// Meme alphabet que le backend (src/utils/trackingCode.js) : ni 0/O, ni 1/I/L
const TRACKING_CODE_PATTERN = /^LM-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/
const REFRESH_INTERVAL_MS = 30 * 1000
const normalizeCode = (value) => String(value || '').trim().toUpperCase().replace(/\s+/g, '')

function TrackingForm({ initialCode }) {
  const { t } = useMarketplaceText()
  const navigate = useNavigate()
  const [value, setValue] = useState(initialCode)
  const [error, setError] = useState('')

  const submit = (event) => {
    event.preventDefault()
    const code = normalizeCode(value)
    if (!TRACKING_CODE_PATTERN.test(code)) {
      setError(t('tracking.invalidCode'))
      return
    }
    setError('')
    navigate(`/suivi/${code}`)
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-2">
      <label htmlFor="mk-tracking-code" className="text-sm font-semibold text-white">{t('tracking.label')}</label>
      <div className="flex">
        <input
          id="mk-tracking-code"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={t('tracking.placeholder')}
          maxLength={20}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck="false"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'mk-tracking-error' : undefined}
          className="mk-input h-12 rounded-r-none font-mono text-base uppercase tracking-wider"
        />
        <button type="submit" className="h-12 shrink-0 rounded-r-lg bg-amber-500 px-6 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-400">
          {t('tracking.submit')}
        </button>
      </div>
      {error && <p id="mk-tracking-error" role="alert" className="text-sm text-amber-500">{error}</p>}
    </form>
  )
}

// Frise des 5 etapes ; en cas d'echec ou d'annulation, aucune etape n'est mise en avant
function ProgressSteps({ progress }) {
  const { t } = useMarketplaceText()

  return (
    <ol aria-label={t('tracking.progress')} className="grid grid-cols-5 gap-2">
      {progress.steps.map((step, index) => {
        const isDone = index < progress.current_step_index || (index === progress.current_step_index && step === 'delivered')
        const isCurrent = index === progress.current_step_index && step !== 'delivered'
        return (
          <li key={step} aria-current={isCurrent ? 'step' : undefined} className="flex flex-col gap-2">
            <span className={`h-1 rounded-full ${isDone ? 'bg-[var(--mk-contrast)]' : isCurrent ? 'bg-amber-500' : 'bg-zinc-800'}`} />
            {/* Sur mobile, les 5 libelles ne tiennent pas : barres seules (le statut est affiche au-dessus),
                libelles conserves pour les lecteurs d'ecran */}
            <span className={`sr-only text-xs sm:not-sr-only ${isCurrent ? 'font-semibold text-amber-500' : isDone ? 'text-zinc-300' : 'text-zinc-600'}`}>
              {t(`tracking.steps.${step}`)}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function TrackingResult({ tracking, onRefresh, isRefreshing }) {
  const { t, language } = useMarketplaceText()
  const formatDate = useCallback((value) => new Intl.DateTimeFormat(language === 'fr' ? 'fr-FR' : 'en-GB', {
    day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value)), [language])
  const isFailed = tracking.status === 'failed'
  const isCancelled = tracking.status === 'cancelled'
  const history = [...tracking.history].reverse()

  return (
    <div className="rounded-lg border border-zinc-800">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-800 p-6">
        <div>
          <p className="font-mono text-sm text-zinc-400">{tracking.tracking_code}</p>
          <p className="mt-1 text-xs text-zinc-500">{t('tracking.currentStatus')}</p>
          <h2 className="text-2xl font-semibold text-white">{t(`tracking.statuses.${tracking.status}`)}</h2>
          <p className="mt-2 text-sm text-zinc-400">
            {t('tracking.soldBy')} :{' '}
            <Link to={`/shop/${tracking.shop.slug}`} className="text-white underline-offset-4 hover:underline">{tracking.shop.name}</Link>
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-700 px-3 text-sm text-white transition-colors hover:border-zinc-500 disabled:opacity-50"
        >
          <RefreshCw aria-hidden="true" size={14} className={isRefreshing ? 'animate-spin' : ''} />
          {t('tracking.refresh')}
        </button>
      </div>

      <div className="flex flex-col gap-6 p-6">
        {(isFailed || isCancelled) && (
          <p role="status" className="flex items-center gap-2 rounded-lg border border-amber-500/40 px-4 py-3 text-sm text-amber-500">
            <CircleX aria-hidden="true" size={16} />
            {t(isFailed ? 'tracking.failedNotice' : 'tracking.cancelledNotice')}
          </p>
        )}
        <ProgressSteps progress={tracking.progress} />

        <section aria-labelledby="mk-history-title">
          <h3 id="mk-history-title" className="mb-4 text-sm font-semibold text-white">{t('tracking.history')}</h3>
          <ol className="relative flex flex-col gap-4 border-l border-zinc-800 pl-6">
            {history.map((entry, index) => (
              <li key={`${entry.status}-${entry.at}`} className="relative">
                <span className={`absolute -left-[31px] top-0.5 grid size-4 place-items-center rounded-full border ${index === 0 ? 'border-amber-500 bg-[var(--mk-bg)]' : 'border-zinc-700 bg-zinc-800'}`}>
                  {index > 0 && <Check aria-hidden="true" size={10} className="text-zinc-300" />}
                </span>
                <p className={`text-sm ${index === 0 ? 'font-semibold text-white' : 'text-zinc-300'}`}>{t(`tracking.statuses.${entry.status}`)}</p>
                <p className="text-xs text-zinc-500">
                  <time dateTime={entry.at}>{formatDate(entry.at)}</time>
                </p>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <div className="flex flex-wrap justify-between gap-2 border-t border-zinc-800 px-6 py-4 text-xs text-zinc-500">
        <span>{t('tracking.orderedOn', { date: formatDate(tracking.created_at) })}</span>
        <span>{t('tracking.updatedAt', { date: formatDate(tracking.updated_at) })}</span>
        {!tracking.is_final && <span className="w-full">{t('tracking.autoRefresh')}</span>}
      </div>
    </div>
  )
}

export default function TrackingPage() {
  const { t } = useMarketplaceText()
  const { code: rawCode } = useParams()
  const code = rawCode ? normalizeCode(rawCode) : ''
  const isValidCode = TRACKING_CODE_PATTERN.test(code)
  const [attempt, setAttempt] = useState(0)
  const requestKey = `${code}#${attempt}`
  const [response, setResponse] = useState({ key: null, code: null, status: 'idle', data: null, errorKey: null })
  usePageTitle(t('tracking.pageTitle'))

  // Les donnees affichees restent visibles pendant une actualisation du meme code
  const hasCurrentData = response.code === code && response.data
  const status = !code ? 'idle' : !isValidCode ? 'invalid' : response.key === requestKey ? response.status : (hasCurrentData ? 'refreshing' : 'loading')

  useEffect(() => {
    if (!isValidCode) return undefined
    const controller = new AbortController()
    fetchTracking(code, { signal: controller.signal })
      .then((data) => setResponse({ key: requestKey, code, status: 'ready', data, errorKey: null }))
      .catch((error) => {
        if (!isRequestCancelled(error)) setResponse((current) => ({ key: requestKey, code, status: 'error', data: current.code === code ? current.data : null, errorKey: getErrorKey(error) }))
      })
    return () => controller.abort()
  }, [code, isValidCode, requestKey])

  // Suivi « en direct » : actualisation toutes les 30 s tant que la livraison n'est pas terminee
  // et que l'onglet est visible (largement sous la limite de 20 requetes/min du serveur)
  const isFinal = Boolean(response.data?.is_final)
  useEffect(() => {
    if (!isValidCode || isFinal) return undefined
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') setAttempt((n) => n + 1)
    }, REFRESH_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [isValidCode, isFinal, code])

  const errorKey = response.errorKey
  const isNotFound = errorKey === 'errors.notFound'
  const showData = hasCurrentData && (status === 'ready' || status === 'refreshing' || (status === 'error' && errorKey === 'errors.rateLimited'))

  return (
    <div className="mk-container grid gap-12 py-12 lg:grid-cols-12">
      <div className="lg:col-span-5">
        <h1 className="text-3xl font-semibold text-white">{t('tracking.title')}</h1>
        <p className="mt-2 text-sm text-zinc-400">{t('tracking.subtitle')}</p>
        <div className="mt-8">
          <TrackingForm key={code} initialCode={code} />
        </div>
        <p className="mt-6 flex gap-3 text-sm text-zinc-500">
          <ShieldCheck aria-hidden="true" size={16} className="mt-0.5 shrink-0" />
          {t('tracking.privacy')}
        </p>
      </div>

      <div className="lg:col-span-7" aria-live="polite">
        {status === 'idle' && (
          <EmptyState icon={PackageSearch} title={t('tracking.title')} text={t('tracking.notFoundText')} />
        )}
        {status === 'invalid' && (
          <EmptyState icon={CircleAlert} title={t('tracking.notFoundTitle')} text={t('tracking.invalidCode')} />
        )}
        {status === 'loading' && (
          <div className="rounded-lg border border-zinc-800 p-6" aria-hidden="true">
            <div className="h-4 w-32 rounded bg-zinc-900" />
            <div className="mt-3 h-7 w-56 rounded bg-zinc-900" />
            <div className="mt-8 grid grid-cols-5 gap-2">{Array.from({ length: 5 }, (_, i) => <div key={i} className="h-1 rounded-full bg-zinc-900" />)}</div>
          </div>
        )}
        {status === 'error' && !showData && (
          <EmptyState
            tone={isNotFound ? 'neutral' : 'error'}
            icon={isNotFound ? PackageSearch : CircleAlert}
            title={isNotFound ? t('tracking.notFoundTitle') : t('errors.title')}
            text={isNotFound ? t('tracking.notFoundText') : t(errorKey)}
            action={!isNotFound && <button type="button" onClick={() => setAttempt((n) => n + 1)} className="h-10 rounded-lg border border-zinc-700 px-4 text-sm font-semibold text-white hover:border-zinc-500">{t('errors.retry')}</button>}
          />
        )}
        {showData && (
          <>
            {status === 'error' && <p role="alert" className="mb-4 text-sm text-amber-500">{t(errorKey)}</p>}
            <TrackingResult tracking={response.data} onRefresh={() => setAttempt((n) => n + 1)} isRefreshing={status === 'refreshing'} />
          </>
        )}
      </div>
    </div>
  )
}
