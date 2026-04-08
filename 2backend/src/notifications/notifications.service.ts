import { Injectable } from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service';
import { NotificationStatus, NotificationType } from '@prisma/client';

export interface CreateNotificationDto {
  userId: string;
  title: string;
  message: string;
  type?: NotificationType;
  requestId?: string;
  actionUrl?: string;
}

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async getMyNotifications(userId: string) {
    const notifications = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const unreadCount = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { notifications, unreadCount };
  }

  async markRead(userId: string, notifId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notifId, userId },
      data: { isRead: true, readAt: new Date(), status: NotificationStatus.READ },
    });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date(), status: NotificationStatus.READ },
    });
  }

  async getPreferences(userId: string) {
    let prefs = await this.prisma.notificationPreference.findUnique({ where: { userId } });
    if (!prefs) {
      prefs = await this.prisma.notificationPreference.create({
        data: { userId },
      });
    }
    return prefs;
  }

  async updatePreferences(userId: string, dto: Partial<{
    emailEnabled: boolean;
    inAppEnabled: boolean;
    marketingEmailEnabled: boolean;
    reminderEmailEnabled: boolean;
  }>) {
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      update: dto,
      create: { userId, ...dto },
    });
  }

  async deleteNotifications(userId: string, ids: string[]) {
    return this.prisma.notification.deleteMany({
      where: { id: { in: ids }, userId },
    });
  }

  // ── HELPER: create a notification (fire-and-forget safe) ──────────────────
  async createNotification(dto: CreateNotificationDto) {
    try {
      return await this.prisma.notification.create({
        data: {
          userId: dto.userId,
          type: dto.type ?? NotificationType.IN_APP,
          title: dto.title,
          message: dto.message,
          requestId: dto.requestId ?? null,
          actionUrl: dto.actionUrl ?? null,
          status: NotificationStatus.SENT,
        },
      });
    } catch {
      // Non-blocking — never crash caller
    }
  }

  // ── HELPER: log an email (no actual sending) ─────────────────────────────
  async logEmail(dto: {
    userId?: string;
    requestId?: string;
    toEmail: string;
    subject: string;
    templateKey?: string;
  }) {
    try {
      return await this.prisma.emailLog.create({
        data: {
          userId: dto.userId ?? null,
          requestId: dto.requestId ?? null,
          toEmail: dto.toEmail,
          subject: dto.subject,
          templateKey: dto.templateKey ?? null,
          status: NotificationStatus.PENDING,
        },
      });
    } catch {
      // Non-blocking
    }
  }
}
