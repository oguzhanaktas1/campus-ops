export type RealtimeEventName =
  | 'notification.created'
  | 'request.created'
  | 'request.updated'
  | 'request.status.changed'
  | 'request.comment.created'
  | 'request.file.uploaded'
  | 'workflow.step.changed'
  | 'approval.created'
  | 'approval.completed'
  | 'ticket.assigned'
  | 'ticket.status.changed'
  | 'sla.warning'
  | 'sla.breached'
  | 'reservation.updated'
  | 'appointment.updated'
  | 'ai.response.completed';

export interface RealtimePayload<T = unknown> {
  event: RealtimeEventName;
  data: T;
  createdAt: string;
}
