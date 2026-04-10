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
import { SlaService } from '../workflow/sla.service';

@Injectable()
export class StaffService {
  constructor(
    private prisma: PrismaService,
    private slaService: SlaService,
  ) {}

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
        assignments: {
          include: {
            assignedTo: { include: { profile: true } },
            assignedBy: { include: { profile: true } },
          },
          orderBy: { assignedAt: 'desc' },
        },
        approvalActions: {
          include: {
            actionBy: { include: { profile: true } },
            workflowInstanceStep: {
              include: { workflowStep: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        workflowInstance: {
          include: {
            currentStep: true,
            workflowDefinition: {
              include: {
                steps: { orderBy: { stepOrder: 'asc' } },
              },
            },
            instanceSteps: {
              orderBy: { createdAt: 'asc' },
            },
          },
        },
        documentRequest: true,
        roomReservationRequest: {
          include: {
            resource: {
              select: {
                id: true,
                name: true,
                resourceType: true,
                locationText: true,
                capacity: true,
              },
            },
          },
        },
        appointmentRequest: true,
        procurementRequest: true,
        accessRequest: true,
        eventRequest: true,
        equipmentRequest: {
          include: {
            labResource: {
              select: {
                id: true,
                name: true,
                resourceType: true,
                locationText: true,
              },
            },
          },
        },
        internshipRequest: true,
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
      workflow: request.workflowInstance
        ? {
            status: request.workflowInstance.status,
            currentStep: request.workflowInstance.currentStep?.stepName ?? null,
            workflowName:
              request.workflowInstance.workflowDefinition?.name ?? null,
            steps:
              request.workflowInstance.workflowDefinition?.steps?.map((step) => {
                const instanceStep = request.workflowInstance?.instanceSteps.find(
                  (item) => item.workflowStepId === step.id,
                );
                return {
                  id: step.id,
                  label: step.stepName,
                  status:
                    step.id === request.workflowInstance?.currentStepId
                      ? 'active'
                      : instanceStep?.status === 'COMPLETED'
                        ? 'completed'
                        : request.status === 'REJECTED' &&
                            step.id === request.workflowInstance?.currentStepId
                          ? 'failed'
                          : 'pending',
                };
              }) ?? [],
          }
        : null,
      formData: {
        ...(request.dynamicData as Record<string, unknown> | null),
        ...(request.documentRequest
          ? {
              documentType: request.documentRequest.documentType,
              language: request.documentRequest.language,
              copiesCount: request.documentRequest.copiesCount,
              deliveryMethod: request.documentRequest.deliveryMethod,
              deliveryAddress: request.documentRequest.deliveryAddress,
            }
          : {}),
        ...(request.roomReservationRequest
          ? {
              resourceId: request.roomReservationRequest.resourceId,
              resourceName: request.roomReservationRequest.resource?.name ?? null,
              eventName: request.roomReservationRequest.eventName,
              reservationPurpose:
                request.roomReservationRequest.reservationPurpose,
              attendeeCount: request.roomReservationRequest.attendeeCount,
              startAt: request.roomReservationRequest.startAt,
              endAt: request.roomReservationRequest.endAt,
              requiresSecurityApproval:
                request.roomReservationRequest.requiresSecurityApproval,
              requiresTechnicalSupport:
                request.roomReservationRequest.requiresTechnicalSupport,
              setupNotes: request.roomReservationRequest.setupNotes,
            }
          : {}),
        ...(request.appointmentRequest
          ? {
              targetUserId: request.appointmentRequest.targetUserId,
              appointmentType: request.appointmentRequest.appointmentType,
              topic: request.appointmentRequest.topic,
              details: request.appointmentRequest.details,
              preferredStartAt: request.appointmentRequest.preferredStartAt,
              preferredEndAt: request.appointmentRequest.preferredEndAt,
            }
          : {}),
        ...(request.procurementRequest
          ? {
              itemName: request.procurementRequest.itemName,
              itemCategory: request.procurementRequest.itemCategory,
              quantity: request.procurementRequest.quantity,
              unitPriceEstimate: request.procurementRequest.unitPriceEstimate,
              totalEstimate: request.procurementRequest.totalEstimate,
              vendorPreference: request.procurementRequest.vendorPreference,
              justification: request.procurementRequest.justification,
              budgetCode: request.procurementRequest.budgetCode,
            }
          : {}),
        ...(request.accessRequest
          ? {
              accessType: request.accessRequest.accessType,
              targetResource: request.accessRequest.targetResource,
              requestedRoleOrPermission:
                request.accessRequest.requestedRoleOrPermission,
              justification: request.accessRequest.justification,
              startAt: request.accessRequest.startAt,
              endAt: request.accessRequest.endAt,
            }
          : {}),
        ...(request.eventRequest
          ? {
              eventName: request.eventRequest.eventName,
              eventType: request.eventRequest.eventType,
              description: request.eventRequest.description,
              expectedAttendance: request.eventRequest.expectedAttendance,
              locationPreference: request.eventRequest.locationPreference,
              startAt: request.eventRequest.startAt,
              endAt: request.eventRequest.endAt,
              needsBudget: request.eventRequest.needsBudget,
              estimatedBudget: request.eventRequest.estimatedBudget,
              needsPosterApproval: request.eventRequest.needsPosterApproval,
              needsSecuritySupport: request.eventRequest.needsSecuritySupport,
              needsTechnicalSupport: request.eventRequest.needsTechnicalSupport,
            }
          : {}),
        ...(request.equipmentRequest
          ? {
              labResourceId: request.equipmentRequest.labResourceId,
              labResourceName:
                request.equipmentRequest.labResource?.name ?? null,
              equipmentName: request.equipmentRequest.equipmentName,
              equipmentCategory: request.equipmentRequest.equipmentCategory,
              quantity: request.equipmentRequest.quantity,
              purpose: request.equipmentRequest.purpose,
              neededFrom: request.equipmentRequest.neededFrom,
              neededUntil: request.equipmentRequest.neededUntil,
              urgencyReason: request.equipmentRequest.urgencyReason,
            }
          : {}),
        ...(request.internshipRequest
          ? {
              companyName: request.internshipRequest.companyName,
              companySector: request.internshipRequest.companySector,
              companyContactName:
                request.internshipRequest.companyContactName,
              companyContactEmail:
                request.internshipRequest.companyContactEmail,
              internshipType: request.internshipRequest.internshipType,
              workMode: request.internshipRequest.workMode,
              startDate: request.internshipRequest.startDate,
              endDate: request.internshipRequest.endDate,
              durationDays: request.internshipRequest.durationDays,
              insuranceRequired: request.internshipRequest.insuranceRequired,
            }
          : {}),
      },
      assignments: request.assignments.map((assignment) => ({
        id: assignment.id,
        assignedAt: assignment.assignedAt,
        unassignedAt: assignment.unassignedAt,
        isActive: assignment.isActive,
        note: assignment.assignmentNote,
        assignedTo: assignment.assignedTo
          ? {
              id: assignment.assignedTo.id,
              fullName:
                assignment.assignedTo.profile?.fullName ||
                assignment.assignedTo.email,
              email: assignment.assignedTo.email,
            }
          : null,
        assignedBy: assignment.assignedBy
          ? {
              id: assignment.assignedBy.id,
              fullName:
                assignment.assignedBy.profile?.fullName ||
                assignment.assignedBy.email,
              email: assignment.assignedBy.email,
            }
          : null,
      })),
      approvalHistory: request.approvalActions.map((action) => ({
        id: action.id,
        actionType: action.actionType,
        decisionNote: action.decisionNote,
        createdAt: action.createdAt,
        actor: {
          id: action.actionBy.id,
          fullName: action.actionBy.profile?.fullName || action.actionBy.email,
          email: action.actionBy.email,
        },
        workflowStep: action.workflowInstanceStep?.workflowStep
          ? {
              id: action.workflowInstanceStep.workflowStep.id,
              key: action.workflowInstanceStep.workflowStep.stepKey,
              name: action.workflowInstanceStep.workflowStep.stepName,
            }
          : null,
      })),
    };
  }

  // 4. GET FACULTY MEMBERS
  async getFacultyMembers() {
    return this.prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        primaryRoles: {
          some: { role: { name: { in: ['FACULTY', 'STAFF', 'ADMIN'] } } },
        },
      },
      select: {
        id: true,
        email: true,
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
    const request = await this.prisma.request.findUnique({
      where: { id: requestId },
      include: {
        currentAssignee: { include: { profile: true } },
        requester: { include: { profile: true } },
      },
    });
    if (!request) throw new NotFoundException('Request not found.');

    const assignee = await this.prisma.user.findUnique({
      where: { id: assigneeUserId },
      include: { profile: true },
    });
    if (!assignee || assignee.status !== 'ACTIVE') {
      throw new BadRequestException('Assignee is invalid or inactive.');
    }

    const updatedRequest = await this.prisma.$transaction(async (tx) => {
      await tx.requestAssignment.updateMany({
        where: { requestId, isActive: true },
        data: { isActive: false, unassignedAt: new Date() },
      });

      await tx.requestAssignment.create({
        data: {
          requestId,
          assignedToUserId: assigneeUserId,
          assignedByUserId: staffId,
          assignmentNote: 'Assigned manually from staff request detail.',
        },
      });

      await tx.requestWatcher.createMany({
        data: [
          { requestId, userId: request.requesterUserId },
          { requestId, userId: assigneeUserId },
          { requestId, userId: staffId },
        ],
        skipDuplicates: true,
      });

      const activeWorkflowStep = await tx.workflowInstanceStep.findFirst({
        where: {
          workflowInstance: { requestId },
          status: 'PENDING',
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true, metadataJson: true },
      });

      if (activeWorkflowStep) {
        await tx.workflowInstanceStep.update({
          where: { id: activeWorkflowStep.id },
          data: {
            assignedToUserId: assigneeUserId,
            metadataJson: {
              ...(activeWorkflowStep.metadataJson as Record<string, unknown> | null),
              manuallyAssignedByUserId: staffId,
              manuallyAssignedAt: new Date().toISOString(),
            },
          },
        });
      }

      const nextStatus =
        request.status === RequestStatus.SUBMITTED
          ? RequestStatus.IN_REVIEW
          : request.status;

      const updated = await tx.request.update({
        where: { id: requestId },
        data: {
          currentAssigneeUserId: assigneeUserId,
          status: nextStatus,
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

      if (nextStatus !== request.status) {
        await tx.requestStatusHistory.create({
          data: {
            requestId,
            oldStatus: request.status,
            newStatus: nextStatus,
            changedByUserId: staffId,
            changeReason: `Request assigned to ${assignee.profile?.fullName || assignee.email} and moved to In Review.`,
          },
        });
      }

      await tx.requestComment.create({
        data: {
          requestId,
          userId: staffId,
          commentText: `Request assigned to ${assignee.profile?.fullName || assignee.email}.`,
          isInternal: true,
        },
      });

      await tx.notification.create({
        data: {
          userId: assigneeUserId,
          requestId,
          type: 'IN_APP',
          title: 'Request Assigned',
          message: `${request.requestNo} has been assigned to you.`,
          actionUrl: '/staff/inbox',
        },
      });

      await this.slaService.markFirstResponse(tx, requestId);

      await tx.auditLog.create({
        data: {
          userId: staffId,
          actionType: AuditActionType.ASSIGN,
          entityType: 'Request',
          entityId: requestId,
        },
      });

      return updated;
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
