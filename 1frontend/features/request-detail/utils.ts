import type { Step } from '@/components/workflow-step-indicator'

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

export function buildWorkflowSteps(type: string, status: string): Step[] {
  let labels = ['Submitted', 'Under Review', 'Approval', 'Completed']

  if (type === 'INTERNSHIP_REQUEST' || type === 'internship') {
    labels = ['Submitted', 'Faculty Review', 'Dept Approval', 'Finalized']
  } else if (
    ['IT_TICKET', 'IT_SUPPORT', 'network_issue', 'device_maintenance'].includes(
      type,
    )
  ) {
    labels = ['Submitted', 'Assigned', 'In Progress', 'Resolved']
  } else if (
    ['ROOM_RESERVATION', 'room_reservation', 'meeting_room_reservation', 'lab_reservation'].includes(
      type,
    )
  ) {
    labels = ['Submitted', 'Verified', 'Confirmed']
  }

  const steps = labels.map((label, idx) => ({
    id: idx + 1,
    label,
    status: 'pending' as const,
  }))

  const safeStatus = (status || 'DRAFT').toUpperCase()

  if (safeStatus === 'SUBMITTED') {
    steps[0].status = 'active'
  } else if (safeStatus === 'IN_REVIEW' || safeStatus === 'ASSIGNED') {
    steps[0].status = 'completed'
    if (steps[1]) steps[1].status = 'active'
  } else if (safeStatus === 'WAITING_APPROVAL' || safeStatus === 'IN_PROGRESS') {
    steps[0].status = 'completed'
    if (steps[1]) steps[1].status = 'completed'
    if (steps[2]) steps[2].status = 'active'
  } else if (safeStatus === 'APPROVED') {
    steps[0].status = 'completed'
    if (steps[1]) steps[1].status = 'completed'
    if (steps[2]) steps[2].status = 'completed'
    if (steps[3]) steps[3].status = 'active'
    if (steps.length === 3) steps[2].status = 'completed'
  } else if (['COMPLETED', 'RESOLVED', 'CLOSED'].includes(safeStatus)) {
    steps.forEach((step) => {
      step.status = 'completed'
    })
  } else if (safeStatus === 'REVISION_REQUESTED') {
    steps[0].status = 'completed'
    if (steps[1]) {
      steps[1].status = 'warning'
      steps[1].label = 'Revision Needed'
    }
  } else if (safeStatus === 'REJECTED') {
    steps[0].status = 'completed'
    if (steps[1]) steps[1].status = 'completed'
    const targetIdx = steps.length > 3 ? 2 : steps.length - 1
    if (steps[targetIdx]) {
      steps[targetIdx].status = 'failed'
      steps[targetIdx].label = 'Rejected'
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
