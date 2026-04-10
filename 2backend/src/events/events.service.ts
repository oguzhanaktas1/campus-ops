import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service';
import { RequestStatus, PriorityLevel } from '@prisma/client';
import { WorkflowEngineService } from '../workflow/workflow-engine.service';

const TYPE_KEY = 'EVENT_REQUEST';

const STATUS_ACTION_MAP: Partial<Record<RequestStatus, 'approve' | 'reject' | 'revision' | 'cancel'>> = {
  [RequestStatus.APPROVED]: 'approve',
  [RequestStatus.REJECTED]: 'reject',
  [RequestStatus.REVISION_REQUESTED]: 'revision',
  [RequestStatus.CANCELLED]: 'cancel',
};

function makeRequestNo(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `EVT-${ymd}-${Math.floor(Math.random() * 9000) + 1000}`;
}

@Injectable()
export class EventsService {
  constructor(
    private prisma: PrismaService,
    private workflowEngine: WorkflowEngineService,
  ) {}

  private async getOrCreateRequestType() {
    let rt = await this.prisma.requestType.findUnique({ where: { key: TYPE_KEY } });
    if (!rt) {
      rt = await this.prisma.requestType.create({
        data: { key: TYPE_KEY, name: 'Event / Activity Request', category: 'CAMPUS_SERVICES', description: 'Campus event or student activity approval request', isActive: true },
      });
    }
    return rt;
  }

  async create(userId: string, dto: {
    eventName: string;
    eventType: string;
    description: string;
    expectedAttendance: number;
    locationPreference?: string;
    startAt: string;
    endAt: string;
    needsBudget?: boolean;
    estimatedBudget?: number;
    needsPosterApproval?: boolean;
    needsSecuritySupport?: boolean;
    needsTechnicalSupport?: boolean;
  }) {
    const rt = await this.getOrCreateRequestType();
    const requestNo = makeRequestNo();

    const req = await this.prisma.$transaction(async (tx) => {
      const initialStatus = RequestStatus.SUBMITTED;
      const r = await tx.request.create({
        data: {
          requestNo,
          title: dto.eventName,
          requestTypeId: rt.id,
          requesterUserId: userId,
          status: RequestStatus.SUBMITTED,
          priority: PriorityLevel.MEDIUM,
          submittedAt: new Date(),
          eventRequest: {
            create: {
              organizerUserId: userId,
              eventName: dto.eventName,
              eventType: dto.eventType,
              description: dto.description,
              expectedAttendance: dto.expectedAttendance,
              locationPreference: dto.locationPreference,
              startAt: new Date(dto.startAt),
              endAt: new Date(dto.endAt),
              needsBudget: dto.needsBudget ?? false,
              estimatedBudget: dto.estimatedBudget,
              needsPosterApproval: dto.needsPosterApproval ?? false,
              needsSecuritySupport: dto.needsSecuritySupport ?? false,
              needsTechnicalSupport: dto.needsTechnicalSupport ?? false,
            },
          },
        },
        include: { eventRequest: true },
      });
      await tx.requestStatusHistory.create({
        data: { requestId: r.id, oldStatus: null, newStatus: RequestStatus.SUBMITTED, changedByUserId: userId, changeReason: 'Event request submitted.' },
      });

      const wfDefId = rt.workflowDefinitionId;
      if (wfDefId) {
        const wfStatus = await this.workflowEngine.bootstrapInstance(tx, r.id, wfDefId);
        if (wfStatus && wfStatus !== initialStatus) {
          await tx.request.update({
            where: { id: r.id },
            data: { status: wfStatus },
          });
          await tx.requestStatusHistory.create({
            data: {
              requestId: r.id,
              oldStatus: initialStatus,
              newStatus: wfStatus,
              changedByUserId: userId,
              changeReason: 'Workflow started.',
            },
          });
        }
      }
      return r;
    });

    void this.prisma.auditLog.create({
      data: { userId, actionType: 'CREATE', entityType: 'EventRequest', entityId: req.id },
    });

    return { requestNo: req.requestNo, requestId: req.id };
  }

  async findAll(userId: string, roles: string[]) {
    const isStaffOrAdmin = roles.some((r) => ['STAFF', 'ADMIN'].includes(r));
    const isFaculty = roles.includes('FACULTY');
    const where = isStaffOrAdmin || isFaculty ? {} : { requesterUserId: userId };

    const rows = await this.prisma.request.findMany({
      where: { requestType: { key: TYPE_KEY }, deletedAt: null, ...where },
      include: {
        eventRequest: true,
        requester: { include: { profile: { select: { fullName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((r) => ({
      id: r.id,
      requestNo: r.requestNo,
      status: r.status,
      priority: r.priority,
      createdAt: r.createdAt,
      requesterName: r.requester.profile?.fullName ?? r.requester.email,
      eventName: r.eventRequest?.eventName,
      eventType: r.eventRequest?.eventType,
      startAt: r.eventRequest?.startAt,
      endAt: r.eventRequest?.endAt,
      expectedAttendance: r.eventRequest?.expectedAttendance,
    }));
  }

  async findById(userId: string, id: string, roles: string[]) {
    const r = await this.prisma.request.findUnique({
      where: { id, deletedAt: null },
      include: {
        eventRequest: true,
        requester: { include: { profile: { select: { fullName: true, title: true } } } },
        statusHistory: { orderBy: { changedAt: 'asc' } },
        workflowInstance: {
          include: {
            currentStep: true,
            workflowDefinition: { select: { name: true } },
          },
        },
      },
    });
    if (!r) throw new NotFoundException('Event request not found.');
    const isPrivileged = roles.some((ro) => ['STAFF', 'ADMIN', 'FACULTY'].includes(ro));
    if (!isPrivileged && r.requesterUserId !== userId) throw new ForbiddenException();
    return {
      ...r,
      workflow: r.workflowInstance
        ? {
            status: r.workflowInstance.status,
            currentStep: r.workflowInstance.currentStep?.stepName ?? null,
            workflowName: r.workflowInstance.workflowDefinition?.name ?? null,
          }
        : null,
    };
  }

  async updateStatus(userId: string, roles: string[], id: string, status: RequestStatus, note?: string) {
    const r = await this.prisma.request.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Event request not found.');

    const action = STATUS_ACTION_MAP[status];
    if (!action) {
      throw new BadRequestException('This endpoint only supports workflow actions: approve, reject, revision, cancel.');
    }

    const updated = await this.workflowEngine.processAction(userId, roles, id, {
      action,
      comment: note,
    });

    void this.prisma.auditLog.create({
      data: { userId, actionType: 'UPDATE', entityType: 'EventRequest', entityId: id, newValuesJson: { status, note } },
    });

    return updated;
  }
}
