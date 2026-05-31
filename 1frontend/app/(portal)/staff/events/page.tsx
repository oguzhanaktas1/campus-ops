'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { PartyPopper, Loader2, Search, AlertCircle, ChevronLeft, ChevronRight, CheckCircle, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { StatusBadge } from '@/components/status-badge'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'
const PAGE_SIZE = 20

function fmtDate(d: string | null | undefined) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function StaffEventsPage() {
  const { t } = useI18n()
  const [events, setEvents] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [actionId, setActionId] = useState<string | null>(null)
  const [note, setNote] = useState('')

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND}/events`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (res.ok) setEvents(await res.json())
      else setEvents([])
    } catch {
      toast.error(t('pages.eventsLoadFail'))
      setEvents([])
    } finally {
      setIsLoading(false)
    }
  }, [t])

  useEffect(() => { void fetchEvents() }, [fetchEvents])

  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`${BACKEND}/events/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ status, note }),
      })
      if (!res.ok) throw new Error()
      toast.success(t('pages.eventUpdateSuccess'))
      setActionId(null)
      setNote('')
      void fetchEvents()
    } catch {
      toast.error(t('pages.eventUpdateFail'))
    }
  }

  const tabs = [
    { key: '', label: t('common.all'), count: events.length },
    { key: 'APPROVED', label: t('common.approved'), count: events.filter((e) => e.status === 'APPROVED').length },
    { key: 'REJECTED', label: t('common.rejected'), count: events.filter((e) => e.status === 'REJECTED').length },
  ]

  const filtered = events.filter((e) => {
    if (activeTab && e.status !== activeTab) return false
    if (!search) return true
    const q = search.toLowerCase()
    return (
      e.eventName?.toLowerCase().includes(q) ||
      e.requestNo?.toLowerCase().includes(q) ||
      e.requesterName?.toLowerCase().includes(q) ||
      e.eventType?.toLowerCase().includes(q)
    )
  })

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5 pb-20">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h1 className="text-xl font-bold text-foreground">{t('pages.eventRequests')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('pages.eventRequestsSubtitle')}</p>
        </div>
        <div className="relative w-full sm:w-64 shrink-0">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder={t('common.search')}
            className="pl-9 h-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-1 bg-muted/50 p-1 rounded-lg border border-border w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setPage(1) }}
            className={cn(
              'px-3 py-1 text-sm font-medium rounded-md transition-all',
              activeTab === tab.key
                ? 'bg-background text-foreground shadow-sm ring-1 ring-border'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted',
            )}
          >
            {tab.label}
            {tab.count > 0 && <span className="ml-1.5 text-xs opacity-60">{tab.count}</span>}
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
            <p className="text-sm font-medium text-foreground">{t('pages.noEventRequests')}</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {paged.map((ev) => (
              <div key={ev.id}>
                <Link
                  href={`/staff/requests/events/${ev.id}`}
                  className="flex items-start justify-between gap-4 px-5 py-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {ev.eventName || 'Event Request'}
                      </p>
                      {ev.requestNo && (
                        <span className="text-xs text-muted-foreground font-mono shrink-0">{ev.requestNo}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      {ev.requesterName && <span>{ev.requesterName}</span>}
                      {ev.startAt && <span>{fmtDate(ev.startAt)}</span>}
                      {ev.expectedAttendance && <span>~{ev.expectedAttendance} people</span>}
                      {ev.eventType && <span>{ev.eventType}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <StatusBadge status={ev.status} />
                  </div>
                </Link>
                {['SUBMITTED', 'IN_REVIEW'].includes(ev.status) && (
                  <div className="px-5 pb-3">
                    {actionId === ev.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          rows={2}
                          placeholder={t('common.noteOptional')}
                          className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none"
                        />
                        <div className="flex gap-2">
                          <Button size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700"
                            onClick={() => void updateStatus(ev.id, 'APPROVED')}>
                            <CheckCircle className="size-3.5" /> {t('common.approve')}
                          </Button>
                          <Button size="sm" variant="destructive" className="gap-1.5"
                            onClick={() => void updateStatus(ev.id, 'REJECTED')}>
                            <XCircle className="size-3.5" /> {t('common.reject')}
                          </Button>
                          <Button size="sm" variant="ghost"
                            onClick={() => { setActionId(null); setNote('') }}>
                            {t('common.cancel')}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setActionId(ev.id)}>
                        {t('common.process')}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} / {filtered.length}</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded hover:bg-muted disabled:opacity-30">
              <ChevronLeft className="size-4" />
            </button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded hover:bg-muted disabled:opacity-30">
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
