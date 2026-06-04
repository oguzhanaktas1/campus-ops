import { getToken } from '@/lib/auth'

export const WORKFLOW_BACKEND =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'

export function workflowAuthHeaders() {
  return {
    Authorization: `Bearer ${getToken()}`,
    'Content-Type': 'application/json',
  }
}

export type WorkflowStep = {
  id: string
  stepKey: string
  stepName: string
  stepOrder: number
  stepType: string
  assignedRoleId?: string | null
  assignedUserId?: string | null
  assignedUnitId?: string | null
  assignedRole?: { id: string; name: string } | null
  assignedUnit?: { id: string; name: string } | null
  assignedUser?: {
    id: string
    email: string
    profile?: { fullName?: string | null } | null
  } | null
}

export type WorkflowSummary = {
  id: string
  key: string
  name: string
  description?: string | null
  isActive: boolean
  isDefault: boolean
  version: number
  steps?: WorkflowStep[]
  _count?: { instances: number }
  metrics?: {
    totalInstances: number
    requestTypeCount: number
    activeInstances: number
    completedInstances: number
    overdueInstances: number
    lastStartedAt?: string | null
  }
}

export type WorkflowTransition = {
  id: string
  actionType: string
  fromStep?: { id: string; stepName: string } | null
  toStep?: { id: string; stepName: string } | null
}

export type WorkflowRequestType = {
  id: string
  key: string
  name: string
  category?: string | null
}

export type WorkflowInstance = {
  id: string
  status: string
  isOverdue: boolean
  startedAt: string | null
  endedAt: string | null
  totalAgeMinutes: number
  currentStepAgeMinutes: number
  inactiveMinutes: number
  currentStep?: { id: string; stepName: string } | null
  instanceSteps: Array<{
    workflowStep: { id: string }
    status: string
    isOverdue?: boolean
    startedAt?: string | null
    completedAt?: string | null
    dueAt?: string | null
    actionTaken?: string | null
    assignedTo?: { fullName: string } | null
    actionBy?: { fullName: string } | null
  }>
  activeAssignment?: {
    assignedToName: string
    assignedByName?: string | null
    assignedAt: string
    assignedAgeMinutes: number
  } | null
  approvalTimeline: Array<{
    id: string
    actionType: string
    createdAt: string
    decisionNote?: string | null
    actionBy: { fullName: string }
  }>
  request: {
    id: string
    requestNo: string
    title: string
    requesterName: string
    currentAssigneeName?: string | null
    status: string
    priority: string
    sla?: {
      dueAt: string | null
      firstResponseState: string
      resolutionState: string
      escalationTriggered: boolean
      stepOverdueCount?: number | null
    } | null
    ticketLifecycle?: {
      status: string
      openedBy?: string | null
      openedAt?: string | null
      resolvedBy?: string | null
      resolvedAt?: string | null
      closedBy?: string | null
      closedAt?: string | null
      reopenedCount?: number | null
      stages?: Array<{ key: string; label: string; at: string; by?: string | null; note?: string | null }> | null
    } | null
  }
}

export type WorkflowDetail = WorkflowSummary & {
  steps: WorkflowStep[]
  transitions: WorkflowTransition[]
  instances: WorkflowInstance[]
  metrics?: {
    totalInstances: number
    requestTypeCount: number
    activeInstances: number
    completedInstances: number
    overdueInstances: number
  }
  requestTypes?: WorkflowRequestType[]
  _count?: { instances: number }
}

export function formatDuration(minutes?: number | null) {
  if (minutes === null || minutes === undefined) return 'N/A'
  if (minutes < 60) return `${minutes} dk`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  if (hours < 24) {
    return remainingMinutes ? `${hours} sa ${remainingMinutes} dk` : `${hours} sa`
  }
  const days = Math.floor(hours / 24)
  const remainingHours = hours % 24
  return remainingHours ? `${days} g ${remainingHours} sa` : `${days} g`
}

export function formatDate(value?: string | null) {
  if (!value) return 'N/A'
  return new Date(value).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatEnumLabel(value?: string | null) {
  if (!value) return 'N/A'
  return value.replace(/_/g, ' ')
}
