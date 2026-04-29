/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service';
import { RequestStatus, Prisma, AuditActionType } from '@prisma/client'; // 🔥 AuditActionType Eklendi
import * as bcrypt from 'bcrypt';
import { SlaService } from '../workflow/sla.service';
import { buildWorkflowSummary } from '../workflow/workflow-summary';
import { CacheService } from '../infrastructure/cache/cache.service';
import { CacheKeys, CacheTtls } from '../infrastructure/cache/cache-keys';

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

@Injectable()
export class StaffService {
  constructor(
    private prisma: PrismaService,
    private slaService: SlaService,
    private cacheService: CacheService,
  ) {}

  // 1. DASHBOARD METRICS
  async getDashboardMetrics() {
    const activeStatuses = [
      RequestStatus.SUBMITTED,
      RequestStatus.IN_REVIEW,
      RequestStatus.WAITING_APPROVAL,
      RequestStatus.REVISION_REQUESTED,
    ];

    const totalOpen = await this.prisma.request.count({
      where: { status: { in: activeStatuses } },
    });

    const unassigned = await this.prisma.request.count({
      where: {
        currentAssigneeUserId: null,
        status: { in: [RequestStatus.SUBMITTED] },
      },
    });

    return {
      totalOpenRequests: totalOpen,
      unassignedRequests: unassigned,
    };
  }

  async getReports(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        primaryRoles: { include: { role: true } },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const isManager = user.primaryRoles.some((item) =>
      ['IT_MANAGER', 'ADMIN'].includes(item.role.name.toUpperCase()),
    );

    const ticketWhere: Prisma.ItTicketWhereInput = isManager
      ? {}
      : { assignedItUserId: userId };

    const [tickets, openCount, resolvedCount, slaBreaches] = await Promise.all([
      this.prisma.itTicket.findMany({
        where: ticketWhere,
        include: {
          request: {
            select: {
              id: true,
              priority: true,
              createdAt: true,
              dueAt: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.itTicket.count({
        where: {
          ...ticketWhere,
          ticketStatus: {
            in: ['OPEN', 'TRIAGED', 'IN_PROGRESS', 'WAITING_USER', 'REOPENED'],
          },
        },
      }),
      this.prisma.itTicket.count({
        where: {
          ...ticketWhere,
          ticketStatus: { in: ['RESOLVED', 'CLOSED'] },
        },
      }),
      this.prisma.slaEvent.count({
        where: {
          request: isManager
            ? undefined
            : {
                itTicket: {
                  assignedItUserId: userId,
                },
              },
          eventType: { in: ['FIRST_RESPONSE_BREACHED', 'RESOLUTION_BREACHED'] },
        },
      }),
    ]);

    const now = new Date();
    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const weeklyThroughput = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(now);
      date.setDate(now.getDate() - (6 - index));
      date.setHours(0, 0, 0, 0);
      const next = new Date(date);
      next.setDate(date.getDate() + 1);

      const opened = tickets.filter(
        (ticket) => ticket.createdAt >= date && ticket.createdAt < next,
      ).length;
      const resolved = tickets.filter((ticket) => {
        const completedAt = ticket.closedAt ?? ticket.resolvedAt;
        return completedAt && completedAt >= date && completedAt < next;
      }).length;

      return {
        day: dayLabels[date.getDay()],
        opened,
        resolved,
      };
    });

    const resolutionTrend = Array.from({ length: 4 }, (_, index) => {
      const end = new Date(now);
      end.setDate(now.getDate() - index * 7);
      end.setHours(23, 59, 59, 999);
      const start = new Date(end);
      start.setDate(end.getDate() - 6);
      start.setHours(0, 0, 0, 0);

      const completedThisWeek = tickets.filter((ticket) => {
        const completedAt = ticket.closedAt ?? ticket.resolvedAt;
        return completedAt && completedAt >= start && completedAt <= end;
      });

      const avgHours =
        completedThisWeek.length > 0
          ? Number(
              (
                completedThisWeek.reduce((sum, ticket) => {
                  const completedAt = ticket.closedAt ?? ticket.resolvedAt;
                  const startedAt = ticket.request.createdAt;
                  return (
                    sum +
                    ((completedAt?.getTime() ?? startedAt.getTime()) -
                      startedAt.getTime()) /
                      (1000 * 60 * 60)
                  );
                }, 0) / completedThisWeek.length
              ).toFixed(1),
            )
          : 0;

      return {
        week: `W${4 - index}`,
        avgHours,
      };
    }).reverse();

    const typeBreakdownMap = new Map<string, number>();
    const priorityBreakdownMap = new Map<string, number>();

    for (const ticket of tickets) {
      const category = ticket.category || 'Uncategorized';
      typeBreakdownMap.set(category, (typeBreakdownMap.get(category) ?? 0) + 1);

      const priority = ticket.request.priority || 'MEDIUM';
      priorityBreakdownMap.set(
        priority,
        (priorityBreakdownMap.get(priority) ?? 0) + 1,
      );
    }

    const completedTickets = tickets.filter((ticket) =>
      ['RESOLVED', 'CLOSED'].includes(ticket.ticketStatus),
    );

    const avgResolutionHours =
      completedTickets.length > 0
        ? Number(
            (
              completedTickets.reduce((sum, ticket) => {
                const completedAt = ticket.closedAt ?? ticket.resolvedAt;
                return (
                  sum +
                  ((completedAt?.getTime() ?? ticket.createdAt.getTime()) -
                    ticket.createdAt.getTime()) /
                    (1000 * 60 * 60)
                );
              }, 0) / completedTickets.length
            ).toFixed(1),
          )
        : 0;

    const overdueCount = tickets.filter(
      (ticket) =>
        ticket.request.dueAt &&
        ticket.request.dueAt < now &&
        !['RESOLVED', 'CLOSED'].includes(ticket.ticketStatus),
    ).length;

    const resolvedWithinSla = Math.max(completedTickets.length - slaBreaches, 0);
    const slaCompliance =
      completedTickets.length > 0
        ? Math.round((resolvedWithinSla / completedTickets.length) * 100)
        : 100;

    return {
      scope: isManager ? 'TEAM' : 'ASSIGNED_TO_ME',
      totalTickets: tickets.length,
      openTickets: openCount,
      resolvedTickets: resolvedCount,
      avgResolutionHours,
      overdueCount,
      slaCompliance,
      slaBreaches,
      weeklyThroughput,
      resolutionTrend,
      typeBreakdown: Array.from(typeBreakdownMap.entries())
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count),
      priorityBreakdown: Array.from(priorityBreakdownMap.entries())
        .map(([priority, count]) => ({ priority, count }))
        .sort((a, b) => b.count - a.count),
    };
  }

  // 2. WORK POOL (GET ALL REQUESTS)
  async getAllRequests(statusFilter?: string, category?: string) {
    const whereClause: Prisma.RequestWhereInput = {};

    if (statusFilter === 'unassigned') {
      whereClause.currentAssigneeUserId = null;
      whereClause.status = {
        in: [RequestStatus.SUBMITTED, RequestStatus.IN_REVIEW],
      };
    } else if (statusFilter === 'active') {
      whereClause.status = {
        in: [
          RequestStatus.SUBMITTED,
          RequestStatus.IN_REVIEW,
          RequestStatus.WAITING_APPROVAL,
          RequestStatus.REVISION_REQUESTED,
        ],
      };
    } else if (statusFilter === 'closed') {
      whereClause.status = {
        in: [
          RequestStatus.APPROVED,
          RequestStatus.REJECTED,
          RequestStatus.CANCELLED,
          RequestStatus.COMPLETED,
          RequestStatus.CLOSED,
          RequestStatus.EXPIRED,
        ],
      };
    }

    if (category) {
      whereClause.requestType = { category: category };
    }

    const requests = await this.prisma.request.findMany({
      where: whereClause,
      include: {
        requester: { include: { profile: true } },
        requestType: true,
        currentAssignee: { include: { profile: true } },
        assignments: {
          where: { isActive: true },
          include: { assignedTo: { include: { profile: true } } },
          orderBy: { assignedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return requests.map((req: any) => {
      const activeAssignee =
        req.currentAssignee?.profile?.fullName ||
        req.currentAssignee?.email ||
        req.assignments?.[0]?.assignedTo?.profile?.fullName ||
        req.assignments?.[0]?.assignedTo?.email ||
        null;

      return {
        id: req.id,
        requestNo: req.requestNo,
        title: req.title,
        status: req.status,
        priority: req.priority,
        typeName: req.requestType?.name || 'General',
        category: req.requestType?.category,
        requesterName: req.requester?.profile?.fullName || req.requester?.email,
        assignedTo: activeAssignee,
        commentCount: req._count?.comments ?? 0,
        createdAt: req.createdAt,
      };
    });
  }

  // 3. REQUEST DETAILS
  async getRequestDetail(id: string) {
    const version = await this.cacheService.getVersion(
      CacheKeys.version(`request:detail:${id}`),
    );
    const cacheKey = `staff:request:detail:${id}:v${version}:v2`;
    return this.cacheService.getOrSet(cacheKey, CacheTtls.long, async () => {
    const request = await this.prisma.request.findUnique({
      where: { id },
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
            primaryRoles: { select: { role: { select: { name: true } } }, take: 1 },
          },
        },
        requestType: true,
        currentAssignee: {
          select: {
            id: true,
            email: true,
            profile: { select: { fullName: true, title: true } },
            primaryRoles: { select: { role: { select: { name: true } } }, take: 1 },
          },
        },
        fileLinks: {
          select: {
            file: {
              select: {
                id: true,
                originalFileName: true,
                fileSizeBytes: true,
                mimeType: true,
                bucketName: true,
                storagePath: true,
              },
            },
          },
        },
        statusHistory: { orderBy: { changedAt: 'desc' } },
        comments: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            commentText: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                email: true,
                profile: { select: { fullName: true } },
                primaryRoles: { select: { role: { select: { name: true } } }, take: 1 },
              },
            },
          },
        },
        assignments: {
          select: {
            id: true,
            assignedAt: true,
            unassignedAt: true,
            isActive: true,
            assignmentNote: true,
            assignedTo: {
              select: {
                id: true,
                email: true,
                profile: { select: { fullName: true } },
              },
            },
            assignedBy: {
              select: {
                id: true,
                email: true,
                profile: { select: { fullName: true } },
              },
            },
          },
          orderBy: { assignedAt: 'desc' },
        },
        approvalActions: {
          select: {
            id: true,
            actionType: true,
            decisionNote: true,
            createdAt: true,
            actionBy: {
              select: {
                id: true,
                email: true,
                profile: { select: { fullName: true } },
              },
            },
            workflowInstanceStep: {
              select: { workflowStep: { select: { id: true, stepKey: true, stepName: true } } },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        workflowInstance: {
          select: {
            id: true,
            status: true,
            currentStepId: true,
            currentStep: { select: { id: true, stepName: true, stepKey: true } },
            workflowDefinition: {
              select: {
                name: true,
                steps: {
                  select: {
                    id: true,
                    stepKey: true,
                    stepName: true,
                    stepType: true,
                    stepOrder: true,
                    slaHours: true,
                    configJson: true,
                    assignedRole: { select: { name: true } },
                    assignedUnit: { select: { id: true, name: true } },
                    assignedUser: {
                      select: {
                        id: true,
                        email: true,
                        profile: { select: { fullName: true } },
                        primaryRoles: { select: { role: { select: { name: true } } }, take: 1 },
                      },
                    },
                  },
                  orderBy: { stepOrder: 'asc' },
                },
              },
            },
            instanceSteps: {
              select: {
                id: true,
                workflowStepId: true,
                status: true,
                actionTaken: true,
                actionNote: true,
                isOverdue: true,
                startedAt: true,
                completedAt: true,
                dueAt: true,
                assignedTo: {
                  select: {
                    id: true,
                    email: true,
                    profile: { select: { fullName: true } },
                    primaryRoles: { select: { role: { select: { name: true } } }, take: 1 },
                  },
                },
                actionBy: {
                  select: {
                    id: true,
                    email: true,
                    profile: { select: { fullName: true } },
                    primaryRoles: { select: { role: { select: { name: true } } }, take: 1 },
                  },
                },
              },
              orderBy: { createdAt: 'asc' },
            },
          },
        },
        documentRequest: true,
        roomReservationRequest: {
          include: {
            resource: {
              select: {
                id: true,
                name: true,
                resourceType: true,
                locationText: true,
                capacity: true,
              },
            },
          },
        },
        appointmentRequest: true,
        procurementRequest: true,
        accessRequest: true,
        eventRequest: true,
        equipmentRequest: {
          include: {
            labResource: {
              select: {
                id: true,
                name: true,
                resourceType: true,
                locationText: true,
              },
            },
          },
        },
        itTicket: {
          include: {
            assignedTo: {
              include: { profile: { select: { fullName: true } } },
            },
          },
        },
        internshipRequest: true,
      },
    });

    if (!request) return null;

    const auditHistory = await this.prisma.auditLog.findMany({
      where: { entityType: 'Request', entityId: id },
      select: {
        id: true,
        actionType: true,
        entityType: true,
        entityId: true,
        createdAt: true,
        user: { select: { id: true, email: true, profile: { select: { fullName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return {
      ...request,
      requester: request.requester
        ? {
            ...request.requester,
            fullName:
              request.requester.profile?.fullName || request.requester.email,
            role:
              request.requester.primaryRoles?.[0]?.role?.name || 'STAFF',
            faculty: request.requester.profile?.faculty?.name || null,
            department:
              request.requester.profile?.department?.name ||
              request.requester.profile?.unit?.name ||
              null,
            studentNumber: request.requester.profile?.studentNumber || null,
            staffNumber: request.requester.profile?.staffNumber || null,
            title: request.requester.profile?.title || null,
          }
        : null,
      workflow: buildWorkflowSummary(request.workflowInstance, request.status),
      formData: {
        ...(request.dynamicData as Record<string, unknown> | null),
        ...(request.documentRequest
          ? {
              documentType: request.documentRequest.documentType,
              language: request.documentRequest.language,
              copiesCount: request.documentRequest.copiesCount,
              deliveryMethod: request.documentRequest.deliveryMethod,
              deliveryAddress: request.documentRequest.deliveryAddress,
            }
          : {}),
        ...(request.roomReservationRequest
          ? {
              resourceId: request.roomReservationRequest.resourceId,
              resourceName: request.roomReservationRequest.resource?.name ?? null,
              eventName: request.roomReservationRequest.eventName,
              reservationPurpose:
                request.roomReservationRequest.reservationPurpose,
              attendeeCount: request.roomReservationRequest.attendeeCount,
              startAt: request.roomReservationRequest.startAt,
              endAt: request.roomReservationRequest.endAt,
              requiresSecurityApproval:
                request.roomReservationRequest.requiresSecurityApproval,
              requiresTechnicalSupport:
                request.roomReservationRequest.requiresTechnicalSupport,
              setupNotes: request.roomReservationRequest.setupNotes,
            }
          : {}),
        ...(request.appointmentRequest
          ? {
              targetUserId: request.appointmentRequest.targetUserId,
              appointmentType: request.appointmentRequest.appointmentType,
              topic: request.appointmentRequest.topic,
              details: request.appointmentRequest.details,
              preferredStartAt: request.appointmentRequest.preferredStartAt,
              preferredEndAt: request.appointmentRequest.preferredEndAt,
            }
          : {}),
        ...(request.procurementRequest
          ? {
              itemName: request.procurementRequest.itemName,
              itemCategory: request.procurementRequest.itemCategory,
              quantity: request.procurementRequest.quantity,
              unitPriceEstimate: request.procurementRequest.unitPriceEstimate,
              totalEstimate: request.procurementRequest.totalEstimate,
              vendorPreference: request.procurementRequest.vendorPreference,
              justification: request.procurementRequest.justification,
              budgetCode: request.procurementRequest.budgetCode,
            }
          : {}),
        ...(request.accessRequest
          ? {
              accessType: request.accessRequest.accessType,
              targetResource: request.accessRequest.targetResource,
              requestedRoleOrPermission:
                request.accessRequest.requestedRoleOrPermission,
              justification: request.accessRequest.justification,
              startAt: request.accessRequest.startAt,
              endAt: request.accessRequest.endAt,
            }
          : {}),
        ...(request.eventRequest
          ? {
              eventName: request.eventRequest.eventName,
              eventType: request.eventRequest.eventType,
              description: request.eventRequest.description,
              expectedAttendance: request.eventRequest.expectedAttendance,
              locationPreference: request.eventRequest.locationPreference,
              startAt: request.eventRequest.startAt,
              endAt: request.eventRequest.endAt,
              needsBudget: request.eventRequest.needsBudget,
              estimatedBudget: request.eventRequest.estimatedBudget,
              needsPosterApproval: request.eventRequest.needsPosterApproval,
              needsSecuritySupport: request.eventRequest.needsSecuritySupport,
              needsTechnicalSupport: request.eventRequest.needsTechnicalSupport,
            }
          : {}),
        ...(request.equipmentRequest
          ? {
              labResourceId: request.equipmentRequest.labResourceId,
              labResourceName:
                request.equipmentRequest.labResource?.name ?? null,
              equipmentName: request.equipmentRequest.equipmentName,
              equipmentCategory: request.equipmentRequest.equipmentCategory,
              quantity: request.equipmentRequest.quantity,
              purpose: request.equipmentRequest.purpose,
              neededFrom: request.equipmentRequest.neededFrom,
              neededUntil: request.equipmentRequest.neededUntil,
              urgencyReason: request.equipmentRequest.urgencyReason,
            }
          : {}),
        ...(request.internshipRequest
          ? {
              companyName: request.internshipRequest.companyName,
              companySector: request.internshipRequest.companySector,
              companyContactName:
                request.internshipRequest.companyContactName,
              companyContactEmail:
                request.internshipRequest.companyContactEmail,
              internshipType: request.internshipRequest.internshipType,
              workMode: request.internshipRequest.workMode,
              startDate: request.internshipRequest.startDate,
              endDate: request.internshipRequest.endDate,
              durationDays: request.internshipRequest.durationDays,
              insuranceRequired: request.internshipRequest.insuranceRequired,
            }
          : {}),
        ...(request.itTicket
          ? {
              category: request.itTicket.category,
              subcategory: request.itTicket.subcategory,
              affectedSystem: request.itTicket.affectedSystem,
              assetId: request.itTicket.assetId,
              locationText: request.itTicket.locationText,
              incidentStartedAt: request.itTicket.incidentStartedAt,
              ticketStatus: request.itTicket.ticketStatus,
              resolvedAt: request.itTicket.resolvedAt,
              reopenedCount: request.itTicket.reopenedCount,
              assignedTo: request.itTicket.assignedTo
                ? {
                    id: request.itTicket.assignedTo.id,
                    fullName:
                      request.itTicket.assignedTo.profile?.fullName ||
                      request.itTicket.assignedTo.email,
                    email: request.itTicket.assignedTo.email,
                  }
                : null,
              resolutionSummary: request.itTicket.resolutionSummary,
            }
          : {}),
      },
      assignments: request.assignments.map((assignment) => ({
        id: assignment.id,
        assignedAt: assignment.assignedAt,
        unassignedAt: assignment.unassignedAt,
        isActive: assignment.isActive,
        note: assignment.assignmentNote,
        assignedTo: assignment.assignedTo
          ? {
              id: assignment.assignedTo.id,
              fullName:
                assignment.assignedTo.profile?.fullName ||
                assignment.assignedTo.email,
              email: assignment.assignedTo.email,
            }
          : null,
        assignedBy: assignment.assignedBy
          ? {
              id: assignment.assignedBy.id,
              fullName:
                assignment.assignedBy.profile?.fullName ||
                assignment.assignedBy.email,
              email: assignment.assignedBy.email,
            }
          : null,
      })),
      timeline: request.statusHistory.map((history) => ({
        id: history.id,
        status: history.newStatus,
        date: history.changedAt,
        note: history.changeReason,
      })),
      statusHistory: request.statusHistory.map((history) => ({
        id: history.id,
        status: history.newStatus,
        date: history.changedAt,
        note: history.changeReason,
      })),
      auditHistory: auditHistory.map((audit) => ({
        id: audit.id,
        actionType: audit.actionType,
        status: audit.actionType,
        entityType: audit.entityType,
        entityId: audit.entityId,
        createdAt: audit.createdAt,
        date: audit.createdAt,
        actor: audit.user
          ? {
              id: audit.user.id,
              fullName: audit.user.profile?.fullName || audit.user.email,
              email: audit.user.email,
            }
          : null,
        note: `${audit.actionType.replace(/_/g, ' ')} on ${audit.entityType}`,
      })),
      approvalHistory: request.approvalActions.map((action) => ({
        id: action.id,
        actionType: action.actionType,
        decisionNote: action.decisionNote,
        createdAt: action.createdAt,
        actor: {
          id: action.actionBy.id,
          fullName: action.actionBy.profile?.fullName || action.actionBy.email,
          email: action.actionBy.email,
        },
        workflowStep: action.workflowInstanceStep?.workflowStep
          ? {
              id: action.workflowInstanceStep.workflowStep.id,
              key: action.workflowInstanceStep.workflowStep.stepKey,
              name: action.workflowInstanceStep.workflowStep.stepName,
            }
          : null,
      })),
    };
    }); // end cacheService.getOrSet
  }

  // 4. GET FACULTY MEMBERS
  async getFacultyMembers() {
    return this.prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        primaryRoles: {
          some: { role: { name: { in: ['FACULTY', 'STAFF', 'ADMIN'] } } },
        },
      },
      select: {
        id: true,
        email: true,
        profile: {
          select: {
            fullName: true,
            title: true,
            department: { select: { name: true } },
          },
        },
      },
      orderBy: { profile: { firstName: 'asc' } },
    });
  }

  // 🔥 5. ASSIGN REQUEST & UPDATE STATUS (AUDIT LOG ADDED) 🔥
  async assignRequest(
    requestId: string,
    assigneeUserId: string,
    staffId: string, // This is the ID of the staff member making the assignment
  ) {
    const request = await this.prisma.request.findUnique({
      where: { id: requestId },
      include: {
        currentAssignee: { include: { profile: true } },
        requester: { include: { profile: true } },
        workflowInstance: { select: { status: true } },
      },
    });
    if (!request) throw new NotFoundException('Request not found.');

    const terminalStatuses: RequestStatus[] = [
      RequestStatus.APPROVED,
      RequestStatus.REJECTED,
      RequestStatus.CANCELLED,
      RequestStatus.CLOSED,
      RequestStatus.COMPLETED,
      RequestStatus.EXPIRED,
    ];

    if (
      terminalStatuses.includes(request.status) ||
      request.workflowInstance?.status === 'COMPLETED'
    ) {
      throw new BadRequestException(
        'This request is already completed and cannot be reassigned.',
      );
    }

    const assignee = await this.prisma.user.findUnique({
      where: { id: assigneeUserId },
      include: { profile: true },
    });
    if (!assignee || assignee.status !== 'ACTIVE') {
      throw new BadRequestException('Assignee is invalid or inactive.');
    }

    const updatedRequest = await this.prisma.$transaction(async (tx) => {
      await tx.requestAssignment.updateMany({
        where: { requestId, isActive: true },
        data: { isActive: false, unassignedAt: new Date() },
      });

      await tx.requestAssignment.create({
        data: {
          requestId,
          assignedToUserId: assigneeUserId,
          assignedByUserId: staffId,
          assignmentNote: 'Assigned manually from staff request detail.',
        },
      });

      await tx.requestWatcher.createMany({
        data: [
          { requestId, userId: request.requesterUserId },
          { requestId, userId: assigneeUserId },
          { requestId, userId: staffId },
        ],
        skipDuplicates: true,
      });

      const activeWorkflowStep = await tx.workflowInstanceStep.findFirst({
        where: {
          workflowInstance: { requestId },
          status: 'PENDING',
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true, metadataJson: true },
      });

      if (activeWorkflowStep) {
        await tx.workflowInstanceStep.update({
          where: { id: activeWorkflowStep.id },
          data: {
            assignedToUserId: assigneeUserId,
            metadataJson: {
              ...(activeWorkflowStep.metadataJson as Record<string, unknown> | null),
              manuallyAssignedByUserId: staffId,
              manuallyAssignedAt: new Date().toISOString(),
            },
          },
        });
      }

      const nextStatus =
        request.status === RequestStatus.SUBMITTED
          ? RequestStatus.IN_REVIEW
          : request.status;

      const updated = await tx.request.update({
        where: { id: requestId },
        data: {
          currentAssigneeUserId: assigneeUserId,
          status: nextStatus,
        },
        include: {
          currentAssignee: { include: { profile: true } },
          requestType: true,
          requester: { include: { profile: true } },
          fileLinks: true,
          comments: {
            include: {
              user: { include: { profile: true } },
            },
          },
        },
      });

      if (nextStatus !== request.status) {
        await tx.requestStatusHistory.create({
          data: {
            requestId,
            oldStatus: request.status,
            newStatus: nextStatus,
            changedByUserId: staffId,
            changeReason: `Request assigned to ${assignee.profile?.fullName || assignee.email} and moved to In Review.`,
          },
        });
      }

      await tx.requestComment.create({
        data: {
          requestId,
          userId: staffId,
          commentText: `Request assigned to ${assignee.profile?.fullName || assignee.email}.`,
          isInternal: true,
        },
      });

      await tx.notification.create({
        data: {
          userId: assigneeUserId,
          requestId,
          type: 'IN_APP',
          title: 'Request Assigned',
          message: `${request.requestNo} has been assigned to you.`,
          actionUrl: '/staff/inbox',
        },
      });

      await this.slaService.markFirstResponse(tx, requestId);

      await tx.auditLog.create({
        data: {
          userId: staffId,
          actionType: AuditActionType.ASSIGN,
          entityType: 'Request',
          entityId: requestId,
        },
      });

      return updated;
    });

    return updatedRequest;
  }

  // 🔥 NOTIFICATION MANAGEMENT (STAFF) 🔥
  async getNotifications(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId: userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markNotificationAsRead(userId: string, notificationId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, userId: userId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllNotificationsAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId: userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async deleteNotifications(userId: string, ids: string[]) {
    await this.prisma.notification.deleteMany({
      where: { userId: userId, id: { in: ids } },
    });
    return { message: 'Notifications deleted successfully.' };
  }

  // 🔥 SETTINGS AND SECURITY MANAGEMENT 🔥

  // 1. GET NOTIFICATION PREFERENCES
  async getPreferences(userId: string) {
    let prefs = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });

    if (!prefs) {
      prefs = await this.prisma.notificationPreference.create({
        data: { userId },
      });
    }
    return prefs;
  }

  // 2. UPDATE NOTIFICATION PREFERENCES
  async updatePreferences(userId: string, data: any) {
    return this.prisma.notificationPreference.update({
      where: { userId },
      data,
    });
  }

  // 🔥 3. CHANGE PASSWORD (AUDIT LOG ADDED) 🔥
  async changePassword(userId: string, body: any) {
    const { currentPassword, newPassword } = body;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );

    if (!isPasswordValid) {
      throw new BadRequestException('Current password is incorrect!');
    }

    if (newPassword.length < 6) {
      throw new BadRequestException(
        'New password must be at least 6 characters long.',
      );
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword },
    });

    // 🔥 AUDIT LOG: PASSWORD UPDATED 🔥
    await this.prisma.auditLog.create({
      data: {
        userId: userId,
        actionType: AuditActionType.UPDATE,
        entityType: 'UserPassword',
        entityId: userId,
      },
    });

    return { message: 'Password successfully updated.' };
  }

  async reviseRequest(
    userId: string,
    requestId: string,
    body: { title?: string; description?: string; dynamicData?: any },
  ) {
    const existing = await this.prisma.request.findFirst({
      where: { id: requestId, requesterUserId: userId },
      include: { workflowInstance: true },
    });

    if (!existing) throw new NotFoundException('Request not found or access denied.');
    if (existing.status !== RequestStatus.REVISION_REQUESTED) {
      throw new BadRequestException('Only revision-requested requests can be revised.');
    }

    await this.prisma.$transaction(async (tx) => {
      const updateData: Prisma.RequestUpdateInput = {
        title: body.title ?? existing.title,
        description: body.description !== undefined ? body.description : existing.description,
        status: RequestStatus.IN_REVIEW,
      };
      if (body.dynamicData !== undefined) {
        updateData.dynamicData = body.dynamicData as Prisma.InputJsonValue;
      }

      await tx.request.update({ where: { id: requestId }, data: updateData });

      await tx.requestStatusHistory.create({
        data: {
          requestId,
          oldStatus: RequestStatus.REVISION_REQUESTED,
          newStatus: RequestStatus.IN_REVIEW,
          changedByUserId: userId,
          changeReason: 'Revised and resubmitted by requester.',
        },
      });

      const revisionAction = await tx.approvalAction.findFirst({
        where: { requestId, actionType: 'REQUEST_REVISION' },
        include: { workflowInstanceStep: true },
        orderBy: { createdAt: 'desc' },
      });

      if (revisionAction?.actionByUserId) {
        await tx.request.update({
          where: { id: requestId },
          data: { currentAssigneeUserId: revisionAction.actionByUserId },
        });

        const prevAssignment = await tx.requestAssignment.findFirst({
          where: { requestId, assignedToUserId: revisionAction.actionByUserId },
          orderBy: { assignedAt: 'desc' },
        });

        if (prevAssignment) {
          await tx.requestAssignment.update({
            where: { id: prevAssignment.id },
            data: { isActive: true, unassignedAt: null },
          });
        } else {
          await tx.requestAssignment.create({
            data: {
              requestId,
              assignedToUserId: revisionAction.actionByUserId,
              assignedByUserId: userId,
              assignmentNote: 'Resubmitted after revision.',
            },
          });
        }
      }

      const revisionStep = revisionAction?.workflowInstanceStep;
      const revisionActorUserId = revisionAction?.actionByUserId ?? null;
      if (existing.workflowInstanceId && revisionStep?.workflowStepId && revisionActorUserId) {
        await tx.workflowInstance.update({
          where: { id: existing.workflowInstanceId },
          data: {
            status: 'ACTIVE',
            endedAt: null,
            currentStepId: revisionStep.workflowStepId,
          },
        });

        const pendingStep = await tx.workflowInstanceStep.findFirst({
          where: {
            workflowInstanceId: existing.workflowInstanceId,
            workflowStepId: revisionStep.workflowStepId,
            status: 'PENDING',
          },
          orderBy: { createdAt: 'desc' },
        });

        if (pendingStep) {
          await tx.workflowInstanceStep.update({
            where: { id: pendingStep.id },
            data: { assignedToUserId: revisionActorUserId },
          });
        } else {
          await tx.workflowInstanceStep.create({
            data: {
              workflowInstanceId: existing.workflowInstanceId,
              workflowStepId: revisionStep.workflowStepId,
              status: 'PENDING',
              startedAt: new Date(),
              assignedToUserId: revisionActorUserId,
            },
          });
        }
      }
    });

    await this.cacheService.bumpVersion(CacheKeys.version(`request:detail:${requestId}`));

    return { success: true, requestId };
  }
}
