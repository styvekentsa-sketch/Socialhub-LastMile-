import { useEffect } from 'react'

/**
 * Titre de l'onglet pour une page du portail.
 * LanguageProvider (parent) ecrit son propre titre apres le rendu des pages : on applique donc le notre
 * au tour suivant. A la sortie de la page, le titre precedent est retabli (espace prive inchange).
 */
export default function usePageTitle(title) {
  useEffect(() => {
    const previousTitle = document.title
    const timer = window.setTimeout(() => { document.title = title }, 0)

    return () => {
      window.clearTimeout(timer)
      document.title = previousTitle
    }
  }, [title])
}
