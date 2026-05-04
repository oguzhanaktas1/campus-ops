'use client'

import { useState } from 'react'
import { StatusBadge, PriorityBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Wrench, Clock, MapPin, User, CheckCircle2, AlertCircle, Circle, Plus } from 'lucide-react'
import { useI18n } from '@/lib/i18n'

type MaintenanceStatus = 'open' | 'in_progress' | 'completed'

const MOCK_MAINTENANCE = [
  {
    id: 'mnt-1',
    title: 'Projector Lamp Replacement – Hall A1',
    location: 'Lecture Hall A1, Building A',
    priority: 'high' as const,
    status: 'completed' as MaintenanceStatus,
    reportedBy: 'Dr. Sarah Mitchell',
    reportedAt: '2024-11-01T09:00:00Z',
    completedAt: '2024-11-03T16:00:00Z',
    technician: 'Marcus Thompson',
    notes: 'Lamp replaced, image quality restored.',
  },
  {
    id: 'mnt-2',
    title: 'HVAC Failure – Room C201',
    location: 'Room C201, Building C',
    priority: 'urgent' as const,
    status: 'in_progress' as MaintenanceStatus,
    reportedBy: 'Prof. James Carter',
    reportedAt: '2024-11-12T08:00:00Z',
    technician: 'Marcus Thompson',
  },
  {
    id: 'mnt-3',
    title: 'Broken Door Lock – Lab D104',
    location: 'Lab D104, Building D',
    priority: 'medium' as const,
    status: 'open' as MaintenanceStatus,
    reportedBy: 'Linda Brooks',
    reportedAt: '2024-11-13T11:00:00Z',
  },
  {
    id: 'mnt-4',
    title: 'Leaking Ceiling – Office B108',
    location: 'Office B108, Building B',
    priority: 'high' as const,
    status: 'open' as MaintenanceStatus,
    reportedBy: 'Staff Member',
    reportedAt: '2024-11-14T07:30:00Z',
  },
  {
    id: 'mnt-5',
    title: 'Elevator Maintenance – Building A',
    location: 'Building A Main Elevator',
    priority: 'medium' as const,
    status: 'completed' as MaintenanceStatus,
    reportedBy: 'System',
    reportedAt: '2024-10-28T09:00:00Z',
    completedAt: '2024-10-28T15:00:00Z',
    technician: 'External Contractor',
    notes: 'Scheduled annual service completed.',
  },
]

const statusConfig: Record<MaintenanceStatus, { labelKey: string; icon: React.ReactNode; className: string }> = {
  open: {
    labelKey: 'common.open',
    icon: <Circle className="size-3.5" />,
    className: 'text-amber-600',
  },
  in_progress: {
    labelKey: 'common.inProgress',
    icon: <Clock className="size-3.5" />,
    className: 'text-blue-600',
  },
  completed: {
    labelKey: 'common.completed',
    icon: <CheckCircle2 className="size-3.5" />,
    className: 'text-emerald-600',
  },
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function MaintenancePage() {
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState<'all' | MaintenanceStatus>('all')

  const filtered = activeTab === 'all'
    ? MOCK_MAINTENANCE
    : MOCK_MAINTENANCE.filter((m) => m.status === activeTab)

  const counts = {
    all: MOCK_MAINTENANCE.length,
    open: MOCK_MAINTENANCE.filter((m) => m.status === 'open').length,
    in_progress: MOCK_MAINTENANCE.filter((m) => m.status === 'in_progress').length,
    completed: MOCK_MAINTENANCE.filter((m) => m.status === 'completed').length,
  }

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">{t('pages.maintenanceRequests')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('pages.maintenanceSubtitle')}</p>
        </div>
        <Button size="sm" className="gap-1.5">
          <Plus className="size-3.5" />
          {t('tickets.newTicket')}
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {(['open', 'in_progress', 'completed'] as MaintenanceStatus[]).map((s) => {
          const cfg = statusConfig[s]
          return (
            <button
              key={s}
              onClick={() => setActiveTab(s === activeTab ? 'all' : s)}
              className={cn(
                'bg-card border border-border rounded-lg p-4 text-left hover:border-primary/40 transition-colors',
                activeTab === s && 'border-primary/50 bg-primary/5'
              )}
            >
              <div className={cn('flex items-center gap-1.5 text-sm font-medium mb-1', cfg.className)}>
                {cfg.icon}
                {t(cfg.labelKey)}
              </div>
              <p className="text-2xl font-bold text-foreground">{counts[s]}</p>
            </button>
          )
        })}
      </div>

      {/* Maintenance list */}
      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border">
          <p className="text-sm font-medium text-foreground">
            {activeTab === 'all' ? t('pages.allMaintenanceRequests') : t(statusConfig[activeTab as MaintenanceStatus]?.labelKey)}
            <span className="text-muted-foreground ml-1.5">({filtered.length})</span>
          </p>
        </div>
        <div className="divide-y divide-border">
          {filtered.map((item) => {
            const cfg = statusConfig[item.status]
            return (
              <div key={item.id} className="px-5 py-4 hover:bg-muted/20 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Wrench className="size-4 text-muted-foreground flex-shrink-0" />
                      <p className="text-sm font-semibold text-foreground">{item.title}</p>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3" />
                        {item.location}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="size-3" />
                        {item.reportedBy}
                      </span>
                      <span>Reported: {formatDate(item.reportedAt)}</span>
                      {item.technician && (
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="size-3" />
                          Assigned: {item.technician}
                        </span>
                      )}
                      {item.completedAt && (
                        <span>Completed: {formatDate(item.completedAt)}</span>
                      )}
                    </div>
                    {item.notes && (
                      <p className="text-xs text-muted-foreground mt-1.5 italic">{item.notes}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <PriorityBadge priority={item.priority} />
                    <div className={cn('flex items-center gap-1 text-xs font-medium', cfg.className)}>
                      {cfg.icon}
                      {t(cfg.labelKey)}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
