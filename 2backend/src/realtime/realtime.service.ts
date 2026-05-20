import { Injectable } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeEventName, RealtimePayload } from './realtime.types';
import { RealtimeRooms } from './utils/room-builder';

@Injectable()
export class RealtimeService {
  constructor(private readonly gateway: RealtimeGateway) {}

  emitToUser<T>(userId: string, event: RealtimeEventName, data: T) {
    this.gateway.server.to(RealtimeRooms.user(userId)).emit(event, this.payload(event, data));
  }

  emitToRole<T>(role: string, event: RealtimeEventName, data: T) {
    this.gateway.server.to(RealtimeRooms.role(role)).emit(event, this.payload(event, data));
  }

  emitToSubRole<T>(subRole: string, event: RealtimeEventName, data: T) {
    this.gateway.server.to(RealtimeRooms.subrole(subRole)).emit(event, this.payload(event, data));
  }

  emitToUnit<T>(unitId: string, event: RealtimeEventName, data: T) {
    this.gateway.server.to(RealtimeRooms.unit(unitId)).emit(event, this.payload(event, data));
  }

  emitToFaculty<T>(facultyId: string, event: RealtimeEventName, data: T) {
    this.gateway.server.to(RealtimeRooms.faculty(facultyId)).emit(event, this.payload(event, data));
  }

  emitToRequest<T>(requestId: string, event: RealtimeEventName, data: T) {
    this.gateway.server.to(RealtimeRooms.request(requestId)).emit(event, this.payload(event, data));
  }

  emitToTicket<T>(ticketId: string, event: RealtimeEventName, data: T) {
    this.gateway.server.to(RealtimeRooms.ticket(ticketId)).emit(event, this.payload(event, data));
  }

  emitToWorkflow<T>(workflowInstanceId: string, event: RealtimeEventName, data: T) {
    this.gateway.server
      .to(RealtimeRooms.workflow(workflowInstanceId))
      .emit(event, this.payload(event, data));
  }

  private payload<T>(event: RealtimeEventName, data: T): RealtimePayload<T> {
    return {
      event,
      data,
      createdAt: new Date().toISOString(),
    };
  }
}
