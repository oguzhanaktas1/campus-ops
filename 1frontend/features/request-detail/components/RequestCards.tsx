import { NT } from '@/components/no-translate'
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

function KeyValueList({
  items,
}: {
  items: Array<{ label: string; value: string | null; noTranslate?: boolean }>
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) =>
        item.value ? (
          <div key={item.label} className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {item.label}
            </p>
            {item.noTranslate ? (
              <NT as="p" className="text-sm text-foreground">{item.value}</NT>
            ) : (
              <p className="text-sm text-foreground">{item.value}</p>
            )}
          </div>
        ) : null,
      )}
    </div>
  )
}

export function RequestMetaCard({ detail }: { detail: RequestDetailViewModel }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Request Meta</CardTitle>
      </CardHeader>
      <CardContent>
        <KeyValueList
          items={[
            { label: 'Type', value: detail.requestType.name },
            { label: 'Category', value: detail.requestType.category ?? null },
            { label: 'Status', value: titleize(detail.status) },
            { label: 'Priority', value: titleize(detail.priority) },
            {
              label: 'Submitted',
              value: formatDate(detail.submittedAt ?? detail.createdAt),
            },
            {
              label: 'Due At',
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
  const steps =
    detail.workflow.steps && detail.workflow.steps.length > 0
      ? detail.workflow.steps
      : buildWorkflowSteps(detail.requestType.key, detail.status)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workflow</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
          <span className="text-sm text-muted-foreground">Current Step</span>
          <span className="text-sm font-medium text-foreground">
            {detail.workflow.currentStep ?? 'Workflow progression'}
          </span>
        </div>
        <WorkflowStepIndicator steps={steps} />
      </CardContent>
    </Card>
  )
}

export function RequestQuickFactsCard({
  detail,
}: {
  detail: RequestDetailViewModel
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Facts</CardTitle>
      </CardHeader>
      <CardContent>
        <KeyValueList
          items={[
            { label: 'Requester',        value: detail.requester?.fullName ?? null,        noTranslate: true },
            { label: 'Current Assignee', value: detail.currentAssignee?.fullName ?? null,  noTranslate: true },
            {
              label: 'Assigned People',
              value: detail.assignedPeople.length > 0 ? detail.assignedPeople.join(', ') : null,
              noTranslate: true,
            },
            { label: 'Activity Count',   value: String(detail.timeline.length) },
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
  const requester = detail.requester
  const requesterNumber =
    requester?.role?.toUpperCase().includes('STUDENT')
      ? requester.studentNumber
      : requester?.staffNumber
  const requesterRole = requester?.role ? titleize(requester.role) : '-'

  return (
    <Card>
      <CardHeader>
        <CardTitle>Requester Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <KeyValueList
          items={[
            { label: 'Full Name',        value: requester?.fullName ?? null,   noTranslate: true },
            { label: 'Email',            value: requester?.email ?? null,      noTranslate: true },
            { label: 'Role',             value: requesterRole },
            { label: 'Department',       value: requester?.department ?? null },
            { label: 'Faculty',          value: requester?.faculty ?? null },
            { label: 'Academic Title',   value: requester?.title ?? null },
            {
              label: requester?.role?.toUpperCase().includes('STUDENT') ? 'Student Number' : 'Staff Number',
              value: requesterNumber ?? null,
              noTranslate: true,
            },
            { label: 'Current Assignee', value: detail.currentAssignee?.fullName ?? null, noTranslate: true },
            {
              label: 'Assigned People',
              value: detail.assignedPeople.length > 0 ? detail.assignedPeople.join(', ') : null,
              noTranslate: true,
            },
            { label: 'Domain Key',       value: humanize(detail.requestType.key) },
          ]}
        />
        <div className="flex items-center justify-between gap-4 border-t pt-4 text-sm">
          <span className="text-muted-foreground">Workflow Status</span>
          <StatusBadge status={detail.workflow.status ?? detail.status} />
        </div>
      </CardContent>
    </Card>
  )
}
