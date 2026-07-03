const API_BASE_URL = import.meta.env.VITE_API_URL?.trim() || '/'

const getApiOrigin = () => {
  try {
    return new URL(API_BASE_URL, globalThis.location?.origin).origin
  } catch {
    return globalThis.location?.origin || ''
  }
}

export function resolveAvatarUrl(avatar) {
  if (!avatar || typeof avatar !== 'string') {
    return null
  }

  if (/^(https?:|blob:|data:)/i.test(avatar)) {
    return avatar
  }

  return `${getApiOrigin()}${avatar.startsWith('/') ? avatar : `/${avatar}`}`
}
