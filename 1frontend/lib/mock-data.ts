// lib/mock-data.ts
// Realistic campus mock data

export type Role = 'student' | 'faculty' | 'staff' | 'admin'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  avatar?: string
  department?: string
  studentId?: string
  title?: string
}

export interface Request {
  id: string
  title: string
  type: RequestType
  status: RequestStatus
  priority: Priority
  submittedBy: string
  submittedByName: string
  assignedTo?: string
  assignedToName?: string
  createdAt: string
  updatedAt: string
  dueDate?: string
  description: string
  attachments?: Attachment[]
  comments?: Comment[]
  timeline?: TimelineEvent[]
  workflowStep?: number
}

export type RequestType =
  | 'internship'
  | 'equipment'
  | 'it_support'
  | 'room_reservation'
  | 'appointment'
  | 'transcript'
  | 'enrollment'
  | 'maintenance'

export type RequestStatus =
  | 'draft'
  | 'pending'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'in_progress'
  | 'completed'
  | 'revision_requested'

export type Priority = 'low' | 'medium' | 'high' | 'urgent'

export interface Attachment {
  id: string
  name: string
  size: string
  type: string
  uploadedAt: string
}

export interface Comment {
  id: string
  author: string
  authorRole: Role
  content: string
  createdAt: string
  avatar?: string
}

export interface TimelineEvent {
  id: string
  event: string
  description: string
  actor: string
  timestamp: string
  type: 'created' | 'updated' | 'approved' | 'rejected' | 'commented' | 'assigned' | 'completed'
}

export interface Notification {
  id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  read: boolean
  createdAt: string
  link?: string
}

export interface Appointment {
  id: string
  title: string
  with: string
  withRole: Role
  date: string
  time: string
  duration: number
  location: string
  status: 'scheduled' | 'completed' | 'cancelled' | 'pending'
  notes?: string
}

export interface Reservation {
  id: string
  roomName: string
  building: string
  capacity: number
  reservedBy: string
  date: string
  startTime: string
  endTime: string
  purpose: string
  status: 'confirmed' | 'pending' | 'cancelled'
}

export interface WorkflowStep {
  id: string
  name: string
  assignedRole: Role
  status: 'pending' | 'active' | 'completed' | 'skipped'
  completedBy?: string
  completedAt?: string
}

// ===== MOCK USERS =====
export const MOCK_USERS: User[] = [
  {
    id: 'u1',
    name: 'Alex Johnson',
    email: 'alex.johnson@campus.edu',
    role: 'student',
    department: 'Computer Science',
    studentId: 'CS-2024-0012',
  },
  {
    id: 'u2',
    name: 'Dr. Sarah Mitchell',
    email: 'sarah.mitchell@campus.edu',
    role: 'faculty',
    department: 'Computer Science',
    title: 'Associate Professor',
  },
  {
    id: 'u3',
    name: 'Marcus Thompson',
    email: 'marcus.thompson@campus.edu',
    role: 'staff',
    department: 'IT Services',
    title: 'IT Operations Lead',
  },
  {
    id: 'u4',
    name: 'Jennifer Park',
    email: 'jennifer.park@campus.edu',
    role: 'admin',
    department: 'Administration',
    title: 'System Administrator',
  },
]

// ===== MOCK REQUESTS =====
export const MOCK_REQUESTS: Request[] = [
  {
    id: 'req-001',
    title: 'Internship Approval – TechCorp Inc.',
    type: 'internship',
    status: 'under_review',
    priority: 'high',
    submittedBy: 'u1',
    submittedByName: 'Alex Johnson',
    assignedTo: 'u2',
    assignedToName: 'Dr. Sarah Mitchell',
    createdAt: '2024-11-10T09:00:00Z',
    updatedAt: '2024-11-12T14:30:00Z',
    dueDate: '2024-11-20T00:00:00Z',
    description: 'Requesting approval for a 3-month software engineering internship at TechCorp Inc. starting January 2025. The role involves full-stack development using React and Node.js.',
    attachments: [
      { id: 'att-1', name: 'offer_letter.pdf', size: '245 KB', type: 'pdf', uploadedAt: '2024-11-10T09:05:00Z' },
      { id: 'att-2', name: 'company_profile.pdf', size: '1.2 MB', type: 'pdf', uploadedAt: '2024-11-10T09:06:00Z' },
    ],
    comments: [
      {
        id: 'c1',
        author: 'Dr. Sarah Mitchell',
        authorRole: 'faculty',
        content: 'The company looks reputable. Please provide your current GPA transcript before I can approve.',
        createdAt: '2024-11-12T14:30:00Z',
      },
    ],
    timeline: [
      { id: 'tl1', event: 'Request Submitted', description: 'Internship request submitted by Alex Johnson', actor: 'Alex Johnson', timestamp: '2024-11-10T09:00:00Z', type: 'created' },
      { id: 'tl2', event: 'Assigned to Faculty', description: 'Request assigned to Dr. Sarah Mitchell for review', actor: 'System', timestamp: '2024-11-10T09:01:00Z', type: 'assigned' },
      { id: 'tl3', event: 'Comment Added', description: 'Faculty requested additional documentation', actor: 'Dr. Sarah Mitchell', timestamp: '2024-11-12T14:30:00Z', type: 'commented' },
    ],
    workflowStep: 2,
  },
  {
    id: 'req-002',
    title: 'Laptop Replacement Request',
    type: 'equipment',
    status: 'pending',
    priority: 'medium',
    submittedBy: 'u1',
    submittedByName: 'Alex Johnson',
    createdAt: '2024-11-08T11:00:00Z',
    updatedAt: '2024-11-08T11:00:00Z',
    dueDate: '2024-11-25T00:00:00Z',
    description: 'My current university-issued laptop has a failing battery and keyboard issues affecting my coursework. Requesting a replacement or repair.',
    timeline: [
      { id: 'tl4', event: 'Request Submitted', description: 'Equipment request submitted', actor: 'Alex Johnson', timestamp: '2024-11-08T11:00:00Z', type: 'created' },
    ],
    workflowStep: 1,
  },
  {
    id: 'req-003',
    title: 'IT Support – VPN Access Issue',
    type: 'it_support',
    status: 'in_progress',
    priority: 'urgent',
    submittedBy: 'u1',
    submittedByName: 'Alex Johnson',
    assignedTo: 'u3',
    assignedToName: 'Marcus Thompson',
    createdAt: '2024-11-13T08:00:00Z',
    updatedAt: '2024-11-13T10:15:00Z',
    description: 'Unable to connect to campus VPN from off-campus location. Error: Authentication failed. This is blocking my remote lab access.',
    timeline: [
      { id: 'tl5', event: 'Ticket Created', description: 'IT support ticket submitted', actor: 'Alex Johnson', timestamp: '2024-11-13T08:00:00Z', type: 'created' },
      { id: 'tl6', event: 'Assigned', description: 'Ticket assigned to Marcus Thompson', actor: 'System', timestamp: '2024-11-13T08:05:00Z', type: 'assigned' },
      { id: 'tl7', event: 'Investigation Started', description: 'IT staff is investigating the VPN issue', actor: 'Marcus Thompson', timestamp: '2024-11-13T10:15:00Z', type: 'updated' },
    ],
    workflowStep: 2,
  },
  {
    id: 'req-004',
    title: 'Room Reservation – Study Group B204',
    type: 'room_reservation',
    status: 'approved',
    priority: 'low',
    submittedBy: 'u1',
    submittedByName: 'Alex Johnson',
    createdAt: '2024-11-05T15:00:00Z',
    updatedAt: '2024-11-06T09:00:00Z',
    description: 'Requesting seminar room B204 for a study group of 8 students on Nov 18, 2024 from 2pm to 5pm.',
    timeline: [
      { id: 'tl8', event: 'Reservation Submitted', description: 'Room reservation request submitted', actor: 'Alex Johnson', timestamp: '2024-11-05T15:00:00Z', type: 'created' },
      { id: 'tl9', event: 'Approved', description: 'Room reservation approved by Facilities', actor: 'Facilities Team', timestamp: '2024-11-06T09:00:00Z', type: 'approved' },
    ],
    workflowStep: 3,
  },
  {
    id: 'req-005',
    title: 'Appointment Request – Dr. Mitchell',
    type: 'appointment',
    status: 'pending',
    priority: 'medium',
    submittedBy: 'u1',
    submittedByName: 'Alex Johnson',
    assignedTo: 'u2',
    assignedToName: 'Dr. Sarah Mitchell',
    createdAt: '2024-11-14T10:00:00Z',
    updatedAt: '2024-11-14T10:00:00Z',
    description: 'Requesting a 30-minute meeting to discuss final year project progress and thesis proposal.',
    workflowStep: 1,
    timeline: [
      { id: 'tl10', event: 'Request Submitted', description: 'Appointment request sent to Dr. Mitchell', actor: 'Alex Johnson', timestamp: '2024-11-14T10:00:00Z', type: 'created' },
    ],
  },
  {
    id: 'req-006',
    title: 'Network Infrastructure Upgrade Request',
    type: 'it_support',
    status: 'under_review',
    priority: 'high',
    submittedBy: 'u2',
    submittedByName: 'Dr. Sarah Mitchell',
    assignedTo: 'u3',
    assignedToName: 'Marcus Thompson',
    createdAt: '2024-11-09T14:00:00Z',
    updatedAt: '2024-11-11T16:00:00Z',
    description: 'Lab B building network infrastructure is outdated and causing significant latency during peak hours.',
    workflowStep: 2,
    timeline: [
      { id: 'tl11', event: 'Request Created', description: 'Faculty submitted network upgrade request', actor: 'Dr. Sarah Mitchell', timestamp: '2024-11-09T14:00:00Z', type: 'created' },
      { id: 'tl12', event: 'Under Review', description: 'IT team reviewing infrastructure requirements', actor: 'Marcus Thompson', timestamp: '2024-11-11T16:00:00Z', type: 'updated' },
    ],
  },
  {
    id: 'req-007',
    title: 'Projector Maintenance – Lecture Hall A1',
    type: 'maintenance',
    status: 'completed',
    priority: 'high',
    submittedBy: 'u2',
    submittedByName: 'Dr. Sarah Mitchell',
    assignedTo: 'u3',
    assignedToName: 'Marcus Thompson',
    createdAt: '2024-11-01T09:00:00Z',
    updatedAt: '2024-11-03T16:00:00Z',
    description: 'Projector in Lecture Hall A1 is displaying poor image quality. Affecting all classes.',
    workflowStep: 4,
    timeline: [
      { id: 'tl13', event: 'Ticket Opened', description: 'Maintenance ticket submitted', actor: 'Dr. Sarah Mitchell', timestamp: '2024-11-01T09:00:00Z', type: 'created' },
      { id: 'tl14', event: 'Technician Assigned', description: 'Marcus Thompson assigned to the ticket', actor: 'System', timestamp: '2024-11-01T10:00:00Z', type: 'assigned' },
      { id: 'tl15', event: 'Issue Resolved', description: 'Projector lamp replaced, issue resolved', actor: 'Marcus Thompson', timestamp: '2024-11-03T16:00:00Z', type: 'completed' },
    ],
  },
  {
    id: 'req-008',
    title: 'Academic Transcript Request',
    type: 'transcript',
    status: 'approved',
    priority: 'medium',
    submittedBy: 'u1',
    submittedByName: 'Alex Johnson',
    createdAt: '2024-11-02T11:00:00Z',
    updatedAt: '2024-11-04T09:00:00Z',
    description: 'Official academic transcript required for internship application.',
    workflowStep: 3,
    timeline: [
      { id: 'tl16', event: 'Request Submitted', description: 'Transcript request submitted', actor: 'Alex Johnson', timestamp: '2024-11-02T11:00:00Z', type: 'created' },
      { id: 'tl17', event: 'Processed', description: 'Transcript prepared and ready for pickup', actor: 'Registrar Office', timestamp: '2024-11-04T09:00:00Z', type: 'completed' },
    ],
  },
]

// ===== MOCK NOTIFICATIONS =====
export const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: 'n1',
    title: 'Request Update',
    message: 'Dr. Sarah Mitchell commented on your internship request.',
    type: 'info',
    read: false,
    createdAt: '2024-11-12T14:30:00Z',
    link: '/student/requests/req-001',
  },
  {
    id: 'n2',
    title: 'Room Reservation Approved',
    message: 'Your room reservation for Study Group B204 has been approved.',
    type: 'success',
    read: false,
    createdAt: '2024-11-06T09:00:00Z',
    link: '/student/requests/req-004',
  },
  {
    id: 'n3',
    title: 'Action Required',
    message: 'Please provide additional documents for your internship request.',
    type: 'warning',
    read: true,
    createdAt: '2024-11-11T10:00:00Z',
    link: '/student/requests/req-001',
  },
  {
    id: 'n4',
    title: 'IT Ticket In Progress',
    message: 'Your VPN access issue is being investigated by Marcus Thompson.',
    type: 'info',
    read: true,
    createdAt: '2024-11-13T10:15:00Z',
    link: '/student/requests/req-003',
  },
  {
    id: 'n5',
    title: 'New Student Request',
    message: 'Alex Johnson submitted an internship approval request for TechCorp.',
    type: 'info',
    read: false,
    createdAt: '2024-11-10T09:01:00Z',
    link: '/faculty/requests/req-001',
  },
  {
    id: 'n6',
    title: 'Appointment Requested',
    message: 'Alex Johnson requested a meeting to discuss thesis progress.',
    type: 'info',
    read: false,
    createdAt: '2024-11-14T10:00:00Z',
    link: '/faculty/appointments',
  },
  {
    id: 'n7',
    title: 'SLA Alert',
    message: 'Ticket req-002 is approaching SLA deadline in 2 hours.',
    type: 'warning',
    read: false,
    createdAt: '2024-11-14T08:00:00Z',
    link: '/staff/tickets',
  },
  {
    id: 'n8',
    title: 'System Health',
    message: 'Email integration experienced 3 failed syncs in the last hour.',
    type: 'error',
    read: false,
    createdAt: '2024-11-14T07:30:00Z',
    link: '/admin/integrations',
  },
]

// ===== MOCK APPOINTMENTS =====
export const MOCK_APPOINTMENTS: Appointment[] = [
  {
    id: 'apt-1',
    title: 'Thesis Progress Review',
    with: 'Dr. Sarah Mitchell',
    withRole: 'faculty',
    date: '2024-11-18',
    time: '10:00',
    duration: 30,
    location: 'Office A312',
    status: 'scheduled',
    notes: 'Bring updated chapter outline',
  },
  {
    id: 'apt-2',
    title: 'Academic Advising Session',
    with: 'Prof. David Chen',
    withRole: 'faculty',
    date: '2024-11-20',
    time: '14:00',
    duration: 45,
    location: 'Office B201',
    status: 'pending',
  },
  {
    id: 'apt-3',
    title: 'Internship Discussion',
    with: 'Alex Johnson',
    withRole: 'student',
    date: '2024-11-18',
    time: '10:00',
    duration: 30,
    location: 'Office A312',
    status: 'scheduled',
    notes: 'Review TechCorp offer letter',
  },
  {
    id: 'apt-4',
    title: 'Curriculum Committee Meeting',
    with: 'Department Team',
    withRole: 'faculty',
    date: '2024-11-19',
    time: '13:00',
    duration: 60,
    location: 'Conference Room C1',
    status: 'scheduled',
  },
  {
    id: 'apt-5',
    title: 'IT Onboarding Review',
    with: 'New Faculty Members',
    withRole: 'faculty',
    date: '2024-11-21',
    time: '09:00',
    duration: 90,
    location: 'Lab D104',
    status: 'scheduled',
  },
]

// ===== MOCK RESERVATIONS =====
export const MOCK_RESERVATIONS: Reservation[] = [
  {
    id: 'res-1',
    roomName: 'Seminar Room B204',
    building: 'Building B',
    capacity: 20,
    reservedBy: 'Alex Johnson',
    date: '2024-11-18',
    startTime: '14:00',
    endTime: '17:00',
    purpose: 'Study group – Advanced Algorithms',
    status: 'confirmed',
  },
  {
    id: 'res-2',
    roomName: 'Computer Lab C301',
    building: 'Building C',
    capacity: 30,
    reservedBy: 'Dr. Sarah Mitchell',
    date: '2024-11-19',
    startTime: '09:00',
    endTime: '12:00',
    purpose: 'Mid-term exam – CS404',
    status: 'confirmed',
  },
  {
    id: 'res-3',
    roomName: 'Conference Room A1',
    building: 'Building A',
    capacity: 12,
    reservedBy: 'Marcus Thompson',
    date: '2024-11-20',
    startTime: '11:00',
    endTime: '13:00',
    purpose: 'IT Infrastructure Planning',
    status: 'pending',
  },
  {
    id: 'res-4',
    roomName: 'Lecture Hall A1',
    building: 'Building A',
    capacity: 150,
    reservedBy: 'Dr. Sarah Mitchell',
    date: '2024-11-21',
    startTime: '08:00',
    endTime: '10:00',
    purpose: 'CS301 Weekly Lecture',
    status: 'confirmed',
  },
]

// ===== ADMIN METRICS =====
export const ADMIN_METRICS = {
  totalRequests: 487,
  openRequests: 134,
  pendingApprovals: 42,
  completedThisWeek: 89,
  approvalRate: 84,
  avgResolutionHours: 18.4,
  activeUsers: 1243,
  workflowHealth: 96,
  requestsByType: [
    { type: 'IT Support', count: 142, color: '#6366f1' },
    { type: 'Room Reservation', count: 98, color: '#10b981' },
    { type: 'Internship', count: 76, color: '#f59e0b' },
    { type: 'Equipment', count: 64, color: '#ef4444' },
    { type: 'Appointment', count: 58, color: '#06b6d4' },
    { type: 'Other', count: 49, color: '#8b5cf6' },
  ],
  weeklyTrend: [
    { day: 'Mon', requests: 42, completed: 35 },
    { day: 'Tue', requests: 58, completed: 49 },
    { day: 'Wed', requests: 35, completed: 40 },
    { day: 'Thu', requests: 72, completed: 55 },
    { day: 'Fri', requests: 61, completed: 58 },
    { day: 'Sat', requests: 18, completed: 22 },
    { day: 'Sun', requests: 9, completed: 12 },
  ],
  monthlyResolution: [
    { month: 'Jul', rate: 78 },
    { month: 'Aug', rate: 81 },
    { month: 'Sep', rate: 79 },
    { month: 'Oct', rate: 83 },
    { month: 'Nov', rate: 84 },
  ],
}

// ===== ADMIN USERS =====
export const ADMIN_USERS = [
  { id: 'u1', name: 'Alex Johnson', email: 'alex.johnson@campus.edu', role: 'student' as Role, department: 'Computer Science', status: 'active', lastLogin: '2024-11-14T08:00:00Z' },
  { id: 'u2', name: 'Dr. Sarah Mitchell', email: 'sarah.mitchell@campus.edu', role: 'faculty' as Role, department: 'Computer Science', status: 'active', lastLogin: '2024-11-14T07:30:00Z' },
  { id: 'u3', name: 'Marcus Thompson', email: 'marcus.thompson@campus.edu', role: 'staff' as Role, department: 'IT Services', status: 'active', lastLogin: '2024-11-13T17:00:00Z' },
  { id: 'u5', name: 'Priya Sharma', email: 'priya.sharma@campus.edu', role: 'student' as Role, department: 'Business Admin', status: 'active', lastLogin: '2024-11-13T09:00:00Z' },
  { id: 'u6', name: 'Prof. James Carter', email: 'james.carter@campus.edu', role: 'faculty' as Role, department: 'Engineering', status: 'active', lastLogin: '2024-11-12T14:00:00Z' },
  { id: 'u7', name: 'Linda Brooks', email: 'linda.brooks@campus.edu', role: 'staff' as Role, department: 'Facilities', status: 'inactive', lastLogin: '2024-10-30T10:00:00Z' },
  { id: 'u8', name: 'Carlos Rivera', email: 'carlos.rivera@campus.edu', role: 'student' as Role, department: 'Architecture', status: 'active', lastLogin: '2024-11-14T06:00:00Z' },
  { id: 'u9', name: 'Dr. Angela Wu', email: 'angela.wu@campus.edu', role: 'faculty' as Role, department: 'Mathematics', status: 'active', lastLogin: '2024-11-11T11:00:00Z' },
]

export const AUDIT_LOGS = [
  { id: 'log-1', action: 'User Login', actor: 'alex.johnson@campus.edu', target: 'Auth', timestamp: '2024-11-14T08:00:00Z', ip: '192.168.1.42', status: 'success' },
  { id: 'log-2', action: 'Request Created', actor: 'alex.johnson@campus.edu', target: 'Request req-005', timestamp: '2024-11-14T10:00:00Z', ip: '192.168.1.42', status: 'success' },
  { id: 'log-3', action: 'Request Approved', actor: 'sarah.mitchell@campus.edu', target: 'Request req-004', timestamp: '2024-11-13T14:30:00Z', ip: '10.0.0.15', status: 'success' },
  { id: 'log-4', action: 'User Role Changed', actor: 'jennifer.park@campus.edu', target: 'linda.brooks@campus.edu', timestamp: '2024-11-13T11:00:00Z', ip: '10.0.0.1', status: 'success' },
  { id: 'log-5', action: 'Failed Login', actor: 'unknown@external.com', target: 'Auth', timestamp: '2024-11-13T06:22:00Z', ip: '203.45.78.12', status: 'failed' },
  { id: 'log-6', action: 'Settings Updated', actor: 'jennifer.park@campus.edu', target: 'System Config', timestamp: '2024-11-12T09:00:00Z', ip: '10.0.0.1', status: 'success' },
  { id: 'log-7', action: 'Integration Sync', actor: 'system', target: 'Email Integration', timestamp: '2024-11-14T07:30:00Z', ip: 'internal', status: 'failed' },
]
