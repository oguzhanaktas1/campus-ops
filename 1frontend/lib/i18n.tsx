'use client'

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'

export type Locale = 'tr' | 'en'

type NestedTranslations = { [key: string]: string | NestedTranslations }

interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, params?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

const STORAGE_KEY = 'campusops-locale'

function getNestedValue(obj: NestedTranslations, path: string): string | undefined {
  const parts = path.split('.')
  let current: string | NestedTranslations = obj
  for (const part of parts) {
    if (typeof current !== 'object' || current === null) return undefined
    current = current[part]
  }
  return typeof current === 'string' ? current : undefined
}

function interpolate(str: string, params?: Record<string, string | number>): string {
  if (!params) return str
  return str.replace(/\{\{(\w+)\}\}/g, (_, key) => String(params[key] ?? `{{${key}}}`))
}

interface I18nProviderProps {
  children: React.ReactNode
  translations: Record<Locale, NestedTranslations>
  defaultLocale?: Locale
}

export function I18nProvider({ children, translations, defaultLocale = 'tr' }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY) as Locale | null
      if (stored === 'tr' || stored === 'en') return stored
    }
    return defaultLocale
  })

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, next)
    }
  }, [])

  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    const dict = translations[locale]
    const value = getNestedValue(dict, key)
    if (value !== undefined) return interpolate(value, params)
    const fallback = getNestedValue(translations['en'], key)
    if (fallback !== undefined) return interpolate(fallback, params)
    return key
  }, [locale, translations])

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}

export function useOptionalI18n(): I18nContextValue | null {
  return useContext(I18nContext)
}
