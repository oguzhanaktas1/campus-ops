import { getToken } from '@/lib/auth'

export const WORKFLOW_BACKEND =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'

export function workflowAuthHeaders() {
  return {
    Authorization: `Bearer ${getToken()}`,
    'Content-Type': 'application/json',
  }
}

export type WorkflowSummary = {
  id: string
  key: string
  name: string
  description?: string | null
  isActive: boolean
  isDefault: boolean
  version: number
  steps?: Array<{ id: string; stepOrder: number }>
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
  startedAt: string
  endedAt?: string | null
  totalAgeMinutes?: number | null
  currentStepAgeMinutes?: number | null
  inactiveMinutes?: number | null
  isOverdue: boolean
  currentStep?:
    | {
        id: string
        stepKey?: string | null
        stepName?: string | null
        stepType?: string | null
      }
    | null
  request: {
    id: string
    requestNo: string
    title: string
    status: string
    priority: string
    requesterName: string
    currentAssigneeName?: string | null
    sla?: {
      dueAt?: string | null
      firstResponseState?: string | null
      resolutionState?: string | null
      escalationTriggered?: boolean
      stepOverdueCount?: number
    }
  }
  activeAssignment?: {
    assignedAt: string
    assignedToName: string
    assignedByName?: string | null
    assignedAgeMinutes?: number | null
  } | null
  approvalTimeline: Array<{
    id: string
    actionType: string
    createdAt: string
    actionBy: { fullName: string }
    decisionNote?: string | null
  }>
  instanceSteps: Array<{
    id: string
    status: string
    startedAt?: string | null
    completedAt?: string | null
    dueAt?: string | null
    isOverdue: boolean
    actionTaken?: string | null
    workflowStep: {
      id: string
      stepName: string
      stepType: string
    }
    assignedTo?: {
      fullName: string
      email: string
    } | null
    actionBy?: {
      fullName: string
    } | null
  }>
}

export type WorkflowDetail = WorkflowSummary & {
  steps: WorkflowStep[]
  transitions: WorkflowTransition[]
  metrics?: {
    totalInstances: number
    requestTypeCount: number
    activeInstances: number
    completedInstances: number
    overdueInstances: number
  }
  requestTypes?: WorkflowRequestType[]
  instances: WorkflowInstance[]
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
