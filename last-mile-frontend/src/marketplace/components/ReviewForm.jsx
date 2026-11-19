import { CircleCheck, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { getApiStatus } from '../../services/api.js'
import { useMarketplaceText } from '../i18n.js'
import { postReview } from '../services/marketplaceApi.js'
import { StarInput } from './StarRating.jsx'

const errorKeyFor = (error) => {
  const status = getApiStatus(error)
  if (status === 403) return 'productPro.reviewNotAllowed'
  if (status === 409) return 'productPro.reviewDuplicate'
  if (status === 429) return 'errors.rateLimited'
  return null
}

/** Formulaire d'avis : publie seulement si le code de suivi correspond a une commande livree contenant le produit. */
export default function ReviewForm({ productId, onPublished }) {
  const { t } = useMarketplaceText()
  const [form, setForm] = useState({ rating: 0, customer_name: '', comment: '', tracking_code: '' })
  const [status, setStatus] = useState('idle') // idle | submitting | done
  const [error, setError] = useState('')
  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))

  const submit = async (event) => {
    event.preventDefault()
    if (!form.rating) {
      setError(t('productPro.ratingRequired'))
      return
    }
    setStatus('submitting')
    setError('')
    try {
      const { review } = await postReview(productId, { ...form, tracking_code: form.tracking_code.trim() })
      setStatus('done')
      onPublished(review)
    } catch (submitError) {
      const key = errorKeyFor(submitError)
      // 400 : message de validation du serveur (format du code, longueur du nom...)
      setError(key ? t(key) : submitError.userMessage || t('errors.generic'))
      setStatus('idle')
    }
  }

  if (status === 'done') {
    return <p role="status" className="flex items-center gap-2 rounded-lg border border-emerald-500/30 px-4 py-3 text-sm text-emerald-400"><CircleCheck aria-hidden="true" size={16} />{t('productPro.reviewThanks')}</p>
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border border-zinc-800 p-5" noValidate>
      <div>
        <h3 className="text-base font-semibold text-white">{t('productPro.writeReview')}</h3>
        <p className="mt-1 text-xs text-zinc-500">{t('productPro.reviewIntro')}</p>
      </div>
      <div className="space-y-2">
        <span className="block text-xs font-semibold text-zinc-300">{t('productPro.yourRating')}</span>
        <StarInput value={form.rating} onChange={(rating) => setForm((current) => ({ ...current, rating }))} label={t('productPro.yourRating')} />
      </div>
      <label className="block space-y-1.5">
        <span className="block text-xs font-semibold text-zinc-300">{t('productPro.trackingCode')}</span>
        <input required value={form.tracking_code} onChange={update('tracking_code')} placeholder="LM-XXXX-XXXX" maxLength={20} autoComplete="off" spellCheck="false" className="mk-input font-mono uppercase" />
      </label>
      <label className="block space-y-1.5">
        <span className="block text-xs font-semibold text-zinc-300">{t('productPro.yourName')}</span>
        <input required value={form.customer_name} onChange={update('customer_name')} maxLength={60} autoComplete="given-name" className="mk-input" />
      </label>
      <label className="block space-y-1.5">
        <span className="block text-xs font-semibold text-zinc-300">{t('productPro.comment')}</span>
        <textarea value={form.comment} onChange={update('comment')} maxLength={1000} rows={4} className="mk-input h-auto py-2" />
      </label>
      {error && <p role="alert" className="text-sm text-amber-500">{error}</p>}
      <button type="submit" disabled={status === 'submitting'} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--mk-contrast)] px-4 text-sm font-semibold text-[var(--mk-on-contrast)] hover:bg-[var(--mk-contrast-hover)] disabled:opacity-60">
        {status === 'submitting' && <LoaderCircle aria-hidden="true" size={16} className="animate-spin" />}
        {t(status === 'submitting' ? 'productPro.submitting' : 'productPro.submitReview')}
      </button>
    </form>
  )
}
