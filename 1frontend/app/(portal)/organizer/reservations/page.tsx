'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/status-badge'
import { BookMarked, PlusCircle, Clock, MapPin, Loader2, ChevronRight } from 'lucide-react'
import { getToken } from '@/lib/auth'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'

function formatDate(d: string) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTime(d: string) {
  if (!d) return ''
  return new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

export default function OrganizerReservationsPage() {
  const [reservations, setReservations] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await fetch(`${BACKEND}/room-reservation-requests/my`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        })
        if (res.ok) setReservations(await res.json())
      } catch {
        // silent
      } finally {
        setIsLoading(false)
      }
    }
    void fetch_()
  }, [])

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  const active = reservations.filter((r) =>
    ['PENDING', 'APPROVED', 'ACTIVE', 'SUBMITTED'].includes((r.reservationStatus ?? r.status ?? '').toUpperCase())
  )
  const past = reservations.filter((r) =>
    ['COMPLETED', 'CANCELLED', 'REJECTED'].includes((r.reservationStatus ?? r.status ?? '').toUpperCase())
  )

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Reservations</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Room and resource reservation requests.</p>
        </div>
        <Link href="/organizer/reservations/new">
          <Button size="sm" className="gap-1.5">
            <PlusCircle className="size-3.5" />
            Reserve Room
          </Button>
        </Link>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">Active ({active.length})</h2>
        {active.length === 0 ? (
          <div className="flex flex-col items-center py-10 bg-card border border-border rounded-lg text-center">
            <BookMarked className="size-7 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No active reservations.</p>
            <Link href="/organizer/reservations/new" className="mt-3">
              <Button variant="outline" size="sm">Reserve a room</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {active.map((r) => (
              <Link key={r.id} href={`/organizer/requests/${r.id}`}>
                <div className="bg-card border border-border rounded-lg p-4 flex items-start justify-between gap-4 hover:bg-muted/20 transition-colors cursor-pointer">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{r.requestNo}</span>
                    </div>
                    <p className="text-sm font-semibold text-foreground">{r.eventName ?? r.title}</p>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {r.startAt && (
                        <span className="flex items-center gap-1">
                          <Clock className="size-3" />
                          {formatDate(r.startAt)} · {formatTime(r.startAt)} – {formatTime(r.endAt)}
                        </span>
                      )}
                      {r.resource?.name && (
                        <span className="flex items-center gap-1">
                          <MapPin className="size-3" />
                          {r.resource.name}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge status={r.reservationStatus ?? r.status} />
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {past.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3">Past Reservations</h2>
          <div className="space-y-2">
            {past.map((r) => (
              <Link key={r.id} href={`/organizer/requests/${r.id}`}>
                <div className="bg-card border border-border rounded-lg p-4 flex items-center justify-between gap-4 opacity-70 hover:opacity-100 hover:bg-muted/20 transition-all cursor-pointer">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{r.eventName ?? r.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.startAt ? formatDate(r.startAt) : ''}
                      {r.resource?.name ? ` · ${r.resource.name}` : ''}
                    </p>
                  </div>
                  <StatusBadge status={r.reservationStatus ?? r.status} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
