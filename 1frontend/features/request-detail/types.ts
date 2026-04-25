export type RequestPortal = 'student' | 'faculty' | 'staff' | 'admin' | 'organizer'

export interface RequestActor {
  id?: string | null
  fullName: string
  email?: string | null
  role?: string | null
  faculty?: string | null
  department?: string | null
  studentNumber?: string | null
  staffNumber?: string | null
  title?: string | null
}

export interface RequestAttachment {
  id: string
  name: string
  size: string
  url?: string | null
}

export interface RequestComment {
  id: string
  author: string
  authorRole: string
  content: string
  createdAt: string
}

export interface RequestTimelineEvent {
  id: string
  status: string
  date: string
  note?: string
}

export interface RequestWorkflowStep {
  id: number | string
  label: string
  status: 'pending' | 'active' | 'completed' | 'failed' | 'warning'
  key?: string | null
  stepKey?: string | null
  name?: string | null
  type?: string | null
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
  slaHours?: number | null
  isOverdue?: boolean | null
}

export interface RequestDetailViewModel {
  id: string
  portal: RequestPortal
  requestNo: string
  title: string
  description: string
  status: string
  priority: string
  createdAt?: string | null
  submittedAt?: string | null
  dueAt?: string | null
  requestType: {
    key: string
    name: string
    category?: string | null
  }
  requester?: RequestActor | null
  currentAssignee?: RequestActor | null
  assignedPeople: string[]
  comments: RequestComment[]
  attachments: RequestAttachment[]
  timeline: RequestTimelineEvent[]
  statusHistory: RequestTimelineEvent[]
  workflow: {
      currentStep?: string | null
      name?: string | null
      status?: string | null
      steps?: RequestWorkflowStep[]
  }
  domainData: Record<string, unknown> | null
  raw: Record<string, unknown>
}
