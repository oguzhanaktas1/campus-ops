'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  CheckCircle2,
  ChevronDown,
  Download,
  Loader2,
  Paperclip,
  RotateCcw,
  Search,
  ShieldX,
  UserCheck,
  UserPlus,
  X,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { CommentThread } from '@/components/comment-thread'
import { RequestTimeline } from '@/components/request-timeline'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { getStoredUser, getToken } from '@/lib/auth'
import { mapRequestDetailToViewModel } from '@/features/request-detail/mappers/mapRequestDetailToViewModel'
import type { RequestDetailViewModel } from '@/features/request-detail/types'
import { useOptionalT } from '@/lib/optional-t'
import { StatusBadge } from '@/components/status-badge'
import { cn } from '@/lib/utils'

export function RequestAttachmentsPanel({
  detail,
}: {
  detail: RequestDetailViewModel
}) {
  const tt = useOptionalT()
  return (
    <Card>
      <CardHeader>
        <CardTitle>{tt('detail.attachments', 'Attachments')}</CardTitle>
      </CardHeader>
      <CardContent>
        {detail.attachments.length === 0 ? (
          <p className="text-sm text-muted-foreground">{tt('detail.noAttachments', 'No attachments uploaded.')}</p>
        ) : (
          <div className="space-y-3">
            {detail.attachments.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Paperclip className="size-4 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {file.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{file.size}</p>
                  </div>
                </div>
                {file.url ? (
                  <Button variant="ghost" size="icon" asChild>
                    <a href={file.url} target="_blank" rel="noreferrer">
                      <Download className="size-4" />
                    </a>
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function RequestCommentsPanel({
  detail,
  onCommentAdded,
}: {
  detail: RequestDetailViewModel
  onCommentAdded: (nextComments: RequestDetailViewModel['comments']) => void
}) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const tt = useOptionalT()

  const currentUser = getStoredUser()

  const handleAddComment = async (text: string) => {
    const token = getToken()
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'
    if (!token) return

    setIsSubmitting(true)
    try {
      const response = await fetch(
        `${backendUrl}/requests/${detail.id}/comments`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ commentText: text }),
        },
      )

      if (!response.ok) throw new Error('comment failed')

      const created = await response.json()
      onCommentAdded([
        ...detail.comments,
        {
          id: String(created.id ?? `tmp-${Date.now()}`),
          authorId: created.user?.id ?? currentUser?.id ?? null,
          author:
            created.author?.fullName ??
            created.author?.email ??
            (typeof created.author === 'string' ? created.author : null) ??
            created.user?.profile?.fullName ??
            created.user?.email ??
            'You',
          authorRole:
            created.authorRole ??
            created.user?.primaryRoles?.[0]?.role?.name?.toLowerCase() ??
            detail.portal,
          content: created.content ?? created.commentText ?? text,
          createdAt: String(created.createdAt ?? new Date().toISOString()),
        },
      ])
    } catch {
      toast.error(tt('detail.commentPostFail', 'Could not post comment'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isSubmitting ? tt('detail.commentsSending', 'Comments - Sending...') : tt('detail.comments', 'Comments')}</CardTitle>
      </CardHeader>
      <CardContent>
        <CommentThread
          comments={detail.comments as any}
          currentUserId={currentUser?.id ?? null}
          onAddComment={handleAddComment}
        />
      </CardContent>
    </Card>
  )
}

export function RequestTimelineTabs({
  detail,
}: {
  detail: RequestDetailViewModel
}) {
  const tt = useOptionalT()
  const assignments = Array.isArray((detail.raw as any).assignments)
    ? ((detail.raw as any).assignments as any[])
    : []
  const approvalHistory = Array.isArray((detail.raw as any).approvalHistory)
    ? ((detail.raw as any).approvalHistory as any[])
    : []
  const auditHistory = Array.isArray((detail.raw as any).auditHistory)
    ? ((detail.raw as any).auditHistory as any[])
    : []
  const auditEvents = auditHistory.map((audit) => ({
    id: String(audit.id),
    status: String(audit.status ?? audit.actionType ?? 'AUDIT'),
    date: String(audit.date ?? audit.createdAt ?? new Date().toISOString()),
    note: [
      audit.note ?? null,
      audit.actor?.fullName ? `Actor: ${audit.actor.fullName}` : null,
      audit.entityType ? `Entity: ${audit.entityType}` : null,
    ].filter(Boolean).join(' | ') || undefined,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>{tt('detail.timelineActivity', 'Timeline & Activity')}</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="status">
          <TabsList className="mb-4 grid w-full grid-cols-4">
            <TabsTrigger value="status">{tt('detail.status', 'Status')}</TabsTrigger>
            <TabsTrigger value="assignments">{tt('detail.assignments', 'Assignments')}</TabsTrigger>
            <TabsTrigger value="approvals">{tt('detail.approvals', 'Approvals')}</TabsTrigger>
            <TabsTrigger value="audit">{tt('detail.audit', 'Audit')}</TabsTrigger>
          </TabsList>
          <TabsContent value="status">
            <RequestTimeline events={detail.statusHistory as any} />
          </TabsContent>
          <TabsContent value="assignments">
            {assignments.length > 0 ? (
              <div className="space-y-3">
                {assignments.map((assignment) => (
                  <div
                    key={String(assignment.id)}
                    className="rounded-lg border bg-muted/30 p-4 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-foreground">
                          {assignment.assignedTo?.fullName ?? tt('detail.unknownAssignee', 'Unknown assignee')}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {assignment.isActive ? tt('common.active', 'Active') : tt('status.COMPLETED', 'Completed')}
                      </span>
                    </div>
                    <div className="mt-2 space-y-1 text-muted-foreground">
                      <p>
                        {tt('detail.assigned', 'Assigned')}:{' '}
                        {assignment.assignedAt
                          ? new Date(String(assignment.assignedAt)).toLocaleString(
                              'en-US',
                            )
                          : '-'}
                      </p>
                      {assignment.assignedBy?.fullName ? (
                        <p>{tt('detail.assignedBy', 'Assigned by')}: {assignment.assignedBy.fullName}</p>
                      ) : null}
                      {assignment.unassignedAt ? (
                        <p>
                          {tt('status.CLOSED', 'Closed')}:{' '}
                          {new Date(String(assignment.unassignedAt)).toLocaleString(
                            'en-US',
                          )}
                        </p>
                      ) : null}
                      {assignment.note ? <p>{tt('detail.note', 'Note')}: {assignment.note}</p> : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {tt('detail.noAssignmentHistory', 'No assignment history available.')}
              </p>
            )}
          </TabsContent>
          <TabsContent value="approvals">
            {approvalHistory.length > 0 ? (
              <div className="space-y-3">
                {approvalHistory.map((action) => (
                  <div
                    key={String(action.id)}
                    className="rounded-lg border bg-muted/30 p-4 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-foreground">
                        {String(action.actionType ?? 'ACTION').replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {action.createdAt
                          ? new Date(String(action.createdAt)).toLocaleString(
                              'en-US',
                            )
                          : '-'}
                      </span>
                    </div>
                    <div className="mt-2 space-y-1 text-muted-foreground">
                      {action.actor?.fullName ? (
                        <p>{tt('detail.actor', 'Actor')}: {action.actor.fullName}</p>
                      ) : null}
                      {action.workflowStep?.name ? (
                        <p>{tt('detail.step', 'Step')}: {action.workflowStep.name}</p>
                      ) : null}
                      {action.decisionNote ? (
                        <p>{tt('detail.note', 'Note')}: {action.decisionNote}</p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {tt('detail.noApprovalHistory', 'No approval history available.')}
              </p>
            )}
          </TabsContent>
          <TabsContent value="audit">
            <RequestTimeline
              events={(auditEvents.length > 0 ? auditEvents : detail.timeline) as any}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

export function RequestActionPanel({
  detail,
  onDetailChange,
}: {
  detail: RequestDetailViewModel
  onDetailChange: (detail: RequestDetailViewModel) => void
}) {
  const tt = useOptionalT()
  const canDecide = canCurrentUserDecide(detail)
  const isTerminal = isTerminalRequest(detail)
  const currentUser = getStoredUser()
  const isRequester = !!currentUser?.id && detail.requester?.id === currentUser.id

  if (detail.portal === 'student') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{tt('detail.actions', 'Actions')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {detail.status === 'REVISION_REQUESTED' ? (
            <Button asChild variant="outline" className="w-full gap-2 border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800">
              <Link
                href={`/student/requests/${detail.id}/edit?type=${detail.requestType.key}`}
              >
                <RotateCcw className="size-4" />
                {tt('detail.reviseSubmission', 'Revise Submission')}
              </Link>
            </Button>
          ) : null}
          <p className="text-sm text-muted-foreground">
            {tt('detail.studentActionHelp', 'Student actions stay scoped to comments, file uploads, revision, and request visibility.')}
          </p>
        </CardContent>
      </Card>
    )
  }

  if (detail.portal === 'organizer') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{tt('detail.actions', 'Actions')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {detail.status === 'REVISION_REQUESTED' ? (
            <Button asChild variant="outline" className="w-full gap-2 border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800">
              <Link
                href={`/organizer/requests/${detail.id}/edit?type=${detail.requestType.key}`}
              >
                <RotateCcw className="size-4" />
                {tt('detail.reviseSubmission', 'Revise Submission')}
              </Link>
            </Button>
          ) : null}
          <p className="text-sm text-muted-foreground">
            {tt('detail.requesterActionHelp', 'Track the status of your submitted request. You can add comments or revise if requested.')}
          </p>
        </CardContent>
      </Card>
    )
  }

  if (detail.portal === 'faculty') {
    if (detail.status === 'REVISION_REQUESTED' && isRequester) {
      return (
        <Card>
          <CardHeader>
            <CardTitle>{tt('detail.actions', 'Actions')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button asChild variant="outline" className="w-full gap-2 border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800">
              <Link href={`/faculty/requests/${detail.id}/edit`}>
                <RotateCcw className="size-4" />
                {tt('detail.reviseSubmission', 'Revise Submission')}
              </Link>
            </Button>
            <p className="text-sm text-muted-foreground">
              {tt('detail.revisionRequestedHelp', 'The reviewer has requested changes. Edit and resubmit your request.')}
            </p>
          </CardContent>
        </Card>
      )
    }

    if (isTerminal) {
      return <TerminalActionPanel detail={detail} />
    }

    if (canDecide) {
      return <DecisionActionPanel detail={detail} onDetailChange={onDetailChange} />
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle>{tt('detail.actions', 'Actions')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button asChild className="w-full">
            <Link href="/faculty/approvals">{tt('detail.openDecisionQueue', 'Open Decision Queue')}</Link>
          </Button>
          <p className="text-sm text-muted-foreground">
            {tt('detail.facultyDecisionHelp', 'Approval and revision decisions remain centralized in the faculty approval flow.')}
          </p>
        </CardContent>
      </Card>
    )
  }

  if (detail.portal === 'admin') {
    return <AdminActionPanel detail={detail} />
  }

  // Requester viewing their own REVISION_REQUESTED request on staff portal — show revise button
  if (detail.portal === 'staff' && detail.status === 'REVISION_REQUESTED' && isRequester) {
    const categorySlug = toCategorySlug(detail.requestType?.category)
    return (
      <Card>
        <CardHeader>
          <CardTitle>{tt('detail.actions', 'Actions')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button asChild variant="outline" className="w-full gap-2 border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800">
            <Link href={`/staff/requests/${categorySlug}/${detail.id}/edit`}>
              <RotateCcw className="size-4" />
              {tt('detail.reviseSubmission', 'Revise Submission')}
            </Link>
          </Button>
          <p className="text-sm text-muted-foreground">
            {tt('detail.revisionRequestedHelp', 'The reviewer has requested changes. Edit and resubmit your request.')}
          </p>
        </CardContent>
      </Card>
    )
  }

  if (isTerminal) {
    return <TerminalActionPanel detail={detail} />
  }

  if (canDecide) {
    return <DecisionActionPanel detail={detail} onDetailChange={onDetailChange} />
  }

  return <StaffActionPanel detail={detail} onDetailChange={onDetailChange} />
}

type DecisionAction = 'approve' | 'reject' | 'revision'

const ACTIONABLE_REQUEST_STATUSES = new Set([
  'SUBMITTED',
  'IN_REVIEW',
  'WAITING_APPROVAL',
  'ASSIGNED',
])

function toCategorySlug(category?: string | null) {
  const map: Record<string, string> = {
    IT_SUPPORT: 'it-support',
    ADMINISTRATIVE: 'administrative',
    INVENTORY: 'inventory',
    CAMPUS_SERVICES: 'campus-services',
    STUDENT_LIFE: 'student-life',
  }
  return map[String(category ?? '').toUpperCase()] ?? 'general'
}

const TERMINAL_REQUEST_STATUSES = new Set([
  'APPROVED',
  'REJECTED',
  'CANCELLED',
  'CLOSED',
  'COMPLETED',
  'EXPIRED',
])

function isTerminalRequest(detail: RequestDetailViewModel) {
  return (
    TERMINAL_REQUEST_STATUSES.has(String(detail.status).toUpperCase()) ||
    String(detail.workflow.status ?? '').toUpperCase() === 'COMPLETED'
  )
}

function normalizeRole(value?: string | null) {
  return String(value ?? '').trim().toUpperCase()
}

function activeWorkflowStep(detail: RequestDetailViewModel) {
  return (
    detail.workflow.steps?.find((step) =>
      step.status === 'active' || step.status === 'warning',
    ) ?? null
  )
}

function canCurrentUserDecide(detail: RequestDetailViewModel) {
  if (!['faculty', 'staff'].includes(detail.portal)) return false
  if (!ACTIONABLE_REQUEST_STATUSES.has(String(detail.status).toUpperCase())) return false

  const user = getStoredUser()
  if (!user?.id) return false

  // Requesters never get decision buttons — they have their own UI (revise/track)
  if (detail.requester?.id === user.id) return false

  const userRoles = new Set((user.roles ?? []).map(normalizeRole))
  const step = activeWorkflowStep(detail)
  const stepRole = normalizeRole(step?.assignedRole ?? step?.role)

  // If the active step has an assigned role, only that role may act — no fallback.
  // This prevents e.g. IT_AGENT from acting when the step has moved to MANAGER_APPROVAL.
  if (stepRole) {
    return userRoles.has(stepRole)
  }

  // No role assigned to step — fall back to direct assignment checks.
  const assignments = Array.isArray((detail.raw as any).assignments)
    ? ((detail.raw as any).assignments as any[])
    : []

  const isCurrentAssignee = detail.currentAssignee?.id === user.id
  const isActiveAssignment = assignments.some((assignment) => {
    if (assignment?.isActive === false) return false
    return (
      assignment?.assignedToUserId === user.id ||
      assignment?.assignedTo?.id === user.id
    )
  })
  const isStepAssignee =
    step?.assignedTo?.id === user.id ||
    (step?.assignedToName &&
      step.assignedToName === detail.currentAssignee?.fullName &&
      detail.currentAssignee?.id === user.id)

  return isCurrentAssignee || isActiveAssignment || isStepAssignee
}

function TerminalActionPanel({ detail }: { detail: RequestDetailViewModel }) {
  const tt = useOptionalT()
  const status = detail.status.toUpperCase()
  const isSuccess = ['APPROVED', 'COMPLETED', 'RESOLVED', 'SCHEDULED'].includes(status)
  const isFailure = ['REJECTED', 'CANCELLED', 'EXPIRED'].includes(status)
  const isClosed = status === 'CLOSED'

  const containerClass = isSuccess
    ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
    : isFailure
      ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30'
      : isClosed
        ? 'border-border bg-muted/40'
        : 'border-border bg-muted/30'

  return (
    <Card>
      <CardHeader>
        <CardTitle>{tt('detail.actions', 'Actions')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className={cn('rounded-lg border p-3 space-y-2', containerClass)}>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {tt('detail.workflowCompleted', 'Final Status')}
          </p>
          <StatusBadge status={detail.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          {tt('detail.terminalWorkflowHelp', 'This request has reached a terminal workflow step. It cannot be reassigned or processed further.')}
        </p>
      </CardContent>
    </Card>
  )
}

function DecisionActionPanel({
  detail,
  onDetailChange,
}: {
  detail: RequestDetailViewModel
  onDetailChange: (detail: RequestDetailViewModel) => void
}) {
  const tt = useOptionalT()
  const [comment, setComment] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  const refreshDetail = async (backendUrl: string, token: string) => {
    const response = await fetch(`${backendUrl}/${detail.portal}/requests/${detail.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) return false

    const fresh = await response.json()
    const inlineDomain = fresh.domainData ?? null
    onDetailChange(
      mapRequestDetailToViewModel(detail.portal, fresh, inlineDomain?.data ?? null),
    )
    return true
  }

  const handleDecision = async (action: DecisionAction) => {
    const trimmedComment = comment.trim()
    if ((action === 'reject' || action === 'revision') && !trimmedComment) {
      toast.error(tt('detail.rejectRevisionRequiresComment', 'Reject or revision requires a comment.'))
      return
    }

    const token = getToken()
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'
    if (!token) return

    setIsProcessing(true)
    try {
      const response = await fetch(`${backendUrl}/requests/${detail.id}/actions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action,
          comment: trimmedComment || undefined,
        }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err?.message ?? tt('detail.actionFailed', 'Action failed'))
      }

      const result = await response.json().catch(() => ({}))
      toast.success(
        action === 'approve'
          ? tt('detail.requestApproved', 'Request approved.')
          : action === 'reject'
            ? tt('detail.requestRejected', 'Request rejected.')
            : tt('detail.revisionRequested', 'Revision requested.'),
      )
      setComment('')

      const refreshed = await refreshDetail(backendUrl, token)
      if (!refreshed) {
        onDetailChange({
          ...detail,
          status:
            result?.status ??
            (action === 'approve'
              ? 'APPROVED'
              : action === 'reject'
                ? 'REJECTED'
                : 'REVISION_REQUESTED'),
        })
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : tt('detail.actionFailed', 'Action failed'))
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{tt('detail.actions', 'Actions')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {tt('detail.currentDecisionStep', 'Current Decision Step')}
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {detail.workflow.currentStep ?? activeWorkflowStep(detail)?.label ?? tt('detail.workflowStep', 'Workflow step')}
          </p>
        </div>

        <Textarea
          placeholder={tt('detail.decisionNotePlaceholder', 'Add a decision note. Required for reject or revision.')}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          disabled={isProcessing}
          className="min-h-[110px] resize-none"
        />

        <div className="grid gap-2">
          <Button
            className="w-full gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
            disabled={isProcessing}
            onClick={() => handleDecision('approve')}
          >
            {isProcessing ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            {tt('detail.approve', 'Approve')}
          </Button>
          <Button
            variant="destructive"
            className="w-full gap-2"
            disabled={isProcessing}
            onClick={() => handleDecision('reject')}
          >
            {isProcessing ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />}
            {tt('detail.reject', 'Reject')}
          </Button>
          <Button
            variant="outline"
            className="w-full gap-2 border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
            disabled={isProcessing}
            onClick={() => handleDecision('revision')}
          >
            {isProcessing ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
            {tt('detail.requestRevision', 'Request Revision')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function AdminActionPanel({ detail }: { detail: RequestDetailViewModel }) {
  const router = useRouter()
  const [isClosing, setIsClosing] = useState(false)
  const tt = useOptionalT()

  const handleForceClose = async () => {
    const token = getToken()
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'
    if (!token) return

    setIsClosing(true)
    try {
      const response = await fetch(`${backendUrl}/admin/requests/${detail.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) throw new Error('delete failed')

      toast.success(tt('detail.requestClosed', 'Request closed'))
      router.push('/admin/requests')
    } catch {
      toast.error(tt('detail.closeRequestFail', 'Failed to close request'))
    } finally {
      setIsClosing(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{tt('detail.actions', 'Actions')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          variant="destructive"
          className="w-full gap-2"
          onClick={handleForceClose}
          disabled={isClosing}
        >
          {isClosing ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ShieldX className="size-4" />
          )}
          {tt('detail.forceClose', 'Force Close')}
        </Button>
        <p className="text-sm text-muted-foreground">
          {tt('detail.adminActionHelp', 'Admin actions retain override behavior inside the shared shell.')}
        </p>
      </CardContent>
    </Card>
  )
}

function StaffActionPanel({
  detail,
  onDetailChange,
}: {
  detail: RequestDetailViewModel
  onDetailChange: (detail: RequestDetailViewModel) => void
}) {
  const tt = useOptionalT()
  const [people, setPeople] = useState<any[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [selected, setSelected] = useState<any | null>(null)
  const [search, setSearch] = useState('')
  const [isAssigning, setIsAssigning] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const token = getToken()
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'
    if (!token) return

    const run = async () => {
      try {
        const response = await fetch(`${backendUrl}/staff/faculty-members`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!response.ok) throw new Error('people failed')
        setPeople(await response.json())
      } catch {
        toast.error(tt('detail.assignablePeopleLoadFail', 'Assignable people could not be loaded'))
      }
    }

    void run()
  }, [])

  const filtered = useMemo(() => {
    const query = search.toLowerCase()
    return people.filter((item) => {
      const name = item.profile?.fullName ?? item.fullName ?? ''
      const email = item.email ?? ''
      return (
        name.toLowerCase().includes(query) || email.toLowerCase().includes(query)
      )
    })
  }, [people, search])

  const handleAssign = async () => {
    const token = getToken()
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'
    if (!token || !selected) return

    setIsAssigning(true)
    try {
      const response = await fetch(`${backendUrl}/staff/requests/${detail.id}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ assigneeId: selected.id }),
      })

      if (!response.ok) throw new Error('assign failed')

      toast.success(tt('detail.requestAssigned', 'Request assigned'))
      onDetailChange({
        ...detail,
        status: 'IN_REVIEW',
        currentAssignee: {
          id: selected.id,
          fullName: selected.profile?.fullName ?? selected.fullName ?? tt('detail.assignedUser', 'Assigned user'),
          email: selected.email ?? null,
        },
      })
      setSelected(null)
    } catch {
      toast.error(tt('detail.assignmentFailed', 'Assignment failed'))
    } finally {
      setIsAssigning(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{tt('detail.actions', 'Actions')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4" ref={dropdownRef}>
        {detail.currentAssignee ? (
          <div className="flex items-center gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3">
            <UserCheck className="size-5 text-emerald-700" />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
                {tt('detail.currentAssignee', 'Current Assignee')}
              </p>
              <p className="text-sm font-semibold text-foreground">
                {detail.currentAssignee.fullName}
              </p>
            </div>
          </div>
        ) : selected ? (
          <div className="space-y-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-amber-700">
                  {tt('detail.readyToAssign', 'Ready to Assign')}
                </p>
                <p className="text-sm font-semibold text-foreground">
                  {selected.profile?.fullName ?? selected.fullName}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => setSelected(null)}
              >
                <X className="size-4" />
              </Button>
            </div>
            <Button
              className="w-full gap-2"
              onClick={handleAssign}
              disabled={isAssigning}
            >
              {isAssigning ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              {tt('detail.confirmAssignment', 'Confirm Assignment')}
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
            {tt('detail.noAssigneeHelp', 'No assignee yet. Select a person to assign this request directly.')}
          </div>
        )}

        {!detail.currentAssignee && !selected ? (
          <div className="relative">
            <Button
              variant="outline"
              className="w-full justify-between"
              onClick={() => setIsOpen((value) => !value)}
            >
              <span className="flex items-center gap-2">
                <UserPlus className="size-4" />
                {tt('detail.selectPerson', 'Select Person')}
              </span>
              <ChevronDown className="size-4" />
            </Button>

            {isOpen ? (
              <div className="absolute left-0 top-full z-20 mt-2 w-full rounded-lg border bg-background shadow-lg">
                <div className="border-b p-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
                    <input
                      className="w-full rounded-md border bg-muted/40 py-2 pl-8 pr-3 text-sm outline-none"
                      placeholder={tt('detail.searchPeople', 'Search people...')}
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </div>
                </div>
                <div className="max-h-56 overflow-y-auto p-1">
                  {filtered.length > 0 ? (
                    filtered.map((item) => (
                      <button
                        key={item.id}
                        className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-muted"
                        onClick={() => {
                          setSelected(item)
                          setIsOpen(false)
                        }}
                      >
                        <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {(item.profile?.fullName ?? item.fullName ?? '?').charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {item.profile?.fullName ?? item.fullName ?? tt('common.unknown', 'Unknown')}
                          </p>
                          {item.profile?.department?.name ? (
                            <p className="truncate text-xs text-muted-foreground">
                              {item.profile.department.name}
                            </p>
                          ) : null}
                        </div>
                      </button>
                    ))
                  ) : (
                    <p className="p-3 text-sm text-muted-foreground">
                      {tt('detail.noPeopleFound', 'No people found.')}
                    </p>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
