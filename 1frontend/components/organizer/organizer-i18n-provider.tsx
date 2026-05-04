'use client'

import { I18nProvider } from '@/lib/i18n'
import enOrganizer from '@/locales/en/organizer'
import trOrganizer from '@/locales/tr/organizer'

const translations = { en: enOrganizer, tr: trOrganizer }

export function OrganizerI18nProvider({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider translations={translations} defaultLocale="tr">
      {children}
    </I18nProvider>
  )
}
