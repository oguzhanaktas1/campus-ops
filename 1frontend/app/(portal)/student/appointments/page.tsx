'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/status-badge'
import { Calendar, PlusCircle, Clock, User, Loader2 } from 'lucide-react'
import { getToken } from '@/lib/auth'
import { cn } from '@/lib/utils'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'

function formatDate(d: string) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatTime(d: string) {
  if (!d) return ''
  return new Date(d).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function StudentAppointmentsPage() {
  const [requests, setRequests] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        const res = await fetch(`${BACKEND}/appointment-requests/my`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        })
        if (res.ok) setRequests(await res.json())
      } catch {
        // silent
      } finally {
        setIsLoading(false)
      }
    }

    void fetchRequests()
  }, [])

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  const active = requests.filter((r) =>
    ['SUBMITTED', 'IN_REVIEW', 'WAITING_APPROVAL'].includes(
      (r.status ?? '').toUpperCase(),
    ),
  )
  const confirmed = requests.filter(
    (r) => r.status?.toUpperCase() === 'APPROVED',
  )
  const past = requests.filter((r) =>
    ['COMPLETED', 'CANCELLED', 'REJECTED'].includes(
      (r.status ?? '').toUpperCase(),
    ),
  )

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Appointments</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage your appointment requests.
          </p>
        </div>
        <Link href="/student/appointments/new">
          <Button size="sm" className="gap-1.5">
            <PlusCircle className="size-3.5" />
            Book Appointment
          </Button>
        </Link>
      </div>

      {active.length > 0 && (
        <CardSection title={`Pending (${active.length})`} items={active} />
      )}
      {confirmed.length > 0 && (
        <CardSection title={`Confirmed (${confirmed.length})`} items={confirmed} />
      )}

      {active.length === 0 && confirmed.length === 0 && (
        <div className="flex flex-col items-center py-10 bg-card border border-border rounded-lg text-center">
          <Calendar className="size-7 text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">No appointments yet.</p>
          <Link href="/student/appointments/new" className="mt-3">
            <Button variant="outline" size="sm">
              Book one now
            </Button>
          </Link>
        </div>
      )}

      {past.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3">Past</h2>
          <div className="space-y-2">
            {past.map((r) => (
              <Link
                key={r.id}
                href={`/student/requests/${r.id}`}
                className="block bg-card border border-border rounded-lg p-4 opacity-70 hover:opacity-100 hover:bg-muted/20 transition-all"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{r.topic}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.preferredStartAt ? formatDate(r.preferredStartAt) : ''}
                      {r.targetUser?.fullName ? ` - ${r.targetUser.fullName}` : ''}
                    </p>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function CardSection({ title, items }: { title: string; items: any[] }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-foreground mb-3">{title}</h2>
      <div className="space-y-3">
        {items.map((r) => (
          <Link
            key={r.id}
            href={`/student/requests/${r.id}`}
            className={cn(
              'block bg-card border border-border rounded-lg p-4 transition-colors hover:bg-muted/20',
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">
                    {r.requestNo}
                  </span>
                  <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                    {r.appointmentType}
                  </span>
                </div>
                <p className="text-sm font-semibold text-foreground">{r.topic}</p>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {r.preferredStartAt && (
                    <span className="flex items-center gap-1">
                      <Clock className="size-3" />
                      {formatDate(r.preferredStartAt)} - {formatTime(r.preferredStartAt)}
                    </span>
                  )}
                  {r.targetUser?.fullName && (
                    <span className="flex items-center gap-1">
                      <User className="size-3" />
                      {r.targetUser.fullName}
                    </span>
                  )}
                </div>
              </div>
              <StatusBadge status={r.status} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
