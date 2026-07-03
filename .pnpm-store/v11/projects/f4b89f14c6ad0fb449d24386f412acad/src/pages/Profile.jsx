import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ImagePlus,
  LoaderCircle,
  LogOut,
  Mail,
  Phone,
  Save,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import AvatarTrigger from '../components/profile/AvatarTrigger.jsx'
import { useAuth } from '../context/auth.js'
import { useLanguage } from '../context/languageContext.js'
import userService from '../services/userService.js'
import { disconnectSocket } from '../services/socket.js'

const MAX_FILE_SIZE = 5 * 1024 * 1024
const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

function ProfileToast({ toast, onClose, t }) {
  const Icon = toast.type === 'success' ? CheckCircle2 : AlertTriangle

  return (
    <motion.div
      initial={{ opacity: 0, y: -18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.98 }}
      className={`fixed left-3 right-3 top-3 z-[70] mx-auto flex max-w-md items-center gap-3 rounded-lg border bg-white p-3 shadow-xl dark:bg-zinc-900 md:left-auto md:right-6 md:top-auto md:bottom-6 ${toast.type === 'success' ? 'border-emerald-500/40' : 'border-rose-500/40'}`}
      role="status"
    >
      <Icon aria-hidden="true" className={toast.type === 'success' ? 'text-emerald-500' : 'text-rose-500'} size={19} />
      <p className="min-w-0 flex-1 text-sm text-zinc-700 dark:text-zinc-200">{toast.message}</p>
      <button
        type="button"
        onClick={onClose}
        className="grid size-8 shrink-0 place-items-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        aria-label={t('profile.closeToast')}
        title={t('profile.closeToast')}
      >
        <X aria-hidden="true" size={16} />
      </button>
    </motion.div>
  )
}

export default function Profile() {
  const { logout, updateUser, user } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const toastTimerRef = useRef(null)
  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [toast, setToast] = useState(null)
  const [profileForm, setProfileForm] = useState({ name: user.name || '', phone: user.phone || '' })
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => () => {
    clearTimeout(toastTimerRef.current)
  }, [])

  useEffect(() => {
    setProfileForm({ name: user.name || '', phone: user.phone || '' })
  }, [user.name, user.phone])

  const showToast = (type, message) => {
    clearTimeout(toastTimerRef.current)
    setToast({ type, message })
    toastTimerRef.current = setTimeout(() => setToast(null), 4000)
  }

  const openFilePicker = () => {
    setIsActionSheetOpen(false)
    window.setTimeout(() => fileInputRef.current?.click(), 160)
  }

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    if (!ACCEPTED_TYPES.has(file.type)) {
      showToast('error', t('profile.invalidType'))
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      showToast('error', t('profile.tooLarge'))
      return
    }

    const localPreviewUrl = URL.createObjectURL(file)
    setPreviewUrl(localPreviewUrl)
    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append('avatar', file)

      const data = await userService.uploadAvatar(formData)

      if (!data?.success || !data?.avatarUrl) {
        throw new Error('INVALID_AVATAR_RESPONSE')
      }

      updateUser({ avatar: data.avatarUrl })
      showToast('success', t('profile.uploadSuccess'))
    } catch {
      showToast('error', t('profile.uploadError'))
    } finally {
      setIsUploading(false)
      setPreviewUrl(null)
      URL.revokeObjectURL(localPreviewUrl)
    }
  }

  const handleProfileChange = (event) => {
    const { name, value } = event.target
    setProfileForm((currentForm) => ({ ...currentForm, [name]: value }))
  }

  const handleProfileSubmit = async (event) => {
    event.preventDefault()
    setIsSaving(true)

    try {
      const data = await userService.updateProfile(profileForm)

      if (!data?.success || !data?.user) {
        throw new Error('INVALID_PROFILE_RESPONSE')
      }

      updateUser(data.user)
      showToast('success', t('profile.saveSuccess'))
    } catch {
      showToast('error', t('profile.saveError'))
    } finally {
      setIsSaving(false)
    }
  }

  const displayedUser = previewUrl ? { ...user, avatar: previewUrl } : user

  const handleLogout = () => {
    disconnectSocket()
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      className="mx-auto w-full max-w-5xl p-4 sm:p-6 lg:p-8"
    >
      <header className="mb-6">
        <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-100">{t('profile.title')}</h2>
        <p className="mt-1 text-sm text-zinc-500">{t('profile.subtitle')}</p>
      </header>

      <section className="grid overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 md:grid-cols-[280px_minmax(0,1fr)]">
        <div className="flex flex-col items-center justify-center border-b border-zinc-200 px-6 py-9 dark:border-zinc-800 md:border-b-0 md:border-r">
          <div className="relative">
            <AvatarTrigger className="size-32 text-2xl" user={displayedUser} />
            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={openFilePicker}
              disabled={isUploading}
              className="absolute bottom-0 right-0 hidden size-10 place-items-center rounded-full border-4 border-white bg-amber-500 text-zinc-950 shadow-lg dark:border-zinc-900 md:grid"
              aria-label={t('profile.changePhoto')}
              title={t('profile.changePhoto')}
            >
              <Camera aria-hidden="true" size={18} strokeWidth={2.1} />
            </motion.button>
            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={() => setIsActionSheetOpen(true)}
              disabled={isUploading}
              className="absolute bottom-0 right-0 grid size-10 place-items-center rounded-full border-4 border-white bg-amber-500 text-zinc-950 shadow-lg dark:border-zinc-900 md:hidden"
              aria-label={t('profile.changePhoto')}
              title={t('profile.changePhoto')}
            >
              <Camera aria-hidden="true" size={18} strokeWidth={2.1} />
            </motion.button>

            {isUploading && (
              <span className="pointer-events-none absolute -inset-2 rounded-full border-2 border-amber-500/25 border-t-amber-500 animate-spin" />
            )}
          </div>

          <h3 className="mt-5 text-base font-semibold text-zinc-950 dark:text-zinc-100">{user.name}</h3>
          <p className="mt-1 text-sm text-zinc-500">{t(`roles.${user.role}`)}</p>
          {isUploading && <p className="mt-3 text-xs font-medium text-amber-600 dark:text-amber-400">{t('profile.uploading')}</p>}
        </div>

        <div className="p-5 sm:p-7">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{t('profile.accountDetails')}</h3>
          <form onSubmit={handleProfileSubmit} className="mt-5 space-y-4">
            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-xs font-medium text-zinc-500"><UserRound aria-hidden="true" size={15} />{t('profile.fullName')}</span>
              <input required name="name" value={profileForm.name} onChange={handleProfileChange} className="field" />
            </label>
            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-xs font-medium text-zinc-500"><Phone aria-hidden="true" size={15} />{t('profile.phone')}</span>
              <input required name="phone" type="tel" value={profileForm.phone} onChange={handleProfileChange} className="field" />
            </label>
            <div className="grid gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800 sm:grid-cols-2">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-xs text-zinc-500"><Mail aria-hidden="true" size={15} />{t('profile.email')}</p>
                <p className="mt-1 truncate text-sm text-zinc-800 dark:text-zinc-200">{user.email}</p>
              </div>
              <div>
                <p className="flex items-center gap-2 text-xs text-zinc-500"><ShieldCheck aria-hidden="true" size={15} />{t('profile.role')}</p>
                <p className="mt-1 text-sm text-zinc-800 dark:text-zinc-200">{t(`roles.${user.role}`)}</p>
              </div>
            </div>
            <motion.button
              type="submit"
              whileTap={isSaving ? undefined : { scale: 0.98 }}
              disabled={isSaving}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-amber-500 px-4 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-400 disabled:opacity-60 sm:ml-auto sm:w-auto"
            >
              {isSaving ? <LoaderCircle aria-hidden="true" className="animate-spin" size={17} /> : <Save aria-hidden="true" size={17} />}
              {t(isSaving ? 'profile.saving' : 'profile.save')}
            </motion.button>
          </form>
        </div>
      </section>

      <div className="mt-4 flex justify-end">
        <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={handleLogout} className="flex h-11 w-full items-center justify-center gap-2 rounded-md border border-rose-500/25 px-4 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-500/10 dark:text-rose-400 sm:w-auto">
          <LogOut aria-hidden="true" size={17} />
          {t('common.logout')}
        </motion.button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />

      <AnimatePresence>
        {isActionSheetOpen && (
          <>
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsActionSheetOpen(false)}
              className="fixed inset-0 z-50 bg-zinc-950/65 backdrop-blur-[2px] md:hidden"
              aria-label={t('profile.cancel')}
            />
            <motion.section
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 360, damping: 34 }}
              className="fixed inset-x-0 bottom-0 z-[60] rounded-t-lg border-t border-zinc-200 bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 md:hidden"
              role="dialog"
              aria-modal="true"
              aria-label={t('profile.changePhoto')}
            >
              <span className="mx-auto mb-4 block h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-700" />
              <button
                type="button"
                onClick={openFilePicker}
                className="flex h-13 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800"
              >
                <span className="grid size-9 place-items-center rounded-full bg-amber-500/12 text-amber-600 dark:text-amber-400">
                  <ImagePlus aria-hidden="true" size={18} />
                </span>
                {t('profile.choosePhoto')}
              </button>
              <button
                type="button"
                onClick={() => setIsActionSheetOpen(false)}
                className="mt-1 h-12 w-full rounded-lg text-sm font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                {t('profile.cancel')}
              </button>
            </motion.section>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && <ProfileToast toast={toast} onClose={() => setToast(null)} t={t} />}
      </AnimatePresence>
    </motion.div>
  )
}
