import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service';
import { RequestStatus, PriorityLevel } from '@prisma/client';
import { WorkflowEngineService } from '../workflow/workflow-engine.service';

const EVENT_CREATION_TYPE_KEY = 'EVENT_CREATION_REQUEST';

function makeRequestNo(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `ECR-${ymd}-${Math.floor(Math.random() * 9000) + 1000}`;
}

@Injectable()
export class EventPlansService {
  constructor(
    private prisma: PrismaService,
    private workflowEngine: WorkflowEngineService,
  ) {}

  // ─────────────────────────────────────────────────────────────
  // EventPlan CRUD
  // ─────────────────────────────────────────────────────────────

  async createPlan(
    userId: string,
    dto: {
      title: string;
      description?: string;
      eventType: string;
      tentativeStartAt?: string;
      tentativeEndAt?: string;
      locationPreference?: string;
      targetAttendance?: number;
      minimumAttendance: number;
      registrationStartAt?: string;
      registrationEndAt?: string;
      notes?: string;
      sourceEventRequestId?: string;
      reservationRequestId?: string;
      accessRequestId?: string;
      procurementRequestId?: string;
      equipmentRequestId?: string;
    },
  ) {
    const plan = await this.prisma.$transaction(async (tx) => {
      const [reservation, access, procurement, equipment] = await Promise.all([
        dto.reservationRequestId
          ? tx.roomReservationRequest.findFirst({
              where: {
                id: dto.reservationRequestId,
                request: { requesterUserId: userId },
              },
              include: { request: { select: { status: true } } },
            })
          : null,
        dto.accessRequestId
          ? tx.accessRequest.findFirst({
              where: {
                id: dto.accessRequestId,
                request: { requesterUserId: userId },
              },
              include: { request: { select: { status: true } } },
            })
          : null,
        dto.procurementRequestId
          ? tx.procurementRequest.findFirst({
              where: {
                id: dto.procurementRequestId,
                request: { requesterUserId: userId },
              },
              include: { request: { select: { status: true } } },
            })
          : null,
        dto.equipmentRequestId
          ? tx.equipmentRequest.findFirst({
              where: {
                id: dto.equipmentRequestId,
                request: { requesterUserId: userId },
              },
              include: { request: { select: { status: true } } },
            })
          : null,
      ]);

      if (!reservation || reservation.request.status !== 'APPROVED') {
        throw new BadRequestException(
          'An approved reservation request is required before creating an event plan.',
        );
      }

      if (!access || access.request.status !== 'APPROVED') {
        throw new BadRequestException(
          'An approved access request is required before creating an event plan.',
        );
      }

      if (dto.procurementRequestId && !procurement) {
        throw new BadRequestException('Selected procurement request was not found.');
      }

      if (dto.equipmentRequestId && !equipment) {
        throw new BadRequestException('Selected equipment request was not found.');
      }

      const createdPlan = await tx.eventPlan.create({
        data: {
          organizerUserId: userId,
          title: dto.title,
          description: dto.description,
          eventType: dto.eventType,
          tentativeStartAt: dto.tentativeStartAt
            ? new Date(dto.tentativeStartAt)
            : null,
          tentativeEndAt: dto.tentativeEndAt
            ? new Date(dto.tentativeEndAt)
            : null,
          locationPreference: dto.locationPreference,
          targetAttendance: dto.targetAttendance,
          minimumAttendance: dto.minimumAttendance,
          registrationStartAt: dto.registrationStartAt
            ? new Date(dto.registrationStartAt)
            : null,
          registrationEndAt: dto.registrationEndAt
            ? new Date(dto.registrationEndAt)
            : null,
          notes: dto.notes,
          sourceEventRequestId: dto.sourceEventRequestId,
          status: 'DRAFT',
        },
      });

      await Promise.all([
        tx.roomReservationRequest.update({
          where: { id: reservation.id },
          data: { eventPlanId: createdPlan.id },
        }),
        tx.accessRequest.update({
          where: { id: access.id },
          data: { eventPlanId: createdPlan.id },
        }),
        procurement
          ? tx.procurementRequest.update({
              where: { id: procurement.id },
              data: { eventPlanId: createdPlan.id },
            })
          : Promise.resolve(),
        equipment
          ? tx.equipmentRequest.update({
              where: { id: equipment.id },
              data: { eventPlanId: createdPlan.id },
            })
          : Promise.resolve(),
      ]);

      return createdPlan;
    });

    void this.prisma.auditLog.create({
      data: {
        userId,
        actionType: 'CREATE',
        entityType: 'EventPlan',
        entityId: plan.id,
      },
    });

    return plan;
  }

  async findAllPlans(userId: string, roles: string[]) {
    const isAdmin = roles.includes('ADMIN');
    const where = isAdmin ? {} : { organizerUserId: userId };

    const plans = await this.prisma.eventPlan.findMany({
      where,
      include: {
        organizer: {
          include: { profile: { select: { fullName: true } } },
        },
        preRegistrations: {
          where: { status: 'REGISTERED' },
          select: { id: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return plans.map((p) => ({
      id: p.id,
      title: p.title,
      eventType: p.eventType,
      status: p.status,
      tentativeStartAt: p.tentativeStartAt,
      tentativeEndAt: p.tentativeEndAt,
      minimumAttendance: p.minimumAttendance,
      targetAttendance: p.targetAttendance,
      preRegistrationCount: p.preRegistrations.length,
      organizerName: p.organizer.profile?.fullName ?? p.organizer.email,
      sourceEventRequestId: p.sourceEventRequestId,
      createdAt: p.createdAt,
    }));
  }

  async findPlanById(userId: string, id: string, roles: string[]) {
    const plan = await this.prisma.eventPlan.findUnique({
      where: { id },
      include: {
        organizer: {
          include: { profile: { select: { fullName: true } } },
        },
        preRegistrations: {
          include: {
            user: { include: { profile: { select: { fullName: true } } } },
          },
          orderBy: { registeredAt: 'asc' },
        },
        decisionLogs: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!plan) throw new NotFoundException('Event plan not found.');

    const isAdmin = roles.includes('ADMIN');
    const isOrganizer = plan.organizerUserId === userId;

    if (!isAdmin && !isOrganizer)
      throw new ForbiddenException('Access denied.');

    // Fetch linked prerequisite requests
    const [reservations, accesses, procurements, equipments] =
      await Promise.all([
        this.prisma.roomReservationRequest.findMany({
          where: { eventPlanId: id },
          include: { request: { select: { id: true, requestNo: true, status: true } } },
        }),
        this.prisma.accessRequest.findMany({
          where: { eventPlanId: id },
          include: { request: { select: { id: true, requestNo: true, status: true } } },
        }),
        this.prisma.procurementRequest.findMany({
          where: { eventPlanId: id },
          include: { request: { select: { id: true, requestNo: true, status: true } } },
        }),
        this.prisma.equipmentRequest.findMany({
          where: { eventPlanId: id },
          include: { request: { select: { id: true, requestNo: true, status: true } } },
        }),
      ]);

    // Fetch linked EventCreationRequest if exists
    const creationRequest = await this.prisma.eventCreationRequest.findUnique({
      where: { eventPlanId: id },
      include: { request: { select: { id: true, requestNo: true, status: true } } },
    });

    const readiness = this.evaluateReadiness(
      reservations,
      accesses,
      procurements,
      equipments,
      plan.preRegistrations.filter((r) => r.status === 'REGISTERED').length,
      plan.minimumAttendance,
    );

    return {
      ...plan,
      prerequisites: {
        reservations: reservations.map((r) => ({
          id: r.id,
          requestId: r.requestId,
          requestNo: r.request.requestNo,
          status: r.request.status,
          eventName: r.eventName,
        })),
        accesses: accesses.map((a) => ({
          id: a.id,
          requestId: a.requestId,
          requestNo: a.request.requestNo,
          status: a.request.status,
          accessType: a.accessType,
        })),
        procurements: procurements.map((p) => ({
          id: p.id,
          requestId: p.requestId,
          requestNo: p.request.requestNo,
          status: p.request.status,
          itemName: p.itemName,
        })),
        equipments: equipments.map((e) => ({
          id: e.id,
          requestId: e.requestId,
          requestNo: e.request.requestNo,
          status: e.request.status,
          equipmentName: e.equipmentName,
        })),
      },
      readiness,
      creationRequest: creationRequest
        ? {
            id: creationRequest.id,
            requestId: creationRequest.requestId,
            requestNo: creationRequest.request.requestNo,
            requestStatus: creationRequest.request.status,
            status: creationRequest.status,
          }
        : null,
    };
  }

  async updatePlan(
    userId: string,
    id: string,
    roles: string[],
    dto: Partial<{
      title: string;
      description: string;
      eventType: string;
      tentativeStartAt: string;
      tentativeEndAt: string;
      locationPreference: string;
      targetAttendance: number;
      minimumAttendance: number;
      registrationStartAt: string;
      registrationEndAt: string;
      notes: string;
      status: string;
    }>,
  ) {
    const plan = await this.prisma.eventPlan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('Event plan not found.');
    const isAdmin = roles.includes('ADMIN');
    if (!isAdmin && plan.organizerUserId !== userId)
      throw new ForbiddenException('Access denied.');

    return this.prisma.eventPlan.update({
      where: { id },
      data: {
        ...dto,
        tentativeStartAt: dto.tentativeStartAt
          ? new Date(dto.tentativeStartAt)
          : undefined,
        tentativeEndAt: dto.tentativeEndAt
          ? new Date(dto.tentativeEndAt)
          : undefined,
        registrationStartAt: dto.registrationStartAt
          ? new Date(dto.registrationStartAt)
          : undefined,
        registrationEndAt: dto.registrationEndAt
          ? new Date(dto.registrationEndAt)
          : undefined,
      },
    });
  }

  async cancelPlan(
    userId: string,
    id: string,
    roles: string[],
    reason?: string,
  ) {
    const plan = await this.prisma.eventPlan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('Event plan not found.');
    const isAdmin = roles.includes('ADMIN');
    if (!isAdmin && plan.organizerUserId !== userId)
      throw new ForbiddenException('Access denied.');

    const updated = await this.prisma.eventPlan.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    await this.prisma.eventDecisionLog.create({
      data: {
        eventPlanId: id,
        decidedByUserId: userId,
        decisionType: 'CANCELLED',
        reason: reason ?? 'Cancelled by organizer.',
      },
    });

    return updated;
  }

  // ─────────────────────────────────────────────────────────────
  // Pre-registration
  // ─────────────────────────────────────────────────────────────

  async registerForPlan(userId: string, planId: string) {
    const plan = await this.prisma.eventPlan.findUnique({
      where: { id: planId },
    });
    if (!plan) throw new NotFoundException('Event plan not found.');
    if (plan.status !== 'REGISTRATION_OPEN')
      throw new BadRequestException('Pre-registration is not open.');

    const now = new Date();
    if (plan.registrationStartAt && now < plan.registrationStartAt)
      throw new BadRequestException('Pre-registration period has not started.');
    if (plan.registrationEndAt && now > plan.registrationEndAt)
      throw new BadRequestException('Pre-registration period has ended.');

    const existing = await this.prisma.eventPlanRegistration.findUnique({
      where: { eventPlanId_userId: { eventPlanId: planId, userId } },
    });

    if (existing) {
      if (existing.status === 'REGISTERED')
        throw new BadRequestException('Already registered.');
      return this.prisma.eventPlanRegistration.update({
        where: { id: existing.id },
        data: { status: 'REGISTERED' },
      });
    }

    return this.prisma.eventPlanRegistration.create({
      data: { eventPlanId: planId, userId, status: 'REGISTERED' },
    });
  }

  async cancelPlanRegistration(userId: string, planId: string) {
    const reg = await this.prisma.eventPlanRegistration.findUnique({
      where: { eventPlanId_userId: { eventPlanId: planId, userId } },
    });
    if (!reg || reg.status !== 'REGISTERED')
      throw new NotFoundException('Registration not found.');

    return this.prisma.eventPlanRegistration.update({
      where: { id: reg.id },
      data: { status: 'CANCELLED' },
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Decision: extend / reschedule
  // ─────────────────────────────────────────────────────────────

  async recordDecision(
    userId: string,
    planId: string,
    roles: string[],
    dto: {
      decisionType: 'EXTENDED_REGISTRATION' | 'RESCHEDULED' | 'CANCELLED';
      reason?: string;
      newRegistrationEndAt?: string;
      newStartAt?: string;
    },
  ) {
    const plan = await this.prisma.eventPlan.findUnique({
      where: { id: planId },
    });
    if (!plan) throw new NotFoundException('Event plan not found.');
    const isAdmin = roles.includes('ADMIN');
    if (!isAdmin && plan.organizerUserId !== userId)
      throw new ForbiddenException('Access denied.');

    const updateData: Record<string, unknown> = {};

    if (dto.decisionType === 'EXTENDED_REGISTRATION' && dto.newRegistrationEndAt) {
      updateData.registrationEndAt = new Date(dto.newRegistrationEndAt);
      updateData.status = 'REGISTRATION_OPEN';
    } else if (dto.decisionType === 'RESCHEDULED' && dto.newStartAt) {
      updateData.tentativeStartAt = new Date(dto.newStartAt);
    } else if (dto.decisionType === 'CANCELLED') {
      updateData.status = 'CANCELLED';
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.eventPlan.update({
        where: { id: planId },
        data: updateData,
      }),
      this.prisma.eventDecisionLog.create({
        data: {
          eventPlanId: planId,
          decidedByUserId: userId,
          decisionType: dto.decisionType,
          reason: dto.reason,
          oldStartAt: plan.tentativeStartAt,
          newStartAt: dto.newStartAt ? new Date(dto.newStartAt) : null,
          oldRegistrationEndAt: plan.registrationEndAt,
          newRegistrationEndAt: dto.newRegistrationEndAt
            ? new Date(dto.newRegistrationEndAt)
            : null,
        },
      }),
    ]);

    return updated;
  }

  // ─────────────────────────────────────────────────────────────
  // EventCreationRequest
  // ─────────────────────────────────────────────────────────────

  async createEventCreationRequest(
    userId: string,
    planId: string,
    roles: string[],
    dto: {
      title: string;
      description?: string;
      eventType: string;
      proposedStartAt: string;
      proposedEndAt: string;
      locationText?: string;
      minimumAttendance: number;
      targetAttendance?: number;
      registrationStartAt: string;
      registrationEndAt: string;
      expectedBudget?: number;
    },
  ) {
    const plan = await this.prisma.eventPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Event plan not found.');
    const isAdmin = roles.includes('ADMIN');
    if (!isAdmin && plan.organizerUserId !== userId)
      throw new ForbiddenException('Access denied.');

    // Check readiness
    const [reservations, accesses, procurements, equipments, preRegCount] =
      await Promise.all([
        this.prisma.roomReservationRequest.findMany({
          where: { eventPlanId: planId },
          include: { request: { select: { status: true } } },
        }),
        this.prisma.accessRequest.findMany({
          where: { eventPlanId: planId },
          include: { request: { select: { status: true } } },
        }),
        this.prisma.procurementRequest.findMany({
          where: { eventPlanId: planId },
          include: { request: { select: { status: true } } },
        }),
        this.prisma.equipmentRequest.findMany({
          where: { eventPlanId: planId },
          include: { request: { select: { status: true } } },
        }),
        this.prisma.eventPlanRegistration.count({
          where: { eventPlanId: planId, status: 'REGISTERED' },
        }),
      ]);

    const readiness = this.evaluateReadiness(
      reservations,
      accesses,
      procurements,
      equipments,
      preRegCount,
      plan.minimumAttendance,
    );

    if (!readiness.isEligible && !isAdmin) {
      throw new BadRequestException(
        `Not eligible for event creation: ${readiness.blockers.join(', ')}`,
      );
    }

    // Check existing creation request
    const existing = await this.prisma.eventCreationRequest.findUnique({
      where: { eventPlanId: planId },
    });
    if (existing)
      throw new BadRequestException(
        'An event creation request already exists for this plan.',
      );

    const rt = await this.prisma.requestType.findUnique({
      where: { key: EVENT_CREATION_TYPE_KEY },
    });
    if (!rt)
      throw new BadRequestException(
        'EVENT_CREATION_REQUEST type not configured.',
      );

    const requestNo = makeRequestNo();

    const result = await this.prisma.$transaction(async (tx) => {
      const initialStatus = RequestStatus.SUBMITTED;

      const request = await tx.request.create({
        data: {
          requestNo,
          title: dto.title,
          requestTypeId: rt.id,
          requesterUserId: userId,
          status: initialStatus,
          priority: PriorityLevel.HIGH,
          submittedAt: new Date(),
          eventCreationRequest: {
            create: {
              eventPlanId: planId,
              organizerUserId: userId,
              title: dto.title,
              description: dto.description,
              eventType: dto.eventType,
              proposedStartAt: new Date(dto.proposedStartAt),
              proposedEndAt: new Date(dto.proposedEndAt),
              locationText: dto.locationText,
              minimumAttendance: dto.minimumAttendance,
              targetAttendance: dto.targetAttendance,
              registrationStartAt: new Date(dto.registrationStartAt),
              registrationEndAt: new Date(dto.registrationEndAt),
              expectedBudget: dto.expectedBudget,
              status: 'PENDING',
            },
          },
        },
        include: { eventCreationRequest: true },
      });

      await tx.requestStatusHistory.create({
        data: {
          requestId: request.id,
          oldStatus: null,
          newStatus: initialStatus,
          changedByUserId: userId,
          changeReason: 'Event creation request submitted.',
        },
      });

      if (rt.workflowDefinitionId) {
        const wfStatus = await this.workflowEngine.bootstrapInstance(
          tx,
          request.id,
          rt.workflowDefinitionId,
        );
        if (wfStatus && wfStatus !== initialStatus) {
          await tx.request.update({
            where: { id: request.id },
            data: { status: wfStatus },
          });
          await tx.requestStatusHistory.create({
            data: {
              requestId: request.id,
              oldStatus: initialStatus,
              newStatus: wfStatus,
              changedByUserId: userId,
              changeReason: 'Workflow started.',
            },
          });
        }
      }

      await tx.eventPlan.update({
        where: { id: planId },
        data: { status: 'WAITING_EVENT_CREATION_APPROVAL' },
      });

      return request;
    });

    void this.prisma.auditLog.create({
      data: {
        userId,
        actionType: 'CREATE',
        entityType: 'EventCreationRequest',
        entityId: result.id,
      },
    });

    return { requestNo: result.requestNo, requestId: result.id };
  }

  // ─────────────────────────────────────────────────────────────
  // Readiness evaluator
  // ─────────────────────────────────────────────────────────────

  private evaluateReadiness(
    reservations: { request: { status: string } }[],
    accesses: { request: { status: string } }[],
    procurements: { request: { status: string } }[],
    equipments: { request: { status: string } }[],
    preRegCount: number,
    minimumAttendance: number,
  ) {
    const allApproved = (items: { request: { status: string } }[]) =>
      items.length === 0 ||
      items.every((i) => i.request.status === 'APPROVED');

    const blockers: string[] = [];

    const reservationOk = allApproved(reservations);
    const accessOk = allApproved(accesses);
    const procurementOk = allApproved(procurements);
    const equipmentOk = allApproved(equipments);
    const preRegOk = preRegCount >= minimumAttendance;

    if (!reservationOk) blockers.push('Reservation not approved');
    if (!accessOk) blockers.push('Access request not approved');
    if (!preRegOk)
      blockers.push(
        `Insufficient pre-registrations (${preRegCount}/${minimumAttendance})`,
      );

    return {
      reservationApproved: reservationOk,
      accessApproved: accessOk,
      procurementApproved: procurementOk,
      equipmentApproved: equipmentOk,
      preRegistrationCount: preRegCount,
      minimumAttendance,
      isEligible: blockers.length === 0,
      blockers,
    };
  }
}
