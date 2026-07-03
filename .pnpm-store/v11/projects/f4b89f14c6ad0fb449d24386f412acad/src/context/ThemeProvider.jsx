import { useLayoutEffect, useMemo, useState } from 'react'
import { ThemeContext } from './themeContext.js'

const getStoredTheme = () => {
  const storedTheme = window.localStorage.getItem('last-mile-theme')
  return storedTheme === 'light' ? 'light' : 'dark'
}

export default function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getStoredTheme)

  useLayoutEffect(() => {
    const isDark = theme === 'dark'
    document.documentElement.classList.toggle('dark', isDark)
    document.documentElement.style.colorScheme = theme
    window.localStorage.setItem('last-mile-theme', theme)
  }, [theme])

  const value = useMemo(() => ({
    isDark: theme === 'dark',
    theme,
    toggleTheme: () => setTheme((current) => current === 'dark' ? 'light' : 'dark'),
  }), [theme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
