// Acces protege au localStorage du portail : le stockage peut etre indisponible
// (navigation privee, donnees bloquees). Commodites par visiteur uniquement.
export const readStored = (key, fallback) => {
  try {
    const raw = window.localStorage.getItem(key)
    return raw === null ? fallback : JSON.parse(raw)
  } catch {
    return fallback
  }
}

export const writeStored = (key, value) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Stockage indisponible : la valeur reste valable pour la session en cours
  }
}
