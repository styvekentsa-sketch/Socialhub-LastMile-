export const DATA_SYNC_EVENT = 'last-mile:data-sync'

export const notifyDataChanged = (scope = 'all', source = 'local') => {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(new CustomEvent(DATA_SYNC_EVENT, {
    detail: { scope, source, timestamp: Date.now() },
  }))
}

export const getSyncScopeFromUrl = (url = '') => {
  if (/\/api\/(?:auth|drivers\/location)(?:\/|$)/.test(url)) {
    return null
  }

  if (/\/api\/products(?:\/|$)/.test(url)) {
    return 'products'
  }

  if (/\/api\/(?:orders|tracking|drivers)(?:\/|$)/.test(url)) {
    return 'orders'
  }

  if (/\/api\/users(?:\/|$)/.test(url)) {
    return 'profile'
  }

  if (/\/api\/public\/checkout(?:\/|$)/.test(url)) {
    return 'orders'
  }

  return null
}
