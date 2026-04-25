'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  AlertTriangle,
  ArrowLeft,
  Loader2,
  Monitor,
  Ticket as TicketIcon,
  User,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { StatusBadge } from '@/components/status-badge'
import { RequestTimeline } from '@/components/request-timeline'
import { WorkflowProgressCard } from '@/features/request-detail/components/RequestCards'
import { buildWorkflowSteps } from '@/features/request-detail/utils'
import { getToken } from '@/lib/auth'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'

function fmt(d: string | null | undefined) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="mb-0.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="text-sm text-foreground">{value || '-'}</p>
    </div>
  )
}

export default function FacultyTicketDetailPage() {
  const { id } = useParams() as { id: string }
  const [data, setData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [commentText, setCommentText] = useState('')
  const [actionNote, setActionNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function loadDetail() {
    const res = await fetch(`${BACKEND}/it-tickets/${id}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
    if (!res.ok) throw new Error()
    setData(await res.json())
  }

  useEffect(() => {
    if (!id) return
    loadDetail()
      .catch(() => setData(null))
      .finally(() => setIsLoading(false))
  }, [id])

  async function postAction(path: string, body?: Record<string, unknown>) {
    setIsSubmitting(true)
    try {
      const res = await fetch(`${BACKEND}/it-tickets/${id}/${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(body ?? {}),
      })
      if (!res.ok) throw new Error()
      await loadDetail()
      setActionNote('')
      toast.success('Ticket updated.')
    } catch {
      toast.error('Action failed.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function addComment() {
    if (!commentText.trim()) return
    setIsSubmitting(true)
    try {
      const res = await fetch(`${BACKEND}/it-tickets/${id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ commentText }),
      })
      if (!res.ok) throw new Error()
      setCommentText('')
      await loadDetail()
      toast.success('Comment added.')
    } catch {
      toast.error('Comment could not be added.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center p-6 py-16">
        <AlertTriangle className="mb-3 size-8 text-muted-foreground/40" />
        <p className="text-sm font-medium">Ticket not found</p>
        <Link href="/faculty/tickets">
          <Button variant="outline" size="sm" className="mt-3">
            Back
          </Button>
        </Link>
      </div>
    )
  }

  const t = data.ticket
  const canClose = t?.ticketStatus === 'RESOLVED'
  const canReopen = t?.ticketStatus === 'RESOLVED' || t?.ticketStatus === 'CLOSED'
  const workflowSource = data.workflow?.engineWorkflow ?? data.workflow
  const lifecycleSteps = buildWorkflowSteps(
    'IT_SUPPORT',
    data.status,
    workflowSource,
    data.ticket?.ticketStatus,
  )
  const currentWorkflowStep =
    workflowSource?.currentStep ??
    (data.ticket?.ticketStatus === 'IN_PROGRESS'
      ? 'In Progress'
      : data.ticket?.ticketStatus === 'RESOLVED' || data.ticket?.ticketStatus === 'CLOSED'
        ? 'Completed'
        : data.ticket?.ticketStatus === 'WAITING_USER'
          ? 'Revision Requested'
          : data.workflow?.currentStep ?? 'In progress')

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-6 pb-20">
      <Link href="/faculty/tickets">
        <Button variant="ghost" size="sm" className="gap-1.5">
          <ArrowLeft className="size-4" /> Back
        </Button>
      </Link>

      <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-amber-100">
            <TicketIcon className="size-5 text-amber-700" />
          </div>
          <div>
            <h1 className="text-lg font-bold">{data.title}</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {data.requestNo} | Submitted {fmt(data.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge status={data.status} />
          <p className="text-xs text-muted-foreground">
            Ticket: {t?.ticketStatus?.replace(/_/g, ' ')}
          </p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr,1fr]">
        <div className="space-y-5">
          <div className="space-y-4 rounded-lg border border-border bg-card p-5">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Monitor className="size-4 text-muted-foreground" /> Ticket Details
            </p>
            <div className="grid grid-cols-2 gap-4">
              <InfoRow label="Category" value={t?.category} />
              <InfoRow label="Subcategory" value={t?.subcategory} />
              <InfoRow label="Affected System" value={t?.affectedSystem} />
              <InfoRow label="Location" value={t?.locationText} />
              <InfoRow label="Assigned To" value={t?.assignedTo?.fullName} />
              <InfoRow label="Priority" value={data.priority} />
            </div>
            {t?.resolutionSummary ? (
              <div>
                <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Resolution
                </p>
                <p className="text-sm text-muted-foreground">{t.resolutionSummary}</p>
              </div>
            ) : null}
          </div>

          {data.description ? (
            <div className="rounded-lg border border-border bg-card p-5">
              <p className="mb-2 text-sm font-semibold">Description</p>
              <p className="text-sm text-muted-foreground">{data.description}</p>
            </div>
          ) : null}

          <div className="rounded-lg border border-border bg-card p-5">
            <p className="mb-4 text-sm font-semibold">Comments</p>
            <div className="space-y-3">
              {data.comments?.map((comment: any) => (
                <div key={comment.id} className="rounded-md border border-border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">{comment.author}</p>
                    <p className="text-xs text-muted-foreground">{fmt(comment.createdAt)}</p>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{comment.content}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 space-y-3">
              <Textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add a comment or provide the requested information."
                rows={4}
              />
              <Button onClick={addComment} disabled={isSubmitting || !commentText.trim()}>
                {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
                Add Comment
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="space-y-3 rounded-lg border border-border bg-card p-5">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <User className="size-4 text-muted-foreground" /> Submitted By
            </p>
            <p className="text-sm font-medium">{data.requester?.fullName}</p>
            <p className="text-xs text-muted-foreground">{data.requester?.email}</p>
            <p className="text-xs text-muted-foreground">
              {data.requester?.faculty || data.requester?.department || '-'}
            </p>
          </div>

          <WorkflowProgressCard
            currentStep={currentWorkflowStep}
            steps={lifecycleSteps}
          />

          <div className="space-y-3 rounded-lg border border-border bg-card p-5">
            <p className="text-sm font-semibold">Requester Actions</p>
            <Input
              value={actionNote}
              onChange={(e) => setActionNote(e.target.value)}
              placeholder="Optional note"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={!canClose || isSubmitting}
                onClick={() => postAction('close', { note: actionNote })}
              >
                Close Ticket
              </Button>
              <Button
                variant="outline"
                disabled={!canReopen || isSubmitting}
                onClick={() => postAction('reopen', { note: actionNote })}
              >
                Reopen Ticket
              </Button>
            </div>
          </div>

          {data.statusHistory?.length > 0 ? (
            <div className="rounded-lg border border-border bg-card p-5">
              <p className="mb-4 text-sm font-semibold">Status History</p>
              <RequestTimeline events={data.statusHistory} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
