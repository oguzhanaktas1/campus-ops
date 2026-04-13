import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service';

@Injectable()
export class PublicEventsService {
  constructor(private prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────────
  // Published Events (student-facing)
  // ─────────────────────────────────────────────────────────────

  async findPublishedEvents() {
    const events = await this.prisma.event.findMany({
      where: {
        status: {
          in: ['PUBLISHED', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'CONFIRMED'],
        },
      },
      include: {
        organizer: {
          include: { profile: { select: { fullName: true } } },
        },
      },
      orderBy: { startAt: 'asc' },
    });

    return events.map((e) => ({
      id: e.id,
      title: e.title,
      eventType: e.eventType,
      locationText: e.locationText,
      startAt: e.startAt,
      endAt: e.endAt,
      status: e.status,
      minimumAttendance: e.minimumAttendance,
      targetAttendance: e.targetAttendance,
      registrationCount: e.registrationCount,
      registrationStartAt: e.registrationStartAt,
      registrationEndAt: e.registrationEndAt,
      publishedAt: e.publishedAt,
      organizerName: e.organizer.profile?.fullName ?? e.organizer.email,
    }));
  }

  async findEventById(eventId: string, userId?: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        organizer: {
          include: { profile: { select: { fullName: true, title: true } } },
        },
      },
    });

    if (!event) throw new NotFoundException('Event not found.');

    let userRegistration: { status: string } | null = null;
    if (userId) {
      const reg = await this.prisma.eventRegistration.findUnique({
        where: { eventId_userId: { eventId, userId } },
      });
      if (reg) userRegistration = { status: reg.status };
    }

    return {
      ...event,
      organizerName: event.organizer.profile?.fullName ?? event.organizer.email,
      organizerTitle: event.organizer.profile?.title,
      userRegistration,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // EventRegistration
  // ─────────────────────────────────────────────────────────────

  async register(userId: string, eventId: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found.');

    if (event.status !== 'REGISTRATION_OPEN')
      throw new BadRequestException('Registration is not open for this event.');

    const now = new Date();
    if (event.registrationStartAt && now < event.registrationStartAt)
      throw new BadRequestException('Registration period has not started.');
    if (event.registrationEndAt && now > event.registrationEndAt)
      throw new BadRequestException('Registration period has ended.');

    const existing = await this.prisma.eventRegistration.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });

    if (existing) {
      if (existing.status === 'REGISTERED')
        throw new BadRequestException('Already registered for this event.');
      const updated = await this.prisma.eventRegistration.update({
        where: { id: existing.id },
        data: { status: 'REGISTERED', cancelledAt: null },
      });
      await this.prisma.event.update({
        where: { id: eventId },
        data: { registrationCount: { increment: 1 } },
      });
      return updated;
    }

    const [reg] = await this.prisma.$transaction([
      this.prisma.eventRegistration.create({
        data: { eventId, userId, status: 'REGISTERED' },
      }),
      this.prisma.event.update({
        where: { id: eventId },
        data: { registrationCount: { increment: 1 } },
      }),
    ]);

    return reg;
  }

  async cancelRegistration(userId: string, eventId: string) {
    const reg = await this.prisma.eventRegistration.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });
    if (!reg || reg.status !== 'REGISTERED')
      throw new NotFoundException('Registration not found.');

    const [updated] = await this.prisma.$transaction([
      this.prisma.eventRegistration.update({
        where: { id: reg.id },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      }),
      this.prisma.event.update({
        where: { id: eventId },
        data: { registrationCount: { decrement: 1 } },
      }),
    ]);

    return updated;
  }

  // ─────────────────────────────────────────────────────────────
  // Organizer: manage own events
  // ─────────────────────────────────────────────────────────────

  async findOrganizerEvents(userId: string, roles: string[]) {
    const isAdmin = roles.includes('ADMIN');
    const where = isAdmin ? {} : { organizerUserId: userId };

    return this.prisma.event.findMany({
      where,
      include: {
        organizer: {
          include: { profile: { select: { fullName: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async publishEvent(userId: string, eventId: string, roles: string[]) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found.');
    const isAdmin = roles.includes('ADMIN');
    if (!isAdmin && event.organizerUserId !== userId)
      throw new ForbiddenException('Access denied.');

    return this.prisma.event.update({
      where: { id: eventId },
      data: {
        status: 'REGISTRATION_OPEN',
        publishedAt: new Date(),
      },
    });
  }

  async confirmEvent(userId: string, eventId: string, roles: string[]) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found.');
    const isAdmin = roles.includes('ADMIN');
    if (!isAdmin && event.organizerUserId !== userId)
      throw new ForbiddenException('Access denied.');

    return this.prisma.event.update({
      where: { id: eventId },
      data: { status: 'CONFIRMED', confirmedAt: new Date() },
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Create Event from approved EventCreationRequest (internal/admin)
  // ─────────────────────────────────────────────────────────────

  async createEventFromApprovedRequest(
    userId: string,
    creationRequestId: string,
    roles: string[],
  ) {
    const ecr = await this.prisma.eventCreationRequest.findUnique({
      where: { id: creationRequestId },
      include: { request: true },
    });

    if (!ecr) throw new NotFoundException('Event creation request not found.');
    if (ecr.request.status !== 'APPROVED')
      throw new BadRequestException('Event creation request is not yet approved.');

    const isAdmin = roles.includes('ADMIN');
    if (!isAdmin && ecr.organizerUserId !== userId)
      throw new ForbiddenException('Access denied.');

    // Check if event already created
    const existing = await this.prisma.event.findFirst({
      where: { eventCreationRequestId: creationRequestId },
    });
    if (existing)
      throw new BadRequestException('Event already created from this request.');

    const event = await this.prisma.event.create({
      data: {
        eventPlanId: ecr.eventPlanId,
        eventCreationRequestId: creationRequestId,
        organizerUserId: ecr.organizerUserId,
        title: ecr.title,
        description: ecr.description,
        eventType: ecr.eventType,
        locationText: ecr.locationText,
        startAt: ecr.proposedStartAt,
        endAt: ecr.proposedEndAt,
        minimumAttendance: ecr.minimumAttendance,
        targetAttendance: ecr.targetAttendance,
        registrationStartAt: ecr.registrationStartAt,
        registrationEndAt: ecr.registrationEndAt,
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });

    // Update ECR status and EventPlan status
    await this.prisma.$transaction([
      this.prisma.eventCreationRequest.update({
        where: { id: creationRequestId },
        data: { status: 'APPROVED' },
      }),
      this.prisma.eventPlan.update({
        where: { id: ecr.eventPlanId },
        data: { status: 'EVENT_CREATED' },
      }),
    ]);

    void this.prisma.auditLog.create({
      data: {
        userId,
        actionType: 'CREATE',
        entityType: 'Event',
        entityId: event.id,
      },
    });

    return event;
  }
}
