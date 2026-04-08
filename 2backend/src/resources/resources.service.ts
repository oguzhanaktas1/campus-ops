import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service';
import { ResourceType } from '@prisma/client';

@Injectable()
export class ResourcesService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters?: {
    resourceType?: ResourceType;
    campusId?: string;
    facultyId?: string;
    departmentId?: string;
    unitId?: string;
  }) {
    return this.prisma.resource.findMany({
      where: {
        isActive: true,
        ...(filters?.resourceType && { resourceType: filters.resourceType }),
        ...(filters?.campusId && { campusId: filters.campusId }),
        ...(filters?.facultyId && { facultyId: filters.facultyId }),
        ...(filters?.departmentId && { departmentId: filters.departmentId }),
        ...(filters?.unitId && { unitId: filters.unitId }),
      },
      include: {
        campus: { select: { id: true, name: true } },
        faculty: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        unit: { select: { id: true, name: true } },
        availabilitySlots: {
          orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string) {
    const r = await this.prisma.resource.findUnique({
      where: { id },
      include: {
        campus: { select: { id: true, name: true } },
        faculty: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        unit: { select: { id: true, name: true } },
        availabilitySlots: {
          orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        },
      },
    });
    if (!r) throw new NotFoundException('Resource not found.');
    return r;
  }

  async findAvailability(id: string) {
    const resource = await this.prisma.resource.findUnique({ where: { id } });
    if (!resource) throw new NotFoundException('Resource not found.');

    const slots = await this.prisma.resourceAvailability.findMany({
      where: { resourceId: id },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });

    // Upcoming booked slots for the next 30 days
    const now = new Date();
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const bookedSlots = await this.prisma.reservation.findMany({
      where: {
        resourceId: id,
        status: { in: ['APPROVED', 'ACTIVE'] },
        startAt: { gte: now, lte: thirtyDaysLater },
      },
      select: { id: true, title: true, startAt: true, endAt: true, status: true },
      orderBy: { startAt: 'asc' },
    });

    return { slots, bookedSlots };
  }
}
