import type { Step, StepStatus } from '@/components/workflow-step-indicator'

export function formatDate(date?: string | null, includeTime = false) {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    ...(includeTime
      ? {
          hour: '2-digit' as const,
          minute: '2-digit' as const,
        }
      : {}),
  })
}

export function formatBytes(size: number | string | null | undefined) {
  if (size === null || size === undefined || size === '') return '-'
  const numeric = typeof size === 'string' ? Number(size) : size
  if (Number.isNaN(numeric)) return String(size)
  if (numeric < 1024) return `${numeric} B`
  if (numeric < 1024 * 1024) return `${(numeric / 1024).toFixed(1)} KB`
  return `${(numeric / 1024 / 1024).toFixed(2)} MB`
}

export function humanize(value?: string | null) {
  if (!value) return '-'
  return value.replace(/_/g, ' ')
}

export function titleize(value?: string | null) {
  if (!value) return '-'
  return humanize(value)
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

type WorkflowTemplateStep = {
  key: string
  label: string
}

type RawWorkflowStep = {
  id?: number | string | null
  workflowStepId?: number | string | null
  key?: string | null
  stepKey?: string | null
  workflowStepKey?: string | null
  label?: string | null
  name?: string | null
  stepName?: string | null
  type?: string | null
  status?: string | null
  isCurrent?: boolean | null
  assignedRole?: string | null
  role?: string | null
  assignedUnit?: { id?: string | null; name?: string | null } | null
  unitName?: string | null
  assignedTo?: {
    id?: string | null
    fullName?: string | null
    email?: string | null
    role?: string | null
  } | null
  assignedToName?: string | null
  actionBy?: {
    id?: string | null
    fullName?: string | null
    email?: string | null
    role?: string | null
  } | null
  actionByName?: string | null
  actionTaken?: string | null
  actionNote?: string | null
  startedAt?: string | null
  completedAt?: string | null
  actedAt?: string | null
  dueAt?: string | null
  slaHours?: number | string | null
  isOverdue?: boolean | null
}

type RawWorkflow = {
  currentStep?: string | null
  currentStepName?: string | null
  steps?: RawWorkflowStep[] | null
}

const WORKFLOW_STEP_TEMPLATES: Record<string, WorkflowTemplateStep[]> = {
  INTERNSHIP_REQUEST: [
    { key: 'SUBMIT', label: 'Submitted' },
    { key: 'ADVISOR_REVIEW', label: 'Advisor Review' },
    { key: 'INTERNSHIP_COORDINATOR_REVIEW', label: 'Internship Coordinator Review' },
    { key: 'APPROVED_END', label: 'Approved' },
  ],
  DOCUMENT_REQUEST: [
    { key: 'SUBMIT', label: 'Submitted' },
    { key: 'DOCUMENT_PROCESSING', label: 'Document Processing' },
    { key: 'APPROVED_END', label: 'Approved' },
  ],
  ROOM_RESERVATION: [
    { key: 'SUBMIT', label: 'Submitted' },
    { key: 'RESOURCE_REVIEW', label: 'Resource Review' },
    { key: 'SECURITY_REVIEW', label: 'Security Review' },
    { key: 'APPROVED_END', label: 'Approved' },
  ],
  APPOINTMENT: [
    { key: 'SUBMIT', label: 'Submitted' },
    { key: 'RESOURCE_REVIEW', label: 'Resource Review' },
    { key: 'APPROVED_END', label: 'Approved' },
  ],
  IT_SUPPORT: [
    { key: 'SUBMIT', label: 'Submitted' },
    { key: 'IT_REVIEW', label: 'IT Review' },
    { key: 'MANAGER_APPROVAL', label: 'Manager Approval' },
    { key: 'APPROVED_END', label: 'Approved' },
    { key: 'IN_PROGRESS', label: 'In Progress' },
    { key: 'COMPLETED_END', label: 'Completed' },
  ],
  EQUIPMENT: [
    { key: 'SUBMIT', label: 'Submitted' },
    { key: 'TECHNICAL_REVIEW', label: 'Technical Review' },
    { key: 'RESOURCE_REVIEW', label: 'Resource Review' },
    { key: 'APPROVED_END', label: 'Approved' },
  ],
  ACCESS_REQUEST: [
    { key: 'SUBMIT', label: 'Submitted' },
    { key: 'SECURITY_REVIEW', label: 'Security Review' },
    { key: 'IT_REVIEW', label: 'IT Review' },
    { key: 'MANAGER_APPROVAL', label: 'Manager Approval' },
    { key: 'APPROVED_END', label: 'Approved' },
  ],
  PROCUREMENT_REQUEST: [
    { key: 'SUBMIT', label: 'Submitted' },
    { key: 'BUDGET_REVIEW', label: 'Budget Review' },
    { key: 'PROCUREMENT_REVIEW', label: 'Procurement Review' },
    { key: 'FINANCE_REVIEW', label: 'Finance Review' },
    { key: 'APPROVED_END', label: 'Approved' },
  ],
  EVENT_REQUEST: [
    { key: 'SUBMIT', label: 'Submitted' },
    { key: 'EVENT_COORDINATOR_REVIEW', label: 'Event Coordinator Review' },
    { key: 'RESOURCE_REVIEW', label: 'Resource Review' },
    { key: 'SECURITY_REVIEW', label: 'Security Review' },
    { key: 'APPROVED_END', label: 'Approved' },
  ],
  EVENT_CREATION_REQUEST: [
    { key: 'SUBMIT', label: 'Submitted' },
    { key: 'ADVISOR_REVIEW', label: 'Advisor Review' },
    { key: 'EVENT_COORDINATOR_REVIEW', label: 'Event Coordinator Review' },
    { key: 'RESOURCE_REVIEW', label: 'Resource Review' },
    { key: 'SECURITY_REVIEW', label: 'Security Review' },
    { key: 'APPROVED_END', label: 'Approved' },
  ],
}

const TYPE_ALIASES: Record<string, string> = {
  APPOINTMENT_REQUEST: 'APPOINTMENT',
  EQUIPMENT_REQUEST: 'EQUIPMENT',
  IT_TICKET: 'IT_SUPPORT',
  NETWORK_ISSUE: 'IT_SUPPORT',
  DEVICE_MAINTENANCE: 'IT_SUPPORT',
  MEETING_ROOM_RESERVATION: 'ROOM_RESERVATION',
  LAB_RESERVATION: 'ROOM_RESERVATION',
  INTERNSHIP: 'INTERNSHIP_REQUEST',
}

const STEP_KEY_ALIASES: Record<string, string> = {
  COORDINATOR_REVIEW: 'INTERNSHIP_COORDINATOR_REVIEW',
  DOCUMENT_REVIEW: 'DOCUMENT_PROCESSING',
  FACULTY_SECRETARY_APPROVAL: 'DOCUMENT_PROCESSING',
  LAB_TECHNICIAN_REVIEW: 'TECHNICAL_REVIEW',
  SECURITY_APPROVAL: 'SECURITY_REVIEW',
  IT_AGENT_REVIEW: 'IT_REVIEW',
  SYSTEM_OWNER_APPROVAL: 'MANAGER_APPROVAL',
  TRIAGE: 'IT_REVIEW',
  PROCUREMENT_INTAKE: 'PROCUREMENT_REVIEW',
  PROCUREMENT_FINAL_APPROVAL: 'PROCUREMENT_REVIEW',
  EVENT_COORDINATOR_FINAL: 'EVENT_COORDINATOR_REVIEW',
  TARGET_REVIEW: 'RESOURCE_REVIEW',
  MANAGER_REVIEW: 'MANAGER_APPROVAL',
}

const STEP_LABEL_ALIASES: Record<string, string> = {
  SUBMIT: 'SUBMIT',
  SUBMITTED: 'SUBMIT',
  'COORDINATOR REVIEW': 'INTERNSHIP_COORDINATOR_REVIEW',
  'DOCUMENT OFFICER REVIEW': 'DOCUMENT_PROCESSING',
  'FACULTY SECRETARY APPROVAL': 'DOCUMENT_PROCESSING',
  'SECRETARY REVIEW': 'DOCUMENT_PROCESSING',
  'LAB REVIEW': 'TECHNICAL_REVIEW',
  'LAB TECHNICIAN REVIEW': 'TECHNICAL_REVIEW',
  'SECURITY APPROVAL': 'SECURITY_REVIEW',
  'IT MANAGER TRIAGE': 'IT_REVIEW',
  TRIAGED: 'IT_REVIEW',
  ASSIGNED: 'IT_REVIEW',
  'MANAGER REVIEW': 'MANAGER_APPROVAL',
  'SYSTEM OWNER APPROVAL': 'MANAGER_APPROVAL',
  'PROCUREMENT OFFICER INTAKE': 'PROCUREMENT_REVIEW',
  'PROCUREMENT FINAL APPROVAL': 'PROCUREMENT_REVIEW',
  'RESOURCE MANAGER APPROVAL': 'RESOURCE_REVIEW',
  'EVENT COORDINATOR FINAL APPROVAL': 'EVENT_COORDINATOR_REVIEW',
  SCHEDULED: 'APPROVED_END',
  RESOLVED: 'COMPLETED_END',
  CLOSED: 'COMPLETED_END',
}

function canonicalType(type: string) {
  const upper = (type || '').toUpperCase()
  return TYPE_ALIASES[upper] ?? upper
}

function normalizeToken(value?: string | null) {
  return String(value ?? '')
    .trim()
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .toUpperCase()
}

function normalizeKey(value?: string | null) {
  return normalizeToken(value).replace(/\s+/g, '_')
}

function getTemplate(type: string): WorkflowTemplateStep[] {
  const key = canonicalType(type)
  return WORKFLOW_STEP_TEMPLATES[key] ?? [
    { key: 'SUBMIT', label: 'Submitted' },
    { key: 'IN_REVIEW', label: 'Under Review' },
    { key: 'APPROVED_END', label: 'Approved' },
  ]
}

function normalizeRawStepStatus(step: RawWorkflowStep): StepStatus | null {
  if (step.isOverdue) return 'warning'

  const normalized = String(step.status ?? '').toLowerCase()
  if (
    normalized === 'pending' ||
    normalized === 'active' ||
    normalized === 'completed' ||
    normalized === 'failed' ||
    normalized === 'warning'
  ) {
    return normalized
  }
  if (['done', 'success', 'approved'].includes(normalized)) return 'completed'
  if (['rejected', 'failed'].includes(normalized)) return 'failed'
  if (['revision', 'returned'].includes(normalized)) return 'warning'
  return null
}

function resolveRawStepKey(step: RawWorkflowStep) {
  const explicitKey = normalizeKey(step.key ?? step.stepKey ?? step.workflowStepKey)
  if (explicitKey) return STEP_KEY_ALIASES[explicitKey] ?? explicitKey

  const labelKey = normalizeToken(step.label ?? step.name ?? step.stepName)
  return STEP_LABEL_ALIASES[labelKey] ?? normalizeKey(labelKey)
}

function findStepIndex(
  template: WorkflowTemplateStep[],
  step: RawWorkflowStep | string | null | undefined,
) {
  const rawKey =
    typeof step === 'string'
      ? STEP_LABEL_ALIASES[normalizeToken(step)] ??
        STEP_KEY_ALIASES[normalizeKey(step)] ??
        normalizeKey(step)
      : resolveRawStepKey(step ?? {})

  if (!rawKey || rawKey === 'REVISION' || rawKey === 'REJECTED_END') return -1

  const normalizedLabel =
    typeof step === 'string'
      ? normalizeToken(step)
      : normalizeToken(step?.label ?? step?.name ?? step?.stepName)

  return template.findIndex((item) => {
    if (item.key === rawKey) return true
    if (STEP_KEY_ALIASES[rawKey] === item.key) return true
    return normalizeToken(item.label) === normalizedLabel
  })
}

function shouldIncludeRawStep(step: RawWorkflowStep, status: string) {
  const rawKey = resolveRawStepKey(step)
  const requestStatus = String(status ?? '').toUpperCase()
  if (rawKey === 'REJECTED_END') return requestStatus === 'REJECTED'
  if (rawKey === 'APPROVED_END' && requestStatus === 'REJECTED') return false
  if (rawKey === 'REVISION' || rawKey === 'REVISION_REQUESTED') {
    return false
  }
  return true
}

function rawStepLabel(step: RawWorkflowStep) {
  return String(step.label ?? step.name ?? step.stepName ?? titleize(resolveRawStepKey(step)) ?? 'Step')
}

function rawStepId(step: RawWorkflowStep, index: number) {
  return step.workflowStepId ?? step.id ?? index + 1
}

function toNullableNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return null
  const numeric = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function matchesCurrentStep(step: Step, currentStep?: string | null) {
  if (!currentStep) return false
  const currentToken = normalizeToken(currentStep)
  const currentKey = normalizeKey(currentStep)
  return (
    normalizeToken(step.label) === currentToken ||
    normalizeToken(step.name) === currentToken ||
    normalizeKey(step.key ?? step.stepKey) === currentKey
  )
}

function buildRawWorkflowSteps(
  rawSteps: RawWorkflowStep[],
  status: string,
  workflow?: RawWorkflow | null,
) {
  const steps = rawSteps.filter((step) => shouldIncludeRawStep(step, status)).map((rawStep, index) => {
    const key = resolveRawStepKey(rawStep)
    return {
      id: rawStepId(rawStep, index),
      key,
      stepKey: rawStep.stepKey ?? key,
      label: rawStepLabel(rawStep),
      name: rawStep.name ?? rawStep.stepName ?? rawStep.label ?? null,
      type: rawStep.type ?? null,
      status: normalizeRawStepStatus(rawStep) ?? 'pending',
      isCurrent: rawStep.isCurrent ?? false,
      assignedRole: rawStep.assignedRole ?? rawStep.role ?? null,
      role: rawStep.role ?? rawStep.assignedRole ?? null,
      assignedUnit: rawStep.assignedUnit ?? null,
      unitName: rawStep.unitName ?? rawStep.assignedUnit?.name ?? null,
      assignedTo: rawStep.assignedTo ?? null,
      assignedToName: rawStep.assignedToName ?? rawStep.assignedTo?.fullName ?? null,
      actionBy: rawStep.actionBy ?? null,
      actionByName: rawStep.actionByName ?? rawStep.actionBy?.fullName ?? null,
      actionTaken: rawStep.actionTaken ?? null,
      actionNote: rawStep.actionNote ?? null,
      startedAt: rawStep.startedAt ?? null,
      completedAt: rawStep.completedAt ?? null,
      actedAt: rawStep.actedAt ?? rawStep.completedAt ?? null,
      dueAt: rawStep.dueAt ?? null,
      slaHours: toNullableNumber(rawStep.slaHours),
      isOverdue: rawStep.isOverdue ?? false,
    } satisfies Step
  })

  if (steps.length === 0) return steps

  const requestStatus = String(status ?? '').toUpperCase()
  const currentStepName = workflow?.currentStep ?? workflow?.currentStepName ?? null
  const currentIndex = steps.findIndex(
    (step) => step.isCurrent || matchesCurrentStep(step, currentStepName),
  )
  const activeIndex = steps.findIndex((step) =>
    ['active', 'warning', 'failed'].includes(step.status),
  )
  const terminalCompletedIndex = steps.findLastIndex((step) => step.status === 'completed')
  const progressIndex =
    currentIndex >= 0
      ? currentIndex
      : activeIndex >= 0
        ? activeIndex
        : terminalCompletedIndex

  if (progressIndex >= 0) {
    completeBefore(steps, progressIndex)
  }

  if (currentIndex >= 0 && steps[currentIndex]) {
    if (requestStatus === 'REJECTED') {
      steps[currentIndex].status = 'failed'
    } else if (requestStatus === 'REVISION_REQUESTED') {
      steps[currentIndex].status = 'warning'
    } else if (steps[currentIndex].status === 'pending') {
      steps[currentIndex].status = 'active'
    }
  }

  if (requestStatus === 'REJECTED' && !steps.some((step) => step.status === 'failed')) {
    const failedIndex = activeIndex >= 0 ? activeIndex : Math.max(1, steps.length - 2)
    completeBefore(steps, failedIndex)
    if (steps[failedIndex]) steps[failedIndex].status = 'failed'
  }

  if (
    requestStatus === 'REVISION_REQUESTED' &&
    !steps.some((step) => step.status === 'warning')
  ) {
    const warningIndex = activeIndex >= 0 ? activeIndex : Math.min(1, steps.length - 1)
    completeBefore(steps, warningIndex)
    if (steps[warningIndex]) steps[warningIndex].status = 'warning'
  }

  return steps
}

function completeBefore(steps: Step[], index: number) {
  for (let i = 0; i < index; i += 1) {
    steps[i].status = 'completed'
  }
}

function activateStep(steps: Step[], index: number) {
  if (index < 0 || !steps[index]) return
  completeBefore(steps, index)
  steps[index].status = 'active'
}

function deriveFallbackSteps(
  template: WorkflowTemplateStep[],
  status: string,
  domainStatus?: string | null,
) {
  const steps = template.map((item, idx) => ({
    id: idx + 1,
    label: item.label,
    status: 'pending' as StepStatus,
  }))
  const safeStatus = (status || 'DRAFT').toUpperCase()
  const safeDomainStatus = String(domainStatus ?? '').toUpperCase()
  const n = steps.length

  if (safeDomainStatus === 'IN_PROGRESS') {
    activateStep(steps, template.findIndex((item) => item.key === 'IN_PROGRESS'))
    return steps
  }
  if (safeDomainStatus === 'RESOLVED') {
    activateStep(steps, template.findIndex((item) => item.key === 'COMPLETED_END'))
    return steps
  }
  if (safeDomainStatus === 'CLOSED') {
    steps.forEach((step) => {
      step.status = 'completed'
    })
    return steps
  }
  if (safeDomainStatus === 'WAITING_USER') {
    steps[0].status = 'completed'
    if (steps[1]) {
      steps[1].status = 'warning'
      steps[1].label = `${steps[1].label} - Revision Requested`
    }
    return steps
  }

  if (safeStatus === 'SUBMITTED' || safeStatus === 'DRAFT') {
    steps[0].status = 'active'
  } else if (safeStatus === 'IN_REVIEW' || safeStatus === 'WAITING_APPROVAL' || safeStatus === 'ASSIGNED') {
    steps[0].status = 'completed'
    if (steps[1]) steps[1].status = 'active'
  } else if (safeStatus === 'APPROVED') {
    const approvedIndex = template.findIndex((item) => item.key === 'APPROVED_END')
    activateStep(steps, approvedIndex >= 0 ? approvedIndex : n - 1)
  } else if (safeStatus === 'IN_PROGRESS') {
    const inProgressIndex = template.findIndex((item) => item.key === 'IN_PROGRESS')
    activateStep(steps, inProgressIndex >= 0 ? inProgressIndex : Math.min(2, n - 1))
  } else if (['COMPLETED', 'RESOLVED', 'CLOSED', 'SCHEDULED'].includes(safeStatus)) {
    steps.forEach((step) => {
      step.status = 'completed'
    })
  } else if (safeStatus === 'REVISION_REQUESTED') {
    steps[0].status = 'completed'
    if (steps[1]) {
      steps[1].status = 'warning'
      steps[1].label = `${steps[1].label} - Revision Requested`
    }
  } else if (safeStatus === 'REJECTED') {
    const failIdx = Math.max(1, n - 2)
    completeBefore(steps, failIdx)
    if (steps[failIdx]) {
      steps[failIdx].status = 'failed'
      steps[failIdx].label = 'Rejected'
    }
  } else if (safeStatus === 'CANCELLED' || safeStatus === 'EXPIRED') {
    steps[0].status = 'completed'
    if (steps[1]) {
      steps[1].status = 'failed'
      steps[1].label = safeStatus === 'EXPIRED' ? 'Expired' : 'Cancelled'
    }
  } else {
    steps[0].status = 'active'
  }

  return steps
}

export function buildWorkflowSteps(
  type: string,
  status: string,
  workflow?: RawWorkflow | null,
  domainStatus?: string | null,
): Step[] {
  const template = getTemplate(type)
  const rawSteps = Array.isArray(workflow?.steps) ? workflow.steps : []
  if (rawSteps.length > 0) {
    const seededSteps = buildRawWorkflowSteps(rawSteps, status, workflow)
    if (seededSteps.length > 0) return seededSteps
  }

  const steps = deriveFallbackSteps(template, status, domainStatus)
  const safeDomainStatus = String(domainStatus ?? '').toUpperCase()
  if (['IN_PROGRESS', 'RESOLVED', 'CLOSED', 'WAITING_USER'].includes(safeDomainStatus)) {
    return steps
  }

  if (rawSteps.length === 0) return steps

  const rawStatusApplied = new Set<number>()
  rawSteps.forEach((rawStep, rawIndex) => {
    const rawStatus = normalizeRawStepStatus(rawStep)
    if (!rawStatus) return
    const rawKey = resolveRawStepKey(rawStep)
    if (rawKey === 'REVISION' || rawKey === 'REVISION_REQUESTED' || rawKey === 'REJECTED_END') {
      return
    }

    let index = findStepIndex(template, rawStep)
    if (index < 0 && ['active', 'warning', 'failed'].includes(rawStatus)) {
      index = Math.min(Math.max(rawIndex, 1), steps.length - 1)
    }
    if (index < 0 || !steps[index]) return

    if (rawStatus === 'completed') {
      steps[index].status = steps[index].status === 'active' ? 'active' : 'completed'
    } else {
      steps[index].status = rawStatus
      completeBefore(steps, index)
    }
    rawStatusApplied.add(index)
  })

  const requestStatus = (status || '').toUpperCase()
  const currentIndex = findStepIndex(
    template,
    workflow?.currentStep ?? workflow?.currentStepName ?? null,
  )

  if (currentIndex >= 0 && steps[currentIndex]) {
    if (!['REJECTED', 'REVISION_REQUESTED'].includes(requestStatus)) {
      completeBefore(steps, currentIndex)
      if (!rawStatusApplied.has(currentIndex) || steps[currentIndex].status === 'pending') {
        steps[currentIndex].status = 'active'
      }
    }
  }

  if (requestStatus === 'REVISION_REQUESTED') {
    const warningIndex = currentIndex >= 1 ? currentIndex : steps.findIndex((step) => step.status === 'active')
    const targetIndex = warningIndex >= 1 ? warningIndex : 1
    if (steps[targetIndex]) {
      completeBefore(steps, targetIndex)
      steps[targetIndex].status = 'warning'
      if (!steps[targetIndex].label.includes('Revision Requested')) {
        steps[targetIndex].label = `${steps[targetIndex].label} - Revision Requested`
      }
    }
  }

  if (requestStatus === 'REJECTED') {
    const failedIndex = currentIndex >= 1 ? currentIndex : Math.max(1, steps.length - 2)
    completeBefore(steps, failedIndex)
    if (steps[failedIndex]) {
      steps[failedIndex].status = 'failed'
      steps[failedIndex].label = 'Rejected'
    }
  }

  return steps
}
