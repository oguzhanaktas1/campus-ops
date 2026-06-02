'use client'

import { useEffect, useState, useCallback } from 'react'
import { TopScrollTable } from '@/components/ui/top-scroll-table'
import { Plus, Pencil, Trash2, Loader2, ShieldCheck, Clock, ChevronLeft, ChevronRight, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { getToken } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'

// ─── Types ───────────────────────────────────────────────────────────────────

interface RequestType { id: string; name: string; key: string }

interface SLAPolicy {
  id: string
  name: string
  requestTypeId?: string | null
  requestType?: RequestType | null
  priority?: string | null
  firstResponseMinutes?: number | null
  resolutionMinutes?: number | null
  escalationMinutes?: number | null
  isActive: boolean
}

interface SlaEvent {
  id: string
  eventType: string
  occurredAt: string
  resolvedAt?: string | null
  request?: { id: string; requestNo: string; title: string; status: string } | null
  policy?: { id: string; name: string; priority?: string | null; requestType?: { key: string; name: string } | null } | null
}

interface SlaMetrics {
  activePolicies: number
  firstResponseBreaches: number
  resolutionBreaches: number
  escalations: number
  stepOverdues: number
}

interface PagedResult<T> { data: T[]; total: number; page: number; totalPages: number }

// ─── Constants ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 20
const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'

const PRIORITY_BADGE: Record<string, string> = {
  LOW:    'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/30 dark:text-slate-400 dark:border-slate-700',
  MEDIUM: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800',
  HIGH:   'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800',
  URGENT: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800',
}

const EVENT_TYPE_BADGE: Record<string, string> = {
  FIRST_RESPONSE_BREACHED: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800',
  RESOLUTION_BREACHED:     'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800',
  ESCALATION_TRIGGERED:    'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800',
  STEP_OVERDUE:            'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800',
  FIRST_RESPONSE_STARTED:  'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800',
  RESOLUTION_STARTED:      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800',
}

const EMPTY_FORM = {
  name: '', requestTypeId: '', priority: '',
  firstResponseMinutes: '', resolutionMinutes: '', escalationMinutes: '',
  isActive: true,
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function minutesToHuman(mins?: number | null): string {
  if (!mins && mins !== 0) return '—'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

function Pagination({ page, totalPages, isLoading, onChange }: {
  page: number; totalPages: number; isLoading: boolean; onChange: (p: number) => void
}) {
  if (totalPages <= 1) return null
  const pages = Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
    const pg = totalPages <= 7 ? i + 1
      : page <= 4 ? i + 1
      : page >= totalPages - 3 ? totalPages - 6 + i
      : page - 3 + i
    return pg < 1 || pg > totalPages ? null : pg
  })
  return (
    <div className="relative flex items-center justify-center text-sm pt-2">
      <p className="absolute left-0 text-muted-foreground">Page {page} of {totalPages}</p>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" className="gap-1" disabled={page <= 1 || isLoading} onClick={() => onChange(page - 1)}>
          <ChevronLeft className="size-4" /> Prev
        </Button>
        {pages.map((pg, i) => pg === null ? null : (
          <Button key={`${pg}-${i}`} variant={pg === page ? 'default' : 'outline'} size="sm" className="w-9" disabled={isLoading} onClick={() => onChange(pg)}>
            {pg}
          </Button>
        ))}
        <Button variant="outline" size="sm" className="gap-1" disabled={page >= totalPages || isLoading} onClick={() => onChange(page + 1)}>
          Next <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminSLAPage() {
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState<'policies' | 'events'>('policies')

  // Metrics
  const [metrics, setMetrics] = useState<SlaMetrics | null>(null)
  const [metricsLoading, setMetricsLoading] = useState(true)

  // Policies tab
  const [policiesResult, setPoliciesResult] = useState<PagedResult<SLAPolicy>>({ data: [], total: 0, page: 1, totalPages: 1 })
  const [policiesPage, setPoliciesPage] = useState(1)
  const [policiesLoading, setPoliciesLoading] = useState(true)

  // Events tab
  const [eventsResult, setEventsResult] = useState<PagedResult<SlaEvent>>({ data: [], total: 0, page: 1, totalPages: 1 })
  const [eventsPage, setEventsPage] = useState(1)
  const [eventsLoading, setEventsLoading] = useState(false)
  const [eventsFetched, setEventsFetched] = useState(false)

  // Request types (for form)
  const [requestTypes, setRequestTypes] = useState<RequestType[]>([])

  // Dialog
  const [showDialog, setShowDialog] = useState(false)
  const [editTarget, setEditTarget] = useState<SLAPolicy | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [isSaving, setIsSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // ── Fetchers ─────────────────────────────────────────────────────────────

  const fetchMetrics = useCallback(async () => {
    setMetricsLoading(true)
    try {
      const res = await fetch(`${BACKEND}/admin/sla/overview`, { headers: { Authorization: `Bearer ${getToken()}` } })
      if (res.ok) {
        const json = await res.json()
        setMetrics(json.metrics)
      }
    } catch { /* silent */ }
    finally { setMetricsLoading(false) }
  }, [])

  const fetchPolicies = useCallback(async (pg: number) => {
    setPoliciesLoading(true)
    try {
      const params = new URLSearchParams({ page: String(pg), limit: String(PAGE_SIZE) })
      const [polRes, rtRes] = await Promise.all([
        fetch(`${BACKEND}/admin/sla?${params}`, { headers: { Authorization: `Bearer ${getToken()}` } }),
        fetch(`${BACKEND}/admin/request-types`, { headers: { Authorization: `Bearer ${getToken()}` } }),
      ])
      if (polRes.ok) setPoliciesResult(await polRes.json())
      if (rtRes.ok) setRequestTypes(await rtRes.json())
    } catch {
      toast.error(t('sla.saveFail'))
    } finally {
      setPoliciesLoading(false)
    }
  }, [])

  const fetchEvents = useCallback(async (pg: number) => {
    setEventsLoading(true)
    try {
      const params = new URLSearchParams({ page: String(pg), limit: String(PAGE_SIZE) })
      const res = await fetch(`${BACKEND}/admin/sla/events?${params}`, { headers: { Authorization: `Bearer ${getToken()}` } })
      if (res.ok) setEventsResult(await res.json())
    } catch {
      toast.error(t('sla.saveFail'))
    } finally {
      setEventsLoading(false)
      setEventsFetched(true)
    }
  }, [])

  // Initial load
  useEffect(() => {
    fetchMetrics()
    fetchPolicies(1)
  }, [fetchMetrics, fetchPolicies])

  // Fetch events when tab first activated
  useEffect(() => {
    if (activeTab === 'events' && !eventsFetched) {
      fetchEvents(1)
    }
  }, [activeTab, eventsFetched, fetchEvents])

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handlePoliciesPage = (pg: number) => {
    setPoliciesPage(pg)
    fetchPolicies(pg)
  }

  const handleEventsPage = (pg: number) => {
    setEventsPage(pg)
    fetchEvents(pg)
  }

  function openAdd() {
    setEditTarget(null)
    setForm({ ...EMPTY_FORM })
    setShowDialog(true)
  }

  function openEdit(p: SLAPolicy) {
    setEditTarget(p)
    setForm({
      name: p.name,
      requestTypeId: p.requestTypeId ?? '',
      priority: p.priority ?? '',
      firstResponseMinutes: p.firstResponseMinutes?.toString() ?? '',
      resolutionMinutes: p.resolutionMinutes?.toString() ?? '',
      escalationMinutes: p.escalationMinutes?.toString() ?? '',
      isActive: p.isActive,
    })
    setShowDialog(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error(t('sla.saveFail')); return }
    setIsSaving(true)
    try {
      const payload = {
        name: form.name,
        requestTypeId: form.requestTypeId || null,
        priority: form.priority || null,
        firstResponseMinutes: form.firstResponseMinutes ? parseInt(form.firstResponseMinutes) : null,
        resolutionMinutes: form.resolutionMinutes ? parseInt(form.resolutionMinutes) : null,
        escalationMinutes: form.escalationMinutes ? parseInt(form.escalationMinutes) : null,
        isActive: form.isActive,
      }
      const url    = editTarget ? `${BACKEND}/admin/sla/${editTarget.id}` : `${BACKEND}/admin/sla`
      const method = editTarget ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error()
      toast.success(t('sla.saveSuccess'))
      setShowDialog(false)
      fetchPolicies(policiesPage)
      fetchMetrics()
    } catch {
      toast.error(t('sla.saveFail'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      const res = await fetch(`${BACKEND}/admin/sla/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (!res.ok) throw new Error()
      toast.success(t('sla.deleteSuccess'))
      fetchPolicies(policiesPage)
      fetchMetrics()
    } catch {
      toast.error(t('sla.deleteFail'))
    } finally {
      setDeletingId(null)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const { data: policies, total: policiesTotal, totalPages: policiesTotalPages } = policiesResult
  const { data: events, total: eventsTotal, totalPages: eventsTotalPages } = eventsResult
  const policiesStart = (policiesPage - 1) * PAGE_SIZE + 1
  const policiesEnd   = Math.min(policiesPage * PAGE_SIZE, policiesTotal)
  const eventsStart   = (eventsPage - 1) * PAGE_SIZE + 1
  const eventsEnd     = Math.min(eventsPage * PAGE_SIZE, eventsTotal)

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-5xl mx-auto pb-20">

      {/* Add/Edit Dialog */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-background border border-border rounded-lg p-6 max-w-md w-full shadow-2xl space-y-4">
            <h2 className="text-base font-bold text-foreground">
              {editTarget ? t('sla.editPolicy') : t('sla.addPolicy')}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">{t('sla.policyName')} *</label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder={t('sla.policyNamePlaceholder')} />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">{t('sla.requestType')}</label>
                <select value={form.requestTypeId} onChange={(e) => setForm((f) => ({ ...f, requestTypeId: e.target.value }))}
                  className="w-full bg-background border border-input rounded-md px-3 h-10 text-sm focus:ring-2 focus:ring-primary outline-none">
                  <option value="">{t('sla.anyRequestType')}</option>
                  {requestTypes.map((rt) => <option key={rt.id} value={rt.id}>{rt.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">{t('sla.priority')}</label>
                <select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                  className="w-full bg-background border border-input rounded-md px-3 h-10 text-sm focus:ring-2 focus:ring-primary outline-none">
                  <option value="">{t('sla.anyPriority')}</option>
                  <option value="LOW">{t('sla.low')}</option>
                  <option value="MEDIUM">{t('sla.medium')}</option>
                  <option value="HIGH">{t('sla.high')}</option>
                  <option value="URGENT">{t('sla.urgent')}</option>
                </select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: t('sla.firstResponseMin'), key: 'firstResponseMinutes' as const },
                  { label: t('sla.resolutionMin'),     key: 'resolutionMinutes' as const },
                  { label: t('sla.escalationMin'),     key: 'escalationMinutes' as const },
                ].map(({ label, key }) => (
                  <div key={key}>
                    <label className="text-xs font-semibold text-muted-foreground mb-1 block">{label}</label>
                    <Input type="number" min="1" value={form[key]}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                      placeholder={t('sla.minutesPlaceholder')} />
                  </div>
                ))}
              </div>
              {(form.firstResponseMinutes || form.resolutionMinutes || form.escalationMinutes) && (
                <div className="bg-muted/40 rounded-lg px-3 py-2 text-xs text-muted-foreground space-y-1">
                  {form.firstResponseMinutes && <p>{t('sla.firstResponse')}: <span className="font-semibold text-foreground">{minutesToHuman(parseInt(form.firstResponseMinutes))}</span></p>}
                  {form.resolutionMinutes    && <p>{t('sla.resolution')}: <span className="font-semibold text-foreground">{minutesToHuman(parseInt(form.resolutionMinutes))}</span></p>}
                  {form.escalationMinutes    && <p>{t('sla.escalation')}: <span className="font-semibold text-foreground">{minutesToHuman(parseInt(form.escalationMinutes))}</span></p>}
                </div>
              )}
              <div className="flex items-center gap-2">
                <input type="checkbox" id="isActive" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} className="rounded" />
                <label htmlFor="isActive" className="text-sm text-foreground">{t('common.active')}</label>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowDialog(false)} disabled={isSaving}>{t('common.cancel')}</Button>
              <Button className="flex-1" onClick={handleSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="size-4 animate-spin" /> : t('common.save')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">{t('sla.title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('sla.subtitle', { count: policiesTotal })}</p>
        </div>
        {activeTab === 'policies' && (
          <Button onClick={openAdd} className="gap-2 self-start">
            <Plus className="size-4" /> {t('sla.addPolicy')}
          </Button>
        )}
      </div>

      {/* Metrics */}
      {metricsLoading ? (
        <div className="grid gap-4 md:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-4 shadow-sm animate-pulse h-20" />
          ))}
        </div>
      ) : metrics && (
        <div className="grid gap-4 md:grid-cols-5">
          {([
            [t('sla.activePolicies'),          metrics.activePolicies,          ''],
            [t('sla.firstResponseBreaches'),  metrics.firstResponseBreaches,   metrics.firstResponseBreaches > 0 ? 'text-red-600' : ''],
            [t('sla.resolutionBreaches'),      metrics.resolutionBreaches,      metrics.resolutionBreaches > 0 ? 'text-red-600' : ''],
            [t('sla.escalations'),              metrics.escalations,             metrics.escalations > 0 ? 'text-amber-600' : ''],
            [t('sla.stepOverdues'),            metrics.stepOverdues,            metrics.stepOverdues > 0 ? 'text-orange-600' : ''],
          ] as [string, number, string][]).map(([label, value, valClass]) => (
            <div key={label} className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className={cn('mt-2 text-2xl font-semibold', valClass || 'text-foreground')}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {([
          { key: 'policies', label: t('sla.title'),    icon: <ShieldCheck className="size-3.5" />, count: policiesTotal },
          { key: 'events',   label: t('sla.eventsTab'), icon: <Zap className="size-3.5" />,        count: eventsTotal },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap',
              activeTab === tab.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.icon}
            {tab.label}
            {(tab.key === 'policies' ? !policiesLoading : eventsFetched) && tab.count > 0 && (
              <span className={cn('ml-1 text-xs rounded-full px-1.5 py-0.5 font-medium',
                activeTab === tab.key ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── POLICIES TAB ── */}
      {activeTab === 'policies' && (
        <div className="space-y-4">
          {policiesTotal > 0 && (
            <p className="text-sm text-muted-foreground">
              {t('sla.showingPolicies', { start: policiesStart, end: policiesEnd, total: policiesTotal })}
            </p>
          )}
          <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
            {policiesLoading && (
              <div className="flex items-center justify-center py-4 border-b border-border">
                <Loader2 className="size-5 animate-spin text-primary" />
              </div>
            )}
            <TopScrollTable>
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('sla.colName')}</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">{t('sla.colAppliesTo')}</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('sla.colTarget')}</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">{t('sla.colTarget')}</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">{t('sla.colTarget')}</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">{t('sla.colEscalation')}</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">{t('sla.colTarget')}</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {policies.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="size-4 text-primary shrink-0" />
                          <span className="font-medium text-foreground">{p.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 hidden sm:table-cell text-xs text-muted-foreground">{p.requestType?.name ?? '—'}</td>
                      <td className="px-5 py-3.5">
                        {p.priority ? (
                          <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full border', PRIORITY_BADGE[p.priority] ?? PRIORITY_BADGE.LOW)}>{p.priority}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">{t('sla.any')}</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 hidden md:table-cell">
                        <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                          <Clock className="size-3.5 text-muted-foreground" />{minutesToHuman(p.firstResponseMinutes)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 hidden md:table-cell">
                        <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                          <Clock className="size-3.5 text-muted-foreground" />{minutesToHuman(p.resolutionMinutes)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 hidden lg:table-cell">
                        <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                          <Clock className="size-3.5 text-muted-foreground" />{minutesToHuman(p.escalationMinutes)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 hidden lg:table-cell">
                        <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full border',
                          p.isActive
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800'
                            : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800/30 dark:text-slate-400 dark:border-slate-700')}>
                          {p.isActive ? t('common.active') : t('common.inactive')}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(p)}>
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon"
                            className="size-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDelete(p.id)} disabled={deletingId === p.id}>
                            {deletingId === p.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TopScrollTable>
            {!policiesLoading && policies.length === 0 && (
              <div className="text-center py-16">
                <ShieldCheck className="size-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground">{t('sla.noSla')}</p>
              </div>
            )}
          </div>
          <Pagination page={policiesPage} totalPages={policiesTotalPages} isLoading={policiesLoading} onChange={handlePoliciesPage} />
        </div>
      )}

      {/* ── EVENTS TAB ── */}
      {activeTab === 'events' && (
        <div className="space-y-4">
          {eventsTotal > 0 && (
            <p className="text-sm text-muted-foreground">
              {t('sla.showingEvents', { start: eventsStart, end: eventsEnd, total: eventsTotal })}
            </p>
          )}
          <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
            {eventsLoading && (
              <div className="flex items-center justify-center py-4 border-b border-border">
                <Loader2 className="size-5 animate-spin text-primary" />
              </div>
            )}
            <TopScrollTable>
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('sla.event')}</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">{t('sla.request')}</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">{t('sla.policy')}</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">{t('sla.priority')}</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('sla.occurred')}</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">{t('sla.resolved')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {events.map((event) => (
                    <tr key={event.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3.5">
                        <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full border',
                          EVENT_TYPE_BADGE[event.eventType] ?? 'bg-muted text-muted-foreground border-border')}>
                          {event.eventType.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 hidden sm:table-cell">
                        {event.request ? (
                          <div>
                            <p className="text-xs font-mono text-muted-foreground">{event.request.requestNo}</p>
                            <p className="text-sm text-foreground truncate max-w-[180px]">{event.request.title}</p>
                          </div>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                      <td className="px-5 py-3.5 hidden md:table-cell text-sm text-muted-foreground">
                        {event.policy?.name ?? '—'}
                      </td>
                      <td className="px-5 py-3.5 hidden lg:table-cell">
                        {event.policy?.priority ? (
                          <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full border', PRIORITY_BADGE[event.policy.priority] ?? PRIORITY_BADGE.LOW)}>
                            {event.policy.priority}
                          </span>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(event.occurredAt).toLocaleString('tr-TR')}
                      </td>
                      <td className="px-5 py-3.5 hidden lg:table-cell text-xs text-muted-foreground whitespace-nowrap">
                        {event.resolvedAt ? new Date(event.resolvedAt).toLocaleString('tr-TR') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TopScrollTable>
            {!eventsLoading && eventsFetched && events.length === 0 && (
              <div className="text-center py-16">
                <Zap className="size-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground">{t('sla.noEvents')}</p>
              </div>
            )}
          </div>
          <Pagination page={eventsPage} totalPages={eventsTotalPages} isLoading={eventsLoading} onChange={handleEventsPage} />
        </div>
      )}
    </div>
  )
}
