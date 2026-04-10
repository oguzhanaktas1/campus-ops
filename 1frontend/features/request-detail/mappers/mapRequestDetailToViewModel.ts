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
  if (!raw.currentAssignee) return null
  return {
    id: raw.currentAssignee.id ?? null,
    fullName:
      raw.currentAssignee.fullName ??
      raw.currentAssignee.profile?.fullName ??
      raw.currentAssignee.email ??
      'Unknown',
    email: raw.currentAssignee.email ?? null,
    role:
      raw.currentAssignee.role ??
      raw.currentAssignee.primaryRoles?.[0]?.role?.name ??
      null,
    title: raw.currentAssignee.title ?? raw.currentAssignee.profile?.title ?? null,
  }
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
            status:
              step.status === 'active' ||
              step.status === 'completed' ||
              step.status === 'failed' ||
              step.status === 'warning'
                ? step.status
                : 'pending',
          }))
        : [],
    },
    domainData:
      domainData ??
      raw.equipment ??
      raw.ticket ??
      raw.internshipRequest ??
      raw.dynamicData ??
      null,
    raw,
  }
}
