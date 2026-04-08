/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service';
import { WorkflowEngineService } from '../workflow/workflow-engine.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  PriorityLevel,
  RequestStatus,
  ReservationStatus,
} from '@prisma/client';
import { CreateRoomReservationDto } from './dto/create-room-reservation.dto';
import {
  ApproveReservationDto,
  RejectReservationDto,
} from './dto/approve-reservation.dto';

const ROOM_RESERVATION_TYPE_KEY = 'ROOM_RESERVATION';

function makeRequestNo(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `RES-${ymd}-${rand}`;
}

@Injectable()
export class ReservationsService {
  constructor(
    private prisma: PrismaService,
    private workflowEngine: WorkflowEngineService,
    private notificationsService: NotificationsService,
  ) {}

  // ── HELPERS ────────────────────────────────────────────────────────────────

  private async getOrCreateRequestType() {
    let rt = await this.prisma.requestType.findUnique({
      where: { key: ROOM_RESERVATION_TYPE_KEY },
    });
    if (!rt) {
      rt = await this.prisma.requestType.create({
        data: {
          key: ROOM_RESERVATION_TYPE_KEY,
          name: 'Room / Resource Reservation',
          category: 'RESERVATION',
          description: 'Room and resource reservation requests',
          isActive: true,
        },
      });
    }
    return rt;
  }

  /** Overlap check: startAt < existing.endAt AND endAt > existing.startAt */
  private async checkConflicts(
    resourceId: string,
    startAt: Date,
    endAt: Date,
    excludeRequestId?: string,
  ) {
    const conflicts = await this.prisma.reservation.findMany({
      where: {
        resourceId,
        status: { in: [ReservationStatus.APPROVED, ReservationStatus.ACTIVE] },
        startAt: { lt: endAt },
        endAt: { gt: startAt },
        ...(excludeRequestId && { requestId: { not: excludeRequestId } }),
      },
      select: {
        id: true,
        title: true,
        startAt: true,
        endAt: true,
        status: true,
      },
    });
    return conflicts;
  }

  private toListItem(r: any) {
    const req = r.request as any;
    return {
      id: req.id,
      reservationRequestId: r.id,
      requestNo: req.requestNo,
      title: req.title,
      status: req.status,
      reservationStatus: r.reservationStatus,
      priority: req.priority,
      eventName: r.eventName,
      reservationPurpose: r.reservationPurpose,
      attendeeCount: r.attendeeCount,
      startAt: r.startAt,
      endAt: r.endAt,
      requiresSecurityApproval: r.requiresSecurityApproval,
      requiresTechnicalSupport: r.requiresTechnicalSupport,
      resource: r.resource
        ? {
            id: r.resource.id,
            name: r.resource.name,
            resourceType: r.resource.resourceType,
          }
        : null,
      createdAt: r.createdAt,
    };
  }

  // ── CREATE ─────────────────────────────────────────────────────────────────

  async create(userId: string, dto: CreateRoomReservationDto) {
    // Validate resource exists
    const resource = await this.prisma.resource.findUnique({
      where: { id: dto.resourceId },
    });
    if (!resource) throw new NotFoundException('Resource not found.');
    if (!resource.isActive)
      throw new BadRequestException('Resource is not available.');

    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);
    if (startAt >= endAt)
      throw new BadRequestException('startAt must be before endAt.');

    // Conflict check (soft — warn but allow submit)
    const conflicts = await this.checkConflicts(resource.id, startAt, endAt);

    const reqType = await this.getOrCreateRequestType();

    let requestNo = makeRequestNo();
    while (await this.prisma.request.findUnique({ where: { requestNo } })) {
      requestNo = makeRequestNo();
    }

    const title = `${resource.name} — ${dto.eventName}`;

    const result = await this.prisma.$transaction(async (tx) => {
      let initialStatus = RequestStatus.SUBMITTED;

      const req = await tx.request.create({
        data: {
          requestNo,
          requestTypeId: reqType.id,
          requesterUserId: userId,
          title,
          description: dto.description ?? dto.reservationPurpose,
          priority: dto.priority ?? PriorityLevel.MEDIUM,
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
          changeReason: 'Room reservation request submitted.',
        },
      });

      await tx.roomReservationRequest.create({
        data: {
          requestId: req.id,
          resourceId: resource.id,
          requesterUserId: userId,
          eventName: dto.eventName,
          reservationPurpose: dto.reservationPurpose,
          attendeeCount: dto.attendeeCount,
          startAt,
          endAt,
          requiresSecurityApproval: dto.requiresSecurityApproval ?? false,
          requiresTechnicalSupport: dto.requiresTechnicalSupport ?? false,
          setupNotes: dto.setupNotes ?? null,
          reservationStatus: ReservationStatus.PENDING,
        },
      });

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

      return {
        requestId: req.id,
        requestNo: req.requestNo,
        conflicts: conflicts.map((c) => ({
          id: c.id,
          title: c.title,
          startAt: c.startAt,
          endAt: c.endAt,
        })),
        hasConflicts: conflicts.length > 0,
      };
    });

    void this.notificationsService.createNotification({
      userId,
      title: 'Reservation Request Submitted',
      message: `Request ${result.requestNo} received for ${resource.name}.`,
      actionUrl: '/student/reservations/' + result.requestId,
    });
    return result;
  }

  // ── MY REQUESTS ─────────────────────────────────────────────────────────────

  async findMy(userId: string) {
    const records = await this.prisma.roomReservationRequest.findMany({
      where: { requesterUserId: userId },
      include: {
        request: {
          include: {
            requestType: { select: { id: true, key: true, name: true } },
          },
        },
        resource: {
          select: {
            id: true,
            name: true,
            resourceType: true,
            locationText: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => this.toListItem(r));
  }

  // ── ALL (admin) ─────────────────────────────────────────────────────────────

  async findAll() {
    const records = await this.prisma.roomReservationRequest.findMany({
      include: {
        request: {
          include: {
            requestType: { select: { id: true, key: true, name: true } },
            requester: {
              include: { profile: { select: { fullName: true } } },
            },
          },
        },
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
      orderBy: { createdAt: 'desc' },
    });

    return records.map((r) => ({
      ...this.toListItem(r),
      requesterName:
        (r.request as any).requester?.profile?.fullName ??
        (r.request as any).requester?.email ??
        'Unknown',
    }));
  }

  // ── INBOX ───────────────────────────────────────────────────────────────────

  async findInbox() {
    const records = await this.prisma.roomReservationRequest.findMany({
      where: {
        reservationStatus: { in: [ReservationStatus.PENDING] },
      },
      include: {
        request: {
          include: {
            requestType: { select: { id: true, key: true, name: true } },
            requester: {
              include: { profile: { select: { fullName: true } } },
            },
          },
        },
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
      orderBy: [{ request: { priority: 'desc' } }, { startAt: 'asc' }],
    });

    return records.map((r) => ({
      ...this.toListItem(r),
      requesterName:
        (r.request as any).requester?.profile?.fullName ??
        (r.request as any).requester?.email ??
        'Unknown',
    }));
  }

  // ── DETAIL ──────────────────────────────────────────────────────────────────

  async findById(userId: string, roles: string[], requestId: string) {
    const isAdmin = roles.includes('ADMIN');
    const isStaff = roles.includes('STAFF');
    const isStudent = roles.includes('STUDENT') && !isAdmin && !isStaff;

    const r = await this.prisma.roomReservationRequest.findFirst({
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
          },
        },
        resource: {
          include: {
            campus: { select: { name: true } },
            faculty: { select: { name: true } },
          },
        },
      },
    });

    if (!r) throw new NotFoundException('Reservation request not found.');
    const req = r.request as any;

    if (isStudent && req.requesterUserId !== userId) {
      throw new ForbiddenException('Access denied.');
    }

    // Check for existing reservation
    const reservation = await this.prisma.reservation.findFirst({
      where: { requestId },
    });

    // Conflict check for current window
    const conflicts = reservation
      ? await this.prisma.reservationConflict.findMany({
          where: { reservationId: reservation.id },
          include: {
            conflictingReservation: {
              select: { title: true, startAt: true, endAt: true },
            },
          },
        })
      : [];

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
      reservation: {
        id: r.id,
        reservationStatus: r.reservationStatus,
        eventName: r.eventName,
        reservationPurpose: r.reservationPurpose,
        attendeeCount: r.attendeeCount,
        startAt: r.startAt,
        endAt: r.endAt,
        requiresSecurityApproval: r.requiresSecurityApproval,
        requiresTechnicalSupport: r.requiresTechnicalSupport,
        setupNotes: r.setupNotes,
        resource: {
          id: r.resource.id,
          name: r.resource.name,
          resourceType: r.resource.resourceType,
          locationText: r.resource.locationText,
          capacity: r.resource.capacity,
          campus: (r.resource as any).campus?.name ?? null,
          faculty: (r.resource as any).faculty?.name ?? null,
        },
      },
      actualReservation: reservation
        ? {
            id: reservation.id,
            status: reservation.status,
            approvedAt: reservation.approvedAt,
          }
        : null,
      conflicts: conflicts.map((c) => ({
        id: c.id,
        conflicting: c.conflictingReservation,
      })),
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
    };
  }

  // ── APPROVE ─────────────────────────────────────────────────────────────────

  async approve(
    userId: string,
    roles: string[],
    requestId: string,
    dto: ApproveReservationDto,
  ) {
    const canApprove = roles.some((r) => ['ADMIN', 'STAFF'].includes(r));
    if (!canApprove) throw new ForbiddenException('Insufficient permissions.');

    const rrr = await this.prisma.roomReservationRequest.findFirst({
      where: { requestId },
      include: { resource: true },
    });
    if (!rrr) throw new NotFoundException('Reservation request not found.');
    if (rrr.reservationStatus !== ReservationStatus.PENDING) {
      throw new BadRequestException(
        'Only pending reservations can be approved.',
      );
    }

    // Final conflict check
    const conflicts = await this.checkConflicts(
      rrr.resourceId,
      rrr.startAt,
      rrr.endAt,
      requestId,
    );

    const rrrData = rrr;
    const result = await this.prisma.$transaction(async (tx) => {
      const prevReq = await tx.request.findUnique({ where: { id: requestId } });

      await tx.roomReservationRequest.update({
        where: { id: rrrData.id },
        data: { reservationStatus: ReservationStatus.APPROVED },
      });

      await tx.request.update({
        where: { id: requestId },
        data: { status: RequestStatus.APPROVED },
      });

      await tx.requestStatusHistory.create({
        data: {
          requestId,
          oldStatus: prevReq?.status ?? null,
          newStatus: RequestStatus.APPROVED,
          changedByUserId: userId,
          changeReason: dto.note?.trim() || 'Reservation approved.',
        },
      });

      const reservation = await tx.reservation.create({
        data: {
          resourceId: rrrData.resourceId,
          requestId,
          reservedByUserId: rrrData.requesterUserId,
          title: rrrData.eventName,
          description: rrrData.reservationPurpose,
          status: ReservationStatus.APPROVED,
          startAt: rrrData.startAt,
          endAt: rrrData.endAt,
          approvedByUserId: userId,
          approvedAt: new Date(),
        },
      });

      for (const conflict of conflicts) {
        await tx.reservationConflict.create({
          data: {
            reservationId: reservation.id,
            conflictingReservationId: conflict.id,
          },
        });
      }

      if (dto.note?.trim()) {
        await tx.requestComment.create({
          data: { requestId, userId, commentText: dto.note, isInternal: false },
        });
      }

      return {
        requestId,
        reservationId: reservation.id,
        requesterUserId: rrrData.requesterUserId,
        status: ReservationStatus.APPROVED,
        hasConflicts: conflicts.length > 0,
        conflictCount: conflicts.length,
      };
    });

    void this.notificationsService.createNotification({
      userId: result.requesterUserId,
      title: 'Reservation Approved',
      message: `Your reservation for ${rrrData.eventName} has been approved.`,
      requestId,
      actionUrl: '/student/reservations/' + requestId,
    });
    return result;
  }

  // ── REJECT ──────────────────────────────────────────────────────────────────

  async reject(
    userId: string,
    roles: string[],
    requestId: string,
    dto: RejectReservationDto,
  ) {
    const canReject = roles.some((r) => ['ADMIN', 'STAFF'].includes(r));
    if (!canReject) throw new ForbiddenException('Insufficient permissions.');

    const rrr = await this.prisma.roomReservationRequest.findFirst({
      where: { requestId },
    });
    if (!rrr) throw new NotFoundException('Reservation request not found.');

    const rrrData = rrr;
    const result = await this.prisma.$transaction(async (tx) => {
      const prevReq = await tx.request.findUnique({ where: { id: requestId } });

      await tx.roomReservationRequest.update({
        where: { id: rrrData.id },
        data: { reservationStatus: ReservationStatus.REJECTED },
      });

      await tx.request.update({
        where: { id: requestId },
        data: { status: RequestStatus.REJECTED },
      });

      await tx.requestStatusHistory.create({
        data: {
          requestId,
          oldStatus: prevReq?.status ?? null,
          newStatus: RequestStatus.REJECTED,
          changedByUserId: userId,
          changeReason: dto.reason?.trim() || 'Reservation rejected.',
        },
      });

      if (dto.reason?.trim()) {
        await tx.requestComment.create({
          data: {
            requestId,
            userId,
            commentText: dto.reason,
            isInternal: false,
          },
        });
      }

      return {
        requestId,
        requesterUserId: rrrData.requesterUserId,
        status: ReservationStatus.REJECTED,
      };
    });

    void this.notificationsService.createNotification({
      userId: result.requesterUserId,
      title: 'Reservation Rejected',
      message:
        dto.reason?.trim() ?? 'Your reservation request has been rejected.',
      requestId,
      actionUrl: '/student/reservations/' + requestId,
    });
    return result;
  }
}
