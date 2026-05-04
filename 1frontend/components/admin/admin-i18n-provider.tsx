'use client'

import { I18nProvider } from '@/lib/i18n'
import enAdmin from '@/locales/en/admin'
import trAdmin from '@/locales/tr/admin'

const translations = { en: enAdmin as any, tr: trAdmin as any }

export function AdminI18nProvider({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider translations={translations} defaultLocale="tr">
      {children}
    </I18nProvider>
  )
}
