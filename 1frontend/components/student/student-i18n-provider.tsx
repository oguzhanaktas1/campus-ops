'use client'

import { I18nProvider, type Locale } from '@/lib/i18n'
import enStudent from '@/locales/en/student'
import trStudent from '@/locales/tr/student'

type NestedTranslations = { [key: string]: string | NestedTranslations }
const translations = { en: enStudent, tr: trStudent } as unknown as Record<Locale, NestedTranslations>

export function StudentI18nProvider({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider translations={translations} defaultLocale="tr">
      {children}
    </I18nProvider>
  )
}
