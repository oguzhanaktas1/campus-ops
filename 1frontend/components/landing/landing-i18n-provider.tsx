'use client'

import { I18nProvider } from '@/lib/i18n'
import enLanding from '@/locales/en/landing'
import trLanding from '@/locales/tr/landing'

const translations = { en: enLanding, tr: trLanding }

export function LandingI18nProvider({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider translations={translations} defaultLocale="tr">
      {children}
    </I18nProvider>
  )
}
