'use client'

import { I18nProvider } from '@/lib/i18n'
import enFaculty from '@/locales/en/faculty'
import trFaculty from '@/locales/tr/faculty'

const translations = { en: enFaculty as any, tr: trFaculty as any }

export function FacultyI18nProvider({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider translations={translations} defaultLocale="tr">
      {children}
    </I18nProvider>
  )
}
