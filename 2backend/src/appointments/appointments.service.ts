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
  AppointmentStatus,
  Prisma,
  PriorityLevel,
  RequestStatus,
} from '@prisma/client';

const APPOINTMENT_TYPE_KEY = 'APPOINTMENT';

function makeRequestNo(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `APT-${ymd}-${Math.floor(Math.random() * 9000) + 1000}`;
}

type CalendarMetadata = {
  requiresManagerApproval: boolean;
  managerUserId: string | null;
  targetUserId: string | null;
  availabilityValidated: boolean;
  hasConflict: boolean;
  hostConflictCount: number;
  requesterConflictCount: number;
  targetConfirmedAt: string | null;
  targetConfirmedByUserId: string | null;
  confirmedStartAt: string | null;
  confirmedEndAt: string | null;
  confirmedLocationText: string | null;
};

const RESOURCE_MANAGER_ROLE = 'RESOURCE_MANAGER';

const TERMINAL_STATUSES: RequestStatus[] = [
  RequestStatus.APPROVED,
  RequestStatus.REJECTED,
  RequestStatus.CANCELLED,
  RequestStatus.CLOSED,
  RequestStatus.COMPLETED,
  RequestStatus.EXPIRED,
];

@Injectable()
export class AppointmentsService {
  constructor(
    private prisma: PrismaService,
    private workflowEngine: WorkflowEngineService,
    private notificationsService: NotificationsService,
  ) {}

  private async getOrCreateRequestType() {
    let rt = await this.prisma.requestType.findUnique({
      where: { key: APPOINTMENT_TYPE_KEY },
    });
    if (!rt) {
      rt = await this.prisma.requestType.create({
        data: {
          key: APPOINTMENT_TYPE_KEY,
          name: 'Appointment Request',
          category: 'APPOINTMENT',
          description: 'Appointment requests between users',
          isActive: true,
        },
      });
    }
    return rt;
  }

  private buildRequestMetadata(input: CalendarMetadata) {
    return {
      calendar: {
        requiresManagerApproval: input.requiresManagerApproval,
        managerUserId: input.managerUserId,
        targetUserId: input.targetUserId,
        availabilityValidated: input.availabilityValidated,
        hasConflict: input.hasConflict,
        hostConflictCount: input.hostConflictCount,
        requesterConflictCount: input.requesterConflictCount,
        targetConfirmedAt: input.targetConfirmedAt,
        targetConfirmedByUserId: input.targetConfirmedByUserId,
        confirmedStartAt: input.confirmedStartAt,
        confirmedEndAt: input.confirmedEndAt,
        confirmedLocationText: input.confirmedLocationText,
      },
    };
  }

  private async getResourceManagerUserIds(): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        primaryRoles: {
          some: { role: { name: RESOURCE_MANAGER_ROLE } },
        },
      },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }

  private async userHasResourceManagerRole(userId: string): Promise<boolean> {
    const found = await this.prisma.userRole.findFirst({
      where: { userId, role: { name: RESOURCE_MANAGER_ROLE } },
      select: { id: true },
    });
    return Boolean(found);
  }

  private extractCalendarMetadata(
    value: Prisma.JsonValue | null | undefined,
  ): CalendarMetadata {
    const raw =
      value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
    const calendar =
      raw.calendar && typeof raw.calendar === 'object' && !Array.isArray(raw.calendar)
        ? (raw.calendar as Record<string, unknown>)
        : {};

    return {
      requiresManagerApproval: calendar.requiresManagerApproval === true,
      managerUserId:
        typeof calendar.managerUserId === 'string'
          ? calendar.managerUserId
          : null,
      targetUserId:
        typeof calendar.targetUserId === 'string'
          ? calendar.targetUserId
          : null,
      availabilityValidated: calendar.availabilityValidated === true,
      hasConflict: calendar.hasConflict === true,
      hostConflictCount:
        typeof calendar.hostConflictCount === 'number'
          ? calendar.hostConflictCount
          : 0,
      requesterConflictCount:
        typeof calendar.requesterConflictCount === 'number'
          ? calendar.requesterConflictCount
          : 0,
      targetConfirmedAt:
        typeof calendar.targetConfirmedAt === 'string'
          ? calendar.targetConfirmedAt
          : null,
      targetConfirmedByUserId:
        typeof calendar.targetConfirmedByUserId === 'string'
          ? calendar.targetConfirmedByUserId
          : null,
      confirmedStartAt:
        typeof calendar.confirmedStartAt === 'string'
          ? calendar.confirmedStartAt
          : null,
      confirmedEndAt:
        typeof calendar.confirmedEndAt === 'string'
          ? calendar.confirmedEndAt
          : null,
      confirmedLocationText:
        typeof calendar.confirmedLocationText === 'string'
          ? calendar.confirmedLocationText
          : null,
    };
  }

  private async validateAgainstAvailability(
    userId: string,
    startAt: Date | null,
    endAt: Date | null,
  ) {
    if (!startAt || !endAt) {
      return false;
    }

    const anySlot = await this.prisma.userAvailabilitySlot.findFirst({
      where: { userId, isActive: true },
      select: { id: true },
    });

    // If the host hasn't configured any availability, skip validation.
    if (!anySlot) {
      return false;
    }

    const dayOfWeek = startAt.getUTCDay();
    const slotStart = `${String(startAt.getUTCHours()).padStart(2, '0')}:${String(
      startAt.getUTCMinutes(),
    ).padStart(2, '0')}`;
    const slotEnd = `${String(endAt.getUTCHours()).padStart(2, '0')}:${String(
      endAt.getUTCMinutes(),
    ).padStart(2, '0')}`;

    const availability = await this.prisma.userAvailabilitySlot.findFirst({
      where: {
        userId,
        dayOfWeek,
        isActive: true,
        startTime: { lte: slotStart },
        endTime: { gte: slotEnd },
      },
    });

    if (!availability) {
      throw new BadRequestException(
        'Selected time is outside the host availability window.',
      );
    }

    return true;
  }

  private async findConflictingAppointments(
    userId: string,
    startAt: Date | null,
    endAt: Date | null,
    excludeAppointmentId?: string | null,
  ) {
    if (!startAt || !endAt) {
      return [];
    }

    return this.prisma.appointment.findMany({
      where: {
        OR: [{ requesterUserId: userId }, { hostUserId: userId }],
        status: {
          in: [AppointmentStatus.REQUESTED, AppointmentStatus.CONFIRMED],
        },
        startAt: { lt: endAt },
        endAt: { gt: startAt },
        ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
      },
      select: {
        id: true,
        title: true,
        startAt: true,
        endAt: true,
        status: true,
      },
    });
  }

  private toListItem(ar: any) {
    const req = ar.request;
    const metadata = this.extractCalendarMetadata(req.dynamicData);
    const durationMin =
      ar.preferredStartAt && ar.preferredEndAt
        ? Math.round(
            (new Date(ar.preferredEndAt).getTime() -
              new Date(ar.preferredStartAt).getTime()) /
              60000,
          )
        : null;

    return {
      id: req.id,
      appointmentRequestId: ar.id,
      requestNo: req.requestNo,
      topic: ar.topic,
      details: ar.details,
      appointmentType: ar.appointmentType,
      status: req.status,
      priority: req.priority,
      preferredStartAt: ar.preferredStartAt,
      preferredEndAt: ar.preferredEndAt,
      durationMin,
      requester: {
        id: ar.requester.id,
        fullName: ar.requester.profile?.fullName ?? ar.requester.email,
        avatarUrl: ar.requester.profile?.avatarUrl ?? null,
      },
      targetUser: {
        id: ar.targetUser.id,
        fullName: ar.targetUser.profile?.fullName ?? ar.targetUser.email,
        avatarUrl: ar.targetUser.profile?.avatarUrl ?? null,
      },
      actualAppointmentId: ar.actualAppointmentId ?? null,
      requiresManagerApproval: metadata.requiresManagerApproval,
      availabilityValidated: metadata.availabilityValidated,
      hasCalendarConflict: metadata.hasConflict,
      hostConflictCount: metadata.hostConflictCount,
      requesterConflictCount: metadata.requesterConflictCount,
      targetConfirmedAt: metadata.targetConfirmedAt,
      confirmedStartAt: metadata.confirmedStartAt,
      confirmedEndAt: metadata.confirmedEndAt,
      confirmedLocationText: metadata.confirmedLocationText,
      awaitingManagerApproval: req.status === RequestStatus.WAITING_APPROVAL,
      createdAt: ar.createdAt,
    };
  }

  async getFacultyUsers() {
    const users = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        primaryRoles: {
          some: { role: { name: { in: ['FACULTY', 'STAFF'] } } },
        },
      },
      include: {
        profile: { select: { fullName: true, avatarUrl: true } },
        primaryRoles: { include: { role: { select: { name: true } } } },
      },
      orderBy: { email: 'asc' },
      take: 100,
    });
    return users.map((u) => ({
      id: u.id,
      fullName: u.profile?.fullName ?? u.email,
      email: u.email,
      role: u.primaryRoles?.[0]?.role?.name ?? 'FACULTY',
    }));
  }

  async create(
    userId: string,
    dto: {
      targetUserId: string;
      appointmentType: string;
      topic: string;
      details?: string;
      preferredStartAt?: string;
      preferredEndAt?: string;
      priority?: PriorityLevel;
    },
  ) {
    const target = await this.prisma.user.findUnique({
      where: { id: dto.targetUserId },
      include: {
        profile: { select: { unitId: true } },
        primaryRoles: { include: { role: { select: { name: true } } } },
      },
    });
    if (!target) throw new NotFoundException('Target user not found.');
    if (dto.targetUserId === userId) {
      throw new BadRequestException('Cannot book appointment with yourself.');
    }

    const preferredStartAt = dto.preferredStartAt
      ? new Date(dto.preferredStartAt)
      : null;
    const preferredEndAt = dto.preferredEndAt
      ? new Date(dto.preferredEndAt)
      : null;
    if (
      preferredStartAt &&
      preferredEndAt &&
      preferredStartAt >= preferredEndAt
    ) {
      throw new BadRequestException(
        'preferredStartAt must be before preferredEndAt.',
      );
    }

    const availabilityValidated = await this.validateAgainstAvailability(
      dto.targetUserId,
      preferredStartAt,
      preferredEndAt,
    );
    const hostConflicts = await this.findConflictingAppointments(
      dto.targetUserId,
      preferredStartAt,
      preferredEndAt,
    );
    const requesterConflicts = await this.findConflictingAppointments(
      userId,
      preferredStartAt,
      preferredEndAt,
    );
    if (hostConflicts.length > 0 || requesterConflicts.length > 0) {
      throw new BadRequestException(
        'Selected time conflicts with an existing appointment.',
      );
    }

    const requestedDurationMin =
      preferredStartAt && preferredEndAt
        ? Math.round(
            (preferredEndAt.getTime() - preferredStartAt.getTime()) / 60000,
          )
        : 0;
    const targetRoleNames = target.primaryRoles.map((role) => role.role.name);
    const managerUserId = target.profile?.unitId
      ? (
          await this.prisma.unit.findUnique({
            where: { id: target.profile.unitId },
            select: { managerUserId: true },
          })
        )?.managerUserId ?? null
      : null;
    const requiresManagerApproval =
      requestedDurationMin > 60 ||
      targetRoleNames.includes('STAFF') ||
      dto.appointmentType === 'CONSULTATION';

    const reqType = await this.getOrCreateRequestType();
    let requestNo = makeRequestNo();
    while (await this.prisma.request.findUnique({ where: { requestNo } })) {
      requestNo = makeRequestNo();
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const initialStatus = RequestStatus.SUBMITTED;
      const req = await tx.request.create({
        data: {
          requestNo,
          requestTypeId: reqType.id,
          requesterUserId: userId,
          currentAssigneeUserId: dto.targetUserId,
          title: `Appointment: ${dto.topic}`,
          description: dto.details ?? null,
          priority: dto.priority ?? PriorityLevel.MEDIUM,
          status: initialStatus,
          submittedAt: new Date(),
          dynamicData: this.buildRequestMetadata({
            requiresManagerApproval,
            managerUserId,
            targetUserId: dto.targetUserId,
            availabilityValidated,
            hasConflict: false,
            hostConflictCount: hostConflicts.length,
            requesterConflictCount: requesterConflicts.length,
            targetConfirmedAt: null,
            targetConfirmedByUserId: null,
            confirmedStartAt: null,
            confirmedEndAt: null,
            confirmedLocationText: null,
          }),
        },
      });

      await tx.requestStatusHistory.create({
        data: {
          requestId: req.id,
          oldStatus: null,
          newStatus: initialStatus,
          changedByUserId: userId,
          changeReason: 'Appointment request submitted.',
        },
      });

      await tx.appointmentRequest.create({
        data: {
          requestId: req.id,
          requesterUserId: userId,
          targetUserId: dto.targetUserId,
          appointmentType: dto.appointmentType,
          topic: dto.topic,
          details: dto.details ?? null,
          preferredStartAt,
          preferredEndAt,
        },
      });

      const wfDefId = reqType.workflowDefinitionId;
      if (wfDefId) {
        const wfStatus = await this.workflowEngine.bootstrapInstance(
          tx,
          req.id,
          wfDefId,
        );
        if (wfStatus && wfStatus !== initialStatus) {
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
        requiresManagerApproval,
        availabilityValidated,
      };
    });

    void this.notificationsService.createNotification({
      userId: dto.targetUserId,
      title: 'New Appointment Request',
      message: `${dto.topic} - appointment requested. Please confirm before manager review.`,
      requestId: result.requestId,
      actionUrl: '/faculty/appointments',
    });

    return result;
  }

  async findMy(userId: string) {
    const records = await this.prisma.appointmentRequest.findMany({
      where: { requesterUserId: userId },
      include: {
        request: {
          select: {
            id: true,
            requestNo: true,
            status: true,
            priority: true,
            dynamicData: true,
          },
        },
        requester: {
          include: {
            profile: { select: { fullName: true, avatarUrl: true } },
            primaryRoles: { include: { role: { select: { name: true } } } },
          },
        },
        targetUser: {
          include: {
            profile: { select: { fullName: true, avatarUrl: true } },
            primaryRoles: { include: { role: { select: { name: true } } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => this.toListItem(r));
  }

  async findIncoming(userId: string, roles: string[] = []) {
    const isResourceManager =
      roles.includes(RESOURCE_MANAGER_ROLE) ||
      (await this.userHasResourceManagerRole(userId));

    const where: Prisma.AppointmentRequestWhereInput = isResourceManager
      ? {
          OR: [
            { targetUserId: userId },
            { request: { status: RequestStatus.WAITING_APPROVAL } },
          ],
        }
      : { targetUserId: userId };

    const records = await this.prisma.appointmentRequest.findMany({
      where,
      include: {
        request: {
          select: {
            id: true,
            requestNo: true,
            status: true,
            priority: true,
            dynamicData: true,
          },
        },
        requester: {
          include: {
            profile: { select: { fullName: true, avatarUrl: true } },
            primaryRoles: { include: { role: { select: { name: true } } } },
          },
        },
        targetUser: {
          include: {
            profile: { select: { fullName: true, avatarUrl: true } },
            primaryRoles: { include: { role: { select: { name: true } } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => this.toListItem(r));
  }

  async findById(userId: string, roles: string[], requestId: string) {
    const ar = await this.prisma.appointmentRequest.findFirst({
      where: { requestId },
      include: {
        request: {
          include: {
            requestType: true,
            statusHistory: { orderBy: { changedAt: 'asc' } },
            comments: {
              where: { isInternal: false },
              orderBy: { createdAt: 'asc' },
              include: { user: { include: { profile: true } } },
            },
          },
        },
        requester: {
          include: {
            profile: { select: { fullName: true, avatarUrl: true } },
            primaryRoles: { include: { role: { select: { name: true } } } },
          },
        },
        targetUser: {
          include: {
            profile: { select: { fullName: true, avatarUrl: true } },
            primaryRoles: { include: { role: { select: { name: true } } } },
          },
        },
        actualAppointment: true,
      },
    });

    if (!ar) throw new NotFoundException('Appointment request not found.');

    const isAdmin = roles.includes('ADMIN');
    const isRequester = ar.requesterUserId === userId;
    const isTarget = ar.targetUserId === userId;
    const req = ar.request as any;
    const isResourceManagerForApproval =
      req.status === RequestStatus.WAITING_APPROVAL &&
      (roles.includes(RESOURCE_MANAGER_ROLE) ||
        (await this.userHasResourceManagerRole(userId)));

    if (!isAdmin && !isRequester && !isTarget && !isResourceManagerForApproval) {
      throw new ForbiddenException('Access denied.');
    }

    return {
      id: req.id,
      requestNo: req.requestNo,
      status: req.status,
      priority: req.priority,
      topic: ar.topic,
      details: ar.details,
      appointmentType: ar.appointmentType,
      preferredStartAt: ar.preferredStartAt,
      preferredEndAt: ar.preferredEndAt,
      requester: {
        id: ar.requester.id,
        fullName:
          (ar.requester as any).profile?.fullName ??
          (ar.requester as any).email,
      },
      targetUser: {
        id: ar.targetUser.id,
        fullName:
          (ar.targetUser as any).profile?.fullName ??
          (ar.targetUser as any).email,
      },
      actualAppointment: ar.actualAppointment ?? null,
      calendar: this.extractCalendarMetadata(req.dynamicData),
      awaitingManagerApproval: req.status === RequestStatus.WAITING_APPROVAL,
      isResourceManagerViewer: isResourceManagerForApproval,
      statusHistory: req.statusHistory.map((h: any) => ({
        id: h.id,
        status: h.newStatus,
        date: h.changedAt,
        note: h.changeReason,
      })),
      comments: req.comments.map((c: any) => ({
        id: c.id,
        author: c.user?.profile?.fullName ?? c.user?.email ?? 'Unknown',
        content: c.commentText,
        createdAt: c.createdAt,
      })),
    };
  }

  async confirm(
    userId: string,
    roles: string[],
    requestId: string,
    dto: {
      confirmedStartAt?: string;
      confirmedEndAt?: string;
      locationText?: string;
      note?: string;
    },
  ) {
    const ar = await this.prisma.appointmentRequest.findFirst({
      where: { requestId },
    });
    if (!ar) throw new NotFoundException('Appointment request not found.');
    if (ar.targetUserId !== userId) {
      throw new ForbiddenException('Only the target user can confirm.');
    }

    const startAt = dto.confirmedStartAt
      ? new Date(dto.confirmedStartAt)
      : (ar.preferredStartAt ?? new Date());
    const endAt = dto.confirmedEndAt
      ? new Date(dto.confirmedEndAt)
      : (ar.preferredEndAt ?? new Date(startAt.getTime() + 60 * 60 * 1000));

    if (startAt >= endAt) {
      throw new BadRequestException('confirmedStartAt must be before confirmedEndAt.');
    }

    const prevReq = await this.prisma.request.findUnique({
      where: { id: requestId },
    });
    if (!prevReq) throw new NotFoundException('Request not found.');
    if (prevReq.status === RequestStatus.APPROVED) {
      throw new BadRequestException('Already approved.');
    }
    if (prevReq.status === RequestStatus.WAITING_APPROVAL) {
      throw new BadRequestException('Already awaiting manager approval.');
    }
    if (TERMINAL_STATUSES.includes(prevReq.status)) {
      throw new BadRequestException('Request is no longer actionable.');
    }

    await this.validateAgainstAvailability(userId, startAt, endAt);
    const hostConflicts = await this.findConflictingAppointments(
      userId,
      startAt,
      endAt,
      ar.actualAppointmentId,
    );
    const requesterConflicts = await this.findConflictingAppointments(
      ar.requesterUserId,
      startAt,
      endAt,
      ar.actualAppointmentId,
    );
    if (hostConflicts.length > 0 || requesterConflicts.length > 0) {
      throw new BadRequestException(
        'Confirmed time conflicts with an existing appointment.',
      );
    }

    const previousMetadata = this.extractCalendarMetadata(prevReq.dynamicData);
    const nextStatus = RequestStatus.WAITING_APPROVAL;
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.request.update({
        where: { id: requestId },
        data: {
          status: nextStatus,
          currentAssigneeUserId: null,
          dynamicData: this.buildRequestMetadata({
            ...previousMetadata,
            availabilityValidated: true,
            hasConflict: false,
            hostConflictCount: hostConflicts.length,
            requesterConflictCount: requesterConflicts.length,
            targetConfirmedAt: now.toISOString(),
            targetConfirmedByUserId: userId,
            confirmedStartAt: startAt.toISOString(),
            confirmedEndAt: endAt.toISOString(),
            confirmedLocationText: dto.locationText?.trim() || null,
          }),
        },
      });

      await tx.requestStatusHistory.create({
        data: {
          requestId,
          oldStatus: prevReq.status,
          newStatus: nextStatus,
          changedByUserId: userId,
          changeReason:
            dto.note?.trim() ||
            'Target user confirmed. Awaiting Resource Manager approval.',
        },
      });

      if (dto.note?.trim()) {
        await tx.requestComment.create({
          data: { requestId, userId, commentText: dto.note, isInternal: false },
        });
      }
    });

    const managerIds = await this.getResourceManagerUserIds();
    for (const managerId of managerIds) {
      if (managerId === userId) continue;
      void this.notificationsService.createNotification({
        userId: managerId,
        title: 'Appointment Awaiting Manager Approval',
        message: `${ar.topic} was confirmed by host. Resource Manager review required.`,
        requestId,
        actionUrl: '/staff/appointments',
      });
    }

    void this.notificationsService.createNotification({
      userId: ar.requesterUserId,
      title: 'Appointment Pending Manager Approval',
      message:
        'The host confirmed your appointment. Final approval is pending Resource Manager review.',
      requestId,
      actionUrl: '/student/appointments',
    });

    return {
      requestId,
      requesterUserId: ar.requesterUserId,
      status: nextStatus,
      awaitingManagerApproval: true,
    };
  }

  async managerApprove(
    userId: string,
    roles: string[],
    requestId: string,
    dto: { note?: string },
  ) {
    const isResourceManager =
      roles.includes(RESOURCE_MANAGER_ROLE) ||
      (await this.userHasResourceManagerRole(userId));
    if (!isResourceManager) {
      throw new ForbiddenException(
        'Only Resource Managers can perform this action.',
      );
    }

    const ar = await this.prisma.appointmentRequest.findFirst({
      where: { requestId },
    });
    if (!ar) throw new NotFoundException('Appointment request not found.');

    const prevReq = await this.prisma.request.findUnique({
      where: { id: requestId },
    });
    if (!prevReq) throw new NotFoundException('Request not found.');
    if (prevReq.status !== RequestStatus.WAITING_APPROVAL) {
      throw new BadRequestException(
        'Appointment is not awaiting manager approval.',
      );
    }

    const previousMetadata = this.extractCalendarMetadata(prevReq.dynamicData);
    const startAt = previousMetadata.confirmedStartAt
      ? new Date(previousMetadata.confirmedStartAt)
      : (ar.preferredStartAt ?? new Date());
    const endAt = previousMetadata.confirmedEndAt
      ? new Date(previousMetadata.confirmedEndAt)
      : (ar.preferredEndAt ?? new Date(startAt.getTime() + 60 * 60 * 1000));
    const locationText = previousMetadata.confirmedLocationText ?? null;

    const hostConflicts = await this.findConflictingAppointments(
      ar.targetUserId,
      startAt,
      endAt,
      ar.actualAppointmentId,
    );
    const requesterConflicts = await this.findConflictingAppointments(
      ar.requesterUserId,
      startAt,
      endAt,
      ar.actualAppointmentId,
    );
    if (hostConflicts.length > 0 || requesterConflicts.length > 0) {
      throw new BadRequestException(
        'Confirmed time now conflicts with an existing appointment.',
      );
    }

    const confirmResult = await this.prisma.$transaction(async (tx) => {
      const appointment = await tx.appointment.create({
        data: {
          requesterUserId: ar.requesterUserId,
          hostUserId: ar.targetUserId,
          title: ar.topic,
          description: ar.details ?? null,
          locationText,
          startAt,
          endAt,
          status: AppointmentStatus.CONFIRMED,
          confirmedAt: new Date(),
        },
      });

      await tx.appointmentRequest.update({
        where: { id: ar.id },
        data: { actualAppointmentId: appointment.id },
      });

      await tx.request.update({
        where: { id: requestId },
        data: {
          status: RequestStatus.APPROVED,
          currentAssigneeUserId: null,
          closedAt: new Date(),
          dynamicData: this.buildRequestMetadata({
            ...previousMetadata,
            hostConflictCount: hostConflicts.length,
            requesterConflictCount: requesterConflicts.length,
          }),
        },
      });

      await tx.requestStatusHistory.create({
        data: {
          requestId,
          oldStatus: RequestStatus.WAITING_APPROVAL,
          newStatus: RequestStatus.APPROVED,
          changedByUserId: userId,
          changeReason:
            dto.note?.trim() || 'Resource Manager approved the appointment.',
        },
      });

      if (dto.note?.trim()) {
        await tx.requestComment.create({
          data: { requestId, userId, commentText: dto.note, isInternal: false },
        });
      }

      await tx.calendarEvent.deleteMany({ where: { requestId } });

      await tx.calendarEvent.create({
        data: {
          userId: ar.requesterUserId,
          title: `Appointment: ${ar.topic}`,
          description: ar.details ?? null,
          startDate: startAt,
          endDate: endAt,
          requestId,
        },
      });

      await tx.calendarEvent.create({
        data: {
          userId: ar.targetUserId,
          title: `Appointment: ${ar.topic}`,
          description: ar.details ?? null,
          startDate: startAt,
          endDate: endAt,
          requestId,
        },
      });

      return {
        requestId,
        appointmentId: appointment.id,
        requesterUserId: ar.requesterUserId,
        targetUserId: ar.targetUserId,
        status: AppointmentStatus.CONFIRMED,
      };
    });

    void this.notificationsService.createNotification({
      userId: confirmResult.requesterUserId,
      title: 'Appointment Confirmed',
      message: 'Your appointment has been approved by the Resource Manager.',
      requestId,
      actionUrl: '/student/appointments',
    });
    void this.notificationsService.createNotification({
      userId: confirmResult.targetUserId,
      title: 'Appointment Approved',
      message: 'Resource Manager approved the appointment.',
      requestId,
      actionUrl: '/faculty/appointments',
    });
    return confirmResult;
  }

  async managerDecline(
    userId: string,
    roles: string[],
    requestId: string,
    dto: { reason?: string },
  ) {
    const isResourceManager =
      roles.includes(RESOURCE_MANAGER_ROLE) ||
      (await this.userHasResourceManagerRole(userId));
    if (!isResourceManager) {
      throw new ForbiddenException(
        'Only Resource Managers can perform this action.',
      );
    }
    const reason = dto.reason?.trim();
    if (!reason) {
      throw new BadRequestException('A reason is required.');
    }

    const ar = await this.prisma.appointmentRequest.findFirst({
      where: { requestId },
    });
    if (!ar) throw new NotFoundException('Appointment request not found.');

    const prevReq = await this.prisma.request.findUnique({
      where: { id: requestId },
    });
    if (!prevReq) throw new NotFoundException('Request not found.');
    if (prevReq.status !== RequestStatus.WAITING_APPROVAL) {
      throw new BadRequestException(
        'Appointment is not awaiting manager approval.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.request.update({
        where: { id: requestId },
        data: {
          status: RequestStatus.REJECTED,
          currentAssigneeUserId: null,
          closedAt: new Date(),
        },
      });
      await tx.requestStatusHistory.create({
        data: {
          requestId,
          oldStatus: prevReq.status,
          newStatus: RequestStatus.REJECTED,
          changedByUserId: userId,
          changeReason: reason,
        },
      });
      await tx.requestComment.create({
        data: { requestId, userId, commentText: reason, isInternal: false },
      });
    });

    void this.notificationsService.createNotification({
      userId: ar.requesterUserId,
      title: 'Appointment Declined',
      message: reason,
      requestId,
      actionUrl: '/student/appointments',
    });
    void this.notificationsService.createNotification({
      userId: ar.targetUserId,
      title: 'Appointment Declined by Manager',
      message: reason,
      requestId,
      actionUrl: '/faculty/appointments',
    });
    return { requestId, status: RequestStatus.REJECTED };
  }

  async decline(
    userId: string,
    roles: string[],
    requestId: string,
    dto: { reason?: string },
  ) {
    const ar = await this.prisma.appointmentRequest.findFirst({
      where: { requestId },
    });
    if (!ar) throw new NotFoundException('Appointment request not found.');
    if (ar.targetUserId !== userId) {
      throw new ForbiddenException('Only the target user can decline.');
    }

    await this.workflowEngine.processAction(userId, roles, requestId, {
      action: 'reject',
      comment: dto.reason?.trim() || undefined,
    });

    await this.prisma.$transaction(async (tx) => {
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
    });

    void this.notificationsService.createNotification({
      userId: ar.requesterUserId,
      title: 'Appointment Declined',
      message:
        dto.reason?.trim() ?? 'Your appointment request has been declined.',
      requestId,
      actionUrl: '/student/appointments',
    });
    return { requestId, status: RequestStatus.REJECTED };
  }

  async cancel(
    userId: string,
    roles: string[],
    requestId: string,
    dto: { reason?: string },
  ) {
    const ar = await this.prisma.appointmentRequest.findFirst({
      where: { requestId },
    });
    if (!ar) throw new NotFoundException('Appointment request not found.');
    if (ar.requesterUserId !== userId) {
      throw new ForbiddenException('Only the requester can cancel.');
    }

    await this.workflowEngine.processAction(userId, roles, requestId, {
      action: 'cancel',
      comment: dto.reason?.trim() || undefined,
    });

    return this.prisma.$transaction(async (tx) => {
      if (ar.actualAppointmentId) {
        await tx.appointment.update({
          where: { id: ar.actualAppointmentId },
          data: {
            status: AppointmentStatus.CANCELLED,
            cancelledAt: new Date(),
          },
        });
        await tx.calendarEvent.deleteMany({
          where: { requestId },
        });
      }
      return { requestId, status: RequestStatus.CANCELLED };
    });
  }

  async getMyAppointments(userId: string) {
    const appointments = await this.prisma.appointment.findMany({
      where: {
        OR: [{ requesterUserId: userId }, { hostUserId: userId }],
      },
      include: {
        requester: { include: { profile: { select: { fullName: true } } } },
        host: { include: { profile: { select: { fullName: true } } } },
      },
      orderBy: { startAt: 'desc' },
    });

    return appointments.map((a) => ({
      id: a.id,
      title: a.title,
      description: a.description,
      locationText: a.locationText,
      startAt: a.startAt,
      endAt: a.endAt,
      status: a.status,
      confirmedAt: a.confirmedAt,
      host: {
        id: a.host.id,
        fullName: (a.host as any).profile?.fullName ?? (a.host as any).email,
      },
      requester: {
        id: a.requester.id,
        fullName:
          (a.requester as any).profile?.fullName ?? (a.requester as any).email,
      },
    }));
  }

  async getAppointmentById(userId: string, id: string) {
    const a = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        requester: { include: { profile: { select: { fullName: true } } } },
        host: { include: { profile: { select: { fullName: true } } } },
        participants: {
          include: {
            user: { include: { profile: { select: { fullName: true } } } },
          },
        },
      },
    });
    if (!a) throw new NotFoundException('Appointment not found.');
    if (a.requesterUserId !== userId && a.hostUserId !== userId) {
      throw new ForbiddenException('Access denied.');
    }
    return a;
  }
}
