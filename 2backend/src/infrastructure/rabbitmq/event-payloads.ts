import type { RoutingKey } from './routing-keys';

/** Tüm RabbitMQ event payload tipleri */

export interface BaseEventPayload {
  event: RoutingKey;
  occurredAt: string; // ISO-8601
  correlationId?: string;
}

// ── Request events ──────────────────────────────────────────────────────────

export interface RequestCreatedPayload extends BaseEventPayload {
  event: 'request.created';
  requestId: string;
  requestNo: string;
  requestType: string;
  requesterUserId: string;
  priority: string;
  workflowInstanceId?: string | null;
}

export interface RequestUpdatedPayload extends BaseEventPayload {
  event: 'request.updated';
  requestId: string;
  requestType: string;
  updatedByUserId: string;
  changes: string[];
}

export interface RequestCancelledPayload extends BaseEventPayload {
  event: 'request.cancelled';
  requestId: string;
  requestType: string;
  cancelledByUserId: string;
  reason?: string | null;
}

// ── Workflow events ─────────────────────────────────────────────────────────

export interface WorkflowAssignedPayload extends BaseEventPayload {
  event: 'workflow.assigned';
  requestId: string;
  requestType: string;
  workflowInstanceId?: string | null;
  stepCode?: string | null;
  assigneeUserId: string;
  assigneeRole?: string | null;
  triggeredByUserId: string;
}

export interface WorkflowApprovedPayload extends BaseEventPayload {
  event: 'workflow.approved';
  requestId: string;
  requestType: string;
  actorUserId: string;
  comment?: string | null;
  newStatus: string;
}

export interface WorkflowRejectedPayload extends BaseEventPayload {
  event: 'workflow.rejected';
  requestId: string;
  requestType: string;
  actorUserId: string;
  comment?: string | null;
  newStatus: string;
}

export interface WorkflowRevisionRequestedPayload extends BaseEventPayload {
  event: 'workflow.revision_requested';
  requestId: string;
  requestType: string;
  actorUserId: string;
  comment?: string | null;
  newStatus: string;
}

export interface RequestStatusChangedPayload extends BaseEventPayload {
  event: 'request.status_changed';
  requestId: string;
  requestType: string;
  oldStatus: string;
  newStatus: string;
  actorUserId?: string | null;
  note?: string | null;
}

export interface EventPublishedPayload extends BaseEventPayload {
  event: 'event.published';
  eventId: string;
  eventTitle: string;
  eventDescription?: string | null;
  eventDate?: string | null;
  location?: string | null;
  organizerName?: string | null;
  targetAudience?: string | null; // "ALL" | "FACULTY:<id>" | "DEPT:<id>"
}

// ── Notification / email ────────────────────────────────────────────────────

export interface NotificationCreatePayload extends BaseEventPayload {
  event: 'notification.create';
  userId: string;
  title: string;
  message: string;
  requestId?: string | null;
  actionUrl?: string | null;
}

export interface EmailSendPayload extends BaseEventPayload {
  event: 'email.send';
  template: string;
  recipientUserId?: string | null;
  toEmail?: string | null;
  requestId?: string | null;
  context: Record<string, unknown>;
}

// ── SLA / reminder ──────────────────────────────────────────────────────────

export interface ReminderSchedulePayload extends BaseEventPayload {
  event: 'reminder.schedule';
  requestId: string;
  targetUserId: string;
  reminderType: string;
  scheduledAt: string;
}

export interface SlaCheckPayload extends BaseEventPayload {
  event: 'sla.check';
  requestId: string;
  checkType: 'first_response' | 'resolution' | 'step_overdue';
}

// ── Audit ───────────────────────────────────────────────────────────────────

export interface AuditAppendPayload extends BaseEventPayload {
  event: 'audit.append';
  entityType: string;
  entityId: string;
  actionType: string;
  actorUserId?: string | null;
  description: string;
  meta?: Record<string, unknown>;
}

/** Union type — tüm payload'lar */
export type AnyEventPayload =
  | RequestCreatedPayload
  | RequestUpdatedPayload
  | RequestCancelledPayload
  | RequestStatusChangedPayload
  | WorkflowAssignedPayload
  | WorkflowApprovedPayload
  | WorkflowRejectedPayload
  | WorkflowRevisionRequestedPayload
  | EventPublishedPayload
  | NotificationCreatePayload
  | EmailSendPayload
  | ReminderSchedulePayload
  | SlaCheckPayload
  | AuditAppendPayload;
