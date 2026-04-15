'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import type { Locale } from '@/lib/i18n'
import {
  getSavedLocale,
  cookieSet,
  setGoogleTransCookie,
  clearGoogleTransCookie,
  LANG_COOKIE,
} from '@/lib/i18n'

interface LanguageContextValue {
  locale: Locale
  /** Dili değiştirir — Google Translate cookie'sini set edip sayfayı yeniler */
  switchLocale: (locale: Locale) => void
}

const LanguageContext = createContext<LanguageContextValue>({
  locale: 'en',
  switchLocale: () => {},
})

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>('en')

  useEffect(() => {
    setLocale(getSavedLocale())
  }, [])

  const switchLocale = (next: Locale) => {
    // Tercih cookie'sini kaydet
    cookieSet(LANG_COOKIE, next)

    if (next === 'tr') {
      setGoogleTransCookie('en', 'tr')
    } else {
      clearGoogleTransCookie()
    }

    // Google Translate cookie'yi sayfanın yeniden yüklenmesiyle uygular
    window.location.reload()
  }

  return (
    <LanguageContext.Provider value={{ locale, switchLocale }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
