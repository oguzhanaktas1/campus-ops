'use client'

import { I18nProvider } from '@/lib/i18n'
import enAuth from '@/locales/en/auth'
import trAuth from '@/locales/tr/auth'

const translations = { en: enAuth, tr: trAuth }

export function AuthI18nProvider({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider translations={translations} defaultLocale="tr">
      {children}
    </I18nProvider>
  )
}
