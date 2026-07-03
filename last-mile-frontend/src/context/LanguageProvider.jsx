import { useCallback, useEffect, useMemo, useState } from 'react'
import translations from '../i18n/translations.js'
import { LanguageContext } from './languageContext.js'

const SUPPORTED_LANGUAGES = new Set(['en', 'fr'])

const getStoredLanguage = () => {
  const storedLanguage = window.localStorage.getItem('last-mile-language')
  return SUPPORTED_LANGUAGES.has(storedLanguage) ? storedLanguage : 'en'
}

const getNestedValue = (source, key) => {
  return key.split('.').reduce((value, segment) => value?.[segment], source)
}

const interpolate = (value, variables) => {
  return value.replace(/\{\{(\w+)\}\}/g, (_, key) => String(variables[key] ?? ''))
}

export default function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(getStoredLanguage)

  useEffect(() => {
    document.documentElement.lang = language
    document.title = translations[language].common.pageTitle
    window.localStorage.setItem('last-mile-language', language)
  }, [language])

  const setLanguage = useCallback((nextLanguage) => {
    if (SUPPORTED_LANGUAGES.has(nextLanguage)) {
      setLanguageState(nextLanguage)
    }
  }, [])

  const t = useCallback((key, variables = {}) => {
    const translatedValue = getNestedValue(translations[language], key)
      ?? getNestedValue(translations.en, key)
      ?? key

    return typeof translatedValue === 'string'
      ? interpolate(translatedValue, variables)
      : key
  }, [language])

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}
