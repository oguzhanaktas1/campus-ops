export interface AdminTranslations {
  common: {
    save: string
    saving: string
    cancel: string
    delete: string
    deleting: string
    edit: string
    add: string
    search: string
    actions: string
    status: string
    type: string
    name: string
    description: string
    createdAt: string
    noData: string
    loading: string
    refresh: string
    close: string
    confirm: string
    yes: string
    no: string
    none: string
    all: string
    total: string
    active: string
    inactive: string
    enabled: string
    disabled: string
    enable: string
    disable: string
    required: string
    optional: string
    back: string
    next: string
    prev: string
    page: string
    of: string
    export: string
    download: string
    view: string
    viewAll: string
    noResults: string
    unknown: string
    system: string
    custom: string
    scope: string
    permissions: string
    role: string
    roles: string
    user: string
    users: string
    clear: string
    selected: string
    deleteSelected: string
    selectAll: string
    deselectAll: string
    markAllRead: string
    systemHealthy: string
  }
  assistant: Record<string, string>
  nav: Record<string, string>
  dashboard: Record<string, string>
  users: Record<string, string>
  roles: Record<string, string>
  settings: Record<string, string>
  requests: {
    title: string
    subtitle: string
    searchPlaceholder: string
    allStatuses: string
    allTypes: string
    statusSubmitted: string
    statusApproved: string
    statusRejected: string
    statusRevision: string
    visible: string
    colRequest: string
    colType: string
    colStudent: string
    colStatus: string
    colLink: string
    deleteConfirmTitle: string
    deleteConfirmDesc: string
    deleteSuccess: string
    deleteFail: string
    loadFail: string
    networkError: string
    typeLabels: Record<string, string>
  }
  analytics: Record<string, string>
  organization: Record<string, string>
  resources: Record<string, string>
  workflows: Record<string, string>
  sla: Record<string, string>
  monitoring: Record<string, string>
  integrations: Record<string, string>
  webhookLogs: Record<string, string>
  systemEvents: Record<string, string>
  auditLogs: Record<string, string>
  notifications: Record<string, string>
  reports: Record<string, string>
  requestTypes: Record<string, string>
  permissions: Record<string, string>
  events: Record<string, string>
  pages: Record<string, string>
  time: Record<string, string>
}

export interface StudentTranslations {
  common: {
    view: string
    viewAll: string
    newRequest: string
    cancel: string
    submitRequest: string
    loading: string
    select: string
    delete: string
    download: string
    upload: string
    search: string
    all: string
    active: string
    past: string
    selected: string
    markAllRead: string
    selectAll: string
    deselectAll: string
  }
  nav: {
    dashboard: string
    requests: string
    documents: string
    reservations: string
    appointments: string
    internships: string
    equipment: string
    procurement: string
    events: string
    accessRequests: string
    calendar: string
    notifications: string
    files: string
    settings: string
    studentPortal: string
  }
  assistant: {
    title: string
    description: string
    internshipPrompt: string
    requestsPrompt: string
    reservationPrompt: string
  }
  dashboard: {
    greeting: string
    fallbackName: string
    subtitle: string
    openRequests: string
    awaitingAction: string
    pendingApprovals: string
    underReview: string
    completed: string
    thisSemester: string
    upcoming: string
    appointmentsRooms: string
    vsLastMonth: string
    quickActions: string
    internshipApplication: string
    bookAppointment: string
    reserveRoom: string
    myFiles: string
    myOpenRequests: string
    noOpenRequests: string
    upcomingAppointments: string
    noUpcomingAppointments: string
    notifications: string
    allCaughtUp: string
  }
  requests: Record<string, string>
  documents: Record<string, string>
  pages: Record<string, string>
  forms: Record<string, string>
  messages: Record<string, string>
  status: Record<string, string>
  time: Record<string, string>
  detail: Record<string, string>
  notifications: Record<string, string>
}
