/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service';
import { RequestStatus, Prisma, AuditActionType } from '@prisma/client'; // 🔥 AuditActionType Eklendi
import * as bcrypt from 'bcrypt';

@Injectable()
export class StaffService {
  constructor(private prisma: PrismaService) {}

  // 1. DASHBOARD METRICS
  async getDashboardMetrics() {
    const activeStatuses = [
      RequestStatus.SUBMITTED,
      RequestStatus.IN_REVIEW,
      RequestStatus.WAITING_APPROVAL,
      RequestStatus.REVISION_REQUESTED,
    ];

    const totalOpen = await this.prisma.request.count({
      where: { status: { in: activeStatuses } },
    });

    const unassigned = await this.prisma.request.count({
      where: {
        currentAssigneeUserId: null,
        status: { in: [RequestStatus.SUBMITTED] },
      },
    });

    return {
      totalOpenRequests: totalOpen,
      unassignedRequests: unassigned,
    };
  }

  // 2. WORK POOL (GET ALL REQUESTS)
  async getAllRequests(statusFilter?: string, category?: string) {
    const whereClause: Prisma.RequestWhereInput = {};

    if (statusFilter === 'unassigned') {
      whereClause.currentAssigneeUserId = null;
      whereClause.status = {
        in: [RequestStatus.SUBMITTED, RequestStatus.IN_REVIEW],
      };
    } else if (statusFilter === 'active') {
      whereClause.status = {
        in: [
          RequestStatus.SUBMITTED,
          RequestStatus.IN_REVIEW,
          RequestStatus.WAITING_APPROVAL,
          RequestStatus.REVISION_REQUESTED,
        ],
      };
    } else if (statusFilter === 'closed') {
      whereClause.status = {
        in: [
          RequestStatus.APPROVED,
          RequestStatus.REJECTED,
          RequestStatus.CANCELLED,
          RequestStatus.COMPLETED,
          RequestStatus.CLOSED,
          RequestStatus.EXPIRED,
        ],
      };
    }

    if (category) {
      whereClause.requestType = { category: category };
    }

    const requests = await this.prisma.request.findMany({
      where: whereClause,
      include: {
        requester: { include: { profile: true } },
        requestType: true,
        currentAssignee: { include: { profile: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return requests.map((req) => ({
      id: req.id,
      requestNo: req.requestNo,
      title: req.title,
      status: req.status,
      priority: req.priority,
      typeName: req.requestType?.name || 'General',
      category: req.requestType?.category,
      requesterName: req.requester?.profile?.fullName || req.requester?.email,
      assignedTo: req.currentAssignee?.profile?.fullName || null,
      createdAt: req.createdAt,
    }));
  }

  // 3. REQUEST DETAILS
  async getRequestDetail(id: string) {
    const request = await this.prisma.request.findUnique({
      where: { id },
      include: {
        requester: {
          include: {
            profile: {
              include: {
                faculty: { select: { name: true } },
                department: { select: { name: true } },
                unit: { select: { name: true } },
              },
            },
            primaryRoles: { include: { role: true } },
          },
        },
        requestType: true,
        currentAssignee: { include: { profile: true } },
        fileLinks: true,
      },
    });

    if (!request) return null;

    return {
      ...request,
      requester: request.requester
        ? {
            ...request.requester,
            fullName:
              request.requester.profile?.fullName || request.requester.email,
            role:
              request.requester.primaryRoles?.[0]?.role?.name || 'STAFF',
            faculty: request.requester.profile?.faculty?.name || null,
            department:
              request.requester.profile?.department?.name ||
              request.requester.profile?.unit?.name ||
              null,
            studentNumber: request.requester.profile?.studentNumber || null,
            staffNumber: request.requester.profile?.staffNumber || null,
            title: request.requester.profile?.title || null,
          }
        : null,
    };
  }

  // 4. GET FACULTY MEMBERS
  async getFacultyMembers() {
    return this.prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        primaryRoles: { some: { role: { name: 'FACULTY' } } },
      },
      select: {
        id: true,
        profile: {
          select: {
            fullName: true,
            title: true,
            department: { select: { name: true } },
          },
        },
      },
      orderBy: { profile: { firstName: 'asc' } },
    });
  }

  // 🔥 5. ASSIGN REQUEST & UPDATE STATUS (AUDIT LOG ADDED) 🔥
  async assignRequest(
    requestId: string,
    assigneeUserId: string,
    staffId: string, // This is the ID of the staff member making the assignment
  ) {
    const updatedRequest = await this.prisma.request.update({
      where: { id: requestId },
      data: {
        currentAssigneeUserId: assigneeUserId,
        status: RequestStatus.IN_REVIEW,
      },
      include: {
        currentAssignee: { include: { profile: true } },
        requestType: true,
        requester: { include: { profile: true } },
        fileLinks: true,
        comments: {
          include: {
            user: { include: { profile: true } },
          },
        },
      },
    });

    // Record Status History
    await this.prisma.requestStatusHistory.create({
      data: {
        requestId: requestId,
        newStatus: RequestStatus.IN_REVIEW,
        changedByUserId: staffId,
        changeReason:
          'Request assigned to a faculty member and marked as In Review.',
      },
    });

    // 🔥 AUDIT LOG: REQUEST ASSIGNED 🔥
    await this.prisma.auditLog.create({
      data: {
        userId: staffId,
        actionType: AuditActionType.ASSIGN,
        entityType: 'Request',
        entityId: requestId,
      },
    });

    return updatedRequest;
  }

  // 🔥 NOTIFICATION MANAGEMENT (STAFF) 🔥
  async getNotifications(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId: userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markNotificationAsRead(userId: string, notificationId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, userId: userId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllNotificationsAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId: userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async deleteNotifications(userId: string, ids: string[]) {
    await this.prisma.notification.deleteMany({
      where: { userId: userId, id: { in: ids } },
    });
    return { message: 'Notifications deleted successfully.' };
  }

  // 🔥 SETTINGS AND SECURITY MANAGEMENT 🔥

  // 1. GET NOTIFICATION PREFERENCES
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

  // 2. UPDATE NOTIFICATION PREFERENCES
  async updatePreferences(userId: string, data: any) {
    return this.prisma.notificationPreference.update({
      where: { userId },
      data,
    });
  }

  // 🔥 3. CHANGE PASSWORD (AUDIT LOG ADDED) 🔥
  async changePassword(userId: string, body: any) {
    const { currentPassword, newPassword } = body;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );

    if (!isPasswordValid) {
      throw new BadRequestException('Current password is incorrect!');
    }

    if (newPassword.length < 6) {
      throw new BadRequestException(
        'New password must be at least 6 characters long.',
      );
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword },
    });

    // 🔥 AUDIT LOG: PASSWORD UPDATED 🔥
    await this.prisma.auditLog.create({
      data: {
        userId: userId,
        actionType: AuditActionType.UPDATE,
        entityType: 'UserPassword',
        entityId: userId,
      },
    });

    return { message: 'Password successfully updated.' };
  }
}
