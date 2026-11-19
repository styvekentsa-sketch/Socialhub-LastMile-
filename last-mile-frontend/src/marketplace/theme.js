// Theme du portail public : clair par defaut, sombre au choix du visiteur.
// Independant du theme de l'espace prive (Admin, Marchand, Livreur), qui garde son propre reglage.
const THEME_KEY = 'mk_theme'

export const readMarketplaceTheme = () => {
  try {
    return window.localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export const saveMarketplaceTheme = (theme) => {
  try {
    window.localStorage.setItem(THEME_KEY, theme === 'dark' ? 'dark' : 'light')
  } catch {
    // Stockage indisponible : le theme reste valable pour la session en cours
  }
}
