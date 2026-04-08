/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service';
import { WorkflowEngineService } from '../workflow/workflow-engine.service';
import { PriorityLevel, RequestStatus, TicketStatus } from '@prisma/client';
import { CreateItTicketDto } from './dto/create-it-ticket.dto';
import { TriageItTicketDto } from './dto/triage-it-ticket.dto';
import { ResolveItTicketDto } from './dto/resolve-it-ticket.dto';

const IT_REQUEST_TYPE_KEY = 'IT_SUPPORT';

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

@Injectable()
export class TicketsService {
  constructor(
    private prisma: PrismaService,
    private workflowEngine: WorkflowEngineService,
  ) {}

  // ── HELPERS ────────────────────────────────────────────────────────────────

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
    // Best match: requestType + priority
    let policy = await this.prisma.slaPolicy.findFirst({
      where: { requestTypeId, priority, isActive: true },
    });
    if (!policy) {
      // Fallback: priority only
      policy = await this.prisma.slaPolicy.findFirst({
        where: { requestTypeId: null, priority, isActive: true },
      });
    }
    if (!policy) {
      // Fallback: requestType only
      policy = await this.prisma.slaPolicy.findFirst({
        where: { requestTypeId, priority: null, isActive: true },
      });
    }
    return policy;
  }

  private toListItem(r: any) {
    const req = r.request as any;
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
      locationText: r.locationText,
      slaPolicyId: r.slaPolicyId,
      createdAt: r.createdAt,
    };
  }

  // ── CREATE ─────────────────────────────────────────────────────────────────

  async create(userId: string, dto: CreateItTicketDto) {
    const reqType = await this.getOrCreateRequestType();

    let requestNo = makeRequestNo();
    while (await this.prisma.request.findUnique({ where: { requestNo } })) {
      requestNo = makeRequestNo();
    }

    const priority = dto.priority ?? PriorityLevel.MEDIUM;

    return this.prisma.$transaction(async (tx) => {
      let initialStatus = RequestStatus.SUBMITTED;

      const req = await tx.request.create({
        data: {
          requestNo,
          requestTypeId: reqType.id,
          requesterUserId: userId,
          title: dto.title,
          description: dto.description ?? null,
          priority,
          status: initialStatus,
          submittedAt: new Date(),
          facultyId: dto.facultyId ?? null,
          departmentId: dto.departmentId ?? null,
          unitId: dto.unitId ?? null,
        },
      });

      await tx.requestStatusHistory.create({
        data: {
          requestId: req.id,
          oldStatus: null,
          newStatus: initialStatus,
          changedByUserId: userId,
          changeReason: 'IT support ticket submitted.',
        },
      });

      // Find SLA policy
      const slaPolicy = await this.resolveSlaPolicy(reqType.id, priority);

      const ticket = await tx.itTicket.create({
        data: {
          requestId: req.id,
          reportedByUserId: userId,
          category: dto.category,
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

      // SLA event: CREATED
      if (slaPolicy) {
        await tx.slaEvent.create({
          data: {
            requestId: req.id,
            slaPolicyId: slaPolicy.id,
            eventType: 'CREATED',
          },
        });
      }

      // Bootstrap workflow if available
      const wfDefId = reqType.workflowDefinitionId;
      if (wfDefId) {
        const wfStatus = await this.workflowEngine.bootstrapInstance(
          tx,
          req.id,
          wfDefId,
        );
        if (wfStatus) {
          await tx.request.update({
            where: { id: req.id },
            data: { status: wfStatus },
          });
          await tx.requestStatusHistory.create({
            data: {
              requestId: req.id,
              oldStatus: initialStatus,
              newStatus: wfStatus,
              changedByUserId: userId,
              changeReason: 'Workflow started.',
            },
          });
        }
      }

      return { requestId: req.id, ticketId: ticket.id, requestNo: req.requestNo };
    });
  }

  // ── MY TICKETS ─────────────────────────────────────────────────────────────

  async findMy(userId: string) {
    const records = await this.prisma.itTicket.findMany({
      where: { reportedByUserId: userId },
      include: {
        request: {
          include: {
            requestType: { select: { id: true, key: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => this.toListItem(r));
  }

  // ── INBOX ──────────────────────────────────────────────────────────────────

  async findInbox(filters?: {
    ticketStatus?: TicketStatus;
    priority?: PriorityLevel;
    category?: string;
    assignedItUserId?: string;
  }) {
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
    }

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
        slaPolicy: { select: { id: true, name: true, resolutionMinutes: true } },
      },
      orderBy: [{ request: { priority: 'desc' } }, { createdAt: 'asc' }],
    });

    return records.map((r) => ({
      ...this.toListItem(r),
      requesterName:
        (r.request as any).requester?.profile?.fullName ??
        (r.request as any).requester?.email ??
        'Unknown',
      assignedTo: r.assignedTo
        ? {
            id: r.assignedTo.id,
            fullName:
              (r.assignedTo as any).profile?.fullName ?? r.assignedTo.email,
          }
        : null,
      slaPolicy: r.slaPolicy ?? null,
    }));
  }

  // ── DETAIL ─────────────────────────────────────────────────────────────────

  async findById(userId: string, roles: string[], requestId: string) {
    const isAdmin = roles.includes('ADMIN');
    const isStaff = roles.includes('STAFF');
    const isStudent = roles.includes('STUDENT') && !isAdmin && !isStaff;

    const r = await this.prisma.itTicket.findFirst({
      where: { requestId },
      include: {
        request: {
          include: {
            requestType: true,
            requester: {
              include: {
                profile: {
                  include: {
                    faculty: { select: { name: true } },
                    department: { select: { name: true } },
                  },
                },
              },
            },
            currentAssignee: {
              include: { profile: { select: { fullName: true } } },
            },
            statusHistory: { orderBy: { changedAt: 'asc' } },
            comments: {
              where: isStudent ? { isInternal: false } : {},
              orderBy: { createdAt: 'asc' },
              include: {
                user: {
                  include: {
                    profile: true,
                    primaryRoles: { include: { role: true } },
                  },
                },
              },
            },
            fileLinks: { include: { file: true } },
            workflowInstance: {
              include: {
                currentStep: true,
                workflowDefinition: { select: { name: true } },
              },
            },
          },
        },
        reportedBy: { include: { profile: { select: { fullName: true } } } },
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
    });

    if (!r) throw new NotFoundException('IT ticket not found.');

    const req = r.request as any;

    if (isStudent && req.requesterUserId !== userId) {
      throw new ForbiddenException('Access denied.');
    }

    return {
      id: req.id,
      requestNo: req.requestNo,
      title: req.title,
      description: req.description,
      status: req.status,
      priority: req.priority,
      createdAt: req.createdAt,
      submittedAt: req.submittedAt,
      requester: {
        id: req.requester.id,
        fullName: req.requester.profile?.fullName ?? req.requester.email,
        faculty: req.requester.profile?.faculty?.name ?? null,
        department: req.requester.profile?.department?.name ?? null,
      },
      currentAssignee: req.currentAssignee
        ? {
            id: req.currentAssignee.id,
            fullName:
              req.currentAssignee.profile?.fullName ?? req.currentAssignee.email,
          }
        : null,
      ticket: {
        id: r.id,
        ticketStatus: r.ticketStatus,
        category: r.category,
        subcategory: r.subcategory,
        affectedSystem: r.affectedSystem,
        assetId: r.assetId,
        locationText: r.locationText,
        incidentStartedAt: r.incidentStartedAt,
        resolutionSummary: r.resolutionSummary,
        resolvedAt: r.resolvedAt,
        closedAt: r.closedAt,
        reopenedCount: r.reopenedCount,
        assignedTo: r.assignedTo
          ? {
              id: r.assignedTo.id,
              fullName:
                (r.assignedTo as any).profile?.fullName ?? r.assignedTo.email,
            }
          : null,
        slaPolicy: r.slaPolicy ?? null,
      },
      workflow: req.workflowInstance
        ? {
            status: req.workflowInstance.status,
            currentStep: req.workflowInstance.currentStep?.stepName ?? null,
            workflowName: req.workflowInstance.workflowDefinition?.name ?? null,
          }
        : null,
      statusHistory: req.statusHistory.map((h: any) => ({
        id: h.id,
        status: h.newStatus,
        date: h.changedAt,
        note: h.changeReason,
      })),
      comments: req.comments.map((c: any) => ({
        id: c.id,
        author: c.user?.profile?.fullName ?? c.user?.email ?? 'Unknown',
        authorRole:
          c.user?.primaryRoles?.[0]?.role?.name?.toLowerCase() ?? 'unknown',
        content: c.commentText,
        isInternal: c.isInternal,
        createdAt: c.createdAt,
      })),
      attachments: req.fileLinks.map((fl: any) => ({
        id: fl.file.id,
        name: fl.file.originalFileName,
        size: fl.file.fileSizeBytes,
        url: fl.file.storagePath,
      })),
    };
  }

  // ── TRIAGE ─────────────────────────────────────────────────────────────────

  async triage(
    userId: string,
    roles: string[],
    requestId: string,
    dto: TriageItTicketDto,
  ) {
    const canTriage = roles.some((r) => ['ADMIN', 'STAFF'].includes(r));
    if (!canTriage) throw new ForbiddenException('Insufficient permissions.');

    const ticket = await this.prisma.itTicket.findFirst({ where: { requestId } });
    if (!ticket) throw new NotFoundException('IT ticket not found.');

    const newTicketStatus =
      dto.newStatus ??
      (dto.assignedItUserId ? TicketStatus.IN_PROGRESS : TicketStatus.TRIAGED);

    // Map ticketStatus → RequestStatus
    const requestStatusMap: Partial<Record<TicketStatus, RequestStatus>> = {
      [TicketStatus.TRIAGED]: RequestStatus.IN_REVIEW,
      [TicketStatus.IN_PROGRESS]: RequestStatus.IN_REVIEW,
    };
    const newRequestStatus = requestStatusMap[newTicketStatus] ?? RequestStatus.IN_REVIEW;

    return this.prisma.$transaction(async (tx) => {
      const prev = await tx.itTicket.findUnique({ where: { id: ticket.id } });
      const prevReq = await tx.request.findUnique({ where: { id: requestId } });

      const updated = await tx.itTicket.update({
        where: { id: ticket.id },
        data: {
          ...(dto.category !== undefined && { category: dto.category }),
          ...(dto.subcategory !== undefined && { subcategory: dto.subcategory }),
          ...(dto.assignedItUserId !== undefined && {
            assignedItUserId: dto.assignedItUserId,
          }),
          ticketStatus: newTicketStatus,
        },
      });

      await tx.request.update({
        where: { id: requestId },
        data: {
          status: newRequestStatus,
          ...(dto.assignedItUserId !== undefined && {
            currentAssigneeUserId: dto.assignedItUserId,
          }),
        },
      });

      // Create RequestAssignment if assignee changed
      if (dto.assignedItUserId && dto.assignedItUserId !== prev?.assignedItUserId) {
        // Deactivate existing assignments
        await tx.requestAssignment.updateMany({
          where: { requestId, isActive: true },
          data: { isActive: false, unassignedAt: new Date() },
        });
        await tx.requestAssignment.create({
          data: {
            requestId,
            assignedToUserId: dto.assignedItUserId,
            assignedByUserId: userId,
            isActive: true,
          },
        });
      }

      await tx.requestStatusHistory.create({
        data: {
          requestId,
          oldStatus: prevReq?.status ?? null,
          newStatus: newRequestStatus,
          changedByUserId: userId,
          changeReason: dto.note?.trim() || `Ticket triaged. Status: ${newTicketStatus}`,
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

      return { ticketId: updated.id, ticketStatus: updated.ticketStatus, requestStatus: newRequestStatus };
    });
  }

  // ── RESOLVE ────────────────────────────────────────────────────────────────

  async resolve(
    userId: string,
    roles: string[],
    requestId: string,
    dto: ResolveItTicketDto,
  ) {
    const canResolve = roles.some((r) => ['ADMIN', 'STAFF'].includes(r));
    if (!canResolve) throw new ForbiddenException('Insufficient permissions.');

    const ticket = await this.prisma.itTicket.findFirst({ where: { requestId } });
    if (!ticket) throw new NotFoundException('IT ticket not found.');

    const resolvedAt = new Date();

    return this.prisma.$transaction(async (tx) => {
      const prevReq = await tx.request.findUnique({ where: { id: requestId } });

      const updated = await tx.itTicket.update({
        where: { id: ticket.id },
        data: {
          ticketStatus: TicketStatus.RESOLVED,
          resolutionSummary: dto.resolutionSummary ?? null,
          resolvedAt,
        },
      });

      await tx.request.update({
        where: { id: requestId },
        data: { status: RequestStatus.COMPLETED },
      });

      await tx.requestStatusHistory.create({
        data: {
          requestId,
          oldStatus: prevReq?.status ?? null,
          newStatus: RequestStatus.COMPLETED,
          changedByUserId: userId,
          changeReason: dto.note?.trim() || 'Ticket resolved.',
        },
      });

      // SLA resolved event
      if (ticket.slaPolicyId) {
        await tx.slaEvent.create({
          data: {
            requestId,
            slaPolicyId: ticket.slaPolicyId,
            eventType: 'RESOLVED',
            resolvedAt,
          },
        });
      }

      return { ticketId: updated.id, ticketStatus: updated.ticketStatus };
    });
  }

  // ── CLOSE ──────────────────────────────────────────────────────────────────

  async close(userId: string, roles: string[], requestId: string) {
    const canClose = roles.some((r) => ['ADMIN', 'STAFF'].includes(r));
    if (!canClose) throw new ForbiddenException('Insufficient permissions.');

    const ticket = await this.prisma.itTicket.findFirst({ where: { requestId } });
    if (!ticket) throw new NotFoundException('IT ticket not found.');

    return this.prisma.$transaction(async (tx) => {
      const prevReq = await tx.request.findUnique({ where: { id: requestId } });

      const updated = await tx.itTicket.update({
        where: { id: ticket.id },
        data: { ticketStatus: TicketStatus.CLOSED, closedAt: new Date() },
      });

      await tx.request.update({
        where: { id: requestId },
        data: { status: RequestStatus.CLOSED },
      });

      await tx.requestStatusHistory.create({
        data: {
          requestId,
          oldStatus: prevReq?.status ?? null,
          newStatus: RequestStatus.CLOSED,
          changedByUserId: userId,
          changeReason: 'Ticket closed.',
        },
      });

      return { ticketId: updated.id, ticketStatus: updated.ticketStatus };
    });
  }

  // ── REOPEN ─────────────────────────────────────────────────────────────────

  async reopen(userId: string, roles: string[], requestId: string) {
    const canReopen = roles.some((r) => ['ADMIN', 'STAFF'].includes(r));
    if (!canReopen) throw new ForbiddenException('Insufficient permissions.');

    const ticket = await this.prisma.itTicket.findFirst({ where: { requestId } });
    if (!ticket) throw new NotFoundException('IT ticket not found.');

    return this.prisma.$transaction(async (tx) => {
      const prevReq = await tx.request.findUnique({ where: { id: requestId } });

      const updated = await tx.itTicket.update({
        where: { id: ticket.id },
        data: {
          ticketStatus: TicketStatus.REOPENED,
          closedAt: null,
          resolvedAt: null,
          reopenedCount: { increment: 1 },
        },
      });

      await tx.request.update({
        where: { id: requestId },
        data: { status: RequestStatus.SUBMITTED },
      });

      await tx.requestStatusHistory.create({
        data: {
          requestId,
          oldStatus: prevReq?.status ?? null,
          newStatus: RequestStatus.SUBMITTED,
          changedByUserId: userId,
          changeReason: 'Ticket reopened.',
        },
      });

      return { ticketId: updated.id, ticketStatus: updated.ticketStatus };
    });
  }

  // ── STAFF MEMBERS (for assignment dropdown) ─────────────────────────────────

  async findStaffMembers() {
    const users = await this.prisma.user.findMany({
      where: {
        primaryRoles: {
          some: { role: { name: 'STAFF' } },
        },
        status: 'ACTIVE',
      },
      include: {
        profile: { select: { fullName: true, title: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });

    return users.map((u) => ({
      id: u.id,
      email: u.email,
      fullName: (u as any).profile?.fullName ?? u.email,
      title: (u as any).profile?.title ?? null,
    }));
  }
}
