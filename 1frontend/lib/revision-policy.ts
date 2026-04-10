export type RevisionFieldMode = 'editable' | 'conditional' | 'locked'

export interface RevisionPolicy {
  requestTypeKey: string
  editable: string[]
  conditional: string[]
  locked: string[]
}

const POLICIES: Record<string, RevisionPolicy> = {
  INTERNSHIP_REQUEST: {
    requestTypeKey: 'INTERNSHIP_REQUEST',
    editable: [
      'companyName',
      'companySector',
      'companyContactName',
      'companyContactEmail',
      'internshipType',
      'workMode',
    ],
    conditional: [
      'startDate',
      'endDate',
      'durationDays',
      'termId',
      'insuranceRequired',
    ],
    locked: ['studentUserId', 'advisorUserId', 'finalDecisionNote', 'currentStageNote'],
  },
  EQUIPMENT: {
    requestTypeKey: 'EQUIPMENT',
    editable: [
      'equipmentName',
      'equipmentCategory',
      'quantity',
      'purpose',
      'urgencyReason',
    ],
    conditional: ['labResourceId', 'neededFrom', 'neededUntil'],
    locked: ['requesterUserId', 'stockCheckStatus', 'procurementRequired', 'estimatedCost'],
  },
  IT_SUPPORT: {
    requestTypeKey: 'IT_SUPPORT',
    editable: ['subcategory', 'affectedSystem', 'assetId', 'locationText', 'incidentStartedAt'],
    conditional: ['category'],
    locked: [
      'reportedByUserId',
      'assignedItUserId',
      'ticketStatus',
      'resolutionSummary',
      'resolvedAt',
      'closedAt',
      'slaPolicyId',
    ],
  },
  ROOM_RESERVATION: {
    requestTypeKey: 'ROOM_RESERVATION',
    editable: ['eventName', 'reservationPurpose', 'attendeeCount', 'setupNotes'],
    conditional: [
      'resourceId',
      'startAt',
      'endAt',
      'requiresSecurityApproval',
      'requiresTechnicalSupport',
    ],
    locked: ['requesterUserId', 'reservationStatus'],
  },
  EVENT_REQUEST: {
    requestTypeKey: 'EVENT_REQUEST',
    editable: [
      'eventName',
      'eventType',
      'description',
      'expectedAttendance',
      'locationPreference',
    ],
    conditional: [
      'startAt',
      'endAt',
      'needsBudget',
      'estimatedBudget',
      'needsPosterApproval',
      'needsSecuritySupport',
      'needsTechnicalSupport',
      'clubId',
    ],
    locked: ['organizerUserId'],
  },
  ACCESS_REQUEST: {
    requestTypeKey: 'ACCESS_REQUEST',
    editable: ['justification'],
    conditional: [
      'accessType',
      'targetResource',
      'requestedRoleOrPermission',
      'startAt',
      'endAt',
    ],
    locked: ['requesterUserId'],
  },
  PROCUREMENT_REQUEST: {
    requestTypeKey: 'PROCUREMENT_REQUEST',
    editable: ['justification', 'vendorPreference'],
    conditional: ['itemName', 'itemCategory', 'quantity', 'unitPriceEstimate', 'budgetCode'],
    locked: ['requesterUserId', 'procurementStatus'],
  },
  DOCUMENT_REQUEST: {
    requestTypeKey: 'DOCUMENT_REQUEST',
    editable: ['language', 'copiesCount', 'deliveryMethod', 'deliveryAddress'],
    conditional: ['documentType'],
    locked: ['requesterUserId', 'issuedAt'],
  },
  APPOINTMENT: {
    requestTypeKey: 'APPOINTMENT',
    editable: ['topic', 'details', 'description'],
    conditional: ['appointmentType', 'preferredStartAt', 'preferredEndAt'],
    locked: ['requesterUserId', 'targetUserId', 'actualAppointmentId'],
  },
}

function normalizeTypeKey(typeKey: string | null | undefined) {
  return String(typeKey ?? '').trim().toUpperCase()
}

export function getRevisionPolicy(typeKey: string | null | undefined): RevisionPolicy | null {
  const normalized = normalizeTypeKey(typeKey)
  return POLICIES[normalized] ?? null
}

export function getRevisionFieldMode(
  policy: RevisionPolicy | null | undefined,
  fieldId: string,
): RevisionFieldMode {
  if (!policy) return 'editable'
  if (policy.editable.includes(fieldId)) return 'editable'
  if (policy.conditional.includes(fieldId)) return 'conditional'
  return 'locked'
}
