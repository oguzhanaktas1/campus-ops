'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PlusCircle, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/status-badge'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'

const FILTERS = [
  { labelKey: 'common.all',              value: '' },
  { labelKey: 'pages.draft',             value: 'DRAFT' },
  { labelKey: 'pages.inPreparation',     value: 'IN_PREPARATION' },
  { labelKey: 'pages.registrationOpen',  value: 'REGISTRATION_OPEN' },
  { labelKey: 'pages.ready',             value: 'READY_FOR_EVENT_CREATION' },
  { labelKey: 'common.cancelled',        value: 'CANCELLED' },
]

export default function OrganizerPlansPage() {
  const { t } = useI18n()
  const [plans, setPlans] = useState<any[]>([])
  const [activeFilter, setActiveFilter] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const res = await fetch(`${BACKEND}/event-plans`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        })
        if (res.ok) setPlans(await res.json())
      } catch {
        toast.error(t('pages.plansLoadFail'))
      } finally {
        setIsLoading(false)
      }
    }
    fetchPlans()
  }, [t])

  const filtered = activeFilter ? plans.filter((p) => p.status === activeFilter) : plans

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5 pb-20">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">{t('nav.eventPlans')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('pages.plansSubtitle')}</p>
        </div>
        <Link href="/organizer/plans/new" className="shrink-0">
          <Button size="sm" className="gap-1.5">
            <PlusCircle className="size-3.5" />
            {t('common.newPlan')}
          </Button>
        </Link>
      </div>

      <div className="flex flex-wrap gap-1 bg-muted/50 p-1 rounded-lg border border-border w-fit">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setActiveFilter(f.value)}
            className={cn(
              'px-3 py-1 text-sm font-medium rounded-md transition-all',
              activeFilter === f.value
                ? 'bg-background text-foreground shadow-sm ring-1 ring-border'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted',
            )}
          >
            {t(f.labelKey)}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center py-16">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <AlertCircle className="size-8 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-foreground">{t('pages.noPlans')}</p>
            <p className="text-xs text-muted-foreground mt-1">{t('pages.noPlansDesc')}</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((plan) => (
              <Link
                key={plan.id}
                href={`/organizer/plans/${plan.id}`}
                className="flex items-start justify-between gap-4 px-5 py-4 hover:bg-muted/30 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">{plan.title}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                    {plan.eventType && <span>{plan.eventType}</span>}
                    {plan.tentativeStartAt && <span>{new Date(plan.tentativeStartAt).toLocaleDateString()}</span>}
                    {plan.preRegistrationCount != null && (
                      <span>{t('pages.preregShort', { count: plan.preRegistrationCount, minimum: plan.minimumAttendance })}</span>
                    )}
                  </div>
                </div>
                <StatusBadge status={plan.status} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
