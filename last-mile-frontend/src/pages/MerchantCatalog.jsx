import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle,
  Check,
  ExternalLink,
  ImagePlus,
  LoaderCircle,
  Minus,
  PackageOpen,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { useCallback, useRef, useState, useEffect } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/auth.js'
import { useLanguage } from '../context/languageContext.js'
import useAutoRefresh from '../hooks/useAutoRefresh.js'
import { getApiErrorMessage } from '../services/api.js'
import productService from '../services/productService.js'
import { resolveAvatarUrl } from '../utils/avatar.js'

const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const INITIAL_FORM = { name: '', price: '', stock: '' }

const formatCurrency = (value, language) => new Intl.NumberFormat(
  language === 'fr' ? 'fr-FR' : 'en-US',
  { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 },
).format(Number(value) || 0)

const readAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result)
  reader.onerror = () => reject(reader.error)
  reader.readAsDataURL(file)
})

const getStockMeta = (stock, t) => {
  const quantity = Number(stock)

  if (quantity === 0) {
    return { bar: 'bg-rose-500', label: t('catalogManagement.outOfStock'), text: 'text-rose-500', pulse: true, width: '100%' }
  }

  if (quantity <= 5) {
    return { bar: 'bg-amber-500', label: t('catalogManagement.lowStock'), text: 'text-amber-600 dark:text-amber-400', pulse: false, width: `${Math.max(18, quantity * 12)}%` }
  }

  return { bar: 'bg-emerald-500', label: t('catalogManagement.available'), text: 'text-emerald-600 dark:text-emerald-400', pulse: false, width: `${Math.min(100, 35 + quantity * 3)}%` }
}

function CatalogToast({ toast, onClose, t }) {
  const isSuccess = toast.type === 'success'

  return (
    <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className={`fixed left-3 right-3 top-3 z-[80] mx-auto flex max-w-md items-center gap-3 rounded-lg border bg-white p-3 shadow-xl dark:bg-zinc-900 md:left-auto md:right-6 md:top-auto md:bottom-6 ${isSuccess ? 'border-emerald-500/35' : 'border-rose-500/35'}`} role="status">
      {isSuccess ? <Check aria-hidden="true" className="text-emerald-500" size={18} /> : <AlertTriangle aria-hidden="true" className="text-rose-500" size={18} />}
      <p className="min-w-0 flex-1 text-sm text-zinc-700 dark:text-zinc-200">{toast.message}</p>
      <button type="button" onClick={onClose} className="grid size-8 place-items-center rounded-md text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label={t('common.close')}><X aria-hidden="true" size={16} /></button>
    </motion.div>
  )
}

function ProductFormDrawer({ error, form, imagePreview, isDragging, isSubmitting, onChange, onClose, onDrop, onDragState, onFileSelect, onSubmit, t }) {
  const fileInputRef = useRef(null)

  return (
    <>
      <motion.button type="button" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-50 bg-zinc-950/72 backdrop-blur-sm" aria-label={t('common.close')} />
      <motion.section initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 340, damping: 34 }} className="fixed inset-x-0 bottom-0 z-[60] mx-auto max-h-[92dvh] max-w-2xl overflow-y-auto rounded-t-lg border border-b-0 border-zinc-200 bg-white px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950 sm:px-6" role="dialog" aria-modal="true" aria-labelledby="add-product-title">
        <span className="mx-auto block h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-700" />
        <div className="mt-4 flex items-start justify-between gap-4">
          <div><p className="text-[10px] font-semibold uppercase text-amber-600 dark:text-amber-400">SocialHub</p><h2 id="add-product-title" className="mt-1 text-lg font-semibold text-zinc-950 dark:text-zinc-100">{t('catalogManagement.addProduct')}</h2></div>
          <button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-md text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900" aria-label={t('common.close')}><X aria-hidden="true" size={18} /></button>
        </div>

        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <label className="block"><span className="mb-2 block text-xs font-medium text-zinc-500">{t('catalogManagement.productName')}</span><input required name="name" value={form.name} onChange={onChange} className="field" maxLength={255} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block min-w-0"><span className="mb-2 block text-xs font-medium text-zinc-500">{t('catalogManagement.price')}</span><input required name="price" type="number" min="1" max="100000000" step="1" value={form.price} onChange={onChange} className="field" /></label>
            <label className="block min-w-0"><span className="mb-2 block text-xs font-medium text-zinc-500">{t('catalogManagement.stock')}</span><input required name="stock" type="number" min="0" max="1000000" step="1" value={form.stock} onChange={onChange} className="field" /></label>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-zinc-500">{t('catalogManagement.image')}</p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragEnter={(event) => { event.preventDefault(); onDragState(true) }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={(event) => { event.preventDefault(); onDragState(false) }}
              onDrop={onDrop}
              className={`relative grid min-h-44 w-full place-items-center overflow-hidden rounded-lg border border-dashed transition-colors ${isDragging ? 'border-amber-500 bg-amber-500/8' : 'border-zinc-300 bg-zinc-50 hover:border-amber-500/60 dark:border-zinc-700 dark:bg-zinc-900'}`}
            >
              {imagePreview ? <img src={imagePreview} alt="" className="absolute inset-0 size-full object-cover" /> : <span className="flex flex-col items-center gap-2 px-4 text-center"><span className="grid size-10 place-items-center rounded-full bg-amber-500/12 text-amber-600 dark:text-amber-400"><Upload aria-hidden="true" size={19} /></span><span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t('catalogManagement.dropImage')}</span><span className="text-xs text-zinc-400">JPEG, PNG, WebP · 5 MB</span></span>}
              {imagePreview && <span className="absolute inset-x-3 bottom-3 rounded-md bg-zinc-950/75 px-3 py-2 text-xs font-medium text-white backdrop-blur-md">{t('catalogManagement.changeImage')}</span>}
            </button>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => onFileSelect(event.target.files?.[0])} className="hidden" />
          </div>

          {error && <p className="rounded-md border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-300">{error}</p>}
          <motion.button type="submit" whileTap={isSubmitting ? undefined : { scale: 0.98 }} disabled={isSubmitting || !imagePreview} className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-amber-500 px-4 text-sm font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-50">
            {isSubmitting ? <LoaderCircle aria-hidden="true" className="animate-spin" size={18} /> : <ImagePlus aria-hidden="true" size={18} />}
            {t(isSubmitting ? 'catalogManagement.creating' : 'catalogManagement.create')}
          </motion.button>
        </form>
      </motion.section>
    </>
  )
}

export default function MerchantCatalog() {
  const { user } = useAuth()
  const { language, t } = useLanguage()
  const [products, setProducts] = useState([])
  const [form, setForm] = useState(INITIAL_FORM)
  const [imageBase64, setImageBase64] = useState('')
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [updatingProductId, setUpdatingProductId] = useState(null)
  const [pendingDeleteId, setPendingDeleteId] = useState(null)
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [toast, setToast] = useState(null)

  const loadProducts = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setIsLoading(true)
    }
    setError('')

    try {
      const data = await productService.getMerchantProducts()
      setProducts(Array.isArray(data) ? data : [])
    } catch (loadError) {
      setError(getApiErrorMessage(loadError, t('catalogManagement.loadError')))
    } finally {
      if (!silent) {
        setIsLoading(false)
      }
    }
  }, [t])

  const refreshProductsSilently = useCallback(() => loadProducts({ silent: true }), [loadProducts])
  useAutoRefresh(refreshProductsSilently, ['products'])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(null), 4000)
    return () => window.clearTimeout(timer)
  }, [toast])

  if (user.role !== 'merchant') {
    return <Navigate to="/orders" replace />
  }

  const selectImage = async (file) => {
    setIsDragging(false)

    if (!file) return
    if (!ACCEPTED_TYPES.has(file.type)) {
      setFormError(t('catalogManagement.invalidImage'))
      return
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setFormError(t('catalogManagement.imageTooLarge'))
      return
    }

    try {
      setImageBase64(await readAsDataUrl(file))
      setFormError('')
    } catch {
      setFormError(t('catalogManagement.invalidImage'))
    }
  }

  const closeDrawer = () => {
    setIsDrawerOpen(false)
    setForm(INITIAL_FORM)
    setImageBase64('')
    setFormError('')
  }

  const createProduct = async (event) => {
    event.preventDefault()
    setIsSubmitting(true)
    setFormError('')

    try {
      const data = await productService.createProduct({
        name: form.name.trim(),
        price: Number(form.price),
        stock: Number(form.stock),
        image_base64: imageBase64,
      })
      setProducts((currentProducts) => [data.product, ...currentProducts])
      closeDrawer()
      setToast({ type: 'success', message: t('catalogManagement.createSuccess') })
    } catch (createError) {
      setFormError(getApiErrorMessage(createError, t('catalogManagement.createError')))
    } finally {
      setIsSubmitting(false)
    }
  }

  const updateStock = async (product, nextStock) => {
    const stock = Math.max(0, Math.min(1000000, nextStock))
    setUpdatingProductId(product.id)

    try {
      const data = await productService.updateProductStock(product.id, stock)
      setProducts((currentProducts) => currentProducts.map((currentProduct) => currentProduct.id === product.id ? data.product : currentProduct))
    } catch (stockError) {
      setToast({ type: 'error', message: getApiErrorMessage(stockError, t('catalogManagement.stockError')) })
    } finally {
      setUpdatingProductId(null)
    }
  }

  const deleteProduct = async (productId) => {
    setUpdatingProductId(productId)

    try {
      await productService.deleteProduct(productId)
      setProducts((currentProducts) => currentProducts.filter((product) => product.id !== productId))
      setToast({ type: 'success', message: t('catalogManagement.deleteSuccess') })
    } catch (deleteError) {
      setToast({ type: 'error', message: getApiErrorMessage(deleteError, t('catalogManagement.deleteError')) })
    } finally {
      setPendingDeleteId(null)
      setUpdatingProductId(null)
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1480px] p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div><h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-100">{t('catalogManagement.title')}</h2><p className="mt-1 text-sm text-zinc-500">{t('catalogManagement.subtitle')}</p></div>
        <div className="flex items-center gap-2">
          {user.shop_slug && <Link to={`/shop/${user.shop_slug}`} target="_blank" className="flex h-10 items-center gap-2 rounded-md border border-zinc-200 px-3 text-xs font-medium text-zinc-600 hover:bg-white dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"><ExternalLink aria-hidden="true" size={15} />{t('catalogManagement.viewShop')}</Link>}
          <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={() => setIsDrawerOpen(true)} className="flex h-10 items-center gap-2 rounded-md bg-amber-500 px-3 text-xs font-semibold text-zinc-950 hover:bg-amber-400"><Plus aria-hidden="true" size={16} />{t('catalogManagement.addProduct')}</motion.button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid min-h-72 place-items-center"><LoaderCircle aria-hidden="true" className="animate-spin text-amber-500" size={23} /></div>
      ) : error ? (
        <div className="grid min-h-72 place-items-center text-center"><div><AlertTriangle aria-hidden="true" className="mx-auto text-rose-500" size={23} /><p className="mt-3 text-sm text-zinc-500">{error}</p><button type="button" onClick={() => loadProducts()} className="mt-4 text-sm font-semibold text-amber-600 dark:text-amber-400">{t('catalogManagement.retry')}</button></div></div>
      ) : products.length === 0 ? (
        <div className="grid min-h-72 place-items-center rounded-lg border border-zinc-200 bg-white text-center dark:border-zinc-800 dark:bg-zinc-900"><div><PackageOpen aria-hidden="true" className="mx-auto text-zinc-400" size={28} /><p className="mt-3 text-sm text-zinc-500">{t('catalogManagement.empty')}</p></div></div>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {products.map((product, index) => {
            const stockMeta = getStockMeta(product.stock, t)
            const isUpdating = updatingProductId === product.id
            const isConfirmingDelete = pendingDeleteId === product.id
            return (
              <motion.article key={product.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.035 }} className="grid min-w-0 grid-cols-[112px_minmax(0,1fr)] overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 sm:grid-cols-[132px_minmax(0,1fr)]">
                <div className="min-h-44 bg-zinc-100 dark:bg-zinc-950"><img src={resolveAvatarUrl(product.image_url)} alt={product.name} className="size-full object-cover" /></div>
                <div className="flex min-w-0 flex-col p-4">
                  <div className="flex items-start justify-between gap-2"><div className="min-w-0"><h3 className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{product.name}</h3><p className="mt-1 text-sm font-semibold text-amber-600 dark:text-amber-400">{formatCurrency(product.price, language)}</p></div>
                    {isConfirmingDelete ? <div className="flex shrink-0"><button type="button" onClick={() => deleteProduct(product.id)} className="grid size-8 place-items-center rounded-md text-rose-500 hover:bg-rose-500/10" aria-label={t('catalogManagement.confirmDelete')}><Check aria-hidden="true" size={16} /></button><button type="button" onClick={() => setPendingDeleteId(null)} className="grid size-8 place-items-center rounded-md text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label={t('catalogManagement.cancelDelete')}><X aria-hidden="true" size={16} /></button></div> : <button type="button" onClick={() => setPendingDeleteId(product.id)} className="grid size-8 shrink-0 place-items-center rounded-md text-zinc-400 hover:bg-rose-500/10 hover:text-rose-500" aria-label={t('catalogManagement.delete')}><Trash2 aria-hidden="true" size={15} /></button>}
                  </div>
                  <div className="mt-auto pt-5">
                    <div className="flex items-center justify-between gap-2"><span className={`flex items-center gap-1.5 text-[10px] font-medium ${stockMeta.text}`}><span className="relative flex size-1.5">{stockMeta.pulse && <span className="absolute size-full animate-ping rounded-full bg-rose-400" />}<span className={`relative size-1.5 rounded-full ${stockMeta.bar}`} /></span>{stockMeta.label}</span><span className="font-mono text-xs text-zinc-500">{product.stock}</span></div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"><motion.div animate={{ width: stockMeta.width }} className={`h-full rounded-full ${stockMeta.bar}`} /></div>
                    <div className="mt-3 flex items-center justify-end gap-1"><button type="button" onClick={() => updateStock(product, Number(product.stock) - 1)} disabled={isUpdating || Number(product.stock) === 0} className="grid size-8 place-items-center rounded-md border border-zinc-200 text-zinc-500 disabled:opacity-35 dark:border-zinc-700" aria-label={t('catalogManagement.decreaseStock')}><Minus aria-hidden="true" size={14} /></button><button type="button" onClick={() => updateStock(product, Number(product.stock) + 1)} disabled={isUpdating} className="grid size-8 place-items-center rounded-md border border-zinc-200 text-zinc-500 disabled:opacity-35 dark:border-zinc-700" aria-label={t('catalogManagement.increaseStock')}>{isUpdating ? <LoaderCircle aria-hidden="true" className="animate-spin" size={14} /> : <Plus aria-hidden="true" size={14} />}</button></div>
                  </div>
                </div>
              </motion.article>
            )
          })}
        </section>
      )}

      <AnimatePresence>{isDrawerOpen && <ProductFormDrawer error={formError} form={form} imagePreview={imageBase64} isDragging={isDragging} isSubmitting={isSubmitting} onChange={(event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }))} onClose={closeDrawer} onDragState={setIsDragging} onDrop={(event) => { event.preventDefault(); selectImage(event.dataTransfer.files?.[0]) }} onFileSelect={selectImage} onSubmit={createProduct} t={t} />}</AnimatePresence>
      <AnimatePresence>{toast && <CatalogToast toast={toast} onClose={() => setToast(null)} t={t} />}</AnimatePresence>
    </div>
  )
}
