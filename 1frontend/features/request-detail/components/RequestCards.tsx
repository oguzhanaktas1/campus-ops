'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { StatusBadge } from '@/components/status-badge'
import { WorkflowStepIndicator } from '@/components/workflow-step-indicator'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { RequestDetailViewModel } from '@/features/request-detail/types'
import {
  buildWorkflowSteps,
  formatDate,
  humanize,
  titleize,
} from '@/features/request-detail/utils'
import type { Step } from '@/components/workflow-step-indicator'
import { cn } from '@/lib/utils'
import { useOptionalT } from '@/lib/optional-t'

function KeyValueList({
  items,
}: {
  items: Array<{
    label: string
    value: string | null
    fullWidth?: boolean
  }>
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) =>
        item.value ? (
          <div
            key={item.label}
            className={cn('space-y-1 min-w-0', item.fullWidth && 'sm:col-span-2')}
          >
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground truncate">
              {item.label}
            </p>
            <p className="text-sm text-foreground break-words min-w-0">{item.value}</p>
          </div>
        ) : null,
      )}
    </div>
  )
}

export function RequestMetaCard({ detail }: { detail: RequestDetailViewModel }) {
  const tt = useOptionalT()
  return (
    <Card>
      <CardHeader>
        <CardTitle>{tt('detail.requestMeta', 'Request Meta')}</CardTitle>
      </CardHeader>
      <CardContent>
        <KeyValueList
          items={[
            { label: tt('detail.type', 'Type'), value: detail.requestType.name },
            { label: tt('detail.category', 'Category'), value: detail.requestType.category ?? null },
            {
              label: tt('detail.submitted', 'Submitted'),
              value: formatDate(detail.submittedAt ?? detail.createdAt),
            },
            {
              label: tt('detail.dueAt', 'Due At'),
              value: detail.dueAt ? formatDate(detail.dueAt) : null,
            },
          ]}
        />
      </CardContent>
    </Card>
  )
}

export function WorkflowCurrentStepCard({
  detail,
}: {
  detail: RequestDetailViewModel
}) {
  const tt = useOptionalT()
  const steps =
    detail.workflow.steps && detail.workflow.steps.length > 0
      ? detail.workflow.steps
      : buildWorkflowSteps(detail.requestType.key, detail.status)

  return (
    <WorkflowProgressCard
      currentStep={detail.workflow.currentStep ?? 'Workflow progression'}
      steps={steps}
      title={tt('detail.workflow', 'Workflow')}
    />
  )
}

export function WorkflowProgressCard({
  currentStep,
  steps,
  title = 'Workflow',
}: {
  currentStep?: string | null
  steps: Step[]
  title?: string
}) {
  const tt = useOptionalT()
  const currentWorkflowStep =
    steps.find((step) => step.isCurrent) ??
    steps.find((step) => step.status === 'active' || step.status === 'warning' || step.status === 'failed') ??
    null
  const currentOwner = currentWorkflowStep ? workflowStepOwner(currentWorkflowStep) : null
  const currentTiming = currentWorkflowStep ? workflowStepTiming(currentWorkflowStep, tt) : null
  const [showStepRows, setShowStepRows] = useState(false)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>{title}</CardTitle>
          <button
            type="button"
            aria-label={showStepRows ? tt('detail.hideWorkflowSteps', 'Hide workflow steps') : tt('detail.showWorkflowSteps', 'Show workflow steps')}
            aria-expanded={showStepRows}
            className="flex size-7 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground transition hover:bg-muted hover:text-foreground"
            onClick={() => setShowStepRows((value) => !value)}
          >
            <ChevronDown
              className={cn('size-4 transition-transform', showStepRows && 'rotate-180')}
            />
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 rounded-lg border bg-muted/30 px-3 py-2.5">
          <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">{tt('detail.currentStep', 'Current Step')}</span>
          <div className="min-w-0 sm:text-right">
            <span className="block text-sm font-semibold text-foreground break-words">
              {currentStep ?? tt('detail.workflow', 'Workflow progression')}
            </span>
            {currentWorkflowStep ? (
              <span className="block text-xs text-muted-foreground mt-0.5 break-words">
                {currentOwner ? `${tt('detail.owner', 'Owner')}: ${currentOwner}` : null}
                {currentOwner && currentTiming ? ' · ' : null}
                {currentTiming ?? null}
              </span>
            ) : null}
          </div>
        </div>
        <div className="overflow-x-auto pb-2">
          <WorkflowStepIndicator steps={steps} className="min-w-[380px] sm:min-w-[520px]" />
        </div>
        {showStepRows ? (
          <div className="space-y-2">
            {steps.map((step, index) => (
              <WorkflowStepRow key={step.id} step={step} index={index} />
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

const workflowStatusStyles: Record<Step['status'], string> = {
  completed: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400',
  active: 'border-primary/30 bg-primary/10 text-primary',
  pending: 'border-border bg-background text-muted-foreground',
  failed: 'border-destructive/30 bg-destructive/10 text-destructive',
  warning: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400',
}

function WorkflowStatusPill({ status }: { status: Step['status'] }) {
  return (
    <span
      className={cn(
        'shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize',
        workflowStatusStyles[status],
      )}
    >
      {status}
    </span>
  )
}

function WorkflowStepRow({
  step,
  index,
}: {
  step: Step
  index: number
}) {
  const tt = useOptionalT()
  return (
    <div
      className={cn(
        'rounded-md border px-3 py-3 text-sm',
        step.status === 'active' && 'border-primary/40 bg-primary/5',
        step.status === 'warning' && 'border-amber-300 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/20',
        step.status === 'failed' && 'border-destructive/40 bg-destructive/5',
      )}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full border bg-background text-xs font-medium text-muted-foreground">
              {index + 1}
            </span>
            <p className="min-w-0 truncate font-medium text-foreground">
              {step.label}
            </p>
            <WorkflowStatusPill status={step.status} />
          </div>
          {step.actionNote ? (
            <p className="line-clamp-2 text-xs text-muted-foreground">
              {step.actionNote}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-3 grid gap-2 border-t pt-3 grid-cols-1 sm:grid-cols-3">
        <WorkflowStepField label={tt('detail.owner', 'Owner')} value={workflowStepOwner(step)} />
        <WorkflowStepField label={tt('detail.where', 'Where')} value={workflowStepLocation(step)} />
        <WorkflowStepField label={tt('detail.time', 'Time')} value={workflowStepTiming(step, tt)} />
      </div>
    </div>
  )
}

function WorkflowStepField({
  label,
  value,
}: {
  label: string
  value?: string | null
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="truncate text-sm text-foreground">{value || '-'}</p>
    </div>
  )
}

function workflowStepOwner(step: Step) {
  if (step.status === 'completed' || step.status === 'failed') {
    return (
      step.actionByName ??
      step.actionBy?.fullName ??
      step.assignedToName ??
      step.assignedTo?.fullName ??
      step.assignedRole ??
      step.role ??
      null
    )
  }

  return (
    step.assignedToName ??
    step.assignedTo?.fullName ??
    step.assignedRole ??
    step.role ??
    null
  )
}

function workflowStepLocation(step: Step) {
  return (
    step.unitName ??
    step.assignedUnit?.name ??
    (step.type ? titleize(step.type) : null) ??
    null
  )
}

function workflowStepTiming(
  step: Step,
  tt: (key: string, fallback: string, params?: Record<string, string | number>) => string,
) {
  if (step.completedAt || step.actedAt) {
    const dateStr = formatWorkflowDate(step.completedAt ?? step.actedAt)
    return tt('detail.doneAt', `Done ${dateStr}`, { date: dateStr })
  }

  if (step.dueAt) {
    const remaining = formatRemaining(step.dueAt, tt)
    if (remaining) return remaining
  }

  if (step.startedAt && (step.status === 'active' || step.status === 'warning' || step.isCurrent)) {
    const dateStr = formatWorkflowDate(step.startedAt)
    return tt('detail.since', `Since ${dateStr}`, { date: dateStr })
  }

  return null
}

function formatWorkflowDate(value?: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function formatRemaining(
  value: string | null | undefined,
  tt: (key: string, fallback: string, params?: Record<string, string | number>) => string,
) {
  if (!value) return null
  const due = new Date(value).getTime()
  if (Number.isNaN(due)) return null

  const diff = due - Date.now()
  const abs = Math.abs(diff)
  const totalMinutes = Math.max(1, Math.round(abs / 60000))
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  const duration =
    days > 0
      ? `${days}d ${hours}h`
      : hours > 0
        ? `${hours}h ${minutes}m`
        : `${minutes}m`

  return diff < 0
    ? tt('detail.overdueDuration', 'Overdue {{duration}}', { duration })
    : tt('detail.durationLeft', '{{duration}} left', { duration })
}

export function RequestQuickFactsCard({
  detail,
}: {
  detail: RequestDetailViewModel
}) {
  const tt = useOptionalT()
  return (
    <Card>
      <CardHeader>
        <CardTitle>{tt('detail.quickFacts', 'Quick Facts')}</CardTitle>
      </CardHeader>
      <CardContent>
        <KeyValueList
          items={[
            { label: tt('detail.requester', 'Requester'),        value: detail.requester?.fullName ?? null },
            { label: tt('detail.currentAssignee', 'Current Assignee'), value: detail.currentAssignee?.fullName ?? null },
            {
              label: tt('detail.assignedPeople', 'Assigned People'),
              value: detail.assignedPeople.length > 0 ? detail.assignedPeople.join(', ') : null,
            },
            { label: tt('detail.activityCount', 'Activity Count'),   value: String(detail.timeline.length) },
          ]}
        />
      </CardContent>
    </Card>
  )
}

export function RelatedEntitiesCard({
  detail,
}: {
  detail: RequestDetailViewModel
}) {
  const tt = useOptionalT()
  const requester = detail.requester
  const requesterNumber =
    requester?.role?.toUpperCase().includes('STUDENT')
      ? requester.studentNumber
      : requester?.staffNumber
  const requesterRole = requester?.role ? titleize(requester.role) : '-'

  return (
    <Card>
      <CardHeader>
        <CardTitle>{tt('detail.requesterDetails', 'Requester Details')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <KeyValueList
          items={[
            { label: tt('detail.fullName', 'Full Name'),        value: requester?.fullName ?? null },
            { label: tt('forms.email', 'Email'),            value: requester?.email ?? null, fullWidth: true },
            { label: tt('detail.role', 'Role'),             value: requesterRole },
            { label: tt('forms.department', 'Department'),       value: requester?.department ?? null },
            { label: tt('forms.faculty', 'Faculty'),          value: requester?.faculty ?? null },
            { label: tt('detail.academicTitle', 'Academic Title'),   value: requester?.title ?? null },
            {
              label: requester?.role?.toUpperCase().includes('STUDENT') ? tt('forms.studentNumber', 'Student Number') : tt('detail.staffNumber', 'Staff Number'),
              value: requesterNumber ?? null,
            },
            { label: tt('detail.currentAssignee', 'Current Assignee'), value: detail.currentAssignee?.fullName ?? null },
            {
              label: tt('detail.assignedPeople', 'Assigned People'),
              value: detail.assignedPeople.length > 0 ? detail.assignedPeople.join(', ') : null,
            },
            { label: tt('detail.domainKey', 'Domain Key'),       value: humanize(detail.requestType.key) },
          ]}
        />
        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4 text-sm">
          <span className="text-muted-foreground shrink-0">{tt('detail.workflowStatus', 'Workflow Status')}</span>
          <StatusBadge status={detail.workflow.status ?? detail.status} />
        </div>
      </CardContent>
    </Card>
  )
}
