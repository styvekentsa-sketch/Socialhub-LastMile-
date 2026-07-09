let deferredInstallPrompt = null
let installed = typeof window !== 'undefined'
  && (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true)
const listeners = new Set()

const notifyListeners = () => {
  listeners.forEach((listener) => listener({
    canPrompt: Boolean(deferredInstallPrompt),
    isInstalled: installed,
  }))
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredInstallPrompt = event
    notifyListeners()
  })

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null
    installed = true
    notifyListeners()
  })
}

export const getPwaInstallState = () => ({
  canPrompt: Boolean(deferredInstallPrompt),
  isInstalled: installed,
})

export const subscribeToPwaInstall = (listener) => {
  listeners.add(listener)
  listener(getPwaInstallState())
  return () => listeners.delete(listener)
}

export const requestPwaInstall = async () => {
  if (!deferredInstallPrompt) {
    return 'unavailable'
  }

  const prompt = deferredInstallPrompt
  await prompt.prompt()
  const choice = await prompt.userChoice

  if (choice.outcome === 'accepted') {
    deferredInstallPrompt = null
  }

  notifyListeners()
  return choice.outcome
}
