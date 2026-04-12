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
  PriorityLevel,
  RequestStatus,
} from '@prisma/client';

const APPOINTMENT_TYPE_KEY = 'APPOINTMENT';

function makeRequestNo(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `APT-${ymd}-${Math.floor(Math.random() * 9000) + 1000}`;
}

@Injectable()
export class AppointmentsService {
  constructor(
    private prisma: PrismaService,
    private workflowEngine: WorkflowEngineService,
    private notificationsService: NotificationsService,
  ) {}

  // ── HELPERS ────────────────────────────────────────────────────────────────

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

  private toListItem(ar: any) {
    const req = ar.request;
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
      createdAt: ar.createdAt,
    };
  }

  // ── FACULTY/STAFF LIST FOR FORM ────────────────────────────────────────────

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

  // ── CREATE REQUEST ─────────────────────────────────────────────────────────

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
    });
    if (!target) throw new NotFoundException('Target user not found.');
    if (dto.targetUserId === userId)
      throw new BadRequestException('Cannot book appointment with yourself.');

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

      // Bootstrap workflow if defined
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

      return { requestId: req.id, requestNo: req.requestNo };
    });

    void this.notificationsService.createNotification({
      userId: dto.targetUserId,
      title: 'New Appointment Request',
      message: `${dto.topic} — appointment requested.`,
      actionUrl: '/faculty/appointments',
    });
    return result;
  }

  // ── MY REQUESTS (as requester) ─────────────────────────────────────────────

  async findMy(userId: string) {
    const records = await this.prisma.appointmentRequest.findMany({
      where: { requesterUserId: userId },
      include: {
        request: {
          select: { id: true, requestNo: true, status: true, priority: true },
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

  // ── INCOMING (as target) ───────────────────────────────────────────────────

  async findIncoming(userId: string) {
    const records = await this.prisma.appointmentRequest.findMany({
      where: { targetUserId: userId },
      include: {
        request: {
          select: { id: true, requestNo: true, status: true, priority: true },
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

  // ── DETAIL ─────────────────────────────────────────────────────────────────

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

    if (!isAdmin && !isRequester && !isTarget) {
      throw new ForbiddenException('Access denied.');
    }

    const req = ar.request as any;
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

  // ── CONFIRM ────────────────────────────────────────────────────────────────

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
    if (ar.targetUserId !== userId)
      throw new ForbiddenException('Only the target user can confirm.');

    const startAt = dto.confirmedStartAt
      ? new Date(dto.confirmedStartAt)
      : (ar.preferredStartAt ?? new Date());
    const endAt = dto.confirmedEndAt
      ? new Date(dto.confirmedEndAt)
      : (ar.preferredEndAt ?? new Date(startAt.getTime() + 60 * 60 * 1000));

    const prevReq = await this.prisma.request.findUnique({
      where: { id: requestId },
    });
    if (prevReq?.status === RequestStatus.APPROVED) {
      throw new BadRequestException('Already confirmed.');
    }

    await this.workflowEngine.processAction(userId, roles, requestId, {
      action: 'approve',
      comment: dto.note?.trim() || undefined,
    });

    const confirmResult = await this.prisma.$transaction(async (tx) => {
      const appointment = await tx.appointment.create({
        data: {
          requesterUserId: ar.requesterUserId,
          hostUserId: userId,
          title: ar.topic,
          description: ar.details ?? null,
          locationText: dto.locationText ?? null,
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

      if (dto.note?.trim()) {
        await tx.requestComment.create({
          data: { requestId, userId, commentText: dto.note, isInternal: false },
        });
      }

      // CalendarEvent for requester
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

      // CalendarEvent for host
      await tx.calendarEvent.create({
        data: {
          userId,
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
        status: AppointmentStatus.CONFIRMED,
      };
    });

    void this.notificationsService.createNotification({
      userId: confirmResult.requesterUserId,
      title: 'Appointment Confirmed',
      message: `Your appointment request has been confirmed.`,
      requestId,
      actionUrl: '/student/appointments',
    });
    return confirmResult;
  }

  // ── DECLINE ────────────────────────────────────────────────────────────────

  async decline(userId: string, roles: string[], requestId: string, dto: { reason?: string }) {
    const ar = await this.prisma.appointmentRequest.findFirst({
      where: { requestId },
    });
    if (!ar) throw new NotFoundException('Appointment request not found.');
    if (ar.targetUserId !== userId)
      throw new ForbiddenException('Only the target user can decline.');

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

  // ── CANCEL ─────────────────────────────────────────────────────────────────

  async cancel(userId: string, roles: string[], requestId: string, dto: { reason?: string }) {
    const ar = await this.prisma.appointmentRequest.findFirst({
      where: { requestId },
    });
    if (!ar) throw new NotFoundException('Appointment request not found.');
    if (ar.requesterUserId !== userId)
      throw new ForbiddenException('Only the requester can cancel.');

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
      }
      return { requestId, status: RequestStatus.CANCELLED };
    });
  }

  // ── MY APPOINTMENTS (confirmed/actual) ────────────────────────────────────

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

  // ── APPOINTMENT DETAIL ────────────────────────────────────────────────────

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
    if (a.requesterUserId !== userId && a.hostUserId !== userId)
      throw new ForbiddenException('Access denied.');
    return a;
  }
}
