import { motion } from 'framer-motion'
import { useLanguage } from '../../context/languageContext.js'
import { useAvatarViewer } from '../../context/avatarViewerContext.js'
import UserAvatar from './UserAvatar.jsx'

export default function AvatarTrigger({ className = 'size-8', inspect = false, user }) {
  const { t } = useLanguage()
  const { openAvatar } = useAvatarViewer()

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.94 }}
      onClick={() => openAvatar(user, { inspect })}
      className="shrink-0 rounded-full"
      aria-label={t('avatarViewer.open', { name: user?.name || '' })}
      title={t('avatarViewer.open', { name: user?.name || '' })}
    >
      <UserAvatar className={className} user={user} />
    </motion.button>
  )
}
