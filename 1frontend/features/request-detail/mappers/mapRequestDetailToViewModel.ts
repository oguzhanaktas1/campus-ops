import type {
  RequestDetailViewModel,
  RequestPortal,
} from '@/features/request-detail/types'
import { buildWorkflowSteps, formatBytes } from '@/features/request-detail/utils'

function fallbackId() {
  return `tmp-${Math.random().toString(36).slice(2)}`
}

function toComment(comment: any) {
  return {
    id: String(comment.id),
    author:
      comment.author?.fullName ??
      comment.author?.email ??
      (typeof comment.author === 'string' ? comment.author : null) ??
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

  if (currentAssignee) {
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

  // When revision is requested and no active assignee, show the reviewer who requested it
  const status = String(raw.status ?? raw.request?.status ?? '').toUpperCase()
  if (status === 'REVISION_REQUESTED') {
    const revisionAction = (raw.approvalHistory ?? []).find(
      (a: any) => String(a.actionType ?? '').toUpperCase() === 'REQUEST_REVISION',
    )
    if (revisionAction?.actor) {
      return {
        id: revisionAction.actor.id ?? null,
        fullName: revisionAction.actor.fullName ?? 'Unknown',
        email: revisionAction.actor.email ?? null,
        role: null,
        title: null,
      }
    }
  }

  return null
}

function deriveAssignedPeople(raw: any) {
  const names = new Set<string>()
  const requester = deriveRequester(raw)
  const requesterIds = new Set(
    [requester?.id, raw.requesterUserId, raw.submittedById]
      .filter(Boolean)
      .map((value) => String(value).toLowerCase()),
  )
  const requesterEmails = new Set(
    [requester?.email, raw.requester?.email]
      .filter(Boolean)
      .map((value) => String(value).toLowerCase()),
  )
  const requesterNames = new Set(
    [requester?.fullName, raw.submittedByName]
      .filter(Boolean)
      .map((value) => String(value).trim().toLowerCase()),
  )

  function isRequester(person: any, fallbackName?: unknown) {
    const id = person?.id ?? person?.userId ?? null
    const email = person?.email ?? null
    const name =
      fallbackName ??
      person?.fullName ??
      person?.profile?.fullName ??
      person?.name ??
      null

    return (
      (id && requesterIds.has(String(id).toLowerCase())) ||
      (email && requesterEmails.has(String(email).toLowerCase())) ||
      (name && requesterEmails.has(String(name).trim().toLowerCase())) ||
      (name && requesterNames.has(String(name).trim().toLowerCase()))
    )
  }

  function addAssignedName(name: unknown, person?: any) {
    if (!name || isRequester(person, name)) return
    names.add(String(name))
  }

  if (Array.isArray(raw.assignedToNames)) {
    raw.assignedToNames.forEach((name: unknown) => {
      addAssignedName(name)
    })
  }

  if (raw.assignedToName) {
    addAssignedName(raw.assignedToName)
  }

  if (raw.currentAssignee) {
    const currentName =
      raw.currentAssignee.fullName ??
      raw.currentAssignee.profile?.fullName ??
      raw.currentAssignee.email ??
      null
    addAssignedName(currentName, raw.currentAssignee)
  }

  if (Array.isArray(raw.assignments)) {
    raw.assignments.forEach((assignment: any) => {
      const assignedName =
        assignment?.assignedTo?.fullName ??
        assignment?.assignedTo?.profile?.fullName ??
        assignment?.assignedTo?.email ??
        null
      addAssignedName(assignedName, assignment?.assignedTo)
    })
  }

  const workflowSteps = Array.isArray(raw.workflow?.steps) ? raw.workflow.steps : []
  workflowSteps.forEach((step: any) => {
    const assignedName =
      step?.assignedToName ??
      step?.assignedTo?.fullName ??
      null
    addAssignedName(assignedName, step?.assignedTo)
  })

  return Array.from(names)
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

function labelWorkflowStep(
  raw: any,
  baseLabel: string,
  stepStatus: 'pending' | 'active' | 'completed' | 'failed' | 'warning',
) {
  const requestStatus = String(raw.status ?? '').toUpperCase()
  const stepNameLower = baseLabel.toLowerCase()

  if (
    requestStatus === 'APPROVED' &&
    (stepNameLower.includes('final') || stepNameLower.includes('decision') || stepNameLower === 'approved')
  ) {
    return 'Approved'
  }

  if (
    requestStatus === 'REJECTED' &&
    (stepNameLower.includes('final') || stepNameLower.includes('decision'))
  ) {
    return 'Rejected'
  }

  if (stepStatus === 'warning') {
    return `${baseLabel} — Revision Requested`
  }

  return baseLabel
}

function buildWorkflowStepsForPortal(raw: any, portal: RequestPortal) {
  const workflowSteps = Array.isArray(raw.workflow?.steps) ? raw.workflow.steps : []

  return workflowSteps.map((step: any) => {
    const stepStatus = normalizeWorkflowStepStatus(raw, step)
    const baseLabel = String(step.label ?? step.stepName ?? 'Step')

    return {
      id: Number(step.id ?? fallbackId()),
      label: labelWorkflowStep(raw, baseLabel, stepStatus),
      status: stepStatus,
    }
  })
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
  const workflowSource = raw.workflow?.engineWorkflow ?? raw.workflow ?? null

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
    status: String(raw.status ?? raw.displayStatus ?? 'PENDING'),
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
    assignedPeople: deriveAssignedPeople(raw),
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
        workflowSource?.currentStep?.stepName ??
        workflowSource?.currentStep ??
        workflowSource?.currentStepName ??
        null,
      name: workflowSource?.workflowName ?? workflowSource?.name ?? null,
      status: workflowSource?.status ?? null,
      steps: buildWorkflowSteps(
        String(requestType.key ?? raw.type ?? 'GENERAL_REQUEST'),
        String(raw.status ?? raw.displayStatus ?? 'PENDING'),
        workflowSource,
        raw.ticket?.ticketStatus ?? raw.itTicket?.ticketStatus ?? null,
      ),
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
      raw.eventCreationRequest ??
      raw.equipment ??
      raw.equipmentRequest ??
      raw.ticket ??
      raw.internshipRequest ??
      raw.dynamicData ??
      null,
    raw,
  }
}
