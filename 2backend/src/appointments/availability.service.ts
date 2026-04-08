import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service';

export interface AvailabilitySlotDto {
  dayOfWeek: number;   // 0 = Sunday … 6 = Saturday
  startTime: string;   // "HH:mm"
  endTime: string;     // "HH:mm"
  isActive?: boolean;
}

@Injectable()
export class AvailabilityService {
  constructor(private prisma: PrismaService) {}

  async getAvailability(userId: string) {
    return this.prisma.userAvailabilitySlot.findMany({
      where: { userId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  async replaceAvailability(userId: string, slots: AvailabilitySlotDto[]) {
    for (const s of slots) {
      if (s.dayOfWeek < 0 || s.dayOfWeek > 6) {
        throw new BadRequestException(`Invalid dayOfWeek: ${s.dayOfWeek}`);
      }
      if (s.startTime >= s.endTime) {
        throw new BadRequestException('startTime must be before endTime.');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userAvailabilitySlot.deleteMany({ where: { userId } });
      if (slots.length > 0) {
        await tx.userAvailabilitySlot.createMany({
          data: slots.map((s) => ({
            userId,
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
            isActive: s.isActive !== false,
          })),
        });
      }
    });

    return this.getAvailability(userId);
  }
}
