const TOKEN_KEY = 'token'

const getStorage = (name) => {
  try {
    return globalThis[name]
  } catch {
    return null
  }
}

const readToken = (storage) => {
  try {
    return storage?.getItem(TOKEN_KEY) || null
  } catch {
    return null
  }
}

const removeToken = (storage) => {
  try {
    storage?.removeItem(TOKEN_KEY)
  } catch {
    return
  }
}

export const getAuthToken = () => (
  readToken(getStorage('localStorage'))
  || readToken(getStorage('sessionStorage'))
)

export const persistAuthToken = (token, rememberMe = false) => {
  const local = getStorage('localStorage')
  const session = getStorage('sessionStorage')
  const selectedStorage = rememberMe ? local : session
  const otherStorage = rememberMe ? session : local

  removeToken(otherStorage)

  try {
    selectedStorage?.setItem(TOKEN_KEY, token)
  } catch {
    return false
  }

  return true
}

export const clearAuthToken = () => {
  removeToken(getStorage('localStorage'))
  removeToken(getStorage('sessionStorage'))
}
