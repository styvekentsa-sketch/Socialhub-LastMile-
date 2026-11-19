import { CircleCheck, MapPin, Moon, Sun, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useCart } from '../cart/cartContext.js'
import { useCompare, useCurrency, usePreferences, useWishlist } from '../collections/collectionsContext.js'
import { DELIVERY_ZONES } from '../constants.js'
import { CURRENCIES, CURRENCY_CODES } from '../currency/currencyConfig.js'
import { useMarketplaceText } from '../i18n.js'

const segmentClass = (isActive) => `inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-md text-sm transition-colors ${isActive ? 'bg-zinc-800 font-semibold text-white' : 'text-zinc-400 hover:text-white'}`

/**
 * Preferences de navigation de l'acheteur (stockees dans ce navigateur uniquement) :
 * theme, devise, quartier de livraison par defaut et effacement des donnees locales.
 */
export default function PreferencesDrawer({ isOpen, onClose, theme, onThemeChange }) {
  const { t } = useMarketplaceText()
  const { currency, setCurrency } = useCurrency()
  const preferences = usePreferences()
  const cart = useCart()
  const wishlist = useWishlist()
  const compare = useCompare()
  const closeRef = useRef(null)
  const [clearStep, setClearStep] = useState('idle') // idle | confirm | done

  useEffect(() => {
    if (!isOpen) return undefined
    closeRef.current?.focus()
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const stored = [
    [t('prefs.dataCart'), cart.count],
    [t('prefs.dataWishlist'), wishlist.count],
    [t('prefs.dataCompare'), compare.count],
    [t('prefs.dataSearches'), preferences.recentSearches.length],
  ]
  const hasData = stored.some(([, count]) => count > 0)

  const clearLocalData = () => {
    cart.clearAll()
    wishlist.clear()
    compare.clear()
    preferences.clearRecentSearches()
    setClearStep('done')
  }

  return (
    <div className="fixed inset-0 z-[70]">
      <button type="button" tabIndex={-1} onClick={onClose} className="absolute inset-0 bg-black/70" aria-label={t('prefs.close')} />
      <aside role="dialog" aria-modal="true" aria-labelledby="mk-prefs-title" className="absolute inset-y-0 right-0 flex w-full max-w-sm flex-col border-l border-zinc-800 bg-[var(--mk-bg)]">
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-zinc-800 px-6">
          <div>
            <h2 id="mk-prefs-title" className="text-base font-semibold text-white">{t('prefs.title')}</h2>
            <p className="text-xs text-zinc-500">{t('prefs.subtitle')}</p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} className="grid size-9 place-items-center rounded-lg border border-zinc-800 text-zinc-400 hover:text-white" aria-label={t('prefs.close')}>
            <X aria-hidden="true" size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-8 overflow-y-auto px-6 py-6">
          <section aria-labelledby="mk-prefs-theme">
            <h3 id="mk-prefs-theme" className="text-sm font-semibold text-white">{t('prefs.theme')}</h3>
            <div role="radiogroup" aria-labelledby="mk-prefs-theme" className="mt-3 flex gap-1 rounded-lg border border-zinc-800 p-1">
              {[['light', Sun, 'prefs.light'], ['dark', Moon, 'prefs.dark']].map(([value, Icon, label]) => (
                <button key={value} type="button" role="radio" aria-checked={theme === value} onClick={() => onThemeChange(value)} className={segmentClass(theme === value)}>
                  <Icon aria-hidden="true" size={15} />{t(label)}
                </button>
              ))}
            </div>
          </section>

          <section aria-labelledby="mk-prefs-currency">
            <h3 id="mk-prefs-currency" className="text-sm font-semibold text-white">{t('currency.label')}</h3>
            <div role="radiogroup" aria-labelledby="mk-prefs-currency" className="mt-3 flex gap-1 rounded-lg border border-zinc-800 p-1">
              {CURRENCY_CODES.map((code) => (
                <button key={code} type="button" role="radio" aria-checked={currency === code} onClick={() => setCurrency(code)} className={segmentClass(currency === code)}>
                  {CURRENCIES[code].label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-zinc-500">{t('currency.note')}</p>
          </section>

          <section aria-labelledby="mk-prefs-zone">
            <h3 id="mk-prefs-zone" className="flex items-center gap-2 text-sm font-semibold text-white"><MapPin aria-hidden="true" size={15} />{t('prefs.zone')}</h3>
            <label className="mt-3 block">
              <span className="sr-only">{t('prefs.zone')}</span>
              <select value={preferences.deliveryZone} onChange={(event) => preferences.setDeliveryZone(event.target.value)} className="mk-input mk-select">
                <option value="">{t('prefs.zoneNone')}</option>
                {DELIVERY_ZONES.map((zone) => <option key={zone} value={zone}>{zone}, Douala</option>)}
              </select>
            </label>
            <p className="mt-2 text-xs text-zinc-500">{t('prefs.zoneHelp')}</p>
          </section>

          <section aria-labelledby="mk-prefs-data" className="border-t border-zinc-800 pt-6">
            <h3 id="mk-prefs-data" className="text-sm font-semibold text-white">{t('prefs.dataTitle')}</h3>
            <p className="mt-1 text-xs text-zinc-500">{t('prefs.dataHelp')}</p>
            <dl className="mt-3 divide-y divide-zinc-800 rounded-lg border border-zinc-800 text-sm">
              {stored.map(([label, count]) => (
                <div key={label} className="flex items-center justify-between px-3 py-2">
                  <dt className="text-zinc-400">{label}</dt>
                  <dd className="tabular-nums text-white">{count}</dd>
                </div>
              ))}
            </dl>
            {clearStep === 'done' && <p role="status" className="mt-3 flex items-center gap-2 text-sm text-emerald-400"><CircleCheck aria-hidden="true" size={15} />{t('prefs.cleared')}</p>}
            {clearStep === 'confirm' ? (
              <div className="mt-3 space-y-3 rounded-lg border border-rose-400/40 p-3">
                <p className="text-sm text-zinc-300">{t('prefs.clearConfirm')}</p>
                <div className="flex gap-2">
                  <button type="button" onClick={clearLocalData} className="inline-flex h-9 items-center gap-2 rounded-md bg-rose-600 px-3 text-sm font-semibold text-[#fff] hover:bg-rose-500">
                    <Trash2 aria-hidden="true" size={15} />{t('prefs.clearConfirmButton')}
                  </button>
                  <button type="button" onClick={() => setClearStep('idle')} className="h-9 rounded-md px-3 text-sm text-zinc-400 hover:text-white">{t('prefs.cancel')}</button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setClearStep('confirm')}
                disabled={!hasData}
                className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-rose-400/40 text-sm font-semibold text-rose-400 transition-colors hover:border-rose-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 aria-hidden="true" size={15} />{t('prefs.clear')}
              </button>
            )}
          </section>
        </div>
        <p className="shrink-0 border-t border-zinc-800 px-6 py-4 text-xs text-zinc-500">{t('prefs.privacyNote')}</p>
      </aside>
    </div>
  )
}
