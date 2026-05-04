'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, ClipboardList, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'

const STATUS_BADGE: Record<string, string> = {
  DRAFT:                           'bg-gray-50 text-gray-600 border-gray-200',
  IN_PREPARATION:                  'bg-blue-50 text-blue-700 border-blue-200',
  WAITING_DEPENDENCIES:            'bg-yellow-50 text-yellow-700 border-yellow-200',
  REGISTRATION_OPEN:               'bg-green-50 text-green-700 border-green-200',
  REGISTRATION_CLOSED:             'bg-orange-50 text-orange-700 border-orange-200',
  READY_FOR_EVENT_CREATION:        'bg-purple-50 text-purple-700 border-purple-200',
  WAITING_EVENT_CREATION_APPROVAL: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  EVENT_CREATED:                   'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLED:                       'bg-red-50 text-red-700 border-red-200',
}

const FILTERS = [
  { labelKey: 'common.all', value: '' },
  { labelKey: 'pages.draft', value: 'DRAFT' },
  { labelKey: 'pages.inPreparation', value: 'IN_PREPARATION' },
  { labelKey: 'pages.registrationOpen', value: 'REGISTRATION_OPEN' },
  { labelKey: 'pages.ready', value: 'READY_FOR_EVENT_CREATION' },
  { labelKey: 'common.cancelled', value: 'CANCELLED' },
]

export default function OrganizerPlansPage() {
  const { t } = useI18n()
  const [plans, setPlans] = useState<any[]>([])
  const [filtered, setFiltered] = useState<any[]>([])
  const [activeFilter, setActiveFilter] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
        const res = await fetch(`${backendUrl}/event-plans`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        })
        if (res.ok) {
          const data = await res.json()
          setPlans(data)
          setFiltered(data)
        }
      } catch {
        toast.error(t('pages.plansLoadFail'))
      } finally {
        setIsLoading(false)
      }
    }
    fetchPlans()
  }, [t])

  useEffect(() => {
    if (!activeFilter) {
      setFiltered(plans)
    } else {
      setFiltered(plans.filter((p) => p.status === activeFilter))
    }
  }, [activeFilter, plans])

  if (isLoading) return (
    <div className="flex h-[60vh] items-center justify-center">
      <Loader2 className="size-8 animate-spin text-primary" />
    </div>
  )

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <ClipboardList className="size-5 text-primary" /> {t('nav.eventPlans')}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('pages.plansSubtitle')}</p>
        </div>
        <Link href="/organizer/plans/new">
          <Button size="sm" className="gap-2"><Plus className="size-4" /> {t('common.newPlan')}</Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setActiveFilter(f.value)}
            className={cn(
              'text-xs px-3 py-1.5 rounded-full border transition-colors',
              activeFilter === f.value
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background border-border text-muted-foreground hover:bg-muted/50',
            )}
          >
            {t(f.labelKey)}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 flex flex-col items-center text-center opacity-50">
            <AlertCircle className="size-10 mb-3" />
            <p className="text-sm font-medium">{t('pages.noPlans')}</p>
            <p className="text-xs text-muted-foreground mt-1">{t('pages.noPlansDesc')}</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((plan) => (
              <Link
                key={plan.id}
                href={`/organizer/plans/${plan.id}`}
                className="flex items-start justify-between px-5 py-4 hover:bg-muted/30 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{plan.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {plan.eventType}
                    {plan.tentativeStartAt && ` · ${new Date(plan.tentativeStartAt).toLocaleDateString()}`}
                    {' · '}{t('pages.preregShort', { count: plan.preRegistrationCount, minimum: plan.minimumAttendance })}
                  </p>
                </div>
                <span className={cn(
                  'text-xs font-semibold px-2 py-0.5 rounded-full border ml-4 shrink-0',
                  STATUS_BADGE[plan.status] ?? STATUS_BADGE.DRAFT,
                )}>
                  {plan.status?.replace(/_/g, ' ')}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
