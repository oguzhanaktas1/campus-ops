import { Injectable } from '@nestjs/common';
import { AppointmentStatus, ReservationStatus } from '@prisma/client';
import { PrismaService } from '../core/prisma/prisma.service';

type CalendarRange = {
  start?: Date;
  end?: Date;
};

type CalendarEventItem = {
  id: string;
  sourceId: string;
  sourceType: 'calendar_event' | 'appointment' | 'reservation';
  type: 'appointment' | 'reservation';
  title: string;
  description: string | null;
  startDate: Date;
  endDate: Date;
  status: string;
  requestId: string | null;
  location: string | null;
};

@Injectable()
export class CalendarService {
  constructor(private prisma: PrismaService) {}

  private buildDateFilter(fieldStart: string, fieldEnd: string, range: CalendarRange) {
    if (!range.start && !range.end) {
      return {};
    }

    return {
      AND: [
        ...(range.end ? [{ [fieldStart]: { lt: range.end } }] : []),
        ...(range.start ? [{ [fieldEnd]: { gt: range.start } }] : []),
      ],
    };
  }

  private escapeIcsText(value: string | null | undefined) {
    return (value ?? '')
      .replace(/\\/g, '\\\\')
      .replace(/\r?\n/g, '\\n')
      .replace(/,/g, '\\,')
      .replace(/;/g, '\\;');
  }

  private toUtcStamp(date: Date) {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  }

  async getMyEvents(userId: string, range: CalendarRange = {}) {
    const [calendarEvents, appointments, reservations] = await Promise.all([
      this.prisma.calendarEvent.findMany({
        where: {
          userId,
          ...this.buildDateFilter('startDate', 'endDate', range),
        },
        orderBy: { startDate: 'asc' },
      }),
      this.prisma.appointment.findMany({
        where: {
          OR: [{ requesterUserId: userId }, { hostUserId: userId }],
          status: { in: [AppointmentStatus.CONFIRMED, AppointmentStatus.REQUESTED] },
          ...this.buildDateFilter('startAt', 'endAt', range),
        },
        orderBy: { startAt: 'asc' },
      }),
      this.prisma.reservation.findMany({
        where: {
          reservedByUserId: userId,
          status: {
            in: [ReservationStatus.PENDING, ReservationStatus.APPROVED, ReservationStatus.ACTIVE],
          },
          ...this.buildDateFilter('startAt', 'endAt', range),
        },
        include: {
          resource: { select: { name: true, locationText: true } },
        },
        orderBy: { startAt: 'asc' },
      }),
    ]);

    const items: CalendarEventItem[] = [
      ...calendarEvents.map((event) => ({
        id: `cal-${event.id}`,
        sourceId: event.id,
        sourceType: 'calendar_event' as const,
        type: 'appointment' as const,
        title: event.title,
        description: event.description ?? null,
        startDate: event.startDate,
        endDate: event.endDate,
        status: 'CONFIRMED',
        requestId: event.requestId ?? null,
        location: null,
      })),
      ...appointments.map((appointment) => ({
        id: `apt-${appointment.id}`,
        sourceId: appointment.id,
        sourceType: 'appointment' as const,
        type: 'appointment' as const,
        title: appointment.title,
        description: appointment.description ?? null,
        startDate: appointment.startAt,
        endDate: appointment.endAt,
        status: appointment.status,
        requestId: null,
        location: appointment.locationText ?? appointment.meetingUrl ?? null,
      })),
      ...reservations.map((reservation) => ({
        id: `res-${reservation.id}`,
        sourceId: reservation.id,
        sourceType: 'reservation' as const,
        type: 'reservation' as const,
        title: reservation.title,
        description: reservation.description ?? null,
        startDate: reservation.startAt,
        endDate: reservation.endAt,
        status: reservation.status,
        requestId: reservation.requestId ?? null,
        location: reservation.resource?.locationText ?? reservation.resource?.name ?? null,
      })),
    ];

    const deduped = new Map<string, CalendarEventItem>();
    for (const item of items) {
      const key = item.requestId
        ? `${item.type}:${item.requestId}:${item.startDate.toISOString()}`
        : `${item.sourceType}:${item.sourceId}`;
      if (!deduped.has(key)) {
        deduped.set(key, item);
      }
    }

    return Array.from(deduped.values()).sort(
      (a, b) => a.startDate.getTime() - b.startDate.getTime(),
    );
  }

  async exportMyEventsAsIcs(userId: string, range: CalendarRange = {}) {
    const events = await this.getMyEvents(userId, range);
    const generatedAt = this.toUtcStamp(new Date());

    const body = events
      .map((event) =>
        [
          'BEGIN:VEVENT',
          `UID:${this.escapeIcsText(event.id)}@campusops`,
          `DTSTAMP:${generatedAt}`,
          `DTSTART:${this.toUtcStamp(event.startDate)}`,
          `DTEND:${this.toUtcStamp(event.endDate)}`,
          `SUMMARY:${this.escapeIcsText(event.title)}`,
          `DESCRIPTION:${this.escapeIcsText(event.description)}`,
          ...(event.location
            ? [`LOCATION:${this.escapeIcsText(event.location)}`]
            : []),
          'END:VEVENT',
        ].join('\r\n'),
      )
      .join('\r\n');

    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//CampusOps//Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      body,
      'END:VCALENDAR',
      '',
    ].join('\r\n');
  }
}
