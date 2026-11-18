import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle,
  Check,
  Eye,
  EyeOff,
  LoaderCircle,
  Lock,
  Pencil,
  Plus,
  Share2,
  Trash2,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { SOCIAL_PLATFORM_NAMES, SOCIAL_PLATFORMS } from '../components/social/socialPlatforms.js'
import { useAuth } from '../context/auth.js'
import { useLanguage } from '../context/languageContext.js'
import { getApiErrorMessage } from '../services/api.js'
import socialChannelService from '../services/socialChannelService.js'

// « Mes réseaux » : canaux de publication propres au marchand (WhatsApp/Whapi, Telegram, Facebook, Instagram, LinkedIn).
// Les jetons ne sont jamais réaffichés en clair : l'API renvoie des valeurs masquées (••••••••3BGUV).

const emptyForm = (platform = 'whatsapp') => ({ id: null, platform, channel_name: '', credentials: {}, auto_publish: true, is_active: true })

function SocialToast({ toast, onClose, t }) {
  const isSuccess = toast.type === 'success'

  return (
    <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className={`fixed left-3 right-3 top-3 z-[80] mx-auto flex max-w-md items-center gap-3 rounded-lg border bg-white p-3 shadow-xl dark:bg-zinc-900 md:left-auto md:right-6 md:top-auto md:bottom-6 ${isSuccess ? 'border-emerald-500/35' : 'border-rose-500/35'}`} role="status">
      {isSuccess ? <Check aria-hidden="true" className="text-emerald-500" size={18} /> : <AlertTriangle aria-hidden="true" className="text-rose-500" size={18} />}
      <p className="min-w-0 flex-1 text-sm text-zinc-700 dark:text-zinc-200">{toast.message}</p>
      <button type="button" onClick={onClose} className="grid size-8 place-items-center rounded-md text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label={t('common.close')}><X aria-hidden="true" size={16} /></button>
    </motion.div>
  )
}

// Interrupteur accessible (role="switch")
function Switch({ checked, disabled, label, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${checked ? 'bg-amber-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}
    >
      <span className={`inline-block size-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-[18px]' : 'translate-x-[2px]'}`} />
    </button>
  )
}

function SecretInput({ field, value, onChange, isEditing, maskedValue, t }) {
  const [isVisible, setIsVisible] = useState(false)

  return (
    <div className="relative">
      <input
        name={field.name}
        type={isVisible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={isEditing && maskedValue ? maskedValue : field.placeholder}
        autoComplete="off"
        spellCheck="false"
        className="field pr-10 font-mono"
      />
      <button type="button" onClick={() => setIsVisible((visible) => !visible)} className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200" aria-label={t(isVisible ? 'socialChannels.hideSecret' : 'socialChannels.showSecret')}>
        {isVisible ? <EyeOff aria-hidden="true" size={15} /> : <Eye aria-hidden="true" size={15} />}
      </button>
    </div>
  )
}

function ChannelFormDrawer({ editingChannel, error, isSubmitting, onClose, onSubmit, t }) {
  const isEditing = Boolean(editingChannel)
  const [form, setForm] = useState(() => (isEditing
    ? { ...emptyForm(editingChannel.platform), id: editingChannel.id, channel_name: editingChannel.channel_name, auto_publish: editingChannel.auto_publish, is_active: editingChannel.is_active }
    : emptyForm()))
  const platform = SOCIAL_PLATFORMS[form.platform]

  const updateCredential = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, credentials: { ...current.credentials, [name]: value } }))
  }

  const submit = (event) => {
    event.preventDefault()
    // En modification, un champ vide n'est pas envoye : la valeur enregistree est conservee
    const credentials = Object.fromEntries(Object.entries(form.credentials).filter(([, value]) => value.trim() !== ''))
    onSubmit({
      ...(form.id ? { id: form.id } : { platform: form.platform }),
      channel_name: form.channel_name.trim(),
      credentials: isEditing
        ? { ...Object.fromEntries(platform.fields.filter((field) => !field.secret).map((field) => [field.name, editingChannel.credentials?.[field.name] || ''])), ...credentials }
        : credentials,
      auto_publish: form.auto_publish,
      is_active: form.is_active,
    })
  }

  return (
    <>
      <motion.button type="button" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-50 bg-zinc-950/72 backdrop-blur-sm" aria-label={t('common.close')} />
      <motion.section initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 340, damping: 34 }} className="fixed inset-x-0 bottom-0 z-[60] mx-auto max-h-[92dvh] max-w-2xl overflow-y-auto rounded-t-lg border border-b-0 border-zinc-200 bg-white px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950 sm:px-6" role="dialog" aria-modal="true" aria-labelledby="social-channel-title">
        <span className="mx-auto block h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-700" />
        <div className="mt-4 flex items-start justify-between gap-4">
          <div><p className="text-[10px] font-semibold uppercase text-amber-600 dark:text-amber-400">SocialHub</p><h2 id="social-channel-title" className="mt-1 text-lg font-semibold text-zinc-950 dark:text-zinc-100">{t(isEditing ? 'socialChannels.editTitle' : 'socialChannels.newTitle')}</h2></div>
          <button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-md text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900" aria-label={t('common.close')}><X aria-hidden="true" size={18} /></button>
        </div>

        <form onSubmit={submit} className="mt-5 space-y-5">
          <fieldset>
            <legend className="mb-2 block text-xs font-medium text-zinc-500">{t('socialChannels.platform')}</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {SOCIAL_PLATFORM_NAMES.map((name) => {
                const { icon: Icon, label } = SOCIAL_PLATFORMS[name]
                const isSelected = form.platform === name
                return (
                  <button
                    key={name}
                    type="button"
                    disabled={isEditing && !isSelected}
                    onClick={() => setForm((current) => ({ ...current, platform: name, credentials: {} }))}
                    aria-pressed={isSelected}
                    className={`flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-md border px-2 text-center text-xs font-medium transition-colors disabled:opacity-35 ${isSelected ? 'border-amber-500 bg-amber-500/8 text-zinc-950 dark:text-zinc-100' : 'border-zinc-200 text-zinc-600 hover:border-amber-500/60 dark:border-zinc-800 dark:text-zinc-400'}`}
                  >
                    <Icon aria-hidden="true" size={17} className={isSelected ? 'text-amber-600 dark:text-amber-400' : ''} />
                    {/* span : la regle globale « button { font: inherit } » annulerait text-xs pose sur le bouton */}
                    <span className="text-xs leading-tight">{label}</span>
                  </button>
                )
              })}
            </div>
          </fieldset>

          <label className="block">
            <span className="mb-2 block text-xs font-medium text-zinc-500">{t('socialChannels.channelName')}</span>
            <input required name="channel_name" value={form.channel_name} onChange={(event) => setForm((current) => ({ ...current, channel_name: event.target.value }))} maxLength={100} placeholder={t('socialChannels.channelNamePlaceholder')} className="field" />
          </label>

          <div className="space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <p className="flex items-center gap-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300"><Lock aria-hidden="true" size={14} className="text-amber-600 dark:text-amber-400" />{t('socialChannels.credentials')}</p>
            <p className="text-xs text-zinc-500">{t(`socialChannels.help.${form.platform}`)}</p>
            {platform.fields.map((field) => (
              <label key={`${form.platform}-${field.name}`} className="block">
                <span className="mb-1.5 block text-xs font-medium text-zinc-500">{t(`socialChannels.fields.${field.name}`)}</span>
                {field.secret
                  ? <SecretInput field={field} value={form.credentials[field.name] || ''} onChange={updateCredential} isEditing={isEditing} maskedValue={editingChannel?.credentials?.[field.name]} t={t} />
                  : <input name={field.name} value={form.credentials[field.name] ?? ''} onChange={updateCredential} placeholder={isEditing ? editingChannel.credentials?.[field.name] || field.placeholder : field.placeholder} autoComplete="off" spellCheck="false" className="field font-mono" />}
                {isEditing && <span className="mt-1 block text-[11px] text-zinc-400">{t('socialChannels.secretKeep')}</span>}
              </label>
            ))}
          </div>

          <div className="space-y-3">
            {[['is_active', 'socialChannels.active', 'socialChannels.activeHint'], ['auto_publish', 'socialChannels.autoPublish', 'socialChannels.autoPublishHint']].map(([key, labelKey, hintKey]) => (
              <div key={key} className="flex items-center justify-between gap-4">
                <div><p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{t(labelKey)}</p><p className="text-xs text-zinc-500">{t(hintKey)}</p></div>
                <Switch checked={form[key]} label={t(labelKey)} onChange={() => setForm((current) => ({ ...current, [key]: !current[key] }))} />
              </div>
            ))}
          </div>

          {error && <p className="rounded-md border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-300">{error}</p>}
          <motion.button type="submit" whileTap={isSubmitting ? undefined : { scale: 0.98 }} disabled={isSubmitting} className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-amber-500 px-4 text-sm font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-50">
            {isSubmitting ? <LoaderCircle aria-hidden="true" className="animate-spin" size={18} /> : <Check aria-hidden="true" size={18} />}
            {t(isSubmitting ? 'socialChannels.saving' : 'socialChannels.save')}
          </motion.button>
        </form>
      </motion.section>
    </>
  )
}

function ChannelCard({ channel, index, isBusy, isConfirmingDelete, onAskDelete, onCancelDelete, onDelete, onEdit, onToggle, t }) {
  const platform = SOCIAL_PLATFORMS[channel.platform]
  const Icon = platform?.icon || Share2

  return (
    <motion.article initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.035 }} className={`flex min-w-0 flex-col rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 ${channel.is_active ? '' : 'opacity-70'}`}>
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-md bg-amber-500/12 text-amber-600 dark:text-amber-400"><Icon aria-hidden="true" size={18} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase text-amber-600 dark:text-amber-400">{platform?.label || channel.platform}</p>
          <h3 className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{channel.channel_name}</h3>
        </div>
        {isConfirmingDelete ? (
          <div className="flex shrink-0">
            <button type="button" onClick={onDelete} className="grid size-8 place-items-center rounded-md text-rose-500 hover:bg-rose-500/10" aria-label={t('socialChannels.confirmDelete')}><Check aria-hidden="true" size={16} /></button>
            <button type="button" onClick={onCancelDelete} className="grid size-8 place-items-center rounded-md text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label={t('socialChannels.cancelDelete')}><X aria-hidden="true" size={16} /></button>
          </div>
        ) : (
          <div className="flex shrink-0">
            <button type="button" onClick={onEdit} className="grid size-8 place-items-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200" aria-label={t('socialChannels.edit')}><Pencil aria-hidden="true" size={15} /></button>
            <button type="button" onClick={onAskDelete} className="grid size-8 place-items-center rounded-md text-zinc-400 hover:bg-rose-500/10 hover:text-rose-500" aria-label={t('socialChannels.delete')}><Trash2 aria-hidden="true" size={15} /></button>
          </div>
        )}
      </div>

      {channel.credentials_unreadable ? (
        <p className="mt-4 flex items-start gap-2 rounded-md border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-300"><AlertTriangle aria-hidden="true" size={14} className="mt-0.5 shrink-0" />{t('socialChannels.unreadable')}</p>
      ) : (
        <dl className="mt-4 space-y-2 rounded-md bg-zinc-50 p-3 dark:bg-zinc-950">
          {(platform?.fields || []).map((field) => (
            <div key={field.name} className="flex items-center justify-between gap-3 text-xs">
              <dt className="shrink-0 text-zinc-500">{t(`socialChannels.fields.${field.name}`)}</dt>
              <dd className="truncate font-mono text-zinc-700 dark:text-zinc-300" title={field.secret ? undefined : channel.credentials?.[field.name]}>{channel.credentials?.[field.name] || '—'}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="mt-auto space-y-2.5 pt-4">
        <div className="flex items-center justify-between gap-3">
          <span className={`flex items-center gap-1.5 text-xs font-medium ${channel.is_active ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-500'}`}>
            <span className={`size-1.5 rounded-full ${channel.is_active ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
            {t(channel.is_active ? 'socialChannels.statusActive' : 'socialChannels.statusInactive')}
          </span>
          <Switch checked={channel.is_active} disabled={isBusy} label={t('socialChannels.active')} onChange={() => onToggle('is_active')} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-zinc-500">{t('socialChannels.autoPublish')}</span>
          <Switch checked={channel.auto_publish} disabled={isBusy} label={t('socialChannels.autoPublish')} onChange={() => onToggle('auto_publish')} />
        </div>
      </div>
    </motion.article>
  )
}

export default function MerchantSocialChannels() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [channels, setChannels] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [drawer, setDrawer] = useState(null) // null | { channel: null } (creation) | { channel } (modification)
  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [busyChannelId, setBusyChannelId] = useState(null)
  const [pendingDeleteId, setPendingDeleteId] = useState(null)
  const [toast, setToast] = useState(null)

  // Chargement : etat mis a jour uniquement a l'arrivee de la reponse (isLoading vaut true au depart)
  const fetchChannels = useCallback(() => socialChannelService.listChannels()
    .then((data) => {
      setChannels(Array.isArray(data?.channels) ? data.channels : [])
      setError('')
    })
    .catch((loadError) => setError(getApiErrorMessage(loadError, t('socialChannels.loadError'))))
    .finally(() => setIsLoading(false)), [t])

  useEffect(() => {
    fetchChannels()
  }, [fetchChannels])

  const retryLoad = () => {
    setIsLoading(true)
    fetchChannels()
  }

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(null), 4000)
    return () => window.clearTimeout(timer)
  }, [toast])

  if (user.role !== 'merchant') {
    return <Navigate to="/orders" replace />
  }

  const replaceChannel = (saved) => setChannels((current) => (current.some((channel) => channel.id === saved.id)
    ? current.map((channel) => (channel.id === saved.id ? saved : channel))
    : [...current, saved]))

  const saveChannel = async (payload) => {
    setIsSubmitting(true)
    setFormError('')
    try {
      replaceChannel(await socialChannelService.saveChannel(payload))
      setDrawer(null)
      setToast({ type: 'success', message: t('socialChannels.saveSuccess') })
    } catch (saveError) {
      setFormError(getApiErrorMessage(saveError, t('socialChannels.saveError')))
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleChannel = async (channel, key) => {
    setBusyChannelId(channel.id)
    try {
      replaceChannel(await socialChannelService.saveChannel({ id: channel.id, [key]: !channel[key] }))
    } catch (toggleError) {
      setToast({ type: 'error', message: getApiErrorMessage(toggleError, t('socialChannels.toggleError')) })
    } finally {
      setBusyChannelId(null)
    }
  }

  const deleteChannel = async (channelId) => {
    setBusyChannelId(channelId)
    try {
      await socialChannelService.deleteChannel(channelId)
      setChannels((current) => current.filter((channel) => channel.id !== channelId))
      setToast({ type: 'success', message: t('socialChannels.deleteSuccess') })
    } catch (deleteError) {
      setToast({ type: 'error', message: getApiErrorMessage(deleteError, t('socialChannels.deleteError')) })
    } finally {
      setPendingDeleteId(null)
      setBusyChannelId(null)
    }
  }

  const openDrawer = (channel = null) => {
    setFormError('')
    setDrawer({ channel })
  }

  return (
    <div className="mx-auto w-full max-w-[1480px] p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-100">{t('socialChannels.title')}</h2>
          <p className="mt-1 text-sm text-zinc-500">{t('socialChannels.subtitle')}</p>
        </div>
        <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={() => openDrawer()} className="flex h-10 items-center gap-2 rounded-md bg-amber-500 px-3 text-xs font-semibold text-zinc-950 hover:bg-amber-400"><Plus aria-hidden="true" size={16} />{t('socialChannels.add')}</motion.button>
      </div>

      <p className="mb-5 flex items-center gap-2 text-xs text-zinc-500"><Lock aria-hidden="true" size={13} className="text-amber-600 dark:text-amber-400" />{t('socialChannels.encrypted')}</p>

      {isLoading ? (
        <div className="grid min-h-72 place-items-center"><LoaderCircle aria-hidden="true" className="animate-spin text-amber-500" size={23} /></div>
      ) : error ? (
        <div className="grid min-h-72 place-items-center text-center"><div><AlertTriangle aria-hidden="true" className="mx-auto text-rose-500" size={23} /><p className="mt-3 text-sm text-zinc-500">{error}</p><button type="button" onClick={retryLoad} className="mt-4 text-sm font-semibold text-amber-600 dark:text-amber-400">{t('socialChannels.retry')}</button></div></div>
      ) : channels.length === 0 ? (
        <div className="grid min-h-72 place-items-center rounded-lg border border-zinc-200 bg-white px-6 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <div>
            <Share2 aria-hidden="true" className="mx-auto text-zinc-400" size={28} />
            <p className="mt-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">{t('socialChannels.empty')}</p>
            <p className="mt-1 max-w-md text-sm text-zinc-500">{t('socialChannels.emptyHint')}</p>
            <button type="button" onClick={() => openDrawer()} className="mt-5 inline-flex h-10 items-center gap-2 rounded-md bg-amber-500 px-3 text-xs font-semibold text-zinc-950 hover:bg-amber-400"><Plus aria-hidden="true" size={16} />{t('socialChannels.add')}</button>
          </div>
        </div>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {channels.map((channel, index) => (
            <ChannelCard
              key={channel.id}
              channel={channel}
              index={index}
              isBusy={busyChannelId === channel.id}
              isConfirmingDelete={pendingDeleteId === channel.id}
              onAskDelete={() => setPendingDeleteId(channel.id)}
              onCancelDelete={() => setPendingDeleteId(null)}
              onDelete={() => deleteChannel(channel.id)}
              onEdit={() => openDrawer(channel)}
              onToggle={(key) => toggleChannel(channel, key)}
              t={t}
            />
          ))}
        </section>
      )}

      <AnimatePresence>
        {drawer && (
          <ChannelFormDrawer
            key={drawer.channel?.id ?? 'new'}
            editingChannel={drawer.channel}
            error={formError}
            isSubmitting={isSubmitting}
            onClose={() => setDrawer(null)}
            onSubmit={saveChannel}
            t={t}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>{toast && <SocialToast toast={toast} onClose={() => setToast(null)} t={t} />}</AnimatePresence>
    </div>
  )
}
