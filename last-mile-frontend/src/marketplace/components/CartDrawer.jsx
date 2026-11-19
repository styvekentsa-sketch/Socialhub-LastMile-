import { Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useCart } from '../cart/cartContext.js'
import { toCheckoutParam } from '../cart/cartStorage.js'
import { useMarketplaceText } from '../i18n.js'
import ProductThumb from './ProductThumb.jsx'

/** Tiroir lateral du panier : articles groupes par boutique, un passage en caisse par boutique. */
export default function CartDrawer() {
  const { t, formatPrice, currency } = useMarketplaceText()
  const cart = useCart()
  const closeRef = useRef(null)

  const { isOpen, close } = cart

  useEffect(() => {
    if (!isOpen) return undefined
    closeRef.current?.focus()
    const onKeyDown = (event) => { if (event.key === 'Escape') close() }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen, close])

  if (!cart.isOpen) return null

  const stepButton = 'grid size-8 place-items-center text-zinc-300 transition-colors hover:text-white disabled:opacity-30'

  return (
    <div className="fixed inset-0 z-[70]">
      <button type="button" onClick={cart.close} className="absolute inset-0 bg-black/70" aria-label={t('cart.close')} tabIndex={-1} />
      <aside role="dialog" aria-modal="true" aria-labelledby="mk-cart-title" className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-zinc-800 bg-[var(--mk-bg)]">
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-zinc-800 px-6">
          <div>
            <h2 id="mk-cart-title" className="text-base font-semibold text-white">{t('cart.title')}</h2>
            <p className="text-xs text-zinc-500">{t('cart.items', { count: cart.count })}</p>
          </div>
          <button ref={closeRef} type="button" onClick={cart.close} className="grid size-9 place-items-center rounded-lg border border-zinc-800 text-zinc-400 hover:text-white" aria-label={t('cart.close')}>
            <X aria-hidden="true" size={18} />
          </button>
        </div>

        {cart.lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <span className="grid size-12 place-items-center rounded-lg border border-zinc-800 text-zinc-500"><ShoppingBag aria-hidden="true" size={22} /></span>
            <p className="mt-4 text-sm font-semibold text-white">{t('cart.empty')}</p>
            <p className="mt-1 text-sm text-zinc-400">{t('cart.emptyHint')}</p>
            <Link to="/catalogue" onClick={cart.close} className="mt-6 inline-flex h-10 items-center rounded-lg bg-[var(--mk-contrast)] px-4 text-sm font-semibold text-[var(--mk-on-contrast)] hover:bg-[var(--mk-contrast-hover)]">{t('cart.browse')}</Link>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
              {cart.groups.map((group) => (
                <section key={group.shopSlug} aria-label={group.shopName} className="rounded-lg border border-zinc-800">
                  <h3 className="border-b border-zinc-800 px-4 py-3 text-sm font-semibold text-white">{group.shopName}</h3>
                  <ul className="divide-y divide-zinc-800">
                    {group.lines.map((line) => (
                      <li key={line.productId} className="flex gap-3 px-4 py-3">
                        <Link to={`/produits/${line.productId}`} onClick={cart.close} className="relative size-16 shrink-0 overflow-hidden rounded-md border border-zinc-800 bg-zinc-900">
                          <ProductThumb src={line.imageUrl} />
                        </Link>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-sm text-white">{line.name}</p>
                          <p className="mt-0.5 text-sm font-semibold text-white">{formatPrice(line.price)}</p>
                          <div className="mt-2 flex items-center justify-between">
                            <div className="flex h-8 items-center rounded-md border border-zinc-800">
                              <button type="button" onClick={() => cart.updateQuantity(line.productId, line.quantity - 1)} disabled={line.quantity <= 1} className={stepButton} aria-label={t('cart.decrease')}><Minus aria-hidden="true" size={14} /></button>
                              <span className="w-8 text-center text-sm tabular-nums text-white" aria-live="polite">{line.quantity}</span>
                              <button type="button" onClick={() => cart.updateQuantity(line.productId, line.quantity + 1)} disabled={line.stock > 0 && line.quantity >= line.stock} className={stepButton} aria-label={t('cart.increase')}><Plus aria-hidden="true" size={14} /></button>
                            </div>
                            <button type="button" onClick={() => cart.removeItem(line.productId)} className="grid size-8 place-items-center rounded-md text-zinc-500 hover:text-white" aria-label={t('cart.remove', { name: line.name })}><Trash2 aria-hidden="true" size={15} /></button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="space-y-3 border-t border-zinc-800 px-4 py-3">
                    <div className="flex justify-between text-sm"><span className="text-zinc-400">{t('cart.subtotal')}</span><span className="font-semibold text-white">{formatPrice(group.subtotal)}</span></div>
                    <Link
                      to={`/shop/${group.shopSlug}/commande?panier=${encodeURIComponent(toCheckoutParam(group.lines))}`}
                      onClick={cart.close}
                      className="flex h-10 items-center justify-center rounded-lg bg-amber-500 px-4 text-sm font-semibold text-zinc-950 hover:bg-amber-400"
                    >
                      {t('cart.checkoutShop', { shop: group.shopName })}
                    </Link>
                  </div>
                </section>
              ))}
            </div>
            <div className="shrink-0 space-y-2 border-t border-zinc-800 px-6 py-4">
              <div className="flex justify-between text-sm"><span className="text-zinc-400">{t('cart.total')}</span><span className="text-base font-semibold text-white">{formatPrice(cart.total)}</span></div>
              {cart.groups.length > 1 && <p className="text-xs text-zinc-500">{t('cart.perShopNote')}</p>}
              <p className="text-xs text-zinc-500">{t('cart.priceNote')}</p>
              {currency !== 'XAF' && <p className="text-xs text-amber-500/90">{t('currency.note')}</p>}
            </div>
          </>
        )}
      </aside>
    </div>
  )
}
