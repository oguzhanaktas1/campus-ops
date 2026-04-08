import { Injectable } from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service';

@Injectable()
export class CalendarService {
  constructor(private prisma: PrismaService) {}

  async getMyEvents(userId: string) {
    return this.prisma.calendarEvent.findMany({
      where: { userId },
      orderBy: { startDate: 'asc' },
      select: {
        id: true,
        title: true,
        description: true,
        startDate: true,
        endDate: true,
        requestId: true,
        createdAt: true,
      },
    });
  }
}
