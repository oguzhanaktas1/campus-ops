'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  CheckCircle2,
  ChevronRight,
  Inbox,
  Loader2,
  RotateCcw,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { getToken } from '@/lib/auth'
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
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialSelectedId = searchParams.get('id')

  const [pending, setPending] = useState<PendingApprovalItem[]>([])
  const [isQueueLoading, setIsQueueLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId)
  const [comment, setComment] = useState('')

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
          throw new Error(errorData?.message || 'Failed to load queue')
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
          error instanceof Error ? error.message : 'Failed to load approvals.',
        )
        setPending([])
      } finally {
        setIsQueueLoading(false)
      }
    }

    void fetchPendingRequests()
  }, [initialSelectedId])

  useEffect(() => {
    if (!selectedId) {
      router.replace('/faculty/approvals')
      return
    }

    router.replace(`/faculty/approvals?id=${selectedId}`)
  }, [router, selectedId])

  const selectedSummary = useMemo(
    () => pending.find((item) => item.id === selectedId) ?? null,
    [pending, selectedId],
  )

  const handleAction = async (action: ActionType) => {
    if (!selectedId || !action) return

    if ((action === 'reject' || action === 'revision') && comment.trim() === '') {
      toast.error(`A comment is required to ${action} this request.`)
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
        throw new Error(errorData?.message || 'Failed to process request')
      }

      toast.success(`Request ${action}d successfully.`)
      setComment('')

      setPending((prev) => {
        const next = prev.filter((item) => item.id !== selectedId)
        setSelectedId(next[0]?.id ?? null)
        return next
      })
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to process request.',
      )
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="h-full overflow-hidden">
      <div className="grid h-full lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="border-r border-border bg-card">
          <div className="border-b border-border px-4 py-4">
            <h1 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Inbox className="size-4 text-primary" />
              Faculty Approval Queue
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {pending.length} request{pending.length === 1 ? '' : 's'} waiting
              for review
            </p>
          </div>

          <div className="max-h-[calc(100vh-9rem)] overflow-y-auto">
            {isQueueLoading ? (
              <div className="flex h-48 items-center justify-center">
                <Loader2 className="size-7 animate-spin text-primary" />
              </div>
            ) : pending.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title="No pending approvals"
                  description="Faculty review queue is currently empty."
                  icon={<CheckCircle2 className="size-6 text-emerald-500" />}
                />
              </div>
            ) : (
              <div className="divide-y divide-border">
                {pending.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    className={cn(
                      'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40',
                      selectedId === item.id &&
                        'border-r-2 border-r-primary bg-primary/5',
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
        </aside>

        <main className="overflow-y-auto bg-muted/10">
          {!selectedId ? (
            <div className="flex h-full items-center justify-center p-6">
              <EmptyState
                title="Select a request"
                description="Choose a pending approval from the queue to inspect details and decide."
                icon={<Inbox className="size-6" />}
              />
            </div>
          ) : isLoading || !detail ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="size-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="mx-auto max-w-7xl space-y-6 p-6 pb-20">
              <RequestHeader detail={detail} />

              <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_340px]">
                <div className="space-y-6">
                  <RequestMetaCard detail={detail} />
                  <DomainDetailPanel detail={detail} />
                  <RequestAttachmentsPanel detail={detail} />
                  <RequestCommentsPanel
                    detail={detail}
                    onCommentAdded={(comments) => setDetail({ ...detail, comments })}
                  />
                  <RequestTimelineTabs detail={detail} />
                </div>

                <div className="space-y-6">
                  <FacultyDecisionPanel
                    detailStatus={detail.status}
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
                  <WorkflowCurrentStepCard detail={detail} />
                  <RequestQuickFactsCard detail={detail} />
                  <RelatedEntitiesCard detail={detail} />
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

function FacultyDecisionPanel({
  detailStatus,
  submittedByName,
  requestTypeName,
  comment,
  isProcessing,
  onCommentChange,
  onAction,
}: {
  detailStatus: string
  submittedByName: string
  requestTypeName: string
  comment: string
  isProcessing: boolean
  onCommentChange: (value: string) => void
  onAction: (action: ActionType) => void
}) {
  const isLocked = ['APPROVED', 'REJECTED', 'REVISION_REQUESTED'].includes(
    detailStatus,
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Faculty Decision</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-muted/30 p-3 text-sm">
          <p className="font-medium text-foreground">{requestTypeName}</p>
          <p className="mt-1 text-muted-foreground">
            Reviewing request submitted by {submittedByName}.
          </p>
        </div>

        {isLocked ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            This request has already been processed in the faculty queue.
          </div>
        ) : (
          <>
            <Textarea
              placeholder="Add a faculty note. Reject and revision actions require a comment."
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
                Approve
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
                Reject
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
                Request Revision
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
