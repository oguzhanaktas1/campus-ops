import type {
  RequestDetailViewModel,
  RequestPortal,
} from '@/features/request-detail/types'
import { formatBytes } from '@/features/request-detail/utils'

function fallbackId() {
  return `tmp-${Math.random().toString(36).slice(2)}`
}

function toComment(comment: any) {
  return {
    id: String(comment.id),
    author:
      comment.author ??
      comment.user?.profile?.fullName ??
      comment.user?.email ??
      'Unknown',
    authorRole:
      comment.authorRole ??
      comment.user?.primaryRoles?.[0]?.role?.name?.toLowerCase() ??
      'unknown',
    content: comment.content ?? comment.commentText ?? '',
    createdAt: String(comment.createdAt ?? new Date().toISOString()),
  }
}

function toTimeline(event: any) {
  return {
    id: String(event.id),
    status: String(event.status ?? event.newStatus ?? 'UPDATED'),
    date: String(
      event.date ?? event.changedAt ?? event.createdAt ?? new Date().toISOString(),
    ),
    note: event.note ?? event.changeReason ?? undefined,
  }
}

function toAttachment(file: any) {
  return {
    id: String(file.id ?? file.file?.id ?? fallbackId()),
    name: String(
      file.name ?? file.originalFileName ?? file.file?.originalFileName ?? 'Attachment',
    ),
    size:
      typeof file.size === 'string'
        ? file.size
        : formatBytes(file.size ?? file.fileSizeBytes ?? file.file?.fileSizeBytes),
    url: file.url ?? file.storagePath ?? file.file?.storagePath ?? null,
  }
}

function deriveRequester(raw: any) {
  if (raw.requester) {
    return {
      id: raw.requester.id ?? null,
      fullName:
        raw.requester.fullName ??
        raw.requester.profile?.fullName ??
        raw.requester.email ??
        raw.submittedByName ??
        'Unknown',
      email: raw.requester.email ?? null,
      role:
        raw.requester.role ??
        raw.requester.primaryRoles?.[0]?.role?.name ??
        null,
      faculty: raw.requester.faculty ?? raw.requester.profile?.faculty?.name ?? null,
      department:
        raw.requester.department ??
        raw.requester.profile?.department?.name ??
        raw.requester.profile?.unit?.name ??
        null,
      studentNumber:
        raw.requester.studentNumber ?? raw.requester.profile?.studentNumber ?? null,
      staffNumber:
        raw.requester.staffNumber ?? raw.requester.profile?.staffNumber ?? null,
      title: raw.requester.title ?? raw.requester.profile?.title ?? null,
    }
  }

  if (raw.submittedByName) {
    return {
      id: null,
      fullName: String(raw.submittedByName),
      email: null,
      role: null,
      faculty: null,
      department: null,
      studentNumber: null,
      staffNumber: null,
      title: null,
    }
  }

  return null
}

function deriveAssignee(raw: any) {
  const currentAssignee =
    raw.currentAssignee ??
    raw.request?.currentAssignee ??
    raw.assignments?.find?.((assignment: any) => assignment?.isActive)?.assignedTo ??
    null

  if (!currentAssignee) return null

  return {
    id: currentAssignee.id ?? null,
    fullName:
      currentAssignee.fullName ??
      currentAssignee.profile?.fullName ??
      currentAssignee.email ??
      'Unknown',
    email: currentAssignee.email ?? null,
    role:
      currentAssignee.role ??
      currentAssignee.primaryRoles?.[0]?.role?.name ??
      null,
    title: currentAssignee.title ?? currentAssignee.profile?.title ?? null,
  }
}

function normalizeWorkflowStepStatus(
  raw: any,
  step: any,
): 'pending' | 'active' | 'completed' | 'failed' | 'warning' {
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

  const currentStepName =
    raw.workflow?.currentStep?.stepName ??
    raw.workflow?.currentStep ??
    raw.workflow?.currentStepName ??
    null

  const stepLabel = String(step.label ?? step.stepName ?? '')
  const requestStatus = String(raw.status ?? '').toUpperCase()
  const workflowStatus = String(raw.workflow?.status ?? '').toUpperCase()

  if (step.isOverdue === true) {
    return 'warning'
  }

  if (
    currentStepName &&
    stepLabel &&
    String(currentStepName).toLowerCase() === stepLabel.toLowerCase()
  ) {
    if (requestStatus === 'REJECTED' || workflowStatus === 'REJECTED') {
      return 'failed'
    }

    if (
      requestStatus === 'REVISION_REQUESTED' ||
      workflowStatus === 'REVISION_REQUESTED'
    ) {
      return 'warning'
    }

    return 'active'
  }

  if (normalized === 'done' || normalized === 'success') {
    return 'completed'
  }

  return 'pending'
}

export function mapRequestDetailToViewModel(
  portal: RequestPortal,
  raw: any,
  domainData?: Record<string, unknown> | null,
): RequestDetailViewModel {
  const requestType = raw.requestType ?? {
    key: raw.type ?? 'GENERAL_REQUEST',
    name: raw.typeName ?? raw.type ?? 'General Request',
    category: raw.category ?? null,
  }

  const timeline = Array.isArray(raw.timeline)
    ? raw.timeline.map(toTimeline)
    : Array.isArray(raw.statusHistory)
      ? raw.statusHistory.map(toTimeline)
      : Array.isArray(raw.history)
        ? raw.history.map(toTimeline)
        : []

  return {
    id: String(raw.id),
    portal,
    requestNo: String(raw.requestNo ?? raw.requestNumber ?? raw.id),
    title: String(raw.title ?? requestType.name ?? 'Request Detail'),
    description: String(raw.description ?? ''),
    status: String(raw.status ?? 'PENDING'),
    priority: String(raw.priority ?? 'MEDIUM'),
    createdAt: raw.createdAt ?? null,
    submittedAt: raw.submittedAt ?? null,
    dueAt: raw.dueAt ?? null,
    requestType: {
      key: String(requestType.key ?? 'GENERAL_REQUEST'),
      name: String(requestType.name ?? 'General Request'),
      category: requestType.category ?? null,
    },
    requester: deriveRequester(raw),
    currentAssignee: deriveAssignee(raw),
    assignedPeople: Array.isArray(raw.assignedToNames)
      ? raw.assignedToNames.filter(Boolean)
      : raw.assignedToName
        ? [raw.assignedToName]
        : Array.isArray(raw.assignments)
          ? raw.assignments
              .map((assignment: any) => assignment?.assignedTo?.fullName)
              .filter(Boolean)
        : [],
    comments: Array.isArray(raw.comments) ? raw.comments.map(toComment) : [],
    attachments: Array.isArray(raw.attachments)
      ? raw.attachments.map(toAttachment)
      : Array.isArray(raw.fileLinks)
        ? raw.fileLinks.map(toAttachment)
        : [],
    timeline,
    statusHistory: timeline,
    workflow: {
      currentStep:
        raw.workflow?.currentStep?.stepName ??
        raw.workflow?.currentStep ??
        raw.workflow?.currentStepName ??
        null,
      name: raw.workflow?.workflowName ?? raw.workflow?.name ?? null,
      status: raw.workflow?.status ?? null,
      steps: Array.isArray(raw.workflow?.steps)
        ? raw.workflow.steps.map((step: any) => ({
            id: String(step.id ?? fallbackId()),
            label: String(step.label ?? step.stepName ?? 'Step'),
            status: normalizeWorkflowStepStatus(raw, step),
          }))
        : [],
    },
    domainData:
      domainData ??
      raw.formData ??
      raw.documentRequest ??
      raw.roomReservationRequest ??
      raw.appointmentRequest ??
      raw.procurementRequest ??
      raw.accessRequest ??
      raw.eventRequest ??
      raw.equipment ??
      raw.equipmentRequest ??
      raw.ticket ??
      raw.internshipRequest ??
      raw.dynamicData ??
      null,
    raw,
  }
}
