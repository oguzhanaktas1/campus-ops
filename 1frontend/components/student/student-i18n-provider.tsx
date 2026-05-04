'use client'

import { I18nProvider } from '@/lib/i18n'
import enStudent from '@/locales/en/student'
import trStudent from '@/locales/tr/student'

const translations = { en: enStudent, tr: trStudent }

export function StudentI18nProvider({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider translations={translations} defaultLocale="tr">
      {children}
    </I18nProvider>
  )
}
