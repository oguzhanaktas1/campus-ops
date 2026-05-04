'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import {
  ExternalLink,
  Filter,
  Loader2,
  Search,
  TimerReset,
  Workflow,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  WORKFLOW_BACKEND as BACKEND,
  workflowAuthHeaders as authHeaders,
  formatDate,
  formatDuration,
  formatEnumLabel,
  type WorkflowDetail,
  type WorkflowInstance,
  type WorkflowRequestType,
  type WorkflowStep,
} from '@/lib/admin-workflow'

type WorkflowInstanceRecord = {
  workflowId: string
  workflowKey: string
  workflowName: string
  workflowSteps: WorkflowStep[]
  requestTypes: WorkflowRequestType[]
  instance: WorkflowInstance
}

function getTimelineStepState(record: WorkflowInstanceRecord, stepId: string) {
  const instanceStep = record.instance.instanceSteps.find(
    (step) => step.workflowStep.id === stepId,
  )

  if (instanceStep?.status === 'COMPLETED') {
    return {
      label: 'Completed',
      className: 'bg-emerald-100 text-emerald-700',
      step: instanceStep,
    }
  }

  if (record.instance.currentStep?.id === stepId) {
    const isOverdue = record.instance.isOverdue || Boolean(instanceStep?.isOverdue)
    return {
      label: isOverdue ? 'Overdue' : 'Active',
      className: isOverdue ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700',
      step: instanceStep ?? null,
    }
  }

  return {
    label: 'Pending',
    className: 'bg-amber-100 text-amber-700',
    step: instanceStep ?? null,
  }
}

export default function AdminWorkflowInstancesPage() {
  const { t } = useI18n()
  const [workflowDetails, setWorkflowDetails] = useState<WorkflowDetail[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [requestTypeFilter, setRequestTypeFilter] = useState('all')
  const [workflowFilter, setWorkflowFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      try {
        const summaryRes = await fetch(`${BACKEND}/admin/workflows/instances/overview`, {
          headers: authHeaders(),
        })
        if (!summaryRes.ok) throw new Error('Failed to load workflows.')

        const details = (await summaryRes.json()) as WorkflowDetail[]
        setWorkflowDetails(Array.isArray(details) ? details : [])
      } catch (error) {
        setWorkflowDetails([])
        toast.error(
          error instanceof Error ? error.message : 'Failed to load workflow instances.',
        )
      } finally {
        setIsLoading(false)
      }
    }

    void load()
  }, [])

  const requestTypeOptions = useMemo(() => {
    const seen = new Map<string, WorkflowRequestType>()

    workflowDetails.forEach((workflow) => {
      workflow.requestTypes?.forEach((type) => {
        seen.set(type.id, type)
      })
    })

    return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [workflowDetails])

  const records = useMemo<WorkflowInstanceRecord[]>(
    () =>
      workflowDetails.flatMap((workflow) =>
        workflow.instances.map((instance) => ({
          workflowId: workflow.id,
          workflowKey: workflow.key,
          workflowName: workflow.name,
          workflowSteps: workflow.steps ?? [],
          requestTypes: workflow.requestTypes ?? [],
          instance,
        })),
      ),
    [workflowDetails],
  )

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase()

    return records.filter((record) => {
      const matchesSearch =
        query.length === 0 ||
        [
          record.instance.request.requestNo,
          record.instance.request.title,
          record.instance.request.requesterName,
          record.instance.request.currentAssigneeName ?? '',
          record.workflowName,
          record.workflowKey,
          record.instance.currentStep?.stepName ?? '',
          ...record.requestTypes.flatMap((type) => [type.name, type.key]),
        ].some((value) => value.toLowerCase().includes(query))

      const matchesRequestType =
        requestTypeFilter === 'all' ||
        record.requestTypes.some((type) => type.id === requestTypeFilter)

      const matchesWorkflow =
        workflowFilter === 'all' || record.workflowId === workflowFilter

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'overdue'
          ? record.instance.isOverdue
          : record.instance.status === statusFilter)

      return matchesSearch && matchesRequestType && matchesWorkflow && matchesStatus
    })
  }, [records, requestTypeFilter, search, statusFilter, workflowFilter])

  const totals = useMemo(
    () => ({
      total: records.length,
      active: records.filter((record) => record.instance.status === 'ACTIVE').length,
      completed: records.filter((record) => record.instance.status === 'COMPLETED').length,
      overdue: records.filter((record) => record.instance.isOverdue).length,
    }),
    [records],
  )

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">{t('workflows.instancesTitle')}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t('workflows.instancesSubtitle', { count: records.length })}
          </p>
        </div>
        <Button asChild variant="outline" className="gap-1.5">
          <Link href="/admin/workflows">
            Workflow definitions
            <ExternalLink className="size-3.5" />
          </Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Total Instances', totals.total],
          ['Active', totals.active],
          ['Completed', totals.completed],
          ['Overdue', totals.overdue],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
          </div>
        ))}
      </div>

      <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Filter className="size-4 text-primary" />
          Filters
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_220px_220px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('common.search')}
              className="pl-9"
            />
          </div>

          <select
            value={workflowFilter}
            onChange={(event) => setWorkflowFilter(event.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
          >
            <option value="all">All workflows</option>
            {workflowDetails.map((workflow) => (
              <option key={workflow.id} value={workflow.id}>
                {workflow.name}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
          >
            <option value="all">{t('common.status')}</option>
            <option value="ACTIVE">Active</option>
            <option value="COMPLETED">Completed</option>
            <option value="overdue">Overdue</option>
          </select>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={requestTypeFilter === 'all' ? 'default' : 'outline'}
            onClick={() => setRequestTypeFilter('all')}
          >
            All Request Types
          </Button>
          {requestTypeOptions.map((type) => (
            <Button
              key={type.id}
              type="button"
              size="sm"
              variant={requestTypeFilter === type.id ? 'default' : 'outline'}
              onClick={() => setRequestTypeFilter(type.id)}
            >
              {type.name}
            </Button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          <span>{filteredRecords.length} instance shown</span>
          <button
            type="button"
            onClick={() => {
              setSearch('')
              setRequestTypeFilter('all')
              setWorkflowFilter('all')
              setStatusFilter('all')
            }}
            className="inline-flex items-center gap-1 text-foreground transition hover:text-primary"
          >
            <TimerReset className="size-3.5" />
            {t('common.refresh')}
          </button>
        </div>
      </section>

      <section className="space-y-4">
        {filteredRecords.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center shadow-sm">
            <Workflow className="mx-auto mb-3 size-10 text-muted-foreground/30" />
            <p className="text-sm font-medium text-foreground">{t('workflows.noInstances')}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('workflows.instancesSubtitle', { count: 0 })}
            </p>
          </div>
        ) : (
          filteredRecords.map((record) => {
            const { instance } = record

            return (
              <details
                key={instance.id}
                className="group rounded-xl border border-border bg-card shadow-sm"
              >
                <summary className="cursor-pointer list-none p-4 marker:hidden">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/admin/requests/${instance.request.id}`}
                          className="text-sm font-semibold text-foreground hover:text-primary"
                        >
                          {instance.request.requestNo}
                        </Link>
                        <span className="text-sm text-muted-foreground">/</span>
                        <p className="truncate text-sm text-foreground">
                          {instance.request.title}
                        </p>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge variant="outline">{record.workflowName}</Badge>
                        <Badge variant="outline">
                          Request {formatEnumLabel(instance.request.status)}
                        </Badge>
                        <Badge variant="outline">
                          Instance {formatEnumLabel(instance.status)}
                        </Badge>
                        <Badge
                          className={cn(
                            'border-transparent',
                            instance.isOverdue
                              ? 'bg-red-100 text-red-700'
                              : 'bg-emerald-100 text-emerald-700',
                          )}
                        >
                          {instance.isOverdue ? 'Overdue' : 'On Track'}
                        </Badge>
                        {record.requestTypes.map((type) => (
                          <Badge key={type.id} variant="secondary">
                            {type.name}
                          </Badge>
                        ))}
                      </div>

                      <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 xl:grid-cols-4">
                        <p>{t('workflows.colRequest')}: <span className="text-foreground">{instance.request.requesterName}</span></p>
                        <p>Assignee: <span className="text-foreground">{instance.request.currentAssigneeName ?? 'Unassigned'}</span></p>
                        <p>{t('workflows.colCurrentStep')}: <span className="text-foreground">{instance.currentStep?.stepName ?? 'Terminal'}</span></p>
                        <p>{t('workflows.colStarted')}: <span className="text-foreground">{formatDate(instance.startedAt)}</span></p>
                      </div>
                    </div>

                    <div className="grid min-w-[220px] gap-2 text-xs text-muted-foreground sm:grid-cols-3 xl:grid-cols-1">
                      <div className="rounded-lg bg-muted/20 px-3 py-2">
                        <p>Total Age</p>
                        <p className="mt-1 text-sm font-medium text-foreground">
                          {formatDuration(instance.totalAgeMinutes)}
                        </p>
                      </div>
                      <div className="rounded-lg bg-muted/20 px-3 py-2">
                        <p>Step Age</p>
                        <p className="mt-1 text-sm font-medium text-foreground">
                          {formatDuration(instance.currentStepAgeMinutes)}
                        </p>
                      </div>
                      <div className="rounded-lg bg-muted/20 px-3 py-2">
                        <p>Idle</p>
                        <p className="mt-1 text-sm font-medium text-foreground">
                          {formatDuration(instance.inactiveMinutes)}
                        </p>
                      </div>
                    </div>
                  </div>
                </summary>

                <div className="border-t border-border px-4 pb-4 pt-4">
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.9fr)]">
                    <div className="space-y-4">
                      <div className="rounded-lg border border-border bg-muted/10 p-4">
                        <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                          <p>Workflow: <span className="text-foreground">{record.workflowName}</span></p>
                          <p>Workflow Key: <span className="font-mono text-foreground">{record.workflowKey}</span></p>
                          <p>Ended At: <span className="text-foreground">{formatDate(instance.endedAt)}</span></p>
                          <p>Priority: <span className="text-foreground">{formatEnumLabel(instance.request.priority)}</span></p>
                        </div>
                      </div>

                      {instance.request.sla && (
                        <div className="rounded-lg border border-border p-4">
                          <h3 className="text-sm font-semibold text-foreground">SLA Snapshot</h3>
                          <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                            <p>Due At: <span className="text-foreground">{formatDate(instance.request.sla.dueAt)}</span></p>
                            <p>First Response: <span className="text-foreground">{formatEnumLabel(instance.request.sla.firstResponseState)}</span></p>
                            <p>Resolution: <span className="text-foreground">{formatEnumLabel(instance.request.sla.resolutionState)}</span></p>
                            <p>Escalated: <span className="text-foreground">{instance.request.sla.escalationTriggered ? 'Yes' : 'No'}</span></p>
                            <p>Step Overdues: <span className="text-foreground">{instance.request.sla.stepOverdueCount ?? 0}</span></p>
                          </div>
                        </div>
                      )}

                      {instance.activeAssignment && (
                        <div className="rounded-lg border border-border p-4">
                          <h3 className="text-sm font-semibold text-foreground">Active Assignment</h3>
                          <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                            <p>Assigned To: <span className="text-foreground">{instance.activeAssignment.assignedToName}</span></p>
                            <p>Assigned By: <span className="text-foreground">{instance.activeAssignment.assignedByName ?? 'System'}</span></p>
                            <p>Assigned At: <span className="text-foreground">{formatDate(instance.activeAssignment.assignedAt)}</span></p>
                            <p>Assignment Age: <span className="text-foreground">{formatDuration(instance.activeAssignment.assignedAgeMinutes)}</span></p>
                          </div>
                        </div>
                      )}

                      {instance.request.ticketLifecycle ? (
                        <div className="rounded-lg border border-border p-4">
                          <h3 className="text-sm font-semibold text-foreground">Ticket Lifecycle</h3>
                          <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                            <p>Ticket Status: <span className="text-foreground">{formatEnumLabel(instance.request.ticketLifecycle.status)}</span></p>
                            <p>Opened By: <span className="text-foreground">{instance.request.ticketLifecycle.openedBy ?? 'N/A'}</span></p>
                            <p>Opened At: <span className="text-foreground">{formatDate(instance.request.ticketLifecycle.openedAt)}</span></p>
                            <p>Resolved By: <span className="text-foreground">{instance.request.ticketLifecycle.resolvedBy ?? 'N/A'}</span></p>
                            <p>Resolved At: <span className="text-foreground">{formatDate(instance.request.ticketLifecycle.resolvedAt)}</span></p>
                            <p>Closed By: <span className="text-foreground">{instance.request.ticketLifecycle.closedBy ?? 'N/A'}</span></p>
                            <p>Closed At: <span className="text-foreground">{formatDate(instance.request.ticketLifecycle.closedAt)}</span></p>
                            <p>Reopened Count: <span className="text-foreground">{instance.request.ticketLifecycle.reopenedCount ?? 0}</span></p>
                          </div>
                          {instance.request.ticketLifecycle.stages?.length ? (
                            <div className="mt-3 space-y-2">
                              {instance.request.ticketLifecycle.stages.map((stage) => (
                                <div key={stage.key} className="rounded-md bg-muted/20 p-3 text-xs text-muted-foreground">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="font-medium text-foreground">{stage.label}</p>
                                    <span>{formatDate(stage.at)}</span>
                                  </div>
                                  <p className="mt-1">By <span className="text-foreground">{stage.by ?? 'N/A'}</span></p>
                                  {stage.note ? (
                                    <p className="mt-1 text-foreground">{stage.note}</p>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="rounded-lg border border-border p-4">
                        <h3 className="text-sm font-semibold text-foreground">Step Timeline</h3>
                        <div className="mt-3 space-y-3">
                          {record.workflowSteps
                            .slice()
                            .sort((a, b) => a.stepOrder - b.stepOrder)
                            .map((workflowStep, index) => {
                              const timeline = getTimelineStepState(record, workflowStep.id)

                              return (
                                <div key={workflowStep.id} className="flex gap-3">
                                  <div className="flex flex-col items-center">
                                    <div className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                                      {index + 1}
                                    </div>
                                    {index < record.workflowSteps.length - 1 && (
                                      <div className="mt-1 h-full w-px bg-border" />
                                    )}
                                  </div>

                                  <div className="min-w-0 flex-1 rounded-lg bg-muted/10 p-3 text-xs text-muted-foreground">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <p className="font-medium text-foreground">
                                        {workflowStep.stepName}
                                      </p>
                                      <Badge className={cn('border-transparent', timeline.className)}>
                                        {timeline.label}
                                      </Badge>
                                    </div>

                                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                      <p>Type: <span className="text-foreground">{formatEnumLabel(workflowStep.stepType)}</span></p>
                                      <p>Assigned To: <span className="text-foreground">{timeline.step?.assignedTo?.fullName ?? 'Queue'}</span></p>
                                      <p>Started: <span className="text-foreground">{formatDate(timeline.step?.startedAt)}</span></p>
                                      <p>Due: <span className="text-foreground">{formatDate(timeline.step?.dueAt)}</span></p>
                                      <p>Completed: <span className="text-foreground">{formatDate(timeline.step?.completedAt)}</span></p>
                                      <p>Action: <span className="text-foreground">{formatEnumLabel(timeline.step?.actionTaken)}</span></p>
                                    </div>

                                    {timeline.step?.actionBy && (
                                      <p className="mt-2">
                                        Action By: <span className="text-foreground">{timeline.step.actionBy.fullName}</span>
                                      </p>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-lg border border-border p-4">
                        <h3 className="text-sm font-semibold text-foreground">Approval Timeline</h3>
                        {instance.approvalTimeline.length === 0 ? (
                          <p className="mt-3 text-xs text-muted-foreground">
                            No approval action recorded yet.
                          </p>
                        ) : (
                          <div className="mt-3 space-y-3">
                            {instance.approvalTimeline.map((action) => (
                              <div
                                key={action.id}
                                className="rounded-lg bg-muted/10 p-3 text-xs text-muted-foreground"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <Badge variant="outline">
                                    {formatEnumLabel(action.actionType)}
                                  </Badge>
                                  <span>{formatDate(action.createdAt)}</span>
                                </div>
                                <p className="mt-2">
                                  By <span className="text-foreground">{action.actionBy.fullName}</span>
                                </p>
                                {action.decisionNote && (
                                  <p className="mt-2 rounded-md bg-background px-2 py-2 text-foreground">
                                    {action.decisionNote}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="rounded-lg border border-border p-4">
                        <h3 className="text-sm font-semibold text-foreground">Quick Actions</h3>
                        <div className="mt-3 flex flex-col gap-2">
                          <Button asChild variant="outline" className="justify-between">
                            <Link href={`/admin/requests/${instance.request.id}`}>
                              Open request detail
                              <ExternalLink className="size-4" />
                            </Link>
                          </Button>
                          <Button asChild variant="outline" className="justify-between">
                            <Link href={`/admin/workflows/${record.workflowId}`}>
                              Open workflow detail
                              <ExternalLink className="size-4" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </details>
            )
          })
        )}
      </section>
    </div>
  )
}
