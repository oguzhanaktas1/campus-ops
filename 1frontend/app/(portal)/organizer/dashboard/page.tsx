'use client'

import Link from 'next/link'
import { ClipboardList, PartyPopper, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'

export default function OrganizerDashboardPage() {
  const { t } = useI18n()

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold">{t('dashboard.title')}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{t('dashboard.subtitle')}</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Link href="/organizer/plans" className="bg-card border border-border rounded-xl p-5 hover:bg-muted/30 transition-colors flex items-start gap-4">
          <div className="p-2 rounded-lg bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
            <ClipboardList className="size-5" />
          </div>
          <div>
            <p className="font-semibold text-sm">{t('nav.eventPlans')}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t('dashboard.eventPlansDesc')}</p>
          </div>
        </Link>

        <Link href="/organizer/events" className="bg-card border border-border rounded-xl p-5 hover:bg-muted/30 transition-colors flex items-start gap-4">
          <div className="p-2 rounded-lg bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            <PartyPopper className="size-5" />
          </div>
          <div>
            <p className="font-semibold text-sm">{t('nav.publishedEvents')}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t('dashboard.publishedEventsDesc')}</p>
          </div>
        </Link>
      </div>

      <div className="flex justify-start">
        <Link href="/organizer/plans/new">
          <Button className="gap-2"><Plus className="size-4" /> {t('dashboard.newEventPlan')}</Button>
        </Link>
      </div>
    </div>
  )
}
