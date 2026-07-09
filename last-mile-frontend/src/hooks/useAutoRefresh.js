import { useEffect, useRef } from 'react'
import { DATA_SYNC_EVENT } from '../services/dataSync.js'

const AUTO_REFRESH_INTERVAL_MS = 30000
const REFRESH_DEBOUNCE_MS = 180

export default function useAutoRefresh(refresh, scopes = ['all']) {
  const refreshRef = useRef(refresh)
  const scopesKey = scopes.join('|')

  useEffect(() => {
    refreshRef.current = refresh
  }, [refresh])

  useEffect(() => {
    let timeoutId
    let isRefreshing = false
    let refreshQueued = false
    const acceptedScopes = new Set(scopesKey.split('|'))

    const executeRefresh = async () => {
      if (isRefreshing) {
        refreshQueued = true
        return
      }

      isRefreshing = true

      try {
        await refreshRef.current()
      } catch {
        // Each screen keeps ownership of its visible error state.
      } finally {
        isRefreshing = false

        if (refreshQueued) {
          refreshQueued = false
          executeRefresh()
        }
      }
    }

    const scheduleRefresh = (event) => {
      if (document.visibilityState === 'hidden') {
        return
      }

      const eventScope = event?.detail?.scope

      if (
        event?.type === DATA_SYNC_EVENT
        && !acceptedScopes.has('all')
        && eventScope !== 'all'
        && !acceptedScopes.has(eventScope)
      ) {
        return
      }

      window.clearTimeout(timeoutId)
      timeoutId = window.setTimeout(executeRefresh, REFRESH_DEBOUNCE_MS)
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        scheduleRefresh()
      }
    }

    const intervalId = window.setInterval(scheduleRefresh, AUTO_REFRESH_INTERVAL_MS)
    window.addEventListener(DATA_SYNC_EVENT, scheduleRefresh)
    window.addEventListener('focus', scheduleRefresh)
    window.addEventListener('online', scheduleRefresh)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.clearInterval(intervalId)
      window.clearTimeout(timeoutId)
      window.removeEventListener(DATA_SYNC_EVENT, scheduleRefresh)
      window.removeEventListener('focus', scheduleRefresh)
      window.removeEventListener('online', scheduleRefresh)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [scopesKey])
}
