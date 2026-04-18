/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApprovalAction,
  PriorityLevel,
  RequestStatus,
  TicketStatus,
  WorkflowActionType,
} from '@prisma/client';
import { PrismaService } from '../core/prisma/prisma.service';
import { WorkflowEngineService } from '../workflow/workflow-engine.service';
import { SlaService } from '../workflow/sla.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateItTicketDto } from './dto/create-it-ticket.dto';
import { TriageItTicketDto } from './dto/triage-it-ticket.dto';
import { ResolveItTicketDto } from './dto/resolve-it-ticket.dto';
import { AssignItTicketDto } from './dto/assign-it-ticket.dto';
import { RequestUserInfoDto } from './dto/request-user-info.dto';
import { StartProgressDto } from './dto/start-progress.dto';
import { CloseItTicketDto } from './dto/close-it-ticket.dto';
import { ReopenItTicketDto } from './dto/reopen-it-ticket.dto';
import { RejectItTicketDto } from './dto/reject-it-ticket.dto';
import { EscalateItTicketDto } from './dto/escalate-it-ticket.dto';
import { ChangePriorityDto } from './dto/change-priority.dto';
import { ChangeCategoryDto } from './dto/change-category.dto';
import { FilesService } from '../files/files.service';
import { AddCommentDto } from '../requests/dto/add-comment.dto';
import { CacheService } from '../infrastructure/cache/cache.service';
import {
  CacheKeys,
  CacheTtls,
  makeCacheHash,
} from '../infrastructure/cache/cache-keys';
import { RabbitmqPublisher } from '../infrastructure/rabbitmq/rabbitmq.publisher';
import { RoutingKeys } from '../infrastructure/rabbitmq/routing-keys';
import { AiClientService } from '../modules/ai/ai-client.service';

const IT_REQUEST_TYPE_KEY = 'IT_SUPPORT';

const INTERNAL_ROLES = ['ADMIN', 'STAFF', 'IT_AGENT', 'IT_MANAGER'];
const IT_OPERATION_ROLES = ['ADMIN', 'STAFF', 'IT_AGENT', 'IT_MANAGER'];
const IT_MANAGER_ROLES = ['ADMIN', 'IT_MANAGER'];

const OPEN_TICKET_STATUSES: TicketStatus[] = [
  TicketStatus.OPEN,
  TicketStatus.TRIAGED,
  TicketStatus.IN_PROGRESS,
  TicketStatus.WAITING_USER,
  TicketStatus.REOPENED,
];

function makeRequestNo(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `IT-${ymd}-${rand}`;
}

function deriveWorkflowStepStatus(params: {
  instanceStep: any;
  isCurrent: boolean;
  requestStatus: RequestStatus;
}) {
  const { instanceStep, isCurrent, requestStatus } = params;

  if (instanceStep?.isOverdue) return 'warning';
  if (isCurrent && requestStatus === RequestStatus.REJECTED) return 'failed';
  if (isCurrent && requestStatus === RequestStatus.REVISION_REQUESTED) {
    return 'warning';
  }
  if (isCurrent) return 'active';
  if (instanceStep?.status === 'COMPLETED') return 'completed';
  if (instanceStep?.status === 'FAILED') return 'failed';
  return 'pending';
}

type TicketLifecycleStepStatus =
  | 'completed'
  | 'active'
  | 'pending'
  | 'failed'
  | 'warning';

@Injectable()
export class TicketsService {
  constructor(
    private prisma: PrismaService,
    private workflowEngine: WorkflowEngineService,
    private slaService: SlaService,
    private notificationsService: NotificationsService,
    private cacheService: CacheService,
    private filesService: FilesService,
    private mq: RabbitmqPublisher,
    private aiClientService: AiClientService,
  ) {}

  private hasAnyRole(roles: string[], allowed: string[]) {
    return roles.some((role) => allowed.includes(role));
  }

  private canOperateTicket(roles: string[]) {
    return this.hasAnyRole(roles, IT_OPERATION_ROLES);
  }

  private canManageTicket(roles: string[]) {
    return this.hasAnyRole(roles, IT_MANAGER_ROLES);
  }

  private canSeeInternal(roles: string[]) {
    return this.hasAnyRole(roles, INTERNAL_ROLES);
  }

  private mapTicketStatusToRequestStatus(ticketStatus: TicketStatus): RequestStatus {
    switch (ticketStatus) {
      case TicketStatus.OPEN:
      case TicketStatus.REOPENED:
        return RequestStatus.SUBMITTED;
      case TicketStatus.TRIAGED:
      case TicketStatus.IN_PROGRESS:
        return RequestStatus.IN_REVIEW;
      case TicketStatus.WAITING_USER:
        return RequestStatus.REVISION_REQUESTED;
      case TicketStatus.RESOLVED:
        return RequestStatus.COMPLETED;
      case TicketStatus.CLOSED:
        return RequestStatus.CLOSED;
      default:
        return RequestStatus.SUBMITTED;
    }
  }

  private async getOrCreateRequestType() {
    let rt = await this.prisma.requestType.findUnique({
      where: { key: IT_REQUEST_TYPE_KEY },
    });
    if (!rt) {
      rt = await this.prisma.requestType.create({
        data: {
          key: IT_REQUEST_TYPE_KEY,
          name: 'IT Support Ticket',
          category: 'IT_SUPPORT',
          description: 'IT helpdesk and technical support requests',
          isActive: true,
        },
      });
    }
    return rt;
  }

  private async resolveSlaPolicy(requestTypeId: string, priority: PriorityLevel) {
    let policy = await this.prisma.slaPolicy.findFirst({
      where: { requestTypeId, priority, isActive: true },
    });
    if (!policy) {
      policy = await this.prisma.slaPolicy.findFirst({
        where: { requestTypeId: null, priority, isActive: true },
      });
    }
    if (!policy) {
      policy = await this.prisma.slaPolicy.findFirst({
        where: { requestTypeId, priority: null, isActive: true },
      });
    }
    return policy;
  }

  private async recalculateTicketPolicy(tx: any, requestId: string) {
    const req = await tx.request.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        requestTypeId: true,
        priority: true,
        createdAt: true,
      },
    });

    if (!req) return null;

    const policy = await this.resolveSlaPolicy(req.requestTypeId, req.priority);

    await tx.itTicket.update({
      where: { requestId },
      data: { slaPolicyId: policy?.id ?? null },
    });

    await tx.request.update({
      where: { id: requestId },
      data: {
        dueAt:
          policy?.resolutionMinutes && policy.resolutionMinutes > 0
            ? new Date(
                req.createdAt.getTime() + policy.resolutionMinutes * 60 * 1000,
              )
            : null,
      },
    });

    return policy;
  }

  private toListItem(r: any) {
    const req = r.request;
    return {
      id: req.id,
      ticketId: r.id,
      requestNo: req.requestNo,
      title: req.title,
      status: req.status,
      ticketStatus: r.ticketStatus,
      priority: req.priority,
      category: r.category,
      subcategory: r.subcategory,
      affectedSystem: r.affectedSystem,
      assetId: r.assetId,
      locationText: r.locationText,
      currentAssignee: req.currentAssignee
        ? {
            id: req.currentAssignee.id,
            fullName:
              req.currentAssignee.profile?.fullName ?? req.currentAssignee.email,
          }
        : null,
      assignee: r.assignedTo
        ? {
            id: r.assignedTo.id,
            fullName: r.assignedTo.profile?.fullName ?? r.assignedTo.email,
          }
        : null,
      requesterName: req.requester?.profile?.fullName ?? req.requester?.email,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      dueAt: req.dueAt,
    };
  }

  private async getTicketRecordOrThrow(requestId: string): Promise<any> {
    const ticket = await this.prisma.itTicket.findFirst({
      where: { requestId },
      include: {
        request: {
          include: {
            requester: {
              include: {
                profile: {
                  include: {
                    faculty: { select: { name: true } },
                    department: { select: { name: true } },
                    unit: { select: { name: true } },
                  },
                },
              },
            },
            currentAssignee: {
              include: { profile: { select: { fullName: true } } },
            },
            requestType: true,
            statusHistory: {
              include: {
                changedBy: { include: { profile: { select: { fullName: true } } } },
              },
              orderBy: { changedAt: 'asc' },
            },
            assignments: {
              include: {
                assignedTo: { include: { profile: { select: { fullName: true } } } },
                assignedBy: { include: { profile: { select: { fullName: true } } } },
              },
              orderBy: { assignedAt: 'desc' },
            },
            comments: {
              include: {
                user: {
                  include: {
                    profile: true,
                    primaryRoles: { include: { role: true } },
                  },
                },
              },
              orderBy: { createdAt: 'asc' },
            },
            workflowInstance: {
              include: {
                workflowDefinition: {
                  include: { steps: { orderBy: { stepOrder: 'asc' } } },
                },
                currentStep: true,
                instanceSteps: {
                  include: {
                    workflowStep: true,
                    assignedTo: {
                      include: { profile: { select: { fullName: true } } },
                    },
                    actionBy: {
                      include: { profile: { select: { fullName: true } } },
                    },
                    approvalActions: {
                      include: {
                        actionBy: {
                          include: { profile: { select: { fullName: true } } },
                        },
                      },
                      orderBy: { createdAt: 'asc' },
                    },
                  },
                  orderBy: { createdAt: 'asc' },
                },
              },
            },
            approvalActions: {
              include: {
                actionBy: {
                  include: { profile: { select: { fullName: true } } },
                },
                workflowInstanceStep: {
                  include: { workflowStep: true },
                },
              },
              orderBy: { createdAt: 'asc' },
            },
            fileLinks: { include: { file: true } },
            slaEvents: { orderBy: { occurredAt: 'asc' } },
          },
        },
        reportedBy: { include: { profile: { select: { fullName: true } } } },
        assignedTo: { include: { profile: { select: { fullName: true } } } },
        slaPolicy: true,
      },
    });

    if (!ticket) {
      throw new NotFoundException('IT ticket not found.');
    }

    return ticket;
  }

  private assertTicketVisibility(userId: string, roles: string[], ticket: any) {
    const isOwner = ticket.request.requesterUserId === userId;
    const isAssignedAgent = ticket.assignedItUserId === userId;

    if (
      this.canManageTicket(roles) ||
      isOwner ||
      (this.canOperateTicket(roles) && isAssignedAgent)
    ) {
      return;
    }

    throw new ForbiddenException('Access denied.');
  }

  private assertTicketOperator(userId: string, roles: string[], ticket: any) {
    const isAssignedAgent = ticket.assignedItUserId === userId;
    if (this.canManageTicket(roles) || (roles.includes('IT_AGENT') && isAssignedAgent)) {
      return;
    }
    throw new ForbiddenException('Insufficient permissions.');
  }

  private async touchTicketCaches(requestId: string) {
    await Promise.all([
      this.cacheService.bumpVersion(CacheKeys.version('staff:tickets:list')),
      this.cacheService.bumpVersion(CacheKeys.version('admin:requests:list')),
      this.cacheService.bumpVersion(CacheKeys.version('admin:dashboard:summary')),
      this.cacheService.bumpVersion(CacheKeys.version(`request:detail:${requestId}`)),
    ]);
  }

  private async notifyUsers(
    userIds: Array<string | null | undefined>,
    payload: {
      requestId: string;
      title: string;
      message: string;
      actionUrl?: string;
    },
  ) {
    const deduped = Array.from(
      new Set(userIds.filter((userId): userId is string => Boolean(userId))),
    );

    await Promise.all(
      deduped.map((userId) =>
        this.notificationsService.createNotification({
          userId,
          requestId: payload.requestId,
          title: payload.title,
          message: payload.message,
          actionUrl: payload.actionUrl,
        }),
      ),
    );
  }

  private async createApprovalAction(
    tx: any,
    requestId: string,
    actorUserId: string,
    actionType: WorkflowActionType,
    decisionNote?: string | null,
  ) {
    const activeStep = await tx.workflowInstanceStep.findFirst({
      where: {
        workflowInstance: { requestId },
        completedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    return tx.approvalAction.create({
      data: {
        requestId,
        workflowInstanceStepId: activeStep?.id ?? null,
        actionType,
        actionByUserId: actorUserId,
        decisionNote: decisionNote ?? null,
      },
    });
  }

  private buildSlaSummary(ticket: any) {
    const policy = ticket.slaPolicy;
    const events = ticket.request.slaEvents ?? [];

    const firstResponseStarted = events.find(
      (event: any) => event.eventType === 'FIRST_RESPONSE_STARTED',
    );
    const resolutionStarted = events.find(
      (event: any) => event.eventType === 'RESOLUTION_STARTED',
    );
    const firstResponseOutcome = events.find((event: any) =>
      ['FIRST_RESPONSE_MET', 'FIRST_RESPONSE_BREACHED'].includes(event.eventType),
    );
    const resolutionOutcome = events.find((event: any) =>
      ['RESOLUTION_MET', 'RESOLUTION_BREACHED'].includes(event.eventType),
    );
    const escalationEvent = events.find(
      (event: any) => event.eventType === 'ESCALATION_TRIGGERED',
    );

    const firstResponseDeadline =
      firstResponseStarted && policy?.firstResponseMinutes
        ? new Date(
            firstResponseStarted.occurredAt.getTime() +
              policy.firstResponseMinutes * 60 * 1000,
          )
        : null;

    const resolutionDeadline =
      resolutionStarted && policy?.resolutionMinutes
        ? new Date(
            resolutionStarted.occurredAt.getTime() +
              policy.resolutionMinutes * 60 * 1000,
          )
        : ticket.request.dueAt;

    const escalationDeadline =
      resolutionStarted && policy?.escalationMinutes
        ? new Date(
            resolutionStarted.occurredAt.getTime() +
              policy.escalationMinutes * 60 * 1000,
          )
        : null;

    return {
      policy: policy
        ? {
            id: policy.id,
            name: policy.name,
            firstResponseMinutes: policy.firstResponseMinutes,
            resolutionMinutes: policy.resolutionMinutes,
            escalationMinutes: policy.escalationMinutes,
          }
        : null,
      firstResponseDeadline,
      resolutionDeadline,
      escalationDeadline,
      firstResponseState: firstResponseOutcome?.eventType ?? 'PENDING',
      resolutionState: resolutionOutcome?.eventType ?? 'PENDING',
      escalationState: escalationEvent ? 'ESCALATED' : 'NORMAL',
      breached:
        firstResponseOutcome?.eventType === 'FIRST_RESPONSE_BREACHED' ||
        resolutionOutcome?.eventType === 'RESOLUTION_BREACHED',
      events: events.map((event: any) => ({
        id: event.id,
        eventType: event.eventType,
        occurredAt: event.occurredAt,
        resolvedAt: event.resolvedAt,
      })),
    };
  }

  private buildWorkflowSummary(ticket: any) {
    const statusHistory = ticket.request.statusHistory ?? [];
    const workflowInstance = ticket.request.workflowInstance;
    const currentStatus = ticket.ticketStatus as TicketStatus;
    const assignmentsAsc = [...(ticket.request.assignments ?? [])].sort(
      (a: any, b: any) =>
        new Date(a.assignedAt).getTime() - new Date(b.assignedAt).getTime(),
    );

    const actorName = (user: any) =>
      user?.profile?.fullName ?? user?.email ?? null;

    const hasRequestStatus = (status: RequestStatus) =>
      statusHistory.some((item: any) => item.newStatus === status);

    const findHistory = (predicate: (item: any) => boolean) =>
      statusHistory.find(predicate) ?? null;

    const openActor = actorName(ticket.reportedBy) ?? actorName(ticket.request.requester);
    const triagedAssignment = assignmentsAsc[0] ?? null;
    const triagedHistory =
      findHistory(
        (item: any) =>
          item.changeReason === 'Ticket triaged.' ||
          item.changeReason === 'Ticket assigned.',
      ) ??
      findHistory(
        (item: any) =>
          item.newStatus === RequestStatus.IN_REVIEW &&
          item.changeReason !== 'Work started on the IT ticket.',
      );
    const inProgressHistory = findHistory(
      (item: any) => item.changeReason === 'Work started on the IT ticket.',
    );
    const waitingUserHistory = findHistory(
      (item: any) => item.newStatus === RequestStatus.REVISION_REQUESTED,
    );
    const resolvedHistory = findHistory(
      (item: any) =>
        item.newStatus === RequestStatus.COMPLETED &&
        item.changeReason === 'Ticket resolved.',
    );
    const closedHistory = findHistory(
      (item: any) => item.newStatus === RequestStatus.CLOSED,
    );
    const reopenedHistory = findHistory(
      (item: any) => item.changeReason === 'Ticket reopened.',
    );

    const reached = {
      open: true,
      triaged:
        currentStatus === TicketStatus.TRIAGED ||
        currentStatus === TicketStatus.IN_PROGRESS ||
        currentStatus === TicketStatus.WAITING_USER ||
        currentStatus === TicketStatus.RESOLVED ||
        currentStatus === TicketStatus.CLOSED ||
        currentStatus === TicketStatus.REOPENED,
      inProgress:
        currentStatus === TicketStatus.IN_PROGRESS ||
        currentStatus === TicketStatus.WAITING_USER ||
        currentStatus === TicketStatus.RESOLVED ||
        currentStatus === TicketStatus.CLOSED ||
        currentStatus === TicketStatus.REOPENED,
      waitingUser:
        currentStatus === TicketStatus.WAITING_USER ||
        hasRequestStatus(RequestStatus.REVISION_REQUESTED),
      resolved:
        currentStatus === TicketStatus.RESOLVED ||
        currentStatus === TicketStatus.CLOSED ||
        Boolean(ticket.resolvedAt) ||
        hasRequestStatus(RequestStatus.COMPLETED),
      closed:
        currentStatus === TicketStatus.CLOSED ||
        Boolean(ticket.closedAt) ||
        hasRequestStatus(RequestStatus.CLOSED),
    };

    const currentStepByStatus: Record<TicketStatus, string> = {
      OPEN: 'Open',
      TRIAGED: 'Triaged',
      IN_PROGRESS: 'In Progress',
      WAITING_USER: 'Waiting for User',
      RESOLVED: 'Resolved',
      CLOSED: 'Closed',
      REOPENED: 'Reopened',
    };

    const baseSteps: Array<{
      id: string;
      name: string;
      status: TicketLifecycleStepStatus;
      completedAt: Date | null;
      occurredAt: Date | null;
      actorName: string | null;
      note: string | null;
    }> = [
      {
        id: 'ticket-open',
        name: 'Open',
        status: 'pending',
        completedAt: ticket.createdAt ?? ticket.request.createdAt ?? null,
        occurredAt: ticket.createdAt ?? ticket.request.createdAt ?? null,
        actorName: openActor,
        note: 'Ticket submitted.',
      },
      {
        id: 'ticket-triaged',
        name: 'Triaged',
        status: 'pending',
        completedAt:
          triagedAssignment?.assignedAt ?? triagedHistory?.changedAt ?? null,
        occurredAt:
          triagedAssignment?.assignedAt ?? triagedHistory?.changedAt ?? null,
        actorName:
          actorName(triagedAssignment?.assignedBy) ??
          actorName(triagedHistory?.changedBy),
        note:
          triagedAssignment?.assignmentNote ??
          triagedHistory?.changeReason ??
          null,
      },
      {
        id: 'ticket-in-progress',
        name: 'In Progress',
        status: 'pending',
        completedAt: inProgressHistory?.changedAt ?? null,
        occurredAt: inProgressHistory?.changedAt ?? null,
        actorName: actorName(inProgressHistory?.changedBy),
        note: inProgressHistory?.changeReason ?? null,
      },
      {
        id: 'ticket-waiting-user',
        name: 'Waiting for User',
        status: 'pending',
        completedAt: waitingUserHistory?.changedAt ?? null,
        occurredAt: waitingUserHistory?.changedAt ?? null,
        actorName: actorName(waitingUserHistory?.changedBy),
        note: waitingUserHistory?.changeReason ?? null,
      },
      {
        id: 'ticket-resolved',
        name: 'Resolved',
        status: 'pending',
        completedAt: ticket.resolvedAt ?? null,
        occurredAt: ticket.resolvedAt ?? resolvedHistory?.changedAt ?? null,
        actorName: actorName(resolvedHistory?.changedBy),
        note: resolvedHistory?.changeReason ?? ticket.resolutionSummary ?? null,
      },
      {
        id: 'ticket-closed',
        name: 'Closed',
        status: 'pending',
        completedAt: ticket.closedAt ?? null,
        occurredAt: ticket.closedAt ?? closedHistory?.changedAt ?? null,
        actorName: actorName(closedHistory?.changedBy),
        note: closedHistory?.changeReason ?? null,
      },
    ];

    const applyCompleted = (index: number) => {
      if (baseSteps[index]) {
        baseSteps[index].status = 'completed';
      }
    };

    applyCompleted(0);
    if (reached.triaged) applyCompleted(1);
    if (reached.inProgress) applyCompleted(2);
    if (reached.waitingUser) applyCompleted(3);
    if (reached.resolved) applyCompleted(4);
    if (reached.closed) applyCompleted(5);

    switch (currentStatus) {
      case TicketStatus.OPEN:
        baseSteps[0].status = 'active';
        break;
      case TicketStatus.TRIAGED:
        baseSteps[1].status = 'active';
        break;
      case TicketStatus.IN_PROGRESS:
        baseSteps[2].status = 'active';
        break;
      case TicketStatus.WAITING_USER:
        baseSteps[3].status = 'warning';
        break;
      case TicketStatus.RESOLVED:
        baseSteps[4].status = 'active';
        break;
      case TicketStatus.CLOSED:
        baseSteps.forEach((step) => {
          step.status = 'completed';
        });
        break;
      case TicketStatus.REOPENED:
        baseSteps[2].status = 'active';
        if (reached.resolved) {
          baseSteps[4].status = 'warning';
          baseSteps[4].note =
            reopenedHistory?.changeReason ??
            `Ticket reopened ${ticket.reopenedCount ?? 1} time(s).`;
        }
        break;
      default:
        break;
    }

    return {
      id: ticket.id,
      status: currentStatus,
      workflowName: 'IT Ticket Lifecycle',
      currentStep: currentStepByStatus[currentStatus] ?? 'Open',
      openedAt: ticket.createdAt ?? ticket.request.createdAt ?? null,
      openedBy: openActor,
      resolvedAt: ticket.resolvedAt ?? null,
      resolvedBy: actorName(resolvedHistory?.changedBy),
      closedAt: ticket.closedAt ?? null,
      closedBy: actorName(closedHistory?.changedBy),
      reopenedAt: reopenedHistory?.changedAt ?? null,
      reopenedBy: actorName(reopenedHistory?.changedBy),
      engineWorkflow: workflowInstance
        ? {
            id: workflowInstance.id,
            status: workflowInstance.status,
            workflowName: workflowInstance.workflowDefinition?.name ?? null,
            currentStep: workflowInstance.currentStep?.stepName ?? null,
            steps: (workflowInstance.workflowDefinition?.steps ?? []).map(
              (definitionStep: any) => {
                const instanceStep = workflowInstance.instanceSteps.find(
                  (step: any) => step.workflowStepId === definitionStep.id,
                );

                return {
                  id: instanceStep?.id ?? definitionStep.id,
                  workflowStepId: definitionStep.id,
                  name: definitionStep.stepName ?? null,
                  status: deriveWorkflowStepStatus({
                    instanceStep,
                    isCurrent: definitionStep.id === workflowInstance.currentStepId,
                    requestStatus: ticket.request.status,
                  }),
                  startedAt: instanceStep?.startedAt ?? null,
                  completedAt: instanceStep?.completedAt ?? null,
                  dueAt: instanceStep?.dueAt ?? null,
                  isOverdue: instanceStep?.isOverdue ?? false,
                };
              },
            ),
          }
        : null,
      steps: baseSteps.map((step) => ({
        id: step.id,
        workflowStepId: step.id,
        name: step.name,
        status: step.status,
        startedAt: step.occurredAt,
        completedAt: step.completedAt,
        dueAt: null,
        isOverdue: false,
        assignedTo: null,
        actionBy: null,
        actorName: step.actorName,
        note: step.note,
      })),
    };
  }

  private buildActivitySummary(ticket: any) {
    const statusHistory = ticket.request.statusHistory.map((item: any) => ({
      id: item.id,
      type: 'STATUS',
      createdAt: item.changedAt,
      label: `${item.oldStatus ?? 'NONE'} -> ${item.newStatus}`,
      note: item.changeReason,
      actor: item.changedBy
        ? item.changedBy.profile?.fullName ?? item.changedBy.email
        : 'System',
    }));

    const assignments = ticket.request.assignments.map((item: any) => ({
      id: item.id,
      type: 'ASSIGNMENT',
      createdAt: item.assignedAt,
      label: item.isActive ? 'Assigned' : 'Assignment updated',
      note: item.assignmentNote,
      actor: item.assignedBy
        ? item.assignedBy.profile?.fullName ?? item.assignedBy.email
        : 'System',
      target: item.assignedTo
        ? item.assignedTo.profile?.fullName ?? item.assignedTo.email
        : null,
      unassignedAt: item.unassignedAt,
    }));

    const approvals = ticket.request.approvalActions.map((item: ApprovalAction & any) => ({
      id: item.id,
      type: 'ACTION',
      createdAt: item.createdAt,
      label: item.actionType,
      note: item.decisionNote,
      actor: item.actionBy?.profile?.fullName ?? item.actionBy?.email ?? 'Unknown',
      workflowStep: item.workflowInstanceStep?.workflowStep?.stepName ?? null,
    }));

    return [...statusHistory, ...assignments, ...approvals].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  private async addCommentInternal(
    userId: string,
    roles: string[],
    requestId: string,
    dto: AddCommentDto,
  ) {
    const ticket = await this.getTicketRecordOrThrow(requestId);
    this.assertTicketVisibility(userId, roles, ticket);

    const canSeeInternal = this.canSeeInternal(roles);
    const isInternal = dto.isInternal === true && canSeeInternal;

    const comment = await this.prisma.requestComment.create({
      data: {
        requestId,
        userId,
        commentText: dto.commentText,
        isInternal,
        parentCommentId: dto.parentCommentId ?? null,
      },
      include: {
        user: {
          include: {
            profile: true,
            primaryRoles: { include: { role: true } },
          },
        },
      },
    });

    const isOwner = ticket.request.requesterUserId === userId;

    await this.prisma.$transaction(async (tx) => {
      if (this.canOperateTicket(roles)) {
        await this.slaService.markFirstResponse(tx, requestId);
      }

      if (isOwner && !isInternal && ticket.ticketStatus === TicketStatus.WAITING_USER) {
        const resumedStatus = ticket.assignedItUserId
          ? TicketStatus.IN_PROGRESS
          : TicketStatus.OPEN;

        await tx.itTicket.update({
          where: { id: ticket.id },
          data: { ticketStatus: resumedStatus },
        });

        await tx.request.update({
          where: { id: requestId },
          data: { status: this.mapTicketStatusToRequestStatus(resumedStatus) },
        });

        await tx.requestStatusHistory.create({
          data: {
            requestId,
            oldStatus: ticket.request.status,
            newStatus: this.mapTicketStatusToRequestStatus(resumedStatus),
            changedByUserId: userId,
            changeReason: 'User provided the requested information.',
          },
        });
      }
    });

    if (isOwner && ticket.ticketStatus === TicketStatus.WAITING_USER) {
      await this.notifyUsers(
        [ticket.assignedItUserId, ticket.request.currentAssigneeUserId],
        {
          requestId,
          title: 'User Responded to IT Ticket',
          message: `${ticket.request.requestNo} has new information from the requester.`,
          actionUrl: `/staff/tickets/${requestId}`,
        },
      );
    }

    await this.touchTicketCaches(requestId);

    return {
      id: comment.id,
      commentText: comment.commentText,
      isInternal: comment.isInternal,
      parentCommentId: comment.parentCommentId,
      createdAt: comment.createdAt,
      author: {
        id: comment.user.id,
        fullName: comment.user.profile?.fullName ?? comment.user.email,
        role:
          comment.user.primaryRoles?.[0]?.role?.name?.toUpperCase() ?? 'UNKNOWN',
      },
    };
  }

  async create(userId: string, dto: CreateItTicketDto) {
    const reqType = await this.getOrCreateRequestType();

    let requestNo = makeRequestNo();
    while (await this.prisma.request.findUnique({ where: { requestNo } })) {
      requestNo = makeRequestNo();
    }

    const aiTriage = await this.aiClientService.post(
      '/triage/ticket',
      {
        title: dto.title,
        description: dto.description ?? dto.title,
        requester_faculty: dto.facultyId ?? null,
        requester_department: dto.departmentId ?? null,
        source_channel: 'portal',
        similar_resolutions: [],
      },
      {
        requestType: 'IT_TICKET',
        category: dto.category,
        priority: dto.priority ?? 'MEDIUM',
        suggestedUnit: 'IT',
        summary: dto.title,
        missingFields: [],
        confidence: 0.25,
        fallbackUsed: true,
      },
    );

    const category =
      ['general', 'other', 'unspecified'].includes(dto.category.toLowerCase()) &&
      typeof aiTriage.category === 'string'
        ? aiTriage.category
        : dto.category;

    const priority =
      dto.priority ??
      (typeof aiTriage.priority === 'string' &&
      Object.values(PriorityLevel).includes(aiTriage.priority as PriorityLevel)
        ? (aiTriage.priority as PriorityLevel)
        : PriorityLevel.MEDIUM);

    const created = await this.prisma.$transaction(async (tx) => {
      const req = await tx.request.create({
        data: {
          requestNo,
          requestTypeId: reqType.id,
          requesterUserId: userId,
          title: dto.title,
          description: dto.description ?? null,
          priority,
          status: RequestStatus.SUBMITTED,
          submittedAt: new Date(),
          facultyId: dto.facultyId ?? null,
          departmentId: dto.departmentId ?? null,
          unitId: dto.unitId ?? null,
          dynamicData: {
            aiTriage,
          },
        },
      });

      await tx.requestStatusHistory.create({
        data: {
          requestId: req.id,
          oldStatus: null,
          newStatus: RequestStatus.SUBMITTED,
          changedByUserId: userId,
          changeReason: 'IT support ticket submitted.',
        },
      });

      const slaPolicy = await this.resolveSlaPolicy(reqType.id, priority);

      const ticket = await tx.itTicket.create({
        data: {
          requestId: req.id,
          reportedByUserId: userId,
          category,
          subcategory: dto.subcategory ?? null,
          affectedSystem: dto.affectedSystem ?? null,
          assetId: dto.assetId ?? null,
          locationText: dto.locationText ?? null,
          incidentStartedAt: dto.incidentStartedAt
            ? new Date(dto.incidentStartedAt)
            : null,
          ticketStatus: TicketStatus.OPEN,
          slaPolicyId: slaPolicy?.id ?? null,
        },
      });

      if (reqType.workflowDefinitionId) {
        await this.workflowEngine.bootstrapInstance(
          tx,
          req.id,
          reqType.workflowDefinitionId,
        );
      }

      await this.slaService.startRequestSla(tx, req.id);

      return {
        requestId: req.id,
        ticketId: ticket.id,
        requestNo: req.requestNo,
        aiTriage,
      };
    });

    await this.touchTicketCaches(created.requestId);
    return created;
  }

  async submit(userId: string, requestId: string) {
    const ticket = await this.getTicketRecordOrThrow(requestId);
    if (ticket.request.requesterUserId !== userId) {
      throw new ForbiddenException('Only the requester can submit this ticket.');
    }

    if (ticket.request.status !== RequestStatus.DRAFT) {
      return {
        requestId,
        requestStatus: ticket.request.status,
        ticketStatus: ticket.ticketStatus,
      };
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.request.update({
        where: { id: requestId },
        data: {
          status: RequestStatus.SUBMITTED,
          submittedAt: new Date(),
        },
      });

      await tx.requestStatusHistory.create({
        data: {
          requestId,
          oldStatus: RequestStatus.DRAFT,
          newStatus: RequestStatus.SUBMITTED,
          changedByUserId: userId,
          changeReason: 'IT ticket submitted.',
        },
      });

      await this.slaService.startRequestSla(tx, requestId);

      return {
        requestId,
        requestStatus: RequestStatus.SUBMITTED,
        ticketStatus: ticket.ticketStatus,
      };
    });

    await this.touchTicketCaches(requestId);
    return result;
  }

  async findMy(userId: string) {
    const records = await this.prisma.itTicket.findMany({
      where: { reportedByUserId: userId },
      include: {
        request: {
          include: {
            requester: { include: { profile: { select: { fullName: true } } } },
            currentAssignee: {
              include: { profile: { select: { fullName: true } } },
            },
            requestType: { select: { id: true, key: true, name: true } },
          },
        },
        assignedTo: { include: { profile: { select: { fullName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return records.map((record) => this.toListItem(record));
  }

  async findTriage(roles: string[]) {
    if (!this.canManageTicket(roles)) {
      throw new ForbiddenException('Only IT managers can view the triage queue.');
    }

    const records = await this.prisma.itTicket.findMany({
      where: {
        ticketStatus: {
          in: [TicketStatus.OPEN, TicketStatus.TRIAGED, TicketStatus.REOPENED],
        },
      },
      include: {
        request: {
          include: {
            requester: { include: { profile: { select: { fullName: true } } } },
            currentAssignee: {
              include: { profile: { select: { fullName: true } } },
            },
          },
        },
        assignedTo: { include: { profile: { select: { fullName: true } } } },
        slaPolicy: {
          select: {
            id: true,
            name: true,
            firstResponseMinutes: true,
            resolutionMinutes: true,
          },
        },
      },
      orderBy: [{ request: { priority: 'desc' } }, { createdAt: 'asc' }],
    });

    return records.map((record) => ({
      ...this.toListItem(record),
      reporter: record.request.requester.profile?.fullName ?? record.request.requester.email,
      slaBadge: record.slaPolicy?.name ?? null,
    }));
  }

  async findAssigned(userId: string, roles: string[], filters?: { ticketStatus?: TicketStatus }) {
    if (!this.canOperateTicket(roles)) {
      throw new ForbiddenException('Insufficient permissions.');
    }

    const where: any = {
      ticketStatus: filters?.ticketStatus
        ? filters.ticketStatus
        : { in: OPEN_TICKET_STATUSES },
    };

    if (roles.includes('IT_AGENT') && !this.canManageTicket(roles)) {
      where.assignedItUserId = userId;
    }

    const records = await this.prisma.itTicket.findMany({
      where,
      include: {
        request: {
          include: {
            requester: { include: { profile: { select: { fullName: true } } } },
            currentAssignee: {
              include: { profile: { select: { fullName: true } } },
            },
          },
        },
        assignedTo: { include: { profile: { select: { fullName: true } } } },
        slaPolicy: true,
      },
      orderBy: [{ request: { priority: 'desc' } }, { updatedAt: 'desc' }],
    });

    return records.map((record) => ({
      ...this.toListItem(record),
      reporter: record.request.requester.profile?.fullName ?? record.request.requester.email,
      slaState:
        record.request.dueAt && record.request.dueAt < new Date()
          ? 'OVERDUE'
          : 'ON_TRACK',
    }));
  }

  async findOverdue(roles: string[]) {
    if (!this.canManageTicket(roles)) {
      throw new ForbiddenException('Only IT managers can view overdue tickets.');
    }

    const now = new Date();
    const records = await this.prisma.itTicket.findMany({
      where: {
        ticketStatus: { in: OPEN_TICKET_STATUSES },
        OR: [
          { request: { dueAt: { lt: now } } },
          {
            request: {
              slaEvents: {
                some: {
                  eventType: {
                    in: [
                      'FIRST_RESPONSE_BREACHED',
                      'RESOLUTION_BREACHED',
                      'ESCALATION_TRIGGERED',
                    ],
                  },
                },
              },
            },
          },
        ],
      },
      include: {
        request: {
          include: {
            requester: { include: { profile: { select: { fullName: true } } } },
            currentAssignee: {
              include: { profile: { select: { fullName: true } } },
            },
            slaEvents: { orderBy: { occurredAt: 'asc' } },
          },
        },
        assignedTo: { include: { profile: { select: { fullName: true } } } },
        slaPolicy: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    return records.map((record) => ({
      ...this.toListItem(record),
      reporter: record.request.requester.profile?.fullName ?? record.request.requester.email,
      latestSlaEvent:
        record.request.slaEvents[record.request.slaEvents.length - 1]?.eventType ?? null,
    }));
  }

  async findCompleted(userId: string, roles: string[]) {
    if (!this.canOperateTicket(roles)) {
      throw new ForbiddenException('Insufficient permissions.');
    }

    const where: any = {
      ticketStatus: { in: [TicketStatus.RESOLVED, TicketStatus.CLOSED] },
    };

    if (roles.includes('IT_AGENT') && !this.canManageTicket(roles)) {
      where.assignedItUserId = userId;
    }

    const records = await this.prisma.itTicket.findMany({
      where,
      include: {
        request: {
          include: {
            requester: { include: { profile: { select: { fullName: true } } } },
            currentAssignee: {
              include: { profile: { select: { fullName: true } } },
            },
          },
        },
        assignedTo: { include: { profile: { select: { fullName: true } } } },
        slaPolicy: true,
      },
      orderBy: [{ closedAt: 'desc' }, { resolvedAt: 'desc' }, { updatedAt: 'desc' }],
    });

    return records.map((record) => ({
      ...this.toListItem(record),
      reporter: record.request.requester.profile?.fullName ?? record.request.requester.email,
      completedAt: record.closedAt ?? record.resolvedAt,
    }));
  }

  async findInbox(
    userId: string,
    roles: string[],
    filters?: {
      ticketStatus?: TicketStatus;
      priority?: PriorityLevel;
      category?: string;
      assignedItUserId?: string;
    },
  ) {
    if (!this.canOperateTicket(roles)) {
      throw new ForbiddenException('Insufficient permissions.');
    }

    const where: any = {
      ticketStatus: filters?.ticketStatus
        ? filters.ticketStatus
        : { in: OPEN_TICKET_STATUSES },
    };

    if (filters?.priority) {
      where.request = { priority: filters.priority };
    }
    if (filters?.category) {
      where.category = filters.category;
    }

    if (filters?.assignedItUserId !== undefined) {
      where.assignedItUserId = filters.assignedItUserId || null;
    } else if (roles.includes('IT_AGENT') && !this.canManageTicket(roles)) {
      where.assignedItUserId = userId;
    }

    const version = await this.cacheService.getVersion(
      CacheKeys.version('staff:tickets:list'),
    );
    const key = CacheKeys.staffTicketsList(makeCacheHash(filters ?? {}), version);

    return this.cacheService.getOrSet(key, CacheTtls.short, async () => {
      const records = await this.prisma.itTicket.findMany({
        where,
        include: {
          request: {
            include: {
              requestType: { select: { id: true, key: true, name: true } },
              requester: {
                include: {
                  profile: { select: { fullName: true, studentNumber: true } },
                },
              },
              currentAssignee: {
                include: { profile: { select: { fullName: true } } },
              },
            },
          },
          assignedTo: { include: { profile: { select: { fullName: true } } } },
          slaPolicy: {
            select: {
              id: true,
              name: true,
              firstResponseMinutes: true,
              resolutionMinutes: true,
            },
          },
        },
        orderBy: [{ request: { priority: 'desc' } }, { createdAt: 'asc' }],
      });

      return records.map((record) => ({
        ...this.toListItem(record),
        requesterName:
          record.request.requester.profile?.fullName ??
          record.request.requester.email,
        assignedTo: record.assignedTo
          ? {
              id: record.assignedTo.id,
              fullName:
                record.assignedTo.profile?.fullName ?? record.assignedTo.email,
            }
          : null,
        slaPolicy: record.slaPolicy ?? null,
      }));
    });
  }

  async findById(userId: string, roles: string[], requestId: string) {
    const ticket = await this.getTicketRecordOrThrow(requestId);
    this.assertTicketVisibility(userId, roles, ticket);

    const canSeeInternal = this.canSeeInternal(roles);

    return {
      id: ticket.request.id,
      requestNo: ticket.request.requestNo,
      title: ticket.request.title,
      description: ticket.request.description,
      status: ticket.request.status,
      priority: ticket.request.priority,
      createdAt: ticket.request.createdAt,
      updatedAt: ticket.request.updatedAt,
      submittedAt: ticket.request.submittedAt,
      dueAt: ticket.request.dueAt,
      requester: {
        id: ticket.request.requester.id,
        email: ticket.request.requester.email,
        fullName:
          ticket.request.requester.profile?.fullName ??
          ticket.request.requester.email,
        faculty: ticket.request.requester.profile?.faculty?.name ?? null,
        department: ticket.request.requester.profile?.department?.name ?? null,
        unit: ticket.request.requester.profile?.unit?.name ?? null,
      },
      currentAssignee: ticket.request.currentAssignee
        ? {
            id: ticket.request.currentAssignee.id,
            fullName:
              ticket.request.currentAssignee.profile?.fullName ??
              ticket.request.currentAssignee.email,
          }
        : null,
      ticket: {
        id: ticket.id,
        ticketStatus: ticket.ticketStatus,
        category: ticket.category,
        subcategory: ticket.subcategory,
        affectedSystem: ticket.affectedSystem,
        assetId: ticket.assetId,
        locationText: ticket.locationText,
        incidentStartedAt: ticket.incidentStartedAt,
        resolutionSummary: ticket.resolutionSummary,
        resolvedAt: ticket.resolvedAt,
        closedAt: ticket.closedAt,
        reopenedCount: ticket.reopenedCount,
        assignedTo: ticket.assignedTo
          ? {
              id: ticket.assignedTo.id,
              fullName:
                ticket.assignedTo.profile?.fullName ?? ticket.assignedTo.email,
            }
          : null,
      },
      workflow: this.buildWorkflowSummary(ticket),
      sla: this.buildSlaSummary(ticket),
      statusHistory: ticket.request.statusHistory.map((history: any) => ({
        id: history.id,
        status: history.newStatus,
        previousStatus: history.oldStatus,
        date: history.changedAt,
        note: history.changeReason,
        changedBy:
          history.changedBy?.profile?.fullName ?? history.changedBy?.email ?? 'System',
      })),
      comments: ticket.request.comments
        .filter((comment: any) => canSeeInternal || !comment.isInternal)
        .map((comment: any) => ({
          id: comment.id,
          author: comment.user?.profile?.fullName ?? comment.user?.email ?? 'Unknown',
          authorRole:
            comment.user?.primaryRoles?.[0]?.role?.name?.toUpperCase() ?? 'UNKNOWN',
          content: comment.commentText,
          isInternal: comment.isInternal,
          createdAt: comment.createdAt,
        })),
      attachments: await Promise.all(
        ticket.request.fileLinks.map((link: any) =>
          this.filesService.buildAttachmentResponse(link.file),
        ),
      ),
      assignmentHistory: ticket.request.assignments.map((assignment: any) => ({
        id: assignment.id,
        assignedAt: assignment.assignedAt,
        unassignedAt: assignment.unassignedAt,
        isActive: assignment.isActive,
        note: assignment.assignmentNote,
        assignedTo: assignment.assignedTo
          ? assignment.assignedTo.profile?.fullName ?? assignment.assignedTo.email
          : null,
        assignedBy: assignment.assignedBy
          ? assignment.assignedBy.profile?.fullName ?? assignment.assignedBy.email
          : null,
      })),
      activity: this.buildActivitySummary(ticket),
    };
  }

  async getComments(userId: string, roles: string[], requestId: string) {
    const ticket = await this.getTicketRecordOrThrow(requestId);
    this.assertTicketVisibility(userId, roles, ticket);

    const canSeeInternal = this.canSeeInternal(roles);

    const comments = await this.prisma.requestComment.findMany({
      where: {
        requestId,
        ...(canSeeInternal ? {} : { isInternal: false }),
      },
      include: {
        user: {
          include: {
            profile: true,
            primaryRoles: { include: { role: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return comments.map((comment) => ({
      id: comment.id,
      commentText: comment.commentText,
      isInternal: comment.isInternal,
      parentCommentId: comment.parentCommentId,
      createdAt: comment.createdAt,
      author: {
        id: comment.user.id,
        fullName: comment.user.profile?.fullName ?? comment.user.email,
        role:
          comment.user.primaryRoles?.[0]?.role?.name?.toUpperCase() ?? 'UNKNOWN',
      },
    }));
  }

  async addComment(
    userId: string,
    roles: string[],
    requestId: string,
    dto: AddCommentDto,
  ) {
    return this.addCommentInternal(userId, roles, requestId, {
      ...dto,
      isInternal: false,
    });
  }

  async addInternalComment(
    userId: string,
    roles: string[],
    requestId: string,
    dto: AddCommentDto,
  ) {
    if (!this.canSeeInternal(roles)) {
      throw new ForbiddenException('Insufficient permissions.');
    }

    return this.addCommentInternal(userId, roles, requestId, {
      ...dto,
      isInternal: true,
    });
  }

  async getWorkflow(userId: string, roles: string[], requestId: string) {
    const ticket = await this.getTicketRecordOrThrow(requestId);
    this.assertTicketVisibility(userId, roles, ticket);
    return this.buildWorkflowSummary(ticket);
  }

  async getSla(userId: string, roles: string[], requestId: string) {
    const ticket = await this.getTicketRecordOrThrow(requestId);
    this.assertTicketVisibility(userId, roles, ticket);
    return this.buildSlaSummary(ticket);
  }

  async getActivity(userId: string, roles: string[], requestId: string) {
    const ticket = await this.getTicketRecordOrThrow(requestId);
    this.assertTicketVisibility(userId, roles, ticket);
    return this.buildActivitySummary(ticket);
  }

  async assign(
    userId: string,
    roles: string[],
    requestId: string,
    dto: AssignItTicketDto,
  ) {
    const ticket = await this.getTicketRecordOrThrow(requestId);

    if (
      roles.includes('IT_AGENT') &&
      !this.canManageTicket(roles) &&
      dto.assignedItUserId !== userId
    ) {
      throw new ForbiddenException('IT agents can only self-assign.');
    }

    if (!this.canManageTicket(roles) && !roles.includes('IT_AGENT')) {
      throw new ForbiddenException('Insufficient permissions.');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.requestAssignment.updateMany({
        where: { requestId, isActive: true },
        data: { isActive: false, unassignedAt: new Date() },
      });

      await tx.requestAssignment.create({
        data: {
          requestId,
          assignedToUserId: dto.assignedItUserId,
          assignedByUserId: userId,
          assignmentNote: dto.note ?? null,
        },
      });

      const newTicketStatus =
        ticket.ticketStatus === TicketStatus.IN_PROGRESS
          ? TicketStatus.IN_PROGRESS
          : TicketStatus.TRIAGED;

      await tx.itTicket.update({
        where: { id: ticket.id },
        data: {
          assignedItUserId: dto.assignedItUserId,
          ticketStatus: newTicketStatus,
        },
      });

      await tx.request.update({
        where: { id: requestId },
        data: {
          currentAssigneeUserId: dto.assignedItUserId,
          status: this.mapTicketStatusToRequestStatus(newTicketStatus),
        },
      });

      await tx.requestStatusHistory.create({
        data: {
          requestId,
          oldStatus: ticket.request.status,
          newStatus: this.mapTicketStatusToRequestStatus(newTicketStatus),
          changedByUserId: userId,
          changeReason: dto.note?.trim() || 'Ticket assigned.',
        },
      });

      await this.createApprovalAction(
        tx,
        requestId,
        userId,
        WorkflowActionType.ASSIGN,
        dto.note ?? 'Ticket assigned.',
      );

      await this.slaService.markFirstResponse(tx, requestId);

      return {
        requestId,
        ticketStatus: newTicketStatus,
        assignedItUserId: dto.assignedItUserId,
      };
    });

    await this.notifyUsers([dto.assignedItUserId, ticket.request.requesterUserId], {
      requestId,
      title: 'IT Ticket Assigned',
      message: `${ticket.request.requestNo} has been assigned.`,
      actionUrl: `/staff/tickets/${requestId}`,
    });

    this.mq.publish({
      event: RoutingKeys.WORKFLOW_ASSIGNED,
      occurredAt: new Date().toISOString(),
      requestId,
      requestType: 'IT_TICKET',
      stepCode: 'it_assignment',
      assigneeUserId: dto.assignedItUserId,
      triggeredByUserId: userId,
    });

    await this.touchTicketCaches(requestId);
    return result;
  }

  async reassign(
    userId: string,
    roles: string[],
    requestId: string,
    dto: AssignItTicketDto,
  ) {
    if (!this.canManageTicket(roles)) {
      throw new ForbiddenException('Only IT managers can reassign tickets.');
    }
    return this.assign(userId, roles, requestId, dto);
  }

  async startProgress(
    userId: string,
    roles: string[],
    requestId: string,
    dto: StartProgressDto,
  ) {
    const ticket = await this.getTicketRecordOrThrow(requestId);

    if (
      roles.includes('IT_AGENT') &&
      !ticket.assignedItUserId &&
      !this.canManageTicket(roles)
    ) {
      await this.assign(userId, roles, requestId, {
        assignedItUserId: userId,
        note: 'Self-assigned while starting progress.',
      });
    }

    const refreshed = await this.getTicketRecordOrThrow(requestId);
    this.assertTicketOperator(userId, roles, refreshed);

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.itTicket.update({
        where: { id: refreshed.id },
        data: { ticketStatus: TicketStatus.IN_PROGRESS },
      });

      await tx.request.update({
        where: { id: requestId },
        data: { status: RequestStatus.IN_REVIEW },
      });

      await tx.requestStatusHistory.create({
        data: {
          requestId,
          oldStatus: refreshed.request.status,
          newStatus: RequestStatus.IN_REVIEW,
          changedByUserId: userId,
          changeReason: dto.note?.trim() || 'Work started on the IT ticket.',
        },
      });

      await this.createApprovalAction(
        tx,
        requestId,
        userId,
        WorkflowActionType.COMPLETE,
        dto.note ?? 'Work started.',
      );

      await this.slaService.markFirstResponse(tx, requestId);

      return { requestId, ticketStatus: TicketStatus.IN_PROGRESS };
    });

    await this.touchTicketCaches(requestId);
    return result;
  }

  async requestUserInfo(
    userId: string,
    roles: string[],
    requestId: string,
    dto: RequestUserInfoDto,
  ) {
    const ticket = await this.getTicketRecordOrThrow(requestId);
    this.assertTicketOperator(userId, roles, ticket);

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.itTicket.update({
        where: { id: ticket.id },
        data: { ticketStatus: TicketStatus.WAITING_USER },
      });

      await tx.request.update({
        where: { id: requestId },
        data: { status: RequestStatus.REVISION_REQUESTED },
      });

      await tx.requestStatusHistory.create({
        data: {
          requestId,
          oldStatus: ticket.request.status,
          newStatus: RequestStatus.REVISION_REQUESTED,
          changedByUserId: userId,
          changeReason: 'Requested additional information from the user.',
        },
      });

      await tx.requestComment.create({
        data: {
          requestId,
          userId,
          commentText: dto.message,
          isInternal: false,
        },
      });

      if (dto.internalNote?.trim()) {
        await tx.requestComment.create({
          data: {
            requestId,
            userId,
            commentText: dto.internalNote,
            isInternal: true,
          },
        });
      }

      await this.createApprovalAction(
        tx,
        requestId,
        userId,
        WorkflowActionType.REQUEST_REVISION,
        dto.internalNote ?? dto.message,
      );

      await this.slaService.markFirstResponse(tx, requestId);

      return { requestId, ticketStatus: TicketStatus.WAITING_USER };
    });

    await this.notifyUsers([ticket.request.requesterUserId], {
      requestId,
      title: 'More Information Requested',
      message: `${ticket.request.requestNo} requires additional information from you.`,
      actionUrl: `/faculty/tickets/${requestId}`,
    });

    await this.touchTicketCaches(requestId);
    return result;
  }

  async triage(
    userId: string,
    roles: string[],
    requestId: string,
    dto: TriageItTicketDto,
  ) {
    if (!this.canManageTicket(roles)) {
      throw new ForbiddenException('Only IT managers can triage tickets.');
    }

    const ticket = await this.getTicketRecordOrThrow(requestId);
    const assignedItUserId = dto.assignedItUserId ?? ticket.assignedItUserId;
    const newTicketStatus =
      dto.newStatus ??
      (assignedItUserId ? TicketStatus.TRIAGED : ticket.ticketStatus);

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.itTicket.update({
        where: { id: ticket.id },
        data: {
          category: dto.category ?? ticket.category,
          subcategory:
            dto.subcategory !== undefined ? dto.subcategory : ticket.subcategory,
          assignedItUserId,
          ticketStatus: newTicketStatus,
        },
      });

      await tx.request.update({
        where: { id: requestId },
        data: {
          currentAssigneeUserId: assignedItUserId ?? null,
          status: this.mapTicketStatusToRequestStatus(newTicketStatus),
        },
      });

      if (
        assignedItUserId &&
        assignedItUserId !== ticket.assignedItUserId
      ) {
        await tx.requestAssignment.updateMany({
          where: { requestId, isActive: true },
          data: { isActive: false, unassignedAt: new Date() },
        });

        await tx.requestAssignment.create({
          data: {
            requestId,
            assignedToUserId: assignedItUserId,
            assignedByUserId: userId,
            assignmentNote: dto.note ?? 'Ticket triaged and assigned.',
          },
        });
      }

      await tx.requestStatusHistory.create({
        data: {
          requestId,
          oldStatus: ticket.request.status,
          newStatus: this.mapTicketStatusToRequestStatus(newTicketStatus),
          changedByUserId: userId,
          changeReason: dto.note?.trim() || 'Ticket triaged.',
        },
      });

      if (dto.note?.trim()) {
        await tx.requestComment.create({
          data: {
            requestId,
            userId,
            commentText: dto.note,
            isInternal: true,
          },
        });
      }

      await this.createApprovalAction(
        tx,
        requestId,
        userId,
        WorkflowActionType.ASSIGN,
        dto.note ?? 'Ticket triaged.',
      );

      if (assignedItUserId) {
        await this.slaService.markFirstResponse(tx, requestId);
      }

      return {
        requestId,
        ticketStatus: newTicketStatus,
        requestStatus: this.mapTicketStatusToRequestStatus(newTicketStatus),
      };
    });

    await this.touchTicketCaches(requestId);
    return result;
  }

  async resolve(
    userId: string,
    roles: string[],
    requestId: string,
    dto: ResolveItTicketDto,
  ) {
    const ticket = await this.getTicketRecordOrThrow(requestId);
    this.assertTicketOperator(userId, roles, ticket);

    if (!dto.resolutionSummary?.trim()) {
      throw new BadRequestException('Resolution summary is required.');
    }

    const resolvedAt = new Date();
    const resolutionSummary = dto.resolutionSummary.trim();

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.itTicket.update({
        where: { id: ticket.id },
        data: {
          ticketStatus: TicketStatus.RESOLVED,
          resolutionSummary,
          resolvedAt,
        },
      });

      await tx.request.update({
        where: { id: requestId },
        data: { status: RequestStatus.COMPLETED, completedAt: resolvedAt },
      });

      await tx.requestStatusHistory.create({
        data: {
          requestId,
          oldStatus: ticket.request.status,
          newStatus: RequestStatus.COMPLETED,
          changedByUserId: userId,
          changeReason: dto.note?.trim() || 'Ticket resolved.',
        },
      });

      await this.createApprovalAction(
        tx,
        requestId,
        userId,
        WorkflowActionType.COMPLETE,
        dto.note ?? resolutionSummary,
      );

      await this.slaService.markResolution(
        tx,
        requestId,
        RequestStatus.COMPLETED,
      );

      return { requestId, ticketStatus: TicketStatus.RESOLVED };
    });

    await this.notifyUsers([ticket.request.requesterUserId], {
      requestId,
      title: 'IT Ticket Resolved',
      message: `${ticket.request.requestNo} has been resolved and is awaiting confirmation.`,
      actionUrl: `/faculty/tickets/${requestId}`,
    });

    this.mq.publish({
      event: RoutingKeys.WORKFLOW_APPROVED,
      occurredAt: new Date().toISOString(),
      requestId,
      requestType: 'IT_TICKET',
      actorUserId: userId,
      comment: dto.resolutionSummary,
      newStatus: 'COMPLETED',
    });

    await this.touchTicketCaches(requestId);
    return result;
  }

  async close(
    userId: string,
    roles: string[],
    requestId: string,
    dto?: CloseItTicketDto,
  ) {
    const ticket = await this.getTicketRecordOrThrow(requestId);
    const isOwner = ticket.request.requesterUserId === userId;

    if (!this.canManageTicket(roles) && !isOwner) {
      throw new ForbiddenException('Only the requester or IT manager can close.');
    }

    if (ticket.ticketStatus !== TicketStatus.RESOLVED && !this.canManageTicket(roles)) {
      throw new BadRequestException('Only resolved tickets can be closed by the requester.');
    }

    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.itTicket.update({
        where: { id: ticket.id },
        data: { ticketStatus: TicketStatus.CLOSED, closedAt: now },
      });

      await tx.request.update({
        where: { id: requestId },
        data: { status: RequestStatus.CLOSED, closedAt: now },
      });

      await tx.requestStatusHistory.create({
        data: {
          requestId,
          oldStatus: ticket.request.status,
          newStatus: RequestStatus.CLOSED,
          changedByUserId: userId,
          changeReason: dto?.note?.trim() || 'Ticket closed.',
        },
      });

      await this.createApprovalAction(
        tx,
        requestId,
        userId,
        WorkflowActionType.COMPLETE,
        dto?.note ?? 'Ticket closed.',
      );

      await this.slaService.markResolution(tx, requestId, RequestStatus.CLOSED);

      return { requestId, ticketStatus: TicketStatus.CLOSED };
    });

    await this.notifyUsers(
      [ticket.request.requesterUserId, ticket.assignedItUserId],
      {
        requestId,
        title: 'IT Ticket Closed',
        message: `${ticket.request.requestNo} has been closed.`,
        actionUrl: `/faculty/tickets/${requestId}`,
      },
    );

    await this.touchTicketCaches(requestId);
    return result;
  }

  async reopen(
    userId: string,
    roles: string[],
    requestId: string,
    dto?: ReopenItTicketDto,
  ) {
    const ticket = await this.getTicketRecordOrThrow(requestId);
    const isOwner = ticket.request.requesterUserId === userId;

    if (!this.canManageTicket(roles) && !isOwner) {
      throw new ForbiddenException('Only the requester or IT manager can reopen.');
    }

    if (
      ticket.ticketStatus !== TicketStatus.RESOLVED &&
      ticket.ticketStatus !== TicketStatus.CLOSED
    ) {
      throw new BadRequestException('Only resolved or closed tickets can be reopened.');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.itTicket.update({
        where: { id: ticket.id },
        data: {
          ticketStatus: TicketStatus.REOPENED,
          closedAt: null,
          reopenedCount: { increment: 1 },
        },
      });

      await tx.request.update({
        where: { id: requestId },
        data: {
          status: RequestStatus.SUBMITTED,
          closedAt: null,
          completedAt: null,
        },
      });

      await tx.requestStatusHistory.create({
        data: {
          requestId,
          oldStatus: ticket.request.status,
          newStatus: RequestStatus.SUBMITTED,
          changedByUserId: userId,
          changeReason: dto?.note?.trim() || 'Ticket reopened.',
        },
      });

      await this.createApprovalAction(
        tx,
        requestId,
        userId,
        WorkflowActionType.ESCALATE,
        dto?.note ?? 'Ticket reopened.',
      );

      return { requestId, ticketStatus: TicketStatus.REOPENED };
    });

    await this.notifyUsers(
      [ticket.assignedItUserId, ticket.request.currentAssigneeUserId],
      {
        requestId,
        title: 'IT Ticket Reopened',
        message: `${ticket.request.requestNo} has been reopened.`,
        actionUrl: `/staff/tickets/${requestId}`,
      },
    );

    await this.touchTicketCaches(requestId);
    return result;
  }

  async reject(
    userId: string,
    roles: string[],
    requestId: string,
    dto?: RejectItTicketDto,
  ) {
    if (!this.canManageTicket(roles)) {
      throw new ForbiddenException('Only IT managers can reject tickets.');
    }

    const ticket = await this.getTicketRecordOrThrow(requestId);
    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.itTicket.update({
        where: { id: ticket.id },
        data: {
          ticketStatus: TicketStatus.CLOSED,
          closedAt: now,
        },
      });

      await tx.request.update({
        where: { id: requestId },
        data: {
          status: RequestStatus.REJECTED,
          closedAt: now,
        },
      });

      await tx.requestStatusHistory.create({
        data: {
          requestId,
          oldStatus: ticket.request.status,
          newStatus: RequestStatus.REJECTED,
          changedByUserId: userId,
          changeReason: dto?.reason?.trim() || 'Ticket rejected as invalid or out of scope.',
        },
      });

      await this.createApprovalAction(
        tx,
        requestId,
        userId,
        WorkflowActionType.REJECT,
        dto?.reason ?? 'Ticket rejected.',
      );

      return { requestId, requestStatus: RequestStatus.REJECTED };
    });

    await this.notifyUsers([ticket.request.requesterUserId], {
      requestId,
      title: 'IT Ticket Rejected',
      message: `${ticket.request.requestNo} was rejected. ${dto?.reason ?? ''}`.trim(),
      actionUrl: `/faculty/tickets/${requestId}`,
    });

    await this.touchTicketCaches(requestId);
    return result;
  }

  async escalate(
    userId: string,
    roles: string[],
    requestId: string,
    dto?: EscalateItTicketDto,
  ) {
    const ticket = await this.getTicketRecordOrThrow(requestId);
    this.assertTicketOperator(userId, roles, ticket);

    const managers = await this.prisma.user.findMany({
      where: {
        primaryRoles: {
          some: { role: { name: { in: ['IT_MANAGER', 'ADMIN'] } } },
        },
        status: 'ACTIVE',
      },
      select: { id: true },
      take: 25,
    });

    const result = await this.prisma.$transaction(async (tx) => {
      if (ticket.slaPolicyId) {
        await tx.slaEvent.create({
          data: {
            requestId,
            slaPolicyId: ticket.slaPolicyId,
            eventType: 'ESCALATION_TRIGGERED',
          },
        });
      }

      if (dto?.note?.trim()) {
        await tx.requestComment.create({
          data: {
            requestId,
            userId,
            commentText: dto.note,
            isInternal: true,
          },
        });
      }

      await this.createApprovalAction(
        tx,
        requestId,
        userId,
        WorkflowActionType.ESCALATE,
        dto?.note ?? 'Ticket escalated.',
      );

      return { requestId, escalated: true };
    });

    await this.notifyUsers(
      [...managers.map((manager) => manager.id), ticket.assignedItUserId],
      {
        requestId,
        title: 'IT Ticket Escalated',
        message: `${ticket.request.requestNo} has been escalated.`,
        actionUrl: `/staff/tickets/${requestId}`,
      },
    );

    await this.touchTicketCaches(requestId);
    return result;
  }

  async changePriority(
    userId: string,
    roles: string[],
    requestId: string,
    dto: ChangePriorityDto,
  ) {
    if (!this.canManageTicket(roles)) {
      throw new ForbiddenException('Only IT managers can change priority.');
    }

    const ticket = await this.getTicketRecordOrThrow(requestId);

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.request.update({
        where: { id: requestId },
        data: { priority: dto.priority },
      });

      await tx.requestStatusHistory.create({
        data: {
          requestId,
          oldStatus: ticket.request.status,
          newStatus: ticket.request.status,
          changedByUserId: userId,
          changeReason:
            dto.note?.trim() || `Priority changed from ${ticket.request.priority} to ${dto.priority}.`,
        },
      });

      const policy = await this.recalculateTicketPolicy(tx, requestId);

      if (policy) {
        await tx.slaEvent.create({
          data: {
            requestId,
            slaPolicyId: policy.id,
            eventType: 'POLICY_RECALCULATED',
          },
        });
      }

      return { requestId, priority: dto.priority };
    });

    await this.touchTicketCaches(requestId);
    return result;
  }

  async changeCategory(
    userId: string,
    roles: string[],
    requestId: string,
    dto: ChangeCategoryDto,
  ) {
    if (!this.canManageTicket(roles)) {
      throw new ForbiddenException('Only IT managers can change category.');
    }

    const ticket = await this.getTicketRecordOrThrow(requestId);

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.itTicket.update({
        where: { id: ticket.id },
        data: {
          category: dto.category,
          subcategory:
            dto.subcategory !== undefined ? dto.subcategory : ticket.subcategory,
        },
      });

      await tx.requestComment.create({
        data: {
          requestId,
          userId,
          commentText:
            dto.note?.trim() ||
            `Category changed to ${dto.category}${dto.subcategory ? ` / ${dto.subcategory}` : ''}.`,
          isInternal: true,
        },
      });

      return {
        requestId,
        category: dto.category,
        subcategory: dto.subcategory ?? ticket.subcategory,
      };
    });

    await this.touchTicketCaches(requestId);
    return result;
  }

  async findStaffMembers() {
    const users = await this.prisma.user.findMany({
      where: {
        primaryRoles: {
          some: {
            role: { name: { in: ['IT_AGENT', 'IT_MANAGER', 'ADMIN'] } },
          },
        },
        status: 'ACTIVE',
      },
      include: {
        profile: { select: { fullName: true, title: true } },
        primaryRoles: { include: { role: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });

    return users.map((user) => ({
      id: user.id,
      email: user.email,
      fullName: user.profile?.fullName ?? user.email,
      title: user.profile?.title ?? null,
      roles: user.primaryRoles.map((role) => role.role.name.toUpperCase()),
    }));
  }
}
