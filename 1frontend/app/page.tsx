import type { Metadata } from 'next'
import { LandingI18nProvider } from '@/components/landing/landing-i18n-provider'
import { HomeLanding } from '@/components/landing/home-landing'

export const metadata: Metadata = {
  title: 'CampusFlow - Smart Campus Operations Platform',
  description:
    'CampusFlow is the all-in-one operations platform for universities. Manage student requests, faculty approvals, IT tickets, room reservations, and procurement workflows all in one place.',
  alternates: {
    canonical: '/',
  },
}

export default function HomePage() {
  return (
    <LandingI18nProvider>
      <HomeLanding />
    </LandingI18nProvider>
  )
}
