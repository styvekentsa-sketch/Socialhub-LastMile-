import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, LoaderCircle, MapPin, PackagePlus, Phone, Send, UserRound, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/auth.js'
import { useLanguage } from '../context/languageContext.js'
import orderService from '../services/orderService.js'

const DISTRICTS = [
  { name: 'Akwa', latitude: 4.0483, longitude: 9.7043 },
  { name: 'Bonamoussadi', latitude: 4.0908, longitude: 9.7468 },
  { name: 'Ndogbong', latitude: 4.0644, longitude: 9.7418 },
  { name: 'Bonapriso', latitude: 4.0285, longitude: 9.6931 },
  { name: 'Deido', latitude: 4.0676, longitude: 9.7067 },
]

const INITIAL_FORM = {
  client_name: '',
  client_phone: '',
  description: '',
  district: 'Akwa',
}

export default function CreateOrder() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const redirectTimerRef = useRef(null)
  const [form, setForm] = useState(INITIAL_FORM)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => () => window.clearTimeout(redirectTimerRef.current), [])

  if (user.role !== 'merchant') {
    return <Navigate to="/orders" replace />
  }

  const updateField = (event) => {
    const { name, value } = event.target
    setForm((currentForm) => ({ ...currentForm, [name]: value }))
    setToast(null)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setIsSubmitting(true)
    setToast(null)

    try {
      const district = DISTRICTS.find((item) => item.name === form.district) || DISTRICTS[0]
      const data = await orderService.createOrder({
        client_name: form.client_name.trim(),
        client_phone: form.client_phone.trim(),
        delivery_address: district.name,
        description: form.description.trim(),
        latitude: district.latitude,
        longitude: district.longitude,
      })

      setForm(INITIAL_FORM)
      setToast({ type: 'success', message: t('createOrder.success', { id: data.orderId }) })
      redirectTimerRef.current = window.setTimeout(() => {
        navigate('/orders', { replace: true, state: { createdOrderId: data.orderId } })
      }, 1200)
    } catch {
      setToast({ type: 'error', message: t('createOrder.error') })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl p-4 sm:p-6 lg:p-8">
      <header className="mb-6">
        <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-100">{t('createOrder.title')}</h2>
        <p className="mt-1 text-sm text-zinc-500">{t('createOrder.subtitle')}</p>
      </header>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 sm:p-7">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-xs font-medium text-zinc-500">{t('createOrder.recipient')}</span>
              <span className="group relative block">
                <UserRound aria-hidden="true" className="form-icon" size={16} />
                <input required name="client_name" value={form.client_name} onChange={updateField} className="form-field" placeholder={t('form.clientPlaceholder')} />
              </span>
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-medium text-zinc-500">{t('createOrder.phone')}</span>
              <span className="group relative block">
                <Phone aria-hidden="true" className="form-icon" size={16} />
                <input required name="client_phone" type="tel" value={form.client_phone} onChange={updateField} className="form-field" placeholder={t('form.phonePlaceholder')} />
              </span>
            </label>
          </div>

          <label className="block">
            <span className="mb-2 block text-xs font-medium text-zinc-500">{t('createOrder.district')}</span>
            <span className="group relative block">
              <MapPin aria-hidden="true" className="form-icon" size={16} />
              <select required name="district" value={form.district} onChange={updateField} className="form-field appearance-none">
                {DISTRICTS.map((district) => <option key={district.name} value={district.name}>{district.name}</option>)}
              </select>
            </span>
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-medium text-zinc-500">{t('createOrder.description')}</span>
            <span className="group relative block">
              <PackagePlus aria-hidden="true" className="pointer-events-none absolute left-3 top-3 text-zinc-400 dark:text-zinc-600" size={16} />
              <textarea
                required
                name="description"
                value={form.description}
                onChange={updateField}
                rows={5}
                maxLength={1000}
                className="w-full resize-none rounded-md border border-zinc-300 bg-white py-3 pl-10 pr-3 text-sm text-zinc-900 outline-none transition-[border-color,box-shadow] focus:border-amber-500 focus:shadow-[0_0_0_3px_rgba(245,158,11,0.08)] dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                placeholder={t('createOrder.descriptionPlaceholder')}
              />
            </span>
          </label>

          <motion.button
            type="submit"
            whileTap={isSubmitting ? undefined : { scale: 0.98 }}
            disabled={isSubmitting}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-amber-500 px-5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-400 disabled:opacity-60 sm:ml-auto sm:w-auto"
          >
            {isSubmitting ? <LoaderCircle aria-hidden="true" className="animate-spin" size={18} /> : <Send aria-hidden="true" size={18} />}
            {t(isSubmitting ? 'createOrder.submitting' : 'createOrder.submit')}
          </motion.button>
        </form>
      </section>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`fixed left-3 right-3 top-3 z-[70] mx-auto flex max-w-md items-center gap-3 rounded-lg border p-3 shadow-xl backdrop-blur-md md:left-auto md:right-6 md:top-auto md:bottom-6 ${toast.type === 'success' ? 'border-emerald-500/30 bg-emerald-950/95 text-emerald-200' : 'border-rose-500/30 bg-rose-950/95 text-rose-200'}`}
            role="status"
          >
            <CheckCircle2 aria-hidden="true" size={18} />
            <p className="min-w-0 flex-1 text-sm">{toast.message}</p>
            <button type="button" onClick={() => setToast(null)} className="grid size-8 place-items-center rounded-md opacity-70 hover:opacity-100" aria-label={t('common.close')}><X aria-hidden="true" size={16} /></button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
