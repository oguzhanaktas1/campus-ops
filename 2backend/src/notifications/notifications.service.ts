import { Injectable, Optional } from '@nestjs/common';
import { NotificationStatus, NotificationType } from '@prisma/client';
import { CacheService } from '../infrastructure/cache/cache.service';
import { CacheKeys, CacheTtls } from '../infrastructure/cache/cache-keys';
import { PrismaService } from '../core/prisma/prisma.service';
import type { RealtimeService } from '../realtime/realtime.service';

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
  constructor(
    private prisma: PrismaService,
    private cacheService: CacheService,
    @Optional() private realtimeService?: RealtimeService,
  ) {}

  async getMyNotifications(userId: string) {
    const notifications = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const unreadCount = await this.cacheService.getOrSet(
      CacheKeys.notificationsUnread(userId),
      CacheTtls.notifications,
      () =>
        this.prisma.notification.count({
          where: { userId, isRead: false },
        }),
    );
    return { notifications, unreadCount };
  }

  async markRead(userId: string, notifId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { id: notifId, userId },
      data: {
        isRead: true,
        readAt: new Date(),
        status: NotificationStatus.READ,
      },
    });
    if (result.count > 0) {
      await this.cacheService.decr(CacheKeys.notificationsUnread(userId));
    }
    return result;
  }

  async markAllRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: {
        isRead: true,
        readAt: new Date(),
        status: NotificationStatus.READ,
      },
    });
    await this.cacheService.set(
      CacheKeys.notificationsUnread(userId),
      0,
      CacheTtls.notifications,
    );
    return result;
  }

  async getPreferences(userId: string) {
    let prefs = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });
    if (!prefs) {
      prefs = await this.prisma.notificationPreference.create({
        data: { userId },
      });
    }
    return prefs;
  }

  async updatePreferences(
    userId: string,
    dto: Partial<{
      emailEnabled: boolean;
      inAppEnabled: boolean;
      marketingEmailEnabled: boolean;
      reminderEmailEnabled: boolean;
    }>,
  ) {
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      update: dto,
      create: { userId, ...dto },
    });
  }

  async deleteNotifications(userId: string, ids: string[]) {
    const result = await this.prisma.notification.deleteMany({
      where: { id: { in: ids }, userId },
    });
    await this.cacheService.del(CacheKeys.notificationsUnread(userId));
    return result;
  }

  async createNotification(dto: CreateNotificationDto) {
    try {
      const notification = await this.prisma.notification.create({
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
      await this.cacheService.incr(CacheKeys.notificationsUnread(dto.userId));

      this.realtimeService?.emitToUser(dto.userId, 'notification.created', {
        id: notification.id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        actionUrl: notification.actionUrl,
        createdAt: notification.createdAt,
      });

      return notification;
    } catch {
      // Non-blocking
    }
  }

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
