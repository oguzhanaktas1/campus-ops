'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Loader2, AlertCircle, CheckCircle2, XCircle, Clock, ChevronRight,
  ExternalLink, RefreshCw, CalendarDays, Users, ClipboardList,
  Building2, ShieldCheck, ShoppingCart, Package, Pencil, Ban,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'

const TABS = ['overview', 'prerequisites', 'preRegistrations', 'readiness', 'creationRequest'] as const
type Tab = typeof TABS[number]

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

const REQ_STATUS_BADGE: Record<string, string> = {
  APPROVED:   'bg-green-50 text-green-700 border-green-200',
  REJECTED:   'bg-red-50 text-red-700 border-red-200',
  SUBMITTED:  'bg-blue-50 text-blue-700 border-blue-200',
  IN_REVIEW:  'bg-yellow-50 text-yellow-700 border-yellow-200',
  DRAFT:      'bg-gray-50 text-gray-500 border-gray-200',
  CANCELLED:  'bg-gray-50 text-gray-400 border-gray-200',
}

const EVENT_TYPES = ['Conference', 'Workshop', 'Club Activity', 'Social Event', 'Sports', 'Cultural', 'Academic', 'Other']

function StatusIcon({ status }: { status: string }) {
  if (status === 'APPROVED') return <CheckCircle2 className="size-4 text-green-600" />
  if (status === 'REJECTED') return <XCircle className="size-4 text-red-600" />
  return <Clock className="size-4 text-yellow-500" />
}

export default function PlanDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { t } = useI18n()
  const [plan, setPlan] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // creation request form
  const [ecrForm, setEcrForm] = useState({
    title: '', description: '', eventType: 'Workshop',
    proposedStartAt: '', proposedEndAt: '', locationText: '',
    minimumAttendance: '', targetAttendance: '',
    registrationStartAt: '', registrationEndAt: '', expectedBudget: '',
  })

  const backend = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
  const headers = { Authorization: `Bearer ${getToken()}` }

  const fetchPlan = useCallback(async () => {
    try {
      const res = await fetch(`${backend}/event-plans/${id}`, { headers })
      if (res.ok) {
        const data = await res.json()
        setPlan(data)
        // Pre-fill ECR form from plan data
        setEcrForm((f) => ({
          ...f,
          title: data.title,
          description: data.description ?? '',
          eventType: data.eventType,
          proposedStartAt: data.tentativeStartAt
            ? new Date(data.tentativeStartAt).toISOString().slice(0, 16)
            : '',
          proposedEndAt: data.tentativeEndAt
            ? new Date(data.tentativeEndAt).toISOString().slice(0, 16)
            : '',
          locationText: data.locationPreference ?? '',
          minimumAttendance: String(data.minimumAttendance ?? ''),
          targetAttendance: String(data.targetAttendance ?? ''),
          registrationStartAt: data.registrationStartAt
            ? new Date(data.registrationStartAt).toISOString().slice(0, 16)
            : '',
          registrationEndAt: data.registrationEndAt
            ? new Date(data.registrationEndAt).toISOString().slice(0, 16)
            : '',
        }))
      } else {
        toast.error(t('pages.planNotFound'))
        router.push('/organizer/plans')
      }
    } catch {
      toast.error(t('pages.planLoadFail'))
    } finally {
      setIsLoading(false)
    }
  }, [id, router, backend, t])

  useEffect(() => { void fetchPlan() }, [fetchPlan])

  async function openPreRegistration() {
    try {
      const res = await fetch(`${backend}/event-plans/${id}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'REGISTRATION_OPEN' }),
      })
      if (!res.ok) throw new Error()
      toast.success(t('pages.preregOpened'))
      void fetchPlan()
    } catch {
      toast.error(t('pages.preregOpenFail'))
    }
  }

  async function cancelPlan() {
    if (!confirm('Are you sure you want to cancel this plan?')) return
    try {
      const res = await fetch(`${backend}/event-plans/${id}`, {
        method: 'DELETE',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Cancelled by organizer.' }),
      })
      if (!res.ok) throw new Error()
      toast.success(t('pages.planCancelled'))
      void fetchPlan()
    } catch {
      toast.error(t('pages.planCancelFail'))
    }
  }

  async function submitCreationRequest(e: React.FormEvent) {
    e.preventDefault()
    if (!ecrForm.title || !ecrForm.proposedStartAt || !ecrForm.proposedEndAt ||
      !ecrForm.minimumAttendance || !ecrForm.registrationStartAt || !ecrForm.registrationEndAt) {
      toast.error(t('pages.fillRequired'))
      return
    }
    setIsSubmitting(true)
    try {
      const res = await fetch(`${backend}/event-plans/${id}/creation-request`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...ecrForm,
          minimumAttendance: parseInt(ecrForm.minimumAttendance),
          targetAttendance: ecrForm.targetAttendance ? parseInt(ecrForm.targetAttendance) : undefined,
          expectedBudget: ecrForm.expectedBudget ? parseFloat(ecrForm.expectedBudget) : undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message ?? 'Error')
      }
      const data = await res.json()
      toast.success(t('pages.eventCreationSubmittedToast', { requestNo: data.requestNo }))
      void fetchPlan()
      setActiveTab('overview')
    } catch (err: any) {
      toast.error(err.message ?? t('pages.eventCreationSubmitFail'))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) return (
    <div className="flex h-[60vh] items-center justify-center">
      <Loader2 className="size-8 animate-spin text-primary" />
    </div>
  )

  if (!plan) return null

  const preRegCount = plan.preRegistrations?.filter((r: any) => r.status === 'REGISTERED').length ?? 0

  return (
    <div className="p-6 max-w-4xl mx-auto pb-20 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Link href="/organizer/plans" className="hover:underline">{t('nav.eventPlans')}</Link>
            <ChevronRight className="size-3" />
            <span className="truncate max-w-[200px]">{plan.title}</span>
          </div>
          <h1 className="text-xl font-bold">{plan.title}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{plan.eventType}</p>
        </div>
        <span className={cn(
          'text-xs font-semibold px-2.5 py-1 rounded-full border shrink-0',
          STATUS_BADGE[plan.status] ?? STATUS_BADGE.DRAFT,
        )}>
          {plan.status?.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px',
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab === 'overview' ? t('pages.overview') : tab === 'prerequisites' ? t('pages.prerequisites') : tab === 'preRegistrations' ? t('pages.preregistrations') : tab === 'readiness' ? t('pages.readinessCheck') : t('pages.eventCreationRequest')}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            {plan.description && (
              <p className="text-sm text-muted-foreground">{plan.description}</p>
            )}
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('pages.tentativeDates')}</p>
                <p>{plan.tentativeStartAt ? new Date(plan.tentativeStartAt).toLocaleString() : '—'}</p>
                <p className="text-muted-foreground">to {plan.tentativeEndAt ? new Date(plan.tentativeEndAt).toLocaleString() : '—'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('common.location')}</p>
                <p>{plan.locationPreference ?? '—'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('pages.attendance')}</p>
                <p>{t('pages.min')} <span className="font-medium">{plan.minimumAttendance}</span> · {t('pages.target')} <span className="font-medium">{plan.targetAttendance ?? '—'}</span></p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('pages.preregWindow')}</p>
                <p>{plan.registrationStartAt ? new Date(plan.registrationStartAt).toLocaleDateString() : '—'} → {plan.registrationEndAt ? new Date(plan.registrationEndAt).toLocaleDateString() : '—'}</p>
              </div>
            </div>
            {plan.sourceEventRequestId && (
              <div className="pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground">{t('pages.sourceStudentRequest')} </p>
                <Link href={`/student/requests/${plan.sourceEventRequestId}`} className="text-xs text-primary hover:underline flex items-center gap-1">
                  {plan.sourceEventRequestId} <ExternalLink className="size-3" />
                </Link>
              </div>
            )}
            {plan.notes && (
              <div className="pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground">{t('common.notes')}</p>
                <p className="text-sm mt-1">{plan.notes}</p>
              </div>
            )}
          </div>

          {/* Actions */}
          {plan.status !== 'CANCELLED' && plan.status !== 'EVENT_CREATED' && (
            <div className="flex flex-wrap gap-2">
              {plan.status === 'DRAFT' || plan.status === 'IN_PREPARATION' ? (
                <Button size="sm" variant="outline" className="gap-2" onClick={openPreRegistration}>
                  <Users className="size-4" /> {t('pages.openPreregistration')}
                </Button>
              ) : null}
              <Button size="sm" variant="destructive" className="gap-2" onClick={cancelPlan}>
                <Ban className="size-4" /> {t('pages.cancelPlan')}
              </Button>
            </div>
          )}

          {/* Creation request info */}
          {plan.creationRequest && (
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{t('pages.eventCreationRequest')}</p>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{plan.creationRequest.requestNo}</p>
                <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full border',
                  REQ_STATUS_BADGE[plan.creationRequest.requestStatus] ?? REQ_STATUS_BADGE.SUBMITTED)}>
                  {plan.creationRequest.requestStatus}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Prerequisites ── */}
      {activeTab === 'prerequisites' && (
        <div className="space-y-4">
          {[
            {
              label: t('pages.reservations'),
              icon: Building2,
              items: plan.prerequisites?.reservations ?? [],
              href: '/organizer/plans/' + id + '/new-reservation',
              newLabel: t('pages.reserveRoom'),
            },
            {
              label: t('nav.accessRequests'),
              icon: ShieldCheck,
              items: plan.prerequisites?.accesses ?? [],
              href: '/student/access-requests/new',
              newLabel: t('pages.newAccessRequest'),
            },
            {
              label: t('pages.procurementTitle'),
              icon: ShoppingCart,
              items: plan.prerequisites?.procurements ?? [],
              href: '/student/procurement/new',
              newLabel: t('pages.procurementTitle'),
            },
            {
              label: t('nav.equipment'),
              icon: Package,
              items: plan.prerequisites?.equipments ?? [],
              href: '/student/equipment/new',
              newLabel: t('pages.requestEquipment'),
            },
          ].map(({ label, icon: Icon, items, href, newLabel }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <Icon className="size-4 text-muted-foreground" /> {label}
                </p>
                <Link href={href}>
                  <Button size="sm" variant="outline" className="text-xs gap-1">+ {newLabel}</Button>
                </Link>
              </div>
              {items.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t('pages.noLinkedRequests')}</p>
              ) : (
                <div className="space-y-2">
                  {items.map((item: any) => (
                    <div key={item.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <StatusIcon status={item.status} />
                        <Link href={`/student/requests/${item.requestId}`} className="hover:underline text-xs">
                          {item.requestNo}
                        </Link>
                        <span className="text-xs text-muted-foreground truncate max-w-[160px]">
                          {item.eventName ?? item.accessType ?? item.itemName ?? item.equipmentName}
                        </span>
                      </div>
                      <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium',
                        REQ_STATUS_BADGE[item.status] ?? REQ_STATUS_BADGE.SUBMITTED)}>
                        {item.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Pre-Registrations ── */}
      {activeTab === 'preRegistrations' && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-primary">{preRegCount}</p>
                <p className="text-xs text-muted-foreground">{t('pages.registered')}</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{plan.minimumAttendance}</p>
                <p className="text-xs text-muted-foreground">{t('pages.minimum')}</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{plan.targetAttendance ?? '—'}</p>
                <p className="text-xs text-muted-foreground">{t('pages.targetAttendance')}</p>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>{t('pages.progress')}</span>
                <span>{preRegCount}/{plan.minimumAttendance}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (preRegCount / plan.minimumAttendance) * 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Decision buttons */}
          {plan.status === 'REGISTRATION_OPEN' && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={async () => {
                const newEnd = prompt('New registration end date (YYYY-MM-DDTHH:MM)')
                if (!newEnd) return
                try {
                  const res = await fetch(`${backend}/event-plans/${id}/decisions`, {
                    method: 'POST',
                    headers: { ...headers, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ decisionType: 'EXTENDED_REGISTRATION', newRegistrationEndAt: newEnd }),
                  })
                  if (!res.ok) throw new Error()
                  toast.success(t('pages.registrationExtended'))
                  void fetchPlan()
                } catch { toast.error(t('common.failed')) }
              }}>
                <RefreshCw className="size-4 mr-1.5" /> {t('pages.extendRegistration')}
              </Button>
              <Button size="sm" variant="outline" onClick={async () => {
                const newStart = prompt('New tentative start date (YYYY-MM-DDTHH:MM)')
                if (!newStart) return
                try {
                  const res = await fetch(`${backend}/event-plans/${id}/decisions`, {
                    method: 'POST',
                    headers: { ...headers, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ decisionType: 'RESCHEDULED', newStartAt: newStart }),
                  })
                  if (!res.ok) throw new Error()
                  toast.success(t('pages.eventRescheduled'))
                  void fetchPlan()
                } catch { toast.error(t('common.failed')) }
              }}>
                <CalendarDays className="size-4 mr-1.5" /> {t('pages.reschedule')}
              </Button>
            </div>
          )}

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/30">
              <p className="text-sm font-semibold">{t('pages.preregistrations')}</p>
            </div>
            {plan.preRegistrations?.length === 0 ? (
              <div className="py-8 text-center opacity-50">
                <AlertCircle className="size-6 mx-auto mb-2" />
                <p className="text-sm">{t('pages.noPreregistrations')}</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {plan.preRegistrations?.map((reg: any) => (
                  <div key={reg.id} className="flex items-center justify-between px-4 py-3 text-sm">
                    <span>{reg.user?.profile?.fullName ?? reg.userId}</span>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium',
                      reg.status === 'REGISTERED' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-500 border-gray-200')}>
                      {reg.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Readiness ── */}
      {activeTab === 'readiness' && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold">{t('pages.readinessCheck')}</p>
            {[
              { label: t('pages.reservations'), ok: plan.readiness?.reservationApproved },
              { label: t('nav.accessRequests'), ok: plan.readiness?.accessApproved },
              { label: t('pages.procurementTitle'), ok: plan.readiness?.procurementApproved },
              { label: t('nav.equipment'), ok: plan.readiness?.equipmentApproved },
              {
                label: `Pre-registrations (${plan.readiness?.preRegistrationCount ?? 0}/${plan.readiness?.minimumAttendance ?? plan.minimumAttendance})`,
                ok: plan.readiness?.preRegistrationCount >= plan.minimumAttendance,
              },
            ].map(({ label, ok }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-sm">{label}</span>
                {ok
                  ? <span className="flex items-center gap-1 text-xs text-green-700 font-medium"><CheckCircle2 className="size-4" /> {t('common.approved')}</span>
                  : <span className="flex items-center gap-1 text-xs text-yellow-600 font-medium"><Clock className="size-4" /> {t('common.pending')}</span>
                }
              </div>
            ))}
          </div>

          <div className={cn(
            'rounded-xl p-4 border text-sm font-medium flex items-center gap-2',
            plan.readiness?.isEligible
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-yellow-50 border-yellow-200 text-yellow-800',
          )}>
            {plan.readiness?.isEligible
              ? <><CheckCircle2 className="size-5 shrink-0" /> {t('pages.eligibleSubmit')}</>
              : <><AlertCircle className="size-5 shrink-0" /> Not yet eligible: {plan.readiness?.blockers?.join(', ')}</>
            }
          </div>

          {plan.readiness?.isEligible && !plan.creationRequest && plan.status !== 'CANCELLED' && (
            <Button className="w-full" onClick={() => setActiveTab('creationRequest')}>
              Proceed to Event Creation Request →
            </Button>
          )}
        </div>
      )}

      {/* ── Creation Request ── */}
      {activeTab === 'creationRequest' && (
        <div className="space-y-4">
          {plan.creationRequest ? (
            <div className="bg-card border border-border rounded-xl p-5 space-y-3">
              <p className="text-sm font-semibold">{t('pages.eventCreationSubmitted')}</p>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{t('pages.requestNo')}</p>
                <p className="text-sm font-medium">{plan.creationRequest.requestNo}</p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{t('common.status')}</p>
                <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full border',
                  REQ_STATUS_BADGE[plan.creationRequest.requestStatus] ?? REQ_STATUS_BADGE.SUBMITTED)}>
                  {plan.creationRequest.requestStatus}
                </span>
              </div>
              <Link href={`/student/requests/${plan.creationRequest.requestId}`}>
                <Button size="sm" variant="outline" className="gap-1 mt-2">
                  {t('pages.viewRequest')} <ExternalLink className="size-3" />
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={submitCreationRequest} className="bg-card border border-border rounded-xl p-5 space-y-4">
              <div>
                <p className="text-sm font-semibold">{t('pages.submitEventCreation')}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  This will start the official approval chain: Faculty Secretary → Dept. Chair → Finance → Budget → Event Coordinator.
                </p>
              </div>

              {/* Readiness snapshot */}
              {plan.readiness && (
                <div className="p-3 bg-muted/30 rounded-lg text-xs space-y-1">
                  <p className="font-semibold mb-1">{t('pages.prereqSnapshot')}</p>
                  {[
                    [t('pages.reservations'), plan.readiness.reservationApproved],
                    [t('nav.accessRequests'), plan.readiness.accessApproved],
                    [t('pages.procurementTitle'), plan.readiness.procurementApproved],
                    [t('nav.equipment'), plan.readiness.equipmentApproved],
                    [`Pre-reg (${plan.readiness.preRegistrationCount}/${plan.readiness.minimumAttendance})`,
                      plan.readiness.preRegistrationCount >= plan.readiness.minimumAttendance],
                  ].map(([label, ok]: any) => (
                    <div key={label} className="flex items-center gap-2">
                      {ok ? <CheckCircle2 className="size-3 text-green-600" /> : <Clock className="size-3 text-yellow-500" />}
                      <span>{label}: {ok ? t('pages.ready') : t('common.pending')}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>{t('common.title')} <span className="text-destructive">*</span></Label>
                  <Input value={ecrForm.title} onChange={(e) => setEcrForm((f) => ({ ...f, title: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('pages.eventType')}</Label>
                  <select value={ecrForm.eventType} onChange={(e) => setEcrForm((f) => ({ ...f, eventType: e.target.value }))}
                    className="w-full bg-background border border-input rounded-md px-3 h-9 text-sm outline-none focus:ring-2 focus:ring-ring">
                    {EVENT_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t('common.location')}</Label>
                  <Input value={ecrForm.locationText} onChange={(e) => setEcrForm((f) => ({ ...f, locationText: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('pages.proposedStart')} <span className="text-destructive">*</span></Label>
                  <Input type="datetime-local" value={ecrForm.proposedStartAt} onChange={(e) => setEcrForm((f) => ({ ...f, proposedStartAt: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('pages.proposedEnd')} <span className="text-destructive">*</span></Label>
                  <Input type="datetime-local" value={ecrForm.proposedEndAt} onChange={(e) => setEcrForm((f) => ({ ...f, proposedEndAt: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('pages.minAttendance')} <span className="text-destructive">*</span></Label>
                  <Input type="number" value={ecrForm.minimumAttendance} onChange={(e) => setEcrForm((f) => ({ ...f, minimumAttendance: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('pages.targetAttendance')}</Label>
                  <Input type="number" value={ecrForm.targetAttendance} onChange={(e) => setEcrForm((f) => ({ ...f, targetAttendance: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('pages.registrationOpens')} <span className="text-destructive">*</span></Label>
                  <Input type="datetime-local" value={ecrForm.registrationStartAt} onChange={(e) => setEcrForm((f) => ({ ...f, registrationStartAt: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('pages.registrationCloses')} <span className="text-destructive">*</span></Label>
                  <Input type="datetime-local" value={ecrForm.registrationEndAt} onChange={(e) => setEcrForm((f) => ({ ...f, registrationEndAt: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('pages.expectedBudget')}</Label>
                  <Input type="number" step="0.01" value={ecrForm.expectedBudget} onChange={(e) => setEcrForm((f) => ({ ...f, expectedBudget: e.target.value }))} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>{t('common.description')}</Label>
                  <textarea value={ecrForm.description} onChange={(e) => setEcrForm((f) => ({ ...f, description: e.target.value }))} rows={3}
                    className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none" />
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button type="submit" disabled={isSubmitting} className="gap-2">
                  {isSubmitting && <Loader2 className="size-4 animate-spin" />} {t('pages.submitCreationRequest')}
                </Button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
