'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AlertTriangle, ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { StatusBadge, PriorityBadge } from '@/components/status-badge'
import { WorkflowProgressCard } from '@/features/request-detail/components/RequestCards'
import { buildWorkflowSteps } from '@/features/request-detail/utils'
import { getStoredUser, getToken } from '@/lib/auth'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'

function fmt(d: string | null | undefined) {
  if (!d) return '-'
  return new Date(d).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function StaffTicketDetailPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [resolutionSummary, setResolutionSummary] = useState('')
  const [commentText, setCommentText] = useState('')
  const [requestInfoText, setRequestInfoText] = useState('')
  const [actionNote, setActionNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const user = getStoredUser()

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

  async function postAction(
    path: string,
    body?: Record<string, unknown>,
    options?: { redirectTo?: string },
  ) {
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

      if (options?.redirectTo) {
        toast.success('Ticket updated.')
        router.push(options.redirectTo)
        return
      }

      await loadDetail()
      setActionNote('')
      setRequestInfoText('')
      setCommentText('')
      toast.success('Ticket updated.')
    } catch {
      toast.error('Action failed.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function addInternalComment() {
    if (!commentText.trim()) return
    await postAction('internal-comments', { commentText })
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
        <Link href="/staff/tickets">
          <Button variant="outline" size="sm" className="mt-3">
            Back
          </Button>
        </Link>
      </div>
    )
  }

  const isAssignedToMe = data.ticket?.assignedTo?.id === user?.id
  const canAssignToMe = !data.ticket?.assignedTo && user?.id
  const canResolve =
    isAssignedToMe ||
    user?.roles?.includes('IT_MANAGER') ||
    user?.roles?.includes('ADMIN')
  const isResolveLocked =
    data.ticket?.ticketStatus === 'RESOLVED' || data.ticket?.ticketStatus === 'CLOSED'
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
    <div className="mx-auto max-w-5xl space-y-5 p-6 pb-20">
      <Link href="/staff/tickets">
        <Button variant="ghost" size="sm" className="gap-1.5">
          <ArrowLeft className="size-4" /> Back
        </Button>
      </Link>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold">{data.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{data.requestNo}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={data.status} />
            <PriorityBadge priority={data.priority} />
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.35fr,1fr]">
        <div className="space-y-5">
          <div className="space-y-3 rounded-xl border border-border bg-card p-5">
            <p className="text-sm font-semibold">Overview</p>
            <div className="grid gap-3 text-sm md:grid-cols-2">
              <div><span className="text-muted-foreground">Reporter:</span> {data.requester?.fullName}</div>
              <div><span className="text-muted-foreground">Ticket Status:</span> {data.ticket?.ticketStatus}</div>
              <div><span className="text-muted-foreground">Category:</span> {data.ticket?.category}</div>
              <div><span className="text-muted-foreground">Subcategory:</span> {data.ticket?.subcategory || '-'}</div>
              <div><span className="text-muted-foreground">Affected System:</span> {data.ticket?.affectedSystem || '-'}</div>
              <div><span className="text-muted-foreground">Location:</span> {data.ticket?.locationText || '-'}</div>
              <div><span className="text-muted-foreground">Assigned To:</span> {data.ticket?.assignedTo?.fullName || 'Unassigned'}</div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {data.description || 'No description provided.'}
              </p>
            </div>
          </div>

          <WorkflowProgressCard
            currentStep={currentWorkflowStep}
            steps={lifecycleSteps}
          />

          <div className="space-y-3 rounded-xl border border-border bg-card p-5">
            <p className="text-sm font-semibold">Comments</p>
            <div className="space-y-3">
              {data.comments?.map((comment: any) => (
                <div key={comment.id} className="rounded-md border border-border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">
                      {comment.author}
                      {comment.isInternal ? ' | Internal' : ''}
                    </p>
                    <p className="text-xs text-muted-foreground">{fmt(comment.createdAt)}</p>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{comment.content}</p>
                </div>
              ))}
            </div>

            <Textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Add an internal note."
              rows={4}
            />
            <Button onClick={addInternalComment} disabled={isSubmitting || !commentText.trim()}>
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
              Add Internal Note
            </Button>
          </div>
        </div>

        <div className="space-y-5">
          <div className="space-y-3 rounded-xl border border-border bg-card p-5">
            <p className="text-sm font-semibold">Actions</p>

            {canAssignToMe ? (
              <Button
                className="w-full"
                disabled={isSubmitting}
                onClick={() =>
                  postAction('assign', {
                    assignedItUserId: user?.id,
                    note: 'Self-assigned from staff queue.',
                  })
                }
              >
                Assign to Me
              </Button>
            ) : null}

            <Button
              className="w-full"
              variant="outline"
              disabled={isSubmitting || !canResolve}
              onClick={() => postAction('start-progress', { note: actionNote })}
            >
              Start Progress
            </Button>

            <Input
              value={actionNote}
              onChange={(e) => setActionNote(e.target.value)}
              placeholder="Optional action note"
            />

            <Textarea
              value={requestInfoText}
              onChange={(e) => setRequestInfoText(e.target.value)}
              placeholder="Ask the user for more information."
              rows={4}
            />
            <Button
              className="w-full"
              variant="outline"
              disabled={isSubmitting || !requestInfoText.trim() || !canResolve}
              onClick={() =>
                postAction('request-user-info', {
                  message: requestInfoText,
                  internalNote: actionNote,
                })
              }
            >
              Request User Info
            </Button>

            <Textarea
              value={resolutionSummary}
              onChange={(e) => setResolutionSummary(e.target.value)}
              placeholder="Resolution summary"
              rows={5}
            />
            <Button
              className="w-full"
              disabled={
                isSubmitting ||
                !resolutionSummary.trim() ||
                !canResolve ||
                isResolveLocked
              }
              onClick={() =>
                postAction(
                  'resolve',
                  { resolutionSummary, note: actionNote },
                  { redirectTo: '/staff/tickets' },
                )
              }
            >
              Resolve Ticket
            </Button>

            <Button
              className="w-full"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => postAction('escalate', { note: actionNote })}
            >
              Escalate
            </Button>
          </div>

          <div className="space-y-3 rounded-xl border border-border bg-card p-5">
            <p className="text-sm font-semibold">Activity</p>
            <div className="space-y-3">
              {data.activity?.slice(0, 8)?.map((item: any) => (
                <div key={item.id} className="border-l-2 border-border pl-3">
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.actor} | {fmt(item.createdAt)}
                  </p>
                  {item.note ? (
                    <p className="mt-1 text-xs text-muted-foreground">{item.note}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
