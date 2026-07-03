import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle,
  Check,
  ChevronRight,
  CreditCard,
  ImageOff,
  LoaderCircle,
  MapPin,
  Minus,
  PackageOpen,
  Phone,
  Plus,
  ShoppingBag,
  Smartphone,
  UserRound,
  WalletCards,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import LanguageSwitcher from '../components/settings/LanguageSwitcher.jsx'
import ThemeToggle from '../components/settings/ThemeToggle.jsx'
import UserAvatar from '../components/profile/UserAvatar.jsx'
import { useLanguage } from '../context/languageContext.js'
import { getApiErrorMessage } from '../services/api.js'
import publicShopService from '../services/publicShopService.js'
import { createPaymentSocket } from '../services/paymentSocket.js'
import { resolveAvatarUrl } from '../utils/avatar.js'

const DISTRICTS = ['Akwa', 'Bonamoussadi', 'Ndogbong', 'Bonapriso', 'Deido']
const INITIAL_CHECKOUT = {
  name: '',
  email: '',
  phone: '',
  district: 'Akwa',
  payment_method: 'orange_money',
}

const formatCurrency = (value, language) => new Intl.NumberFormat(
  language === 'fr' ? 'fr-FR' : 'en-US',
  { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 },
).format(Number(value) || 0)

const formatAmount = (value, language) => new Intl.NumberFormat(
  language === 'fr' ? 'fr-FR' : 'en-US',
  { maximumFractionDigits: 0 },
).format(Number(value) || 0)

const normalizeWhatsAppNumber = (phone) => {
  let digits = String(phone || '').replace(/\D/g, '')

  if (digits.startsWith('00')) {
    digits = digits.slice(2)
  }

  if (digits.startsWith('0')) {
    digits = digits.slice(1)
  }

  if (digits.length === 9 && digits.startsWith('6')) {
    digits = `237${digits}`
  }

  return digits
}

function ProductImage({ product }) {
  const [hasError, setHasError] = useState(false)
  const imageUrl = resolveAvatarUrl(product.image_url)

  return (
    <div className="relative aspect-square overflow-hidden bg-zinc-100 dark:bg-zinc-900">
      {imageUrl && !hasError ? (
        <img
          src={imageUrl}
          alt={product.name}
          onError={() => setHasError(true)}
          className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
      ) : (
        <div className="grid size-full place-items-center text-zinc-300 dark:text-zinc-700">
          <ImageOff aria-hidden="true" size={30} strokeWidth={1.4} />
        </div>
      )}
    </div>
  )
}

function OperatorMark({ method }) {
  if (method === 'orange_money') {
    return <span className="grid size-10 shrink-0 place-items-center rounded-md bg-orange-500 text-xs font-black text-white">OM</span>
  }

  if (method === 'mtn_momo') {
    return <span className="grid size-10 shrink-0 place-items-center rounded-md bg-yellow-400 text-[10px] font-black text-zinc-950">MoMo</span>
  }

  return <span className="grid size-10 shrink-0 place-items-center rounded-md bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100"><CreditCard aria-hidden="true" size={19} /></span>
}

function WaitingPayment({ checkout, language, payment, t }) {
  const amount = formatAmount(payment.order.total, language)
  const operatorKey = checkout.payment_method === 'orange_money'
    ? 'socialHub.ussdOrange'
    : checkout.payment_method === 'mtn_momo'
      ? 'socialHub.ussdMtn'
      : 'socialHub.cardPending'

  return (
    <motion.div key="waiting-payment" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex min-h-[430px] flex-col items-center justify-center px-2 py-8 text-center">
      <div className="relative grid size-24 place-items-center">
        <span className="absolute inset-0 animate-ping rounded-full border border-amber-500/30" />
        <span className="absolute inset-2 rounded-full border-2 border-zinc-200 border-t-amber-500 animate-spin dark:border-zinc-800 dark:border-t-amber-500" />
        <Smartphone aria-hidden="true" className="relative text-amber-500" size={28} />
      </div>
      <p className="mt-6 text-[10px] font-semibold uppercase text-amber-600 dark:text-amber-400">{t('socialHub.ussdTitle')}</p>
      <h3 className="mt-2 max-w-md text-xl font-semibold text-zinc-950 dark:text-zinc-100">{t(operatorKey, { amount })}</h3>
      <p className="mt-3 max-w-sm text-sm leading-6 text-zinc-500">{t('socialHub.ussdDetail', { phone: checkout.phone })}</p>
      {payment.payment_link && (
        <a href={payment.payment_link} className="mt-6 flex h-11 items-center justify-center rounded-md border border-amber-500/35 px-4 text-sm font-semibold text-amber-600 dark:text-amber-400">{t('socialHub.continuePayment')}</a>
      )}
      <div className="mt-7 flex items-center gap-2 text-xs text-zinc-500">
        <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-70" /><span className="relative size-2 rounded-full bg-emerald-500" /></span>
        {t('socialHub.realtimeConfirmation')}
      </div>
    </motion.div>
  )
}

function CheckoutSheet({ amount, cartItems, checkout, error, isLoading, language, onChange, onClose, onSubmit, pendingPayment, t }) {
  const total = formatCurrency(amount, language)
  const paymentOptions = [
    { value: 'orange_money', label: t('socialHub.orangeMoney'), detail: t('socialHub.mobileMoneyDetail'), selected: 'border-orange-500 bg-orange-500/8', hover: 'hover:border-orange-500/70' },
    { value: 'mtn_momo', label: t('socialHub.mtnMomo'), detail: t('socialHub.mobileMoneyDetail'), selected: 'border-yellow-400 bg-yellow-400/8', hover: 'hover:border-yellow-400/70' },
    { value: 'card', label: t('socialHub.cardFintech'), detail: t('socialHub.cardDetail'), selected: 'border-sky-500 bg-sky-500/8', hover: 'hover:border-sky-500/70' },
  ]

  return (
    <>
      <motion.button
        type="button"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-zinc-950/75 backdrop-blur-sm"
        aria-label={t('common.close')}
      />
      <motion.section
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 340, damping: 34 }}
        className="fixed inset-x-0 bottom-0 z-[60] mx-auto max-h-[92dvh] max-w-2xl overflow-y-auto rounded-t-lg border border-b-0 border-zinc-200 bg-white px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950 sm:px-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="socialhub-checkout-title"
      >
        <span className="mx-auto block h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-700" />
        <div className="mt-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase text-amber-600 dark:text-amber-400">SocialHub Checkout</p>
            <h2 id="socialhub-checkout-title" className="mt-1 text-lg font-semibold text-zinc-950 dark:text-zinc-100">{t('socialHub.checkoutTitle')}</h2>
          </div>
          <button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-950 dark:hover:bg-zinc-900 dark:hover:text-white" aria-label={t('common.close')}>
            <X aria-hidden="true" size={18} />
          </button>
        </div>

        <AnimatePresence mode="wait">
          {pendingPayment ? (
            <WaitingPayment checkout={checkout} language={language} payment={pendingPayment} t={t} />
          ) : (
            <motion.form key="payment-form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -8 }} onSubmit={onSubmit} className="mt-5 space-y-4">
              <div className="space-y-2 border-y border-zinc-200 py-4 dark:border-zinc-800">
                {cartItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-4 text-sm">
                    <p className="min-w-0 truncate text-zinc-700 dark:text-zinc-300">{item.quantity}x {item.name}</p>
                    <p className="shrink-0 font-medium text-zinc-950 dark:text-zinc-100">{formatCurrency(item.price * item.quantity, language)}</p>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-4 pt-2 text-sm font-semibold">
                  <span>{t('socialHub.total')}</span>
                  <span className="text-amber-600 dark:text-amber-400">{total}</span>
                </div>
              </div>
          <label className="block">
            <span className="mb-2 block text-xs font-medium text-zinc-500">{t('socialHub.buyerName')}</span>
            <span className="group relative block">
              <UserRound aria-hidden="true" className="form-icon" size={16} />
              <input required name="name" value={checkout.name} onChange={onChange} className="form-field" autoComplete="name" />
            </span>
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-medium text-zinc-500">{t('socialHub.email')}</span>
            <span className="group relative block">
              <UserRound aria-hidden="true" className="form-icon" size={16} />
              <input required name="email" type="email" value={checkout.email} onChange={onChange} className="form-field" autoComplete="email" />
            </span>
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-medium text-zinc-500">{t('socialHub.phone')}</span>
            <span className="group relative block">
              <Phone aria-hidden="true" className="form-icon" size={16} />
              <input required name="phone" type="tel" value={checkout.phone} onChange={onChange} className="form-field" placeholder="+237 6XX XX XX XX" autoComplete="tel" />
            </span>
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-medium text-zinc-500">{t('socialHub.district')}</span>
            <span className="group relative block">
              <MapPin aria-hidden="true" className="form-icon" size={16} />
              <select required name="district" value={checkout.district} onChange={onChange} className="form-field appearance-none">
                {DISTRICTS.map((district) => <option key={district} value={district}>{district}</option>)}
              </select>
            </span>
          </label>

          <fieldset>
            <legend className="mb-2 text-xs font-medium text-zinc-500">{t('socialHub.paymentMethod')}</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {paymentOptions.map(({ value, label, detail, selected, hover }) => {
                const isActive = checkout.payment_method === value
                return (
                  <motion.button
                    key={value}
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    onClick={() => onChange({ target: { name: 'payment_method', value } })}
                    className={`relative flex min-h-20 items-center gap-3 rounded-md border bg-zinc-950 px-3 text-left text-white transition-colors ${isActive ? selected : `border-zinc-800 ${hover}`}`}
                    aria-pressed={isActive}
                  >
                    <OperatorMark method={value} />
                    <span className="min-w-0"><span className="block text-xs font-semibold">{label}</span><span className="mt-1 block text-[10px] leading-4 text-zinc-500">{detail}</span></span>
                    {isActive && <Check aria-hidden="true" className="absolute right-2 top-2 text-amber-500" size={14} />}
                  </motion.button>
                )
              })}
            </div>
          </fieldset>

          {error && <p className="rounded-md border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-300">{error}</p>}

          <motion.button type="submit" whileTap={isLoading ? undefined : { scale: 0.98 }} disabled={isLoading} className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-amber-500 px-4 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-400 disabled:opacity-60">
            {isLoading ? <LoaderCircle aria-hidden="true" className="animate-spin" size={18} /> : <WalletCards aria-hidden="true" size={18} />}
            {isLoading ? t('socialHub.processing') : t('socialHub.payAmount', { amount: formatAmount(amount, language) })}
          </motion.button>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.section>
    </>
  )
}

function SuccessSheet({ checkoutResult, district, language, onClose, t }) {
  const itemSummary = checkoutResult.items.map((item) => `${item.quantity}x ${item.name}`).join(', ')
  const trackingUrl = `${window.location.origin}/tracking/${checkoutResult.order.id}`
  const message = t('socialHub.whatsappMessage', {
    district,
    items: itemSummary,
    orderId: checkoutResult.order.id,
    trackingUrl,
  })
  const sellerPhone = normalizeWhatsAppNumber(checkoutResult.shop.phone)
  const whatsappBaseUrl = import.meta.env.VITE_WHATSAPP_URL?.trim()?.replace(/\/$/, '') || ''
  const whatsappUrl = `${whatsappBaseUrl}/${sellerPhone}?text=${encodeURIComponent(message)}`

  return (
    <div className="fixed inset-0 z-[70] grid place-items-end bg-zinc-950/80 backdrop-blur-sm sm:place-items-center">
      <motion.section initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }} className="w-full rounded-t-lg border border-b-0 border-emerald-500/25 bg-white px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-6 text-center shadow-2xl dark:bg-zinc-950 sm:max-w-md sm:rounded-lg sm:border sm:p-7">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-500 text-zinc-950 shadow-[0_0_34px_rgba(16,185,129,0.22)]">
          <Check aria-hidden="true" size={25} strokeWidth={2.4} />
        </span>
        <p className="mt-5 text-[10px] font-semibold uppercase text-emerald-600 dark:text-emerald-400">{t('socialHub.paid')}</p>
        <h2 className="mt-2 text-xl font-semibold text-zinc-950 dark:text-zinc-100">{t('socialHub.successTitle')}</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-zinc-500">{t('socialHub.successDetail', { id: checkoutResult.order.id })}</p>
        <div className="mt-5 flex items-center justify-between border-y border-zinc-200 py-3 text-sm dark:border-zinc-800">
          <span className="text-zinc-500">{t('socialHub.total')}</span>
          <span className="font-semibold text-zinc-950 dark:text-zinc-100">{formatCurrency(checkoutResult.order.total, language)}</span>
        </div>
        <a href={whatsappUrl} target="_blank" rel="noreferrer" className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-md bg-amber-500 px-4 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-400">
          <Phone aria-hidden="true" size={18} />
          {t('socialHub.whatsapp')}
        </a>
        <button type="button" onClick={onClose} className="mt-2 h-11 w-full rounded-md text-sm font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900">{t('common.close')}</button>
      </motion.section>
    </div>
  )
}

export default function PublicShop() {
  const { slug } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const { language, t } = useLanguage()
  const [catalog, setCatalog] = useState(null)
  const [cart, setCart] = useState({})
  const [checkout, setCheckout] = useState(INITIAL_CHECKOUT)
  const [checkoutResult, setCheckoutResult] = useState(null)
  const [pendingPayment, setPendingPayment] = useState(null)
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [checkoutError, setCheckoutError] = useState('')

  const loadCatalog = useCallback(async () => {
    setIsLoading(true)
    setLoadError('')

    try {
      setCatalog(await publicShopService.getShop(slug))
    } catch (error) {
      setLoadError(getApiErrorMessage(error, t('socialHub.unavailable')))
    } finally {
      setIsLoading(false)
    }
  }, [slug, t])

  useEffect(() => {
    loadCatalog()
  }, [loadCatalog])

  useEffect(() => {
    const paymentReference = searchParams.get('payment_reference') || searchParams.get('tx_ref')

    if (!paymentReference) {
      return undefined
    }

    let isMounted = true

    publicShopService.getPayment(paymentReference)
      .then((payment) => {
        if (!isMounted) return

        setCheckout((currentCheckout) => ({
          ...currentCheckout,
          district: payment.customer?.district || currentCheckout.district,
          payment_method: payment.payment_method,
        }))

        if (payment.payment_status === 'paid') {
          setCheckoutResult(payment)
        } else if (payment.payment_status === 'failed') {
          setCheckoutError(t('socialHub.paymentFailed'))
          setIsCheckoutOpen(true)
        } else {
          setPendingPayment(payment)
          setIsCheckoutOpen(true)
        }
        setSearchParams({}, { replace: true })
      })
      .catch((paymentError) => {
        if (isMounted) {
          setCheckoutError(getApiErrorMessage(paymentError, t('socialHub.paymentError')))
        }
      })

    return () => {
      isMounted = false
    }
  }, [searchParams, setSearchParams, t])

  useEffect(() => {
    if (!pendingPayment?.payment_reference) {
      return undefined
    }

    const paymentSocket = createPaymentSocket(pendingPayment.payment_reference)

    const handlePaymentConfirmed = (payload = {}) => {
      if (payload.payment_reference !== pendingPayment.payment_reference) {
        return
      }

      setCheckoutResult({
        ...pendingPayment,
        payment_status: 'paid',
        order: { ...pendingPayment.order, total: payload.total ?? pendingPayment.order.total },
      })
      setPendingPayment(null)
      setIsCheckoutOpen(false)
    }

    paymentSocket.on('payment_confirmed', handlePaymentConfirmed)
    const handlePaymentFailed = () => {
      setPendingPayment(null)
      setCheckoutError(t('socialHub.paymentFailed'))
      loadCatalog()
    }
    paymentSocket.on('payment_failed', handlePaymentFailed)
    paymentSocket.on('connect_error', () => setCheckoutError(t('socialHub.realtimeError')))
    paymentSocket.connect()

    return () => {
      paymentSocket.off('payment_confirmed', handlePaymentConfirmed)
      paymentSocket.off('payment_failed', handlePaymentFailed)
      paymentSocket.disconnect()
    }
  }, [loadCatalog, pendingPayment, t])

  const cartItems = useMemo(() => (catalog?.products || [])
    .filter((product) => cart[product.id] > 0)
    .map((product) => ({ ...product, quantity: cart[product.id] })), [cart, catalog])
  const cartCount = useMemo(() => cartItems.reduce((total, item) => total + item.quantity, 0), [cartItems])
  const cartTotal = useMemo(() => cartItems.reduce((total, item) => total + Number(item.price) * item.quantity, 0), [cartItems])

  const updateQuantity = (product, delta) => {
    setCart((currentCart) => {
      const quantity = Math.max(0, Math.min(Number(product.stock), (currentCart[product.id] || 0) + delta))
      const nextCart = { ...currentCart }

      if (quantity === 0) {
        delete nextCart[product.id]
      } else {
        nextCart[product.id] = quantity
      }

      return nextCart
    })
  }

  const handleCheckoutChange = (event) => {
    const { name, value } = event.target
    setCheckout((currentCheckout) => ({ ...currentCheckout, [name]: value }))
    setCheckoutError('')
  }

  const submitCheckout = async (event) => {
    event.preventDefault()

    if (cartItems.length === 0) {
      setCheckoutError(t('socialHub.emptyCart'))
      return
    }

    setIsCheckingOut(true)
    setCheckoutError('')

    try {
      const data = await publicShopService.checkout({
        shop_slug: slug,
        cart: cartItems.map((item) => ({ product_id: item.id, quantity: item.quantity })),
        customer: {
          name: checkout.name.trim(),
          email: checkout.email.trim(),
          phone: checkout.phone.trim(),
          district: checkout.district,
        },
        payment_method: checkout.payment_method,
      })

      setCart({})
      setCatalog((currentCatalog) => currentCatalog ? {
        ...currentCatalog,
        products: currentCatalog.products.map((product) => {
          const purchasedItem = cartItems.find((item) => Number(item.id) === Number(product.id))
          return purchasedItem ? { ...product, stock: Number(product.stock) - purchasedItem.quantity } : product
        }),
      } : currentCatalog)

      if (data.requires_redirect && data.payment_link) {
        window.location.assign(data.payment_link)
      } else if (data.requires_confirmation) {
        setPendingPayment(data)
      } else {
        setCheckoutResult(data)
        setIsCheckoutOpen(false)
      }
    } catch (error) {
      setCheckoutError(getApiErrorMessage(error, t('socialHub.paymentError')))
    } finally {
      setIsCheckingOut(false)
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-screen overflow-y-auto bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-100">
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/88 px-4 py-3 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/88">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <UserAvatar className="size-10" user={{ name: catalog?.shop?.name, avatar: catalog?.shop?.avatar }} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{catalog?.shop?.name || 'SocialHub'}</p>
              <p className="text-[10px] font-medium uppercase text-amber-600 dark:text-amber-400">SocialHub Shop</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5"><LanguageSwitcher /><ThemeToggle /></div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pb-32 pt-6 sm:px-6">
        {isLoading ? (
          <div className="grid min-h-[60dvh] place-items-center"><LoaderCircle aria-hidden="true" className="animate-spin text-amber-500" size={24} /></div>
        ) : loadError ? (
          <div className="grid min-h-[60dvh] place-items-center text-center">
            <div><AlertTriangle aria-hidden="true" className="mx-auto text-rose-500" size={25} /><p className="mt-3 text-sm text-zinc-500">{loadError}</p><button type="button" onClick={loadCatalog} className="mt-5 text-sm font-semibold text-amber-600 dark:text-amber-400">{t('socialHub.retry')}</button></div>
          </div>
        ) : (
          <>
            <section className="mb-7">
              <p className="text-[10px] font-semibold uppercase text-zinc-400">{t('socialHub.catalog')}</p>
              <h1 className="mt-2 max-w-xl text-2xl font-semibold leading-tight sm:text-3xl">{t('socialHub.shopTitle', { name: catalog.shop.name })}</h1>
              <p className="mt-2 text-sm text-zinc-500">{t('socialHub.shopSubtitle')}</p>
            </section>

            {catalog.products.length === 0 ? (
              <div className="grid min-h-64 place-items-center rounded-lg border border-zinc-200 bg-white text-center dark:border-zinc-800 dark:bg-zinc-900">
                <div><PackageOpen aria-hidden="true" className="mx-auto text-zinc-400" size={28} /><p className="mt-3 text-sm text-zinc-500">{t('socialHub.noProducts')}</p></div>
              </div>
            ) : (
              <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label={t('socialHub.products')}>
                {catalog.products.map((product, index) => {
                  const quantity = cart[product.id] || 0
                  const isOutOfStock = Number(product.stock) <= 0
                  return (
                    <motion.article key={product.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }} className="group min-w-0 overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                      <ProductImage product={product} />
                      <div className="p-3">
                        <h2 className="min-h-10 text-sm font-medium leading-5 text-zinc-900 dark:text-zinc-100">{product.name}</h2>
                        <div className="mt-3 flex items-end justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-amber-600 dark:text-amber-400">{formatCurrency(product.price, language)}</p>
                            <p className={`mt-1 text-[10px] ${isOutOfStock ? 'text-rose-500' : 'text-zinc-400'}`}>{t(isOutOfStock ? 'socialHub.outOfStock' : 'socialHub.inStock', { count: product.stock })}</p>
                          </div>
                          {quantity > 0 ? (
                            <div className="flex h-9 shrink-0 items-center rounded-full border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950">
                              <button type="button" onClick={() => updateQuantity(product, -1)} className="grid size-9 place-items-center" aria-label={t('socialHub.remove')}><Minus aria-hidden="true" size={14} /></button>
                              <span className="w-5 text-center text-xs font-semibold">{quantity}</span>
                              <button type="button" onClick={() => updateQuantity(product, 1)} disabled={quantity >= Number(product.stock)} className="grid size-9 place-items-center disabled:opacity-30" aria-label={t('socialHub.add')}><Plus aria-hidden="true" size={14} /></button>
                            </div>
                          ) : (
                            <motion.button type="button" whileTap={{ scale: 0.9 }} onClick={() => updateQuantity(product, 1)} disabled={isOutOfStock} className="grid size-9 shrink-0 place-items-center rounded-full bg-amber-500 text-zinc-950 shadow-sm disabled:bg-zinc-200 disabled:text-zinc-400 dark:disabled:bg-zinc-800" aria-label={t('socialHub.add')}>
                              <Plus aria-hidden="true" size={18} />
                            </motion.button>
                          )}
                        </div>
                      </div>
                    </motion.article>
                  )
                })}
              </section>
            )}
          </>
        )}
      </main>

      <AnimatePresence>
        {cartCount > 0 && !isCheckoutOpen && !checkoutResult && (
          <motion.button type="button" initial={{ y: 90, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 90, opacity: 0 }} whileTap={{ scale: 0.985 }} onClick={() => setIsCheckoutOpen(true)} className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 mx-auto flex h-16 max-w-xl items-center gap-3 rounded-lg border border-amber-400/25 bg-zinc-950 px-4 text-left text-white shadow-[0_18px_48px_rgba(0,0,0,0.35)] dark:bg-zinc-900">
            <span className="relative grid size-10 shrink-0 place-items-center rounded-full bg-amber-500 text-zinc-950"><ShoppingBag aria-hidden="true" size={18} /><span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full border-2 border-zinc-950 bg-white text-[9px] font-bold text-zinc-950 dark:border-zinc-900">{cartCount}</span></span>
            <span className="min-w-0 flex-1"><span className="block text-xs text-zinc-400">{t('socialHub.cart')}</span><span className="block truncate text-sm font-semibold">{formatCurrency(cartTotal, language)}</span></span>
            <span className="flex items-center gap-1 text-xs font-semibold text-amber-400">{t('socialHub.checkout')}<ChevronRight aria-hidden="true" size={16} /></span>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isCheckoutOpen && (
          <CheckoutSheet
            amount={cartTotal || pendingPayment?.order?.total || 0}
            cartItems={cartItems}
            checkout={checkout}
            error={checkoutError}
            isLoading={isCheckingOut}
            language={language}
            onChange={handleCheckoutChange}
            onClose={() => setIsCheckoutOpen(false)}
            onSubmit={submitCheckout}
            pendingPayment={pendingPayment}
            t={t}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {checkoutResult && <SuccessSheet checkoutResult={checkoutResult} district={checkout.district} language={language} onClose={() => setCheckoutResult(null)} t={t} />}
      </AnimatePresence>
    </motion.div>
  )
}
