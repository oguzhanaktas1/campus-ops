/** RabbitMQ exchange adı */
export const EXCHANGE = 'campusops.events';

/** Routing key sabitleri */
export const RoutingKeys = {
  // ── Request lifecycle ────────────────────────────────────────────────────
  REQUEST_CREATED:  'request.created',
  REQUEST_UPDATED:  'request.updated',
  REQUEST_CANCELLED:'request.cancelled',

  // ── Workflow actions ─────────────────────────────────────────────────────
  WORKFLOW_ASSIGNED:            'workflow.assigned',
  WORKFLOW_APPROVED:            'workflow.approved',
  WORKFLOW_REJECTED:            'workflow.rejected',
  WORKFLOW_REVISION_REQUESTED:  'workflow.revision_requested',

  // ── Notification / email ─────────────────────────────────────────────────
  NOTIFICATION_CREATE: 'notification.create',
  EMAIL_SEND:          'email.send',

  // ── SLA / reminder ───────────────────────────────────────────────────────
  REMINDER_SCHEDULE: 'reminder.schedule',
  SLA_CHECK:         'sla.check',

  // ── Files / docs / reports ───────────────────────────────────────────────
  ATTACHMENT_PROCESS: 'attachment.process',
  DOCUMENT_GENERATE:  'document.generate',
  REPORT_GENERATE:    'report.generate',

  // ── Audit ─────────────────────────────────────────────────────────────────
  AUDIT_APPEND: 'audit.append',
} as const;

export type RoutingKey = (typeof RoutingKeys)[keyof typeof RoutingKeys];

/** Queue adları */
export const Queues = {
  NOTIFICATIONS: 'q.notifications',
  EMAILS:        'q.emails',
  WORKFLOW:      'q.workflow',
  REMINDERS:     'q.reminders',
  ATTACHMENTS:   'q.attachments',
  DOCUMENTS:     'q.documents',
  REPORTS:       'q.reports',
  AUDIT:         'q.audit',
  DEADLETTER:    'q.deadletter',
} as const;

/**
 * Her queue'nun hangi routing key pattern'larını dinleyeceği.
 * RabbitMQ topic exchange kullanıyoruz; '*' tek kelime, '#' birden fazla kelime eşleştirir.
 */
export const QUEUE_BINDINGS: Record<string, string[]> = {
  [Queues.NOTIFICATIONS]: [
    'workflow.*',
    'notification.create',
    'request.created',
  ],
  [Queues.EMAILS]: [
    'email.send',
    'workflow.*',
    'reminder.schedule',
  ],
  [Queues.WORKFLOW]: [
    'request.created',
    'workflow.assigned',
    'workflow.approved',
    'workflow.revision_requested',
    'sla.check',
  ],
  [Queues.REMINDERS]: [
    'reminder.schedule',
    'sla.check',
  ],
  [Queues.ATTACHMENTS]: [
    'attachment.process',
  ],
  [Queues.DOCUMENTS]: [
    'document.generate',
    'workflow.approved',
  ],
  [Queues.REPORTS]: [
    'report.generate',
  ],
  [Queues.AUDIT]: [
    'audit.append',
    'request.*',
    'workflow.*',
  ],
};
