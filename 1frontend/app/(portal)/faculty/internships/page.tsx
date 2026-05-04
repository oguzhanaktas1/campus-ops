'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { MetricCard } from '@/components/metric-card'
import { EmptyState } from '@/components/empty-state'
import { StatusBadge } from '@/components/status-badge'
import {
  Briefcase,
  CheckCircle2,
  XCircle,
  Loader2,
  Eye,
  Filter,
  ClipboardList,
  Building2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'

type FilterStatus = 'all' | 'pending' | 'approved' | 'rejected'

function formatDate(d: string | Date | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const PENDING_STATUSES = ['SUBMITTED', 'IN_REVIEW', 'WAITING_APPROVAL']

export default function FacultyInternshipsPage() {
  const router = useRouter()
  const { t } = useI18n()
  const [internships, setInternships] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<FilterStatus>('all')

  const FILTER_TABS: { key: FilterStatus; label: string }[] = [
    { key: 'all', label: t('internships.tabAll') },
    { key: 'pending', label: t('internships.tabPending') },
    { key: 'approved', label: t('internships.tabApproved') },
    { key: 'rejected', label: t('internships.tabRejected') },
  ]

  const fetchInternships = async () => {
    try {
      const res = await fetch(`${BACKEND}/faculty/internships`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      setInternships(res.ok ? await res.json() : [])
    } catch {
      setInternships([])
      toast.error(t('internships.loadFail'))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { void fetchInternships() }, [])

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    setProcessingId(id)
    try {
      const res = await fetch(`${BACKEND}/faculty/requests/${id}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ action }),
      })
      if (res.ok) {
        const result = await res.json().catch(() => ({}))
        toast.success(action === 'approve' ? t('internships.approveSuccess') : t('internships.rejectSuccess'))
        setInternships((prev) =>
          prev.map((r) =>
            r.id === id
              ? {
                  ...r,
                  status: result.status ?? (action === 'approve' ? 'APPROVED' : 'REJECTED'),
                  displayStatus: result.nextStep === 'Internship Coordinator Review'
                    ? 'COORDINATOR_REVIEW'
                    : result.status ?? (action === 'approve' ? 'APPROVED' : 'REJECTED'),
                  canAct: false,
                }
              : r,
          ),
        )
      } else {
        const err = await res.json().catch(() => ({})) as { message?: string }
        toast.error(err.message ?? t('internships.actionFail'))
      }
    } catch {
      toast.error(t('internships.actionFail'))
    } finally {
      setProcessingId(null)
    }
  }

  const counts = {
    total: internships.length,
    pending: internships.filter((r) => PENDING_STATUSES.includes(r.status)).length,
    approved: internships.filter((r) => r.status === 'APPROVED').length,
    rejected: internships.filter((r) => r.status === 'REJECTED').length,
  }

  const filtered = internships.filter((r) => {
    if (activeFilter === 'all') return true
    if (activeFilter === 'pending') return PENDING_STATUSES.includes(r.status)
    if (activeFilter === 'approved') return r.status === 'APPROVED'
    if (activeFilter === 'rejected') return r.status === 'REJECTED'
    return true
  })

  if (isLoading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto pb-20">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Briefcase className="size-5 text-primary" /> {t('internships.title')}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {t('internships.subtitle', { count: internships.length })}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricCard title={t('internships.totalApplications')} value={counts.total} icon={<ClipboardList className="size-4" />} footer={t('internships.allTime')} />
        <MetricCard title={t('internships.pendingReview')} value={counts.pending} icon={<Loader2 className="size-4" />} valueClassName={counts.pending > 0 ? 'text-amber-600' : undefined} footer={t('internships.requiresAction')} />
        <MetricCard title={t('internships.approvedCount')} value={counts.approved} icon={<CheckCircle2 className="size-4" />} valueClassName="text-emerald-600" footer={t('internships.allTime')} />
        <MetricCard title={t('internships.rejectedCount')} value={counts.rejected} icon={<XCircle className="size-4" />} valueClassName={counts.rejected > 0 ? 'text-destructive' : undefined} footer={t('internships.allTime')} />
      </div>

      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-border flex-wrap">
          <div className="flex items-center gap-1">
            <Filter className="size-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">{t('common.filter')}:</span>
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveFilter(tab.key)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                  activeFilter === tab.key
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <span className="text-xs text-muted-foreground">{filtered.length} results</span>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            title={t('internships.noInternships')}
            description={t('internships.noInternshipsDesc')}
            icon={<Briefcase className="size-6" />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 border-b border-border">
                  {[
                    t('internships.colStudent'),
                    t('internships.colCompany'),
                    t('common.type'),
                    t('common.date'),
                    t('common.date'),
                    t('common.status'),
                    t('common.actions'),
                  ].map((h, i) => (
                    <th key={i} className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((req) => {
                  const canAct = req.canAct === true && PENDING_STATUSES.includes(req.status)
                  const isProcessing = processingId === req.id

                  return (
                    <tr key={req.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">
                            {req.submittedByName?.charAt(0) ?? 'S'}
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{req.submittedByName ?? t('common.unknown')}</p>
                            {req.studentNumber && (
                              <p className="text-[10px] text-muted-foreground">{req.studentNumber}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Building2 className="size-3.5 flex-shrink-0" />
                          {req.companyName ?? '—'}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-muted-foreground text-xs">{req.internshipType}</td>
                      <td className="px-5 py-4 text-muted-foreground text-xs">{formatDate(req.startDate)}</td>
                      <td className="px-5 py-4 text-muted-foreground text-xs">{formatDate(req.endDate)}</td>
                      <td className="px-5 py-4"><StatusBadge status={req.displayStatus ?? req.status} /></td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => router.push(`/faculty/requests/${req.id}?from=/faculty/internships`)}>
                            <Eye className="size-3" /> {t('common.view')}
                          </Button>
                          {canAct && (
                            <>
                              <Button size="sm" className="h-7 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs" disabled={isProcessing} onClick={() => handleAction(req.id, 'approve')}>
                                {isProcessing ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle2 className="size-3" />}
                                {t('common.approve')}
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs border-destructive/30 text-destructive hover:bg-destructive/10" disabled={isProcessing} onClick={() => handleAction(req.id, 'reject')}>
                                {isProcessing ? <Loader2 className="size-3 animate-spin" /> : <XCircle className="size-3" />}
                                {t('common.reject')}
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
