import { resolveAvatarUrl } from '../../utils/avatar.js'

const getInitials = (name = '') => name
  .trim()
  .split(/\s+/)
  .filter(Boolean)
  .map((part) => part[0])
  .join('')
  .slice(0, 2)
  .toUpperCase() || 'U'

export default function UserAvatar({ className = 'size-8', user, ...props }) {
  const avatarUrl = resolveAvatarUrl(user?.avatar)

  return (
    <span
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full border border-zinc-300 bg-amber-500/10 text-xs font-semibold text-amber-700 dark:border-zinc-700 dark:text-amber-300 ${className}`}
      {...props}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
      ) : getInitials(user?.name)}
    </span>
  )
}
