'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CalendarRange, Clock, Users, MapPin, CheckCircle2, Clock3, XCircle, Plus } from 'lucide-react'
import { useReservations } from '@/lib/hooks'

const statusConfig = {
  confirmed: { label: 'Confirmed', icon: CheckCircle2, className: 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400' },
  pending: { label: 'Pending', icon: Clock3, className: 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400' },
  cancelled: { label: 'Cancelled', icon: XCircle, className: 'text-red-600 bg-red-50 border-red-200 dark:bg-red-950/30 dark:text-red-400' },
}

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}

export default function StaffRoomsPage() {
  const { reservations, confirmed, pending } = useReservations('staff')
  const [activeTab, setActiveTab] = useState<'all' | 'confirmed' | 'pending'>('all')

  const filtered = activeTab === 'all' ? reservations : activeTab === 'confirmed' ? confirmed : pending

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Room Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Review and manage room reservation requests.
          </p>
        </div>
        <Button size="sm" className="gap-1.5">
          <Plus className="size-3.5" />
          New Reservation
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{reservations.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Total This Week</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{confirmed.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Confirmed</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">{pending.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Pending Approval</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {(['all', 'confirmed', 'pending'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px',
              activeTab === t
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {t === 'all' ? 'All' : statusConfig[t].label}
          </button>
        ))}
      </div>

      {/* Reservations grid */}
      <div className="grid sm:grid-cols-2 gap-4">
        {filtered.map((res) => {
          const cfg = statusConfig[res.status]
          const StatusIcon = cfg.icon
          return (
            <div key={res.id} className="bg-card border border-border rounded-lg p-4 shadow-sm space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">{res.roomName}</p>
                  <p className="text-xs text-muted-foreground">{res.building}</p>
                </div>
                <span className={cn('flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md border', cfg.className)}>
                  <StatusIcon className="size-3" />
                  {cfg.label}
                </span>
              </div>
              <div className="space-y-1.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <CalendarRange className="size-3.5 flex-shrink-0" />
                  <span>{formatDate(res.date)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="size-3.5 flex-shrink-0" />
                  <span>{res.startTime} – {res.endTime}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Users className="size-3.5 flex-shrink-0" />
                  <span>Capacity: {res.capacity}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin className="size-3.5 flex-shrink-0" />
                  <span>{res.reservedBy}</span>
                </div>
              </div>
              <p className="text-xs text-foreground font-medium border-t border-border pt-2.5">
                {res.purpose}
              </p>
              {res.status === 'pending' && (
                <div className="flex items-center gap-2 pt-1">
                  <Button size="sm" variant="outline" className="flex-1 h-7 text-xs border-destructive/30 text-destructive hover:bg-destructive/10">
                    Decline
                  </Button>
                  <Button size="sm" className="flex-1 h-7 text-xs">
                    Approve
                  </Button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
