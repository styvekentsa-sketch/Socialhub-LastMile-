import { createContext, useContext } from 'react'

export const AvatarViewerContext = createContext(null)

export function useAvatarViewer() {
  const context = useContext(AvatarViewerContext)

  if (!context) {
    throw new Error('useAvatarViewer doit être utilisé dans AvatarViewerProvider.')
  }

  return context
}
