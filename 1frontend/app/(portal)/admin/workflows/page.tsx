'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import {
  ChevronRight,
  ExternalLink,
  GitBranch,
  Loader2,
  Plus,
  Settings2,
  Trash2,
  Workflow,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  WORKFLOW_BACKEND as BACKEND,
  workflowAuthHeaders as authHeaders,
  type WorkflowDetail,
  type WorkflowSummary,
} from '@/lib/admin-workflow'

const STEP_TYPES = ['START', 'REVIEW', 'APPROVAL', 'REVISION', 'ASSIGNMENT', 'AUTO_ACTION', 'END']
const ACTION_TYPES = ['SUBMIT', 'APPROVE', 'REJECT', 'REQUEST_REVISION', 'ASSIGN', 'ESCALATE', 'CANCEL', 'COMPLETE', 'AUTO_TRANSITION']

export default function AdminWorkflowsPage() {
  const { t } = useI18n()
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowDetail | null>(null)
  const [roles, setRoles] = useState<Array<{ id: string; name: string }>>([])
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string }>>([])
  const [units, setUnits] = useState<Array<{ id: string; name: string }>>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDetailLoading, setIsDetailLoading] = useState(false)

  const [isCreateWorkflowOpen, setIsCreateWorkflowOpen] = useState(false)
  const [isCreateStepOpen, setIsCreateStepOpen] = useState(false)
  const [isCreateTransitionOpen, setIsCreateTransitionOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isMetaLoading, setIsMetaLoading] = useState(false)

  const [workflowForm, setWorkflowForm] = useState({
    key: '',
    name: '',
    description: '',
  })
  const [stepForm, setStepForm] = useState({
    stepKey: '',
    stepName: '',
    stepOrder: '',
    stepType: 'REVIEW',
    assignedRoleId: '',
    assignedUserId: '',
    assignedUnitId: '',
    slaHours: '',
  })
  const [transitionForm, setTransitionForm] = useState({
    fromStepId: '',
    toStepId: '',
    actionType: 'APPROVE',
  })

  const fetchWorkflows = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND}/admin/workflows`, {
        headers: authHeaders(),
      })
      if (!res.ok) throw new Error(t('workflows.loadFail'))
      const data = (await res.json()) as WorkflowSummary[]
      setWorkflows(Array.isArray(data) ? data : [])
      setSelectedId((current) => current ?? data?.[0]?.id ?? null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('workflows.loadFail'))
      setWorkflows([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  const fetchMeta = useCallback(async () => {
    if (isMetaLoading) return
    if (roles.length && users.length && units.length) return

    setIsMetaLoading(true)
    try {
      const [rolesRes, usersRes, unitsRes] = await Promise.all([
        fetch(`${BACKEND}/admin/roles`, { headers: authHeaders() }),
        fetch(`${BACKEND}/admin/users`, { headers: authHeaders() }),
        fetch(`${BACKEND}/admin/units`, { headers: authHeaders() }),
      ])

      if (rolesRes.ok) {
        const data = await rolesRes.json()
        setRoles(Array.isArray(data) ? data : [])
      }

      if (usersRes.ok) {
        const data = await usersRes.json()
        setUsers(
          Array.isArray(data)
            ? data.map((user: any) => ({
                id: user.id,
                name: user.name ?? user.email,
                email: user.email,
              }))
            : [],
        )
      }

      if (unitsRes.ok) {
        const data = await unitsRes.json()
        setUnits(Array.isArray(data) ? data : [])
      }
    } catch {
      // silent meta fallback
    } finally {
      setIsMetaLoading(false)
    }
  }, [isMetaLoading, roles.length, units.length, users.length])

  const fetchWorkflowDetail = useCallback(async (id: string) => {
    setIsDetailLoading(true)
    try {
      const res = await fetch(`${BACKEND}/admin/workflows/${id}`, {
        headers: authHeaders(),
      })
      if (!res.ok) throw new Error(t('workflows.detailLoadFail'))
      const data = (await res.json()) as WorkflowDetail
      setSelectedWorkflow(data)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('workflows.detailLoadFail'))
      setSelectedWorkflow(null)
    } finally {
      setIsDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchWorkflows()
  }, [fetchWorkflows])

  useEffect(() => {
    if (!isCreateStepOpen) return
    void fetchMeta()
  }, [fetchMeta, isCreateStepOpen])

  useEffect(() => {
    if (!selectedId) {
      setSelectedWorkflow(null)
      return
    }
    void fetchWorkflowDetail(selectedId)
  }, [fetchWorkflowDetail, selectedId])

  const selectedSummary = useMemo(
    () => workflows.find((workflow) => workflow.id === selectedId) ?? null,
    [selectedId, workflows],
  )

  const resetWorkflowForm = () =>
    setWorkflowForm({ key: '', name: '', description: '' })

  const resetStepForm = () =>
    setStepForm({
      stepKey: '',
      stepName: '',
      stepOrder: '',
      stepType: 'REVIEW',
      assignedRoleId: '',
      assignedUserId: '',
      assignedUnitId: '',
      slaHours: '',
    })

  const resetTransitionForm = (detail?: WorkflowDetail | null) =>
    setTransitionForm({
      fromStepId: detail?.steps?.[0]?.id ?? '',
      toStepId: '',
      actionType: 'APPROVE',
    })

  const refreshAll = async (keepSelectedId?: string | null) => {
    await fetchWorkflows()
    if (keepSelectedId) {
      setSelectedId(keepSelectedId)
      await fetchWorkflowDetail(keepSelectedId)
    }
  }

  const handleCreateWorkflow = async () => {
    if (!workflowForm.key.trim() || !workflowForm.name.trim()) {
      toast.error(t('workflows.keyNameRequired'))
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch(`${BACKEND}/admin/workflows`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          key: workflowForm.key.trim().toUpperCase(),
          name: workflowForm.name.trim(),
          description: workflowForm.description.trim() || null,
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message ?? t('workflows.createFail'))

      toast.success(t('workflows.createSuccess'))
      setIsCreateWorkflowOpen(false)
      resetWorkflowForm()
      await refreshAll(data.id ?? null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('workflows.createFail'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteWorkflow = async (id: string, event: React.MouseEvent) => {
    event.stopPropagation()
    if (!window.confirm(t('workflows.deleteConfirm'))) return

    try {
      const res = await fetch(`${BACKEND}/admin/workflows/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      })
      if (!res.ok) throw new Error(t('workflows.deleteFail'))
      toast.success(t('workflows.deleteSuccess'))
      const fallbackId =
        workflows.find((workflow) => workflow.id !== id)?.id ?? null
      setSelectedId((current) => (current === id ? fallbackId : current))
      await fetchWorkflows()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('workflows.deleteFail'))
    }
  }

  const handleCreateStep = async () => {
    if (!selectedId) return
    if (!stepForm.stepKey.trim() || !stepForm.stepName.trim() || !stepForm.stepOrder) {
      toast.error(t('workflows.stepRequired'))
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch(`${BACKEND}/admin/workflows/${selectedId}/steps`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          stepKey: stepForm.stepKey.trim().toUpperCase(),
          stepName: stepForm.stepName.trim(),
          stepOrder: Number(stepForm.stepOrder),
          stepType: stepForm.stepType,
          assignedRoleId: stepForm.assignedRoleId || undefined,
          assignedUserId: stepForm.assignedUserId || undefined,
          assignedUnitId: stepForm.assignedUnitId || undefined,
          slaHours: stepForm.slaHours ? Number(stepForm.slaHours) : undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message ?? t('workflows.stepAddFail'))
      toast.success(t('workflows.stepAdded'))
      setIsCreateStepOpen(false)
      resetStepForm()
      await fetchWorkflowDetail(selectedId)
      await fetchWorkflows()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('workflows.stepAddFail'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCreateTransition = async () => {
    if (!selectedId) return
    if (!transitionForm.fromStepId) {
      toast.error(t('workflows.fromStepRequired'))
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch(`${BACKEND}/admin/workflows/${selectedId}/transitions`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          fromStepId: transitionForm.fromStepId,
          toStepId: transitionForm.toStepId || undefined,
          actionType: transitionForm.actionType,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message ?? t('workflows.transitionAddFail'))
      toast.success(t('workflows.transitionAdded'))
      setIsCreateTransitionOpen(false)
      resetTransitionForm(selectedWorkflow)
      await fetchWorkflowDetail(selectedId)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('workflows.transitionAddFail'))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">{t('workflows.title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t('workflows.subtitle', { count: workflows.length })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link href="/admin/workflow-instances">
              Workflow Instances
              <ExternalLink className="size-3.5" />
            </Link>
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setIsCreateWorkflowOpen(true)}>
            <Plus className="size-3.5" />
            {t('workflows.addWorkflow')}
          </Button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-3">
          {workflows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center">
              <Workflow className="size-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">{t('workflows.noWorkflows')}</p>
            </div>
          ) : (
            workflows.map((workflow) => (
              <div
                key={workflow.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedId(workflow.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setSelectedId(workflow.id)
                  }
                }}
                className={cn(
                  'w-full rounded-lg border bg-card p-4 text-left shadow-sm transition-all hover:border-primary/40',
                  selectedId === workflow.id ? 'border-primary bg-primary/5' : 'border-border',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {workflow.name}
                      </p>
                      {workflow.isActive && (
                        <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-700">
                          {t('common.status')}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs font-mono text-muted-foreground">
                      {workflow.key}
                    </p>
                    {workflow.description && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {workflow.description}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-muted-foreground">
                      v{workflow.version} · {workflow.steps?.length ?? 0} steps · {workflow._count?.instances ?? 0} instances
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-destructive hover:bg-destructive/10"
                      onClick={(event) => void handleDeleteWorkflow(workflow.id, event)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                    <ChevronRight className={cn('size-4 text-muted-foreground', selectedId === workflow.id && 'rotate-90')} />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="rounded-lg border border-border bg-card shadow-sm">
          {!selectedId || !selectedSummary ? (
            <div className="flex min-h-[28rem] items-center justify-center p-6 text-sm text-muted-foreground">
              {t('workflows.editWorkflow')}
            </div>
          ) : isDetailLoading || !selectedWorkflow ? (
            <div className="flex min-h-[28rem] items-center justify-center p-6">
              <Loader2 className="size-7 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-6 p-6">
              <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Settings2 className="size-4" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-foreground">{selectedWorkflow.name}</h2>
                      <p className="text-xs font-mono text-muted-foreground">{selectedWorkflow.key}</p>
                    </div>
                  </div>
                  {selectedWorkflow.description && (
                    <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
                      {selectedWorkflow.description}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => {
                      resetStepForm()
                      setIsCreateStepOpen(true)
                    }}
                  >
                    <Plus className="size-3.5" />
                    Add Step
                  </Button>
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={() => {
                      resetTransitionForm(selectedWorkflow)
                      setIsCreateTransitionOpen(true)
                    }}
                    disabled={selectedWorkflow.steps.length === 0}
                  >
                    <GitBranch className="size-3.5" />
                    Add Transition
                  </Button>
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                <section className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {[
                      [t('workflows.requestTypes'), selectedWorkflow.metrics?.requestTypeCount ?? 0],
                      [t('workflows.activeInstances'), selectedWorkflow.metrics?.activeInstances ?? 0],
                      [t('workflows.completedInstances'), selectedWorkflow.metrics?.completedInstances ?? 0],
                      [t('workflows.overdueInstances'), selectedWorkflow.metrics?.overdueInstances ?? 0],
                      [t('workflows.totalInstances'), selectedWorkflow.metrics?.totalInstances ?? 0],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-lg border border-border bg-muted/20 p-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
                        <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-foreground">{t('workflows.boundRequestTypes')}</h3>
                    {selectedWorkflow.requestTypes?.length ? (
                      <div className="flex flex-wrap gap-2">
                        {selectedWorkflow.requestTypes.map((type) => (
                          <span key={type.id} className="rounded-full bg-muted px-3 py-1 text-xs text-foreground">
                            {type.name} ({type.key})
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">{t('workflows.noRequestTypesAttached')}</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground">{t('workflows.steps')}</h3>
                    <span className="text-xs text-muted-foreground">
                      {selectedWorkflow.steps.length} {t('workflows.total')}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {selectedWorkflow.steps.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{t('workflows.noStepsDefined')}</p>
                    ) : (
                      selectedWorkflow.steps
                        .sort((a, b) => a.stepOrder - b.stepOrder)
                        .map((step, index) => (
                          <div key={step.id} className="flex gap-3 rounded-lg border border-border p-4">
                            <div className="flex flex-col items-center">
                              <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                                {index + 1}
                              </div>
                              {index < selectedWorkflow.steps.length - 1 && (
                                <div className="mt-1 h-6 w-px bg-border" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-medium text-foreground">{step.stepName}</p>
                                <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                                  {step.stepType}
                                </span>
                                <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                                  {t('workflows.order')} {step.stepOrder}
                                </span>
                              </div>
                              <p className="text-xs font-mono text-muted-foreground">{step.stepKey}</p>
                              <div className="flex flex-wrap gap-2 pt-1 text-xs text-muted-foreground">
                                {step.assignedRole?.name && <span>{t('workflows.role')}: {step.assignedRole.name}</span>}
                                {step.assignedUser && (
                                  <span>
                                    {t('workflows.user')}: {step.assignedUser.profile?.fullName ?? step.assignedUser.email}
                                  </span>
                                )}
                                {step.assignedUnit?.name && (
                                  <span>
                                    {t('workflows.unit')}: {step.assignedUnit.name}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </section>

                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground">{t('workflows.transitions')}</h3>
                    <span className="text-xs text-muted-foreground">
                      {selectedWorkflow.transitions.length} {t('workflows.total')}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {selectedWorkflow.transitions.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{t('workflows.noTransitionsDefined')}</p>
                    ) : (
                      selectedWorkflow.transitions.map((transition) => (
                        <div key={transition.id} className="rounded-lg border border-border p-4">
                          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                            <span>{transition.fromStep?.stepName ?? t('workflows.unknownStep')}</span>
                            <ChevronRight className="size-4 text-muted-foreground" />
                            <span>{transition.toStep?.stepName ?? t('workflows.terminal')}</span>
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {t('workflows.action')}: {transition.actionType}
                          </p>
                        </div>
                      ))
                    )}
                  </div>

                </section>
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={isCreateWorkflowOpen} onOpenChange={setIsCreateWorkflowOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('workflows.addWorkflow')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>{t('workflows.colName')} *</Label>
              <Input
                value={workflowForm.key}
                onChange={(event) =>
                  setWorkflowForm((prev) => ({
                    ...prev,
                    key: event.target.value.toUpperCase().replace(/\s/g, '_'),
                  }))
                }
                placeholder={t('workflows.keyPlaceholder')}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('common.name')} *</Label>
              <Input
                value={workflowForm.name}
                onChange={(event) =>
                  setWorkflowForm((prev) => ({ ...prev, name: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('common.description')}</Label>
              <Input
                value={workflowForm.description}
                onChange={(event) =>
                  setWorkflowForm((prev) => ({ ...prev, description: event.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateWorkflowOpen(false)} disabled={isSubmitting}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleCreateWorkflow} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateStepOpen} onOpenChange={setIsCreateStepOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('workflows.colSteps')}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t('workflows.searchPlaceholder')} *</Label>
              <Input
                value={stepForm.stepKey}
                onChange={(event) =>
                  setStepForm((prev) => ({
                    ...prev,
                    stepKey: event.target.value.toUpperCase().replace(/\s/g, '_'),
                  }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Step Name *</Label>
              <Input
                value={stepForm.stepName}
                onChange={(event) =>
                  setStepForm((prev) => ({ ...prev, stepName: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Order *</Label>
              <Input
                type="number"
                min="1"
                value={stepForm.stepOrder}
                onChange={(event) =>
                  setStepForm((prev) => ({ ...prev, stepOrder: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Step Type *</Label>
              <select
                value={stepForm.stepType}
                onChange={(event) =>
                  setStepForm((prev) => ({ ...prev, stepType: event.target.value }))
                }
                className="w-full rounded-md border border-input bg-background px-3 h-9 text-sm"
              >
                {STEP_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('workflows.assignedRole')}</Label>
              <select
                value={stepForm.assignedRoleId}
                onChange={(event) =>
                  setStepForm((prev) => ({ ...prev, assignedRoleId: event.target.value }))
                }
                className="w-full rounded-md border border-input bg-background px-3 h-9 text-sm"
              >
                <option value="">{t('workflows.none')}</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('workflows.assignedUser')}</Label>
              <select
                value={stepForm.assignedUserId}
                onChange={(event) =>
                  setStepForm((prev) => ({ ...prev, assignedUserId: event.target.value }))
                }
                className="w-full rounded-md border border-input bg-background px-3 h-9 text-sm"
              >
                <option value="">{t('workflows.none')}</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.email})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('workflows.assignedUnit')}</Label>
              <select
                value={stepForm.assignedUnitId}
                onChange={(event) =>
                  setStepForm((prev) => ({ ...prev, assignedUnitId: event.target.value }))
                }
                className="w-full rounded-md border border-input bg-background px-3 h-9 text-sm"
              >
                <option value="">{t('workflows.none')}</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('workflows.slaHours')}</Label>
              <Input
                type="number"
                min="0"
                value={stepForm.slaHours}
                onChange={(event) =>
                  setStepForm((prev) => ({ ...prev, slaHours: event.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateStepOpen(false)} disabled={isSubmitting}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleCreateStep} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateTransitionOpen} onOpenChange={setIsCreateTransitionOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('workflows.colActions')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>From Step *</Label>
              <select
                value={transitionForm.fromStepId}
                onChange={(event) =>
                  setTransitionForm((prev) => ({ ...prev, fromStepId: event.target.value }))
                }
                className="w-full rounded-md border border-input bg-background px-3 h-9 text-sm"
              >
                <option value="">{t('workflows.selectStep')}</option>
                {selectedWorkflow?.steps.map((step) => (
                  <option key={step.id} value={step.id}>
                    {step.stepName}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Action *</Label>
              <select
                value={transitionForm.actionType}
                onChange={(event) =>
                  setTransitionForm((prev) => ({ ...prev, actionType: event.target.value }))
                }
                className="w-full rounded-md border border-input bg-background px-3 h-9 text-sm"
              >
                {ACTION_TYPES.map((action) => (
                  <option key={action} value={action}>
                    {action}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('workflows.toStep')}</Label>
              <select
                value={transitionForm.toStepId}
                onChange={(event) =>
                  setTransitionForm((prev) => ({ ...prev, toStepId: event.target.value }))
                }
                className="w-full rounded-md border border-input bg-background px-3 h-9 text-sm"
              >
                <option value="">{t('workflows.terminalNoNext')}</option>
                {selectedWorkflow?.steps.map((step) => (
                  <option key={step.id} value={step.id}>
                    {step.stepName}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateTransitionOpen(false)} disabled={isSubmitting}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleCreateTransition} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
