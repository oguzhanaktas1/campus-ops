'use client'

import { I18nProvider } from '@/lib/i18n'
import enStaff from '@/locales/en/staff'
import trStaff from '@/locales/tr/staff'

const translations = { en: enStaff, tr: trStaff }

export function StaffI18nProvider({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider translations={translations} defaultLocale="tr">
      {children}
    </I18nProvider>
  )
}
