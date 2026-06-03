'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  CheckCircle2,
  ChevronRight,
  Inbox,
  Loader2,
  PanelLeftOpen,
  RotateCcw,
  Sparkles,
  X,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { getToken } from '@/lib/auth'
import { getActiveSocket } from '@/lib/socket'
import { StatusBadge, PriorityBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/empty-state'
import { RequestHeader } from '@/features/request-detail/components/RequestHeader'
import {
  RelatedEntitiesCard,
  RequestMetaCard,
  RequestQuickFactsCard,
  WorkflowCurrentStepCard,
} from '@/features/request-detail/components/RequestCards'
import {
  RequestAttachmentsPanel,
  RequestCommentsPanel,
  RequestTimelineTabs,
} from '@/features/request-detail/components/RequestPanels'
import { DomainDetailPanel } from '@/features/request-detail/domain-panels/DomainDetailPanel'
import { useRequestDetail } from '@/features/request-detail/hooks/useRequestDetail'
import { useI18n } from '@/lib/i18n'

type ActionType = 'approve' | 'reject' | 'revision' | null

interface PendingApprovalItem {
  id: string
  title: string
  status: string
  priority: string
  createdAt: string
  submittedByName: string
  typeName: string
}

function formatDate(d: string) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function FacultyApprovalsPage() {
  const { t } = useI18n()
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialSelectedId = searchParams.get('id')

  const [pending, setPending] = useState<PendingApprovalItem[]>([])
  const [isQueueLoading, setIsQueueLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId)
  const [completedAction, setCompletedAction] = useState<ActionType>(null)
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [comment, setComment] = useState('')
  const [aiEnabled, setAiEnabled] = useState(false)
  const [aiSummary, setAiSummary] = useState<{
    summary: string
    risks: string[]
    recommendations: string[]
    fallbackUsed?: boolean
  } | null>(null)
  const [isAiLoading, setIsAiLoading] = useState(false)

  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)
    }
  }, [])

  const { detail, isLoading, setDetail } = useRequestDetail(
    selectedId ?? '',
    'faculty',
  )

  useEffect(() => {
    const fetchPendingRequests = async () => {
      try {
        const token = getToken()
        const backendUrl =
          process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
        const res = await fetch(`${backendUrl}/faculty/requests/pending`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}))
          throw new Error(errorData?.message || t('approvals.loadFail'))
        }

        const data = await res.json()
        const rows = Array.isArray(data) ? data : []
        setPending(rows)

        const nextSelectedId =
          initialSelectedId && rows.some((item) => item.id === initialSelectedId)
            ? initialSelectedId
            : rows[0]?.id ?? null

        setSelectedId((current) =>
          current && rows.some((item) => item.id === current)
            ? current
            : nextSelectedId,
        )
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : t('approvals.loadFail'),
        )
        setPending([])
      } finally {
        setIsQueueLoading(false)
      }
    }

    void fetchPendingRequests()

    const sock = getActiveSocket()
    if (sock) {
      const refresh = () => void fetchPendingRequests()
      sock.on('approval.created', refresh)
      sock.on('approval.completed', refresh)
      sock.on('request.status.changed', refresh)
      return () => {
        sock.off('approval.created', refresh)
        sock.off('approval.completed', refresh)
        sock.off('request.status.changed', refresh)
      }
    }
  }, [initialSelectedId])

  useEffect(() => {
    const checkAi = async () => {
      try {
        const token = getToken()
        const backendUrl =
          process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
        const res = await fetch(`${backendUrl}/ai/health`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) return
        const data = await res.json()
        setAiEnabled(data.enabled === true && data.status !== 'unavailable' && data.status !== 'disabled')
      } catch {
        setAiEnabled(false)
      }
    }

    void checkAi()
  }, [])

  useEffect(() => {
    if (!selectedId) {
      router.replace('/faculty/approvals')
      return
    }

    router.replace(`/faculty/approvals?id=${selectedId}`)
  }, [router, selectedId])

  useEffect(() => {
    const run = async () => {
      if (!detail || !aiEnabled || !selectedId) {
        setAiSummary(null)
        return
      }

      setIsAiLoading(true)
      try {
        const token = getToken()
        const backendUrl =
          process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
        const res = await fetch(`${backendUrl}/ai/summary/approval`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            requestTitle: detail.title,
            requestDescription: detail.description,
            domainData: detail.domainData ?? {},
            currentWorkflowStep: detail.workflow.currentStep ?? null,
            previousActions: detail.timeline.map((item) => `${item.status}: ${item.note ?? ''}`),
            commentsSummary: detail.comments
              .slice(-5)
              .map((item) => `${item.author}: ${item.content}`)
              .join('\n'),
            attachedDocuments: detail.attachments.map((item) => item.name),
          }),
        })

        if (!res.ok) {
          throw new Error('AI summary unavailable')
        }

        setAiSummary(await res.json())
      } catch {
        setAiSummary(null)
      } finally {
        setIsAiLoading(false)
      }
    }

    void run()
  }, [aiEnabled, detail, selectedId])

  const selectedSummary = useMemo(
    () => pending.find((item) => item.id === selectedId) ?? null,
    [pending, selectedId],
  )

  const handleAction = async (action: ActionType) => {
    if (!selectedId || !action) return

    if ((action === 'reject' || action === 'revision') && comment.trim() === '') {
      toast.error(t('approvals.revisionNotesPlaceholder'))
      return
    }

    setIsProcessing(true)
    try {
      const token = getToken()
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'

      const res = await fetch(`${backendUrl}/faculty/requests/${selectedId}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action, comment }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData?.message || t(`approvals.fail${action.charAt(0).toUpperCase() + action.slice(1)}`))
      }

      setComment('')
      setCompletedAction(action)

      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)
      dismissTimerRef.current = setTimeout(() => {
        setCompletedAction(null)
        setPending((prev) => {
          const next = prev.filter((item) => item.id !== selectedId)
          setSelectedId(next[0]?.id ?? null)
          return next
        })
      }, 1800)
    } catch (error) {
      const failKey = action === 'approve' ? 'failApprove' : action === 'reject' ? 'failReject' : 'failRevision'
      toast.error(
        error instanceof Error ? error.message : t(`approvals.${failKey}`),
      )
    } finally {
      setIsProcessing(false)
    }
  }

  const pendingListContent = (
    <>
      <div className="border-b border-border px-4 py-4 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Inbox className="size-4 text-primary shrink-0" />
            {t('approvals.title')}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('approvals.subtitle', { count: pending.length })}
          </p>
        </div>
        <button
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden p-1.5 rounded-md hover:bg-muted transition-colors shrink-0"
          aria-label="Close list"
        >
          <X className="size-4 text-muted-foreground" />
        </button>
      </div>

      <div className="overflow-y-auto h-[calc(100%-4rem)]">
        {isQueueLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="size-7 animate-spin text-primary" />
          </div>
        ) : pending.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title={t('approvals.noPending')}
              description={t('approvals.noPendingDesc')}
              icon={<CheckCircle2 className="size-6 text-emerald-500" />}
            />
          </div>
        ) : (
          <div className="divide-y divide-border">
            {pending.map((item) => (
              <button
                key={item.id}
                onClick={() => { setSelectedId(item.id); setSidebarOpen(false) }}
                className={cn(
                  'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40',
                  selectedId === item.id && 'border-r-2 border-r-primary bg-primary/5',
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {item.title}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.submittedByName} · {formatDate(item.createdAt)}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <PriorityBadge priority={item.priority} />
                    <StatusBadge status={item.status} />
                  </div>
                </div>
                <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  )

  return (
    <div className="h-full overflow-hidden">

      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="grid h-full lg:grid-cols-[320px_minmax(0,1fr)]">

        {/* Sidebar — fixed overlay on mobile, static column on desktop */}
        <aside className={cn(
          'border-r border-border bg-card flex flex-col',
          'fixed inset-y-0 left-0 z-40 w-[300px] transition-transform duration-200 ease-in-out',
          'lg:relative lg:z-auto lg:w-auto lg:translate-x-0 lg:inset-auto',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}>
          {pendingListContent}
        </aside>

        {/* Main */}
        <main className="overflow-hidden bg-muted/10 flex flex-col">

          {/* Mobile toggle bar */}
          <div className="flex items-center gap-3 border-b border-border px-4 py-2.5 lg:hidden shrink-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-primary transition-colors"
            >
              <PanelLeftOpen className="size-4" />
              {t('approvals.title')}
              {pending.length > 0 && (
                <span className="ml-0.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground leading-none">
                  {pending.length}
                </span>
              )}
            </button>
            {selectedSummary && (
              <p className="text-sm text-muted-foreground truncate min-w-0">· {selectedSummary.title}</p>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {!selectedId ? (
              <div className="flex h-full items-center justify-center p-6">
                <div className="text-center space-y-3">
                  <EmptyState
                    title={t('approvals.selectRequest')}
                    description={t('approvals.selectRequestDesc')}
                    icon={<Inbox className="size-6" />}
                  />
                  <button
                    onClick={() => setSidebarOpen(true)}
                    className="lg:hidden inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                  >
                    <PanelLeftOpen className="size-4" />
                    {t('approvals.title')} ({pending.length})
                  </button>
                </div>
              </div>
            ) : isLoading || !detail ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="size-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 pb-20">
                <div className="rounded-2xl border bg-card p-4 sm:p-5 shadow-sm overflow-hidden">
                  <RequestHeader detail={detail} />
                </div>

                <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_340px]">
                  <div className="min-w-0 space-y-6">
                    <WorkflowCurrentStepCard detail={detail} />
                    <RequestMetaCard detail={detail} />
                    <DomainDetailPanel detail={detail} />
                    <RequestAttachmentsPanel detail={detail} />
                    <RequestCommentsPanel
                      detail={detail}
                      onCommentAdded={(comments) => setDetail({ ...detail, comments })}
                    />
                    <RequestTimelineTabs detail={detail} />
                  </div>

                  <div className="min-w-0 space-y-6">
                    <FacultyDecisionPanel
                      detailStatus={detail.status}
                      completedAction={completedAction}
                      submittedByName={
                        detail.requester?.fullName ??
                        selectedSummary?.submittedByName ??
                        'Requester'
                      }
                      requestTypeName={
                        detail.requestType.name || selectedSummary?.typeName || 'Request'
                      }
                      comment={comment}
                      isProcessing={isProcessing}
                      onCommentChange={setComment}
                      onAction={handleAction}
                    />
                    <ApprovalAiSummaryCard
                      aiEnabled={aiEnabled}
                      summary={aiSummary}
                      isLoading={isAiLoading}
                    />
                    <RequestQuickFactsCard detail={detail} />
                    <RelatedEntitiesCard detail={detail} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

function ApprovalAiSummaryCard({
  aiEnabled,
  summary,
  isLoading,
}: {
  aiEnabled: boolean
  summary: {
    summary: string
    risks: string[]
    recommendations: string[]
    fallbackUsed?: boolean
  } | null
  isLoading: boolean
}) {
  if (!aiEnabled) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          AI Review Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Preparing summary
          </div>
        ) : !summary ? (
          <p className="text-sm text-muted-foreground">
            AI summary is unavailable. Review flow continues normally without it.
          </p>
        ) : (
          <>
            <div className="rounded-lg border bg-muted/30 p-3 text-sm text-foreground">
              {summary.summary}
            </div>
            {summary.risks.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Risks
                </p>
                <div className="space-y-2">
                  {summary.risks.map((item) => (
                    <div key={item} className="rounded-md border border-amber-300/40 bg-amber-50/60 px-3 py-2 text-sm text-amber-900">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {summary.recommendations.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Recommendations
                </p>
                <div className="space-y-2">
                  {summary.recommendations.map((item) => (
                    <div key={item} className="rounded-md border border-emerald-300/40 bg-emerald-50/60 px-3 py-2 text-sm text-emerald-900">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Advisory only. Final decision always belongs to the reviewer.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function FacultyDecisionPanel({
  detailStatus,
  completedAction,
  submittedByName,
  requestTypeName,
  comment,
  isProcessing,
  onCommentChange,
  onAction,
}: {
  detailStatus: string
  completedAction: ActionType
  submittedByName: string
  requestTypeName: string
  comment: string
  isProcessing: boolean
  onCommentChange: (value: string) => void
  onAction: (action: ActionType) => void
}) {
  const { t } = useI18n()
  const isLocked = ['APPROVED', 'REJECTED', 'REVISION_REQUESTED'].includes(detailStatus)

  const completedConfig = completedAction === 'approve'
    ? { label: t('approvals.successApprove'), className: 'border-emerald-200 bg-emerald-50 text-emerald-800', icon: <CheckCircle2 className="size-5 text-emerald-600" /> }
    : completedAction === 'reject'
      ? { label: t('approvals.successReject'), className: 'border-red-200 bg-red-50 text-red-800', icon: <XCircle className="size-5 text-red-500" /> }
      : completedAction === 'revision'
        ? { label: t('approvals.successRevision'), className: 'border-amber-200 bg-amber-50 text-amber-800', icon: <RotateCcw className="size-5 text-amber-600" /> }
        : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('approvals.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-muted/30 p-3 text-sm">
          <p className="font-medium text-foreground">{requestTypeName}</p>
          <p className="mt-1 text-muted-foreground">{submittedByName}</p>
        </div>

        {completedConfig ? (
          <div className={`flex items-center gap-3 rounded-lg border p-4 text-sm font-medium ${completedConfig.className}`}>
            {completedConfig.icon}
            {completedConfig.label}
          </div>
        ) : isLocked ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            {t('common.completed')}
          </div>
        ) : (
          <>
            <Textarea
              placeholder={t('approvals.notesPlaceholder')}
              value={comment}
              onChange={(event) => onCommentChange(event.target.value)}
              className="min-h-[120px] resize-none"
              disabled={isProcessing}
            />

            <div className="flex flex-wrap gap-3">
              <Button
                className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={() => onAction('approve')}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-4" />
                )}
                {t('approvals.approveBtn')}
              </Button>
              <Button
                variant="destructive"
                className="gap-2"
                onClick={() => onAction('reject')}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <XCircle className="size-4" />
                )}
                {t('approvals.rejectBtn')}
              </Button>
              <Button
                variant="outline"
                className="gap-2 border-amber-300 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
                onClick={() => onAction('revision')}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RotateCcw className="size-4" />
                )}
                {t('approvals.revisionBtn')}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
