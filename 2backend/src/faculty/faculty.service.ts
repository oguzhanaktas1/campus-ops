/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../core/prisma/prisma.service';
import { SlaService } from '../workflow/sla.service';
import { WorkflowEngineService } from '../workflow/workflow-engine.service';
import { buildWorkflowSummary } from '../workflow/workflow-summary';
import { CacheService } from '../infrastructure/cache/cache.service';
import { FilesService } from '../files/files.service';
import {
  CacheKeys,
  CacheTtls,
  makeCacheHash,
} from '../infrastructure/cache/cache-keys';
import {
  RequestStatus,
  WorkflowActionType,
  AuditActionType,
  TicketStatus,
} from '@prisma/client'; // 🔥 AuditActionType Added

function deriveFacultyWorkflowStepStatus(params: {
  instanceStep: any;
  isCurrent: boolean;
  requestStatus: RequestStatus;
}) {
  const { instanceStep, isCurrent, requestStatus } = params;

  if (instanceStep?.isOverdue) return 'warning';
  if (instanceStep?.actionTaken === 'REJECT') return 'failed';
  if (instanceStep?.actionTaken === 'REQUEST_REVISION') return 'warning';
  if (isCurrent && requestStatus === RequestStatus.REJECTED) return 'failed';
  if (isCurrent && requestStatus === RequestStatus.REVISION_REQUESTED) return 'warning';
  if (isCurrent) return 'active';
  if (instanceStep?.status === 'COMPLETED') return 'completed';
  if (instanceStep?.status === 'FAILED') return 'failed';
  return 'pending';
}

function buildFacultyWorkflowStepLabel(step: any, instanceStep: any) {
  const stepName = String(step.stepName ?? 'Step');
  const actionTaken = String(instanceStep?.actionTaken ?? '');
  const stepKey = String(step.stepKey ?? '').toUpperCase();

  if (!['REJECT', 'REQUEST_REVISION', 'APPROVE'].includes(actionTaken)) {
    return stepName;
  }

  const actorLabel = stepKey.includes('COORDINATOR')
    ? 'Internship Coordinator'
    : stepKey.includes('ADVISOR')
      ? 'Advisor'
      : stepName.replace(/\s+Review$/i, '');

  if (actionTaken === 'REJECT') return `${actorLabel} Rejected`;
  if (actionTaken === 'REQUEST_REVISION') return `${actorLabel} Revision Requested`;
  if (actionTaken === 'APPROVE' && stepKey.includes('ADVISOR')) {
    return `${actorLabel} Approved`;
  }

  return stepName;
}

@Injectable()
export class FacultyService {
  constructor(
    private prisma: PrismaService,
    private slaService: SlaService,
    private cacheService: CacheService,
    private filesService: FilesService,
    private workflowEngine: WorkflowEngineService,
    @Optional() private notificationsService?: NotificationsService,
  ) {}

  private definedData(data: Record<string, any>): Record<string, any> {
    return Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined),
    ) as Record<string, any>;
  }

  private toNullableDate(value: unknown) {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    return new Date(String(value));
  }

  private toNullableNumber(value: unknown) {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private toNullableInt(value: unknown) {
    const parsed = this.toNullableNumber(value);
    return typeof parsed === 'number' ? Math.trunc(parsed) : parsed;
  }

  private toNullableText(value: unknown) {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const trimmed = String(value).trim();
    return trimmed ? trimmed : null;
  }

  private buildRequestDomainData(request: any) {
    switch (request.requestType?.key) {
      case 'DOCUMENT_REQUEST':
        return request.documentRequest
          ? {
              documentType: request.documentRequest.documentType,
              language: request.documentRequest.language,
              copiesCount: request.documentRequest.copiesCount,
              deliveryMethod: request.documentRequest.deliveryMethod,
              deliveryAddress: request.documentRequest.deliveryAddress,
              description: request.description,
            }
          : null;
      case 'ROOM_RESERVATION':
        return request.roomReservationRequest
          ? {
              resourceId: request.roomReservationRequest.resourceId,
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
          : null;
      case 'APPOINTMENT':
        return request.appointmentRequest
          ? {
              targetUserId: request.appointmentRequest.targetUserId,
              appointmentType: request.appointmentRequest.appointmentType,
              topic: request.appointmentRequest.topic,
              details: request.appointmentRequest.details,
              preferredStartAt: request.appointmentRequest.preferredStartAt,
              preferredEndAt: request.appointmentRequest.preferredEndAt,
            }
          : null;
      case 'PROCUREMENT_REQUEST':
        return request.procurementRequest
          ? {
              itemName: request.procurementRequest.itemName,
              itemCategory: request.procurementRequest.itemCategory,
              quantity: request.procurementRequest.quantity,
              unitPriceEstimate: request.procurementRequest.unitPriceEstimate
                ? Number(request.procurementRequest.unitPriceEstimate)
                : null,
              totalEstimate: request.procurementRequest.totalEstimate
                ? Number(request.procurementRequest.totalEstimate)
                : null,
              vendorPreference: request.procurementRequest.vendorPreference,
              justification: request.procurementRequest.justification,
              budgetCode: request.procurementRequest.budgetCode,
            }
          : null;
      case 'ACCESS_REQUEST':
        return request.accessRequest
          ? {
              accessType: request.accessRequest.accessType,
              targetResource: request.accessRequest.targetResource,
              requestedRoleOrPermission:
                request.accessRequest.requestedRoleOrPermission,
              justification: request.accessRequest.justification,
              startAt: request.accessRequest.startAt,
              endAt: request.accessRequest.endAt,
            }
          : null;
      case 'EVENT_REQUEST':
        return request.eventRequest
          ? {
              eventName: request.eventRequest.eventName,
              eventType: request.eventRequest.eventType,
              description: request.eventRequest.description,
              expectedAttendance: request.eventRequest.expectedAttendance,
              locationPreference: request.eventRequest.locationPreference,
              startAt: request.eventRequest.startAt,
              endAt: request.eventRequest.endAt,
              needsBudget: request.eventRequest.needsBudget,
              estimatedBudget: request.eventRequest.estimatedBudget
                ? Number(request.eventRequest.estimatedBudget)
                : null,
              needsPosterApproval: request.eventRequest.needsPosterApproval,
              needsSecuritySupport: request.eventRequest.needsSecuritySupport,
              needsTechnicalSupport:
                request.eventRequest.needsTechnicalSupport,
            }
          : null;
      case 'EQUIPMENT':
        return request.equipmentRequest
          ? {
              equipmentName: request.equipmentRequest.equipmentName,
              equipmentCategory: request.equipmentRequest.equipmentCategory,
              quantity: request.equipmentRequest.quantity,
              purpose: request.equipmentRequest.purpose,
              neededFrom: request.equipmentRequest.neededFrom,
              neededUntil: request.equipmentRequest.neededUntil,
              urgencyReason: request.equipmentRequest.urgencyReason,
              stockCheckStatus: request.equipmentRequest.stockCheckStatus,
              procurementRequired:
                request.equipmentRequest.procurementRequired,
              estimatedCost: request.equipmentRequest.estimatedCost
                ? Number(request.equipmentRequest.estimatedCost)
                : null,
            }
          : null;
      case 'INTERNSHIP_REQUEST':
        return request.internshipRequest
          ? {
              companyName: request.internshipRequest.companyName,
              companySector: request.internshipRequest.companySector,
              companyContactName: request.internshipRequest.companyContactName,
              companyContactEmail:
                request.internshipRequest.companyContactEmail,
              internshipType: request.internshipRequest.internshipType,
              workMode: request.internshipRequest.workMode,
              startDate: request.internshipRequest.startDate,
              endDate: request.internshipRequest.endDate,
              durationDays: request.internshipRequest.durationDays,
              insuranceRequired:
                request.internshipRequest.insuranceRequired,
            }
          : null;
      case 'IT_SUPPORT':
        return request.itTicket
          ? {
              category: request.itTicket.category,
              subcategory: request.itTicket.subcategory,
              affectedSystem: request.itTicket.affectedSystem,
              assetId: request.itTicket.assetId,
              locationText: request.itTicket.locationText,
              incidentStartedAt: request.itTicket.incidentStartedAt,
              ticketStatus: request.itTicket.ticketStatus,
              description: request.description,
            }
          : null;
      default:
        return request.dynamicData ?? null;
    }
  }

  // 1. GET PENDING APPROVALS FOR FACULTY
  async getPendingApprovals(userId: string) {
    const version = await this.cacheService.getVersion(
      CacheKeys.version('faculty:approvals:list'),
    );
    const key = CacheKeys.facultyApprovalsList(
      userId,
      makeCacheHash({ scope: 'pending' }),
      version,
    );

    return this.cacheService.getOrSet(key, CacheTtls.short, async () => {
      const requests = await this.prisma.request.findMany({
      where: {
        // 🔥 CRITICAL FILTER: Fetch only unresolved requests
        status: {
          in: [
            RequestStatus.SUBMITTED,
            RequestStatus.IN_REVIEW,
            RequestStatus.WAITING_APPROVAL,
          ],
        },
        // 🔥 MULTIPLE ASSIGNMENT CHECK: Either you are the main assignee or have an ACTIVE assignment
        OR: [
          { currentAssigneeUserId: userId },
          {
            assignments: {
              some: { assignedToUserId: userId, isActive: true },
            },
          },
        ],
      },
      include: {
        requester: { include: { profile: true } },
        requestType: true,
        statusHistory: { orderBy: { changedAt: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
      });

      return requests.map((req) => ({
        id: req.id,
        title: req.title,
        description: req.description,
        status: req.status,
        priority: req.priority,
        createdAt: req.createdAt,
        submittedByName:
          req.requester.profile?.fullName ||
          req.requester.email ||
          'Unnamed User',
        typeName: req.requestType?.name || 'General Request',
        formSchema: req.requestType?.formSchemaJson || [],
        dynamicData: (req as any).dynamicData || {},
        timeline: req.statusHistory.map((h) => ({
          id: h.id,
          status: h.newStatus,
          date: h.changedAt,
          note: h.changeReason,
        })),
      }));
    });
  }

  // 2. PROCESS ACTION (Approve / Reject / Revise) + IN-APP NOTIFICATION & AUDIT
  async processAction(
    userId: string,
    roles: string[],
    requestId: string,
    data: { action: string; comment?: string },
  ) {
    const request = await this.prisma.request.findFirst({
      where: {
        id: requestId,
        OR: [
          { currentAssigneeUserId: userId },
          {
            assignments: { some: { assignedToUserId: userId, isActive: true } },
          },
        ],
      },
    });

    if (!request) {
      throw new NotFoundException(
        'Request not found or you do not have permission for this action.',
      );
    }

    if (
      (data.action === 'reject' || data.action === 'revision') &&
      (!data.comment || data.comment.trim() === '')
    ) {
      throw new BadRequestException(
        'A comment/reason is required for reject or revision actions!',
      );
    }

    const workflowInstance = await this.prisma.workflowInstance.findUnique({
      where: { requestId },
      select: { id: true },
    });

    if (workflowInstance) {
      const auditAction =
        data.action === 'approve'
          ? AuditActionType.APPROVE
          : data.action === 'reject'
            ? AuditActionType.REJECT
            : AuditActionType.STATUS_CHANGE;

      const result = await this.workflowEngine.processAction(userId, roles, requestId, {
        action: data.action,
        comment: data.comment,
      });

      await this.prisma.auditLog.create({
        data: {
          userId,
          actionType: auditAction,
          entityType: 'Request',
          entityId: requestId,
        },
      });

      await Promise.all([
        this.cacheService.bumpVersion(CacheKeys.version('faculty:approvals:list')),
        this.cacheService.bumpVersion(
          CacheKeys.version(`request:detail:${requestId}`),
        ),
        this.cacheService.bumpVersion(CacheKeys.version('admin:requests:list')),
        this.cacheService.bumpVersion(
          CacheKeys.version('admin:dashboard:summary'),
        ),
      ]);

      return result;
    }

    let newStatus: RequestStatus;
    let wfAction: WorkflowActionType;
    let notifTitle = '';
    let auditAction: AuditActionType = AuditActionType.UPDATE;

    if (data.action === 'approve') {
      newStatus = RequestStatus.APPROVED;
      wfAction = WorkflowActionType.APPROVE;
      notifTitle = '✅ Request Approved';
      auditAction = AuditActionType.APPROVE;
    } else if (data.action === 'reject') {
      newStatus = RequestStatus.REJECTED;
      wfAction = WorkflowActionType.REJECT;
      notifTitle = '❌ Request Rejected';
      auditAction = AuditActionType.REJECT;
    } else if (data.action === 'revision') {
      newStatus = RequestStatus.REVISION_REQUESTED;
      wfAction = WorkflowActionType.REQUEST_REVISION;
      notifTitle = '🔄 Revision Requested';
      auditAction = AuditActionType.STATUS_CHANGE;
    } else {
      throw new BadRequestException('Invalid action type.');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // A. Update the main request status
      const updatedReq = await tx.request.update({
        where: { id: requestId },
        data: { status: newStatus },
      });

      // B. Status History
      await tx.requestStatusHistory.create({
        data: {
          requestId,
          oldStatus: request.status,
          newStatus: newStatus,
          changedByUserId: userId,
          changeReason: data.comment || 'Processed via Faculty Portal',
        },
      });

      // C. Official Approval Action
      await tx.approvalAction.create({
        data: {
          requestId,
          actionType: wfAction,
          actionByUserId: userId,
          decisionNote: data.comment,
        },
      });

      // D. Comment (If any)
      if (data.comment) {
        await tx.requestComment.create({
          data: {
            requestId,
            userId,
            commentText: data.comment,
            isInternal: false,
          },
        });
      }

      // 🔥 E. SEND IN-APP NOTIFICATION TO STUDENT 🔥
      await tx.notification.create({
        data: {
          userId: request.requesterUserId,
          requestId: request.id,
          type: 'IN_APP',
          title: notifTitle,
          message: `Your request "${request.title}" has been marked as ${newStatus}.${data.comment ? `\nFaculty Note: ${data.comment}` : ''}`,
          actionUrl: `/student/requests/${request.id}`,
        },
      });

      // 🔥 F. ADD TO CALENDAR IF APPROVED 🔥
      if (data.action === 'approve' && request.dynamicData) {
        const dynData = request.dynamicData as Record<string, any>;
        const dateKey = Object.keys(dynData).find((k) =>
          k.toLowerCase().includes('date'),
        );
        const timeKey = Object.keys(dynData).find((k) =>
          k.toLowerCase().includes('time'),
        );

        if (dateKey && timeKey) {
          const dateVal = dynData[dateKey];
          const timeVal = dynData[timeKey];
          const formattedTime =
            timeVal.length === 5 ? `${timeVal}:00` : timeVal;
          const startDateTime = new Date(`${dateVal}T${formattedTime}`);

          if (!isNaN(startDateTime.getTime())) {
            const endDateTime = new Date(
              startDateTime.getTime() + 60 * 60 * 1000,
            );

            // To Faculty calendar
            await tx.calendarEvent.create({
              data: {
                userId: userId,
                title: `[Approved] ${request.title}`,
                description: `Request No: ${request.requestNo}\nDetails: ${request.description || 'No description'}`,
                startDate: startDateTime,
                endDate: endDateTime,
                requestId: request.id,
              },
            });

            // To Student calendar
            await tx.calendarEvent.create({
              data: {
                userId: request.requesterUserId,
                title: `[Approved] ${request.title}`,
                description: `This request has been approved and scheduled by the faculty.`,
                startDate: startDateTime,
                endDate: endDateTime,
                requestId: request.id,
              },
            });
          }
        }
      }

      // G. Close the assignment
      await tx.requestAssignment.updateMany({
        where: { requestId: requestId, assignedToUserId: userId },
        data: { isActive: false, unassignedAt: new Date() },
      });

      // 🔥 H. AUDIT LOG: FACULTY ACTION 🔥
      await tx.auditLog.create({
        data: {
          userId: userId,
          actionType: auditAction,
          entityType: 'Request',
          entityId: requestId,
        },
      });

      return updatedReq;
    });

    await Promise.all([
      this.cacheService.bumpVersion(CacheKeys.version('faculty:approvals:list')),
      this.cacheService.bumpVersion(
        CacheKeys.version(`request:detail:${requestId}`),
      ),
      this.cacheService.bumpVersion(CacheKeys.version('admin:requests:list')),
      this.cacheService.bumpVersion(
        CacheKeys.version('admin:dashboard:summary'),
      ),
    ]);

    this.notificationsService?.emitToast(request.requesterUserId, {
      title: notifTitle,
      message: `Your request "${request.title}" has been marked as ${newStatus}.${data.comment ? ` Faculty Note: ${data.comment}` : ''}`,
      type: 'IN_APP',
      requestId: request.id,
      actionUrl: `/student/requests/${request.id}`,
    });

    return result;
  }

  // 3. GET ALL REQUESTS INVOLVING THE FACULTY (ARCHIVE)
  async getAllRequests(userId: string) {
    const requests = await this.prisma.request.findMany({
      where: {
        OR: [
          { currentAssigneeUserId: userId },
          { assignments: { some: { assignedToUserId: userId } } },
          { approvalActions: { some: { actionByUserId: userId } } },
        ],
      },
      include: {
        requester: { include: { profile: true } },
        requestType: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    return requests.map((req) => ({
      id: req.id,
      title: req.title,
      status: req.status,
      priority: req.priority,
      createdAt: req.createdAt,
      type: req.requestType.key,
      typeName: req.requestType.name,
      submittedByName:
        req.requester.profile?.fullName ||
        req.requester.email ||
        'Unnamed User',
    }));
  }

  // 4. GET SINGLE REQUEST DETAIL
  async getRequestDetail(userId: string, requestId: string, roles: string[] = []) {
    const version = await this.cacheService.getVersion(
      CacheKeys.version(`request:detail:${requestId}`),
    );
    const cacheKey = `faculty:request:detail:${requestId}:v${version}:v2`;
    return this.cacheService.getOrSet(cacheKey, CacheTtls.long, async () => {
    const isFaculty = roles.includes('FACULTY');

    let whereClause: any;
    if (isFaculty) {
      whereClause = { id: requestId };
    } else {
      const userProfile = await this.prisma.userProfile.findUnique({
        where: { userId },
        select: { facultyId: true },
      });
      const userFacultyId = userProfile?.facultyId ?? null;

      const accessOR: any[] = [
        { requesterUserId: userId },
        { currentAssigneeUserId: userId },
        { assignments: { some: { assignedToUserId: userId } } },
        { approvalActions: { some: { actionByUserId: userId } } },
        { appointmentRequest: { targetUserId: userId } },
        { workflowInstance: { instanceSteps: { some: { assignedToUserId: userId } } } },
      ];
      if (userFacultyId) {
        accessOR.push({ facultyId: userFacultyId });
      }
      whereClause = { id: requestId, OR: accessOR };
    }

    const request = await this.prisma.request.findFirst({
      where: whereClause,
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
            primaryRoles: { select: { role: { select: { name: true } } }, take: 1 },
          },
        },
        requestType: true,
        fileLinks: {
          select: {
            file: {
              select: {
                id: true,
                originalFileName: true,
                fileSizeBytes: true,
                mimeType: true,
                bucketName: true,
                storagePath: true,
              },
            },
          },
        },
        currentAssignee: {
          select: {
            id: true,
            email: true,
            profile: { select: { fullName: true, title: true } },
            primaryRoles: { select: { role: { select: { name: true } } }, take: 1 },
          },
        },
        comments: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            commentText: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                email: true,
                profile: { select: { fullName: true } },
                primaryRoles: { select: { role: { select: { name: true } } }, take: 1 },
              },
            },
          },
        },
        assignments: {
          select: {
            id: true,
            assignedAt: true,
            unassignedAt: true,
            isActive: true,
            assignmentNote: true,
            assignedTo: {
              select: {
                id: true,
                email: true,
                profile: { select: { fullName: true } },
                primaryRoles: { select: { role: { select: { name: true } } }, take: 1 },
              },
            },
            assignedBy: {
              select: {
                id: true,
                email: true,
                profile: { select: { fullName: true } },
              },
            },
          },
          orderBy: { assignedAt: 'desc' },
        },
        approvalActions: {
          select: {
            id: true,
            actionType: true,
            decisionNote: true,
            createdAt: true,
            actionBy: {
              select: {
                id: true,
                email: true,
                profile: { select: { fullName: true } },
              },
            },
            workflowInstanceStep: {
              select: { workflowStep: { select: { id: true, stepKey: true, stepName: true } } },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        statusHistory: { orderBy: { changedAt: 'desc' } },
        workflowInstance: {
          select: {
            id: true,
            status: true,
            currentStepId: true,
            currentStep: { select: { id: true, stepName: true, stepKey: true } },
            workflowDefinition: {
              select: {
                name: true,
                steps: {
                  select: {
                    id: true,
                    stepKey: true,
                    stepName: true,
                    stepType: true,
                    stepOrder: true,
                    slaHours: true,
                    configJson: true,
                    assignedRole: { select: { name: true } },
                    assignedUnit: { select: { id: true, name: true } },
                    assignedUser: {
                      select: {
                        id: true,
                        email: true,
                        profile: { select: { fullName: true } },
                        primaryRoles: { select: { role: { select: { name: true } } }, take: 1 },
                      },
                    },
                  },
                  orderBy: { stepOrder: 'asc' },
                },
              },
            },
            instanceSteps: {
              select: {
                id: true,
                workflowStepId: true,
                status: true,
                actionTaken: true,
                actionNote: true,
                isOverdue: true,
                startedAt: true,
                completedAt: true,
                dueAt: true,
                assignedTo: {
                  select: {
                    id: true,
                    email: true,
                    profile: { select: { fullName: true } },
                    primaryRoles: { select: { role: { select: { name: true } } }, take: 1 },
                  },
                },
                actionBy: {
                  select: {
                    id: true,
                    email: true,
                    profile: { select: { fullName: true } },
                    primaryRoles: { select: { role: { select: { name: true } } }, take: 1 },
                  },
                },
              },
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
        itTicket: true,
        internshipRequest: true,
      },
    });

    if (!request) throw new NotFoundException('Request not found.');

    return {
      id: request.id,
      requestNo: request.requestNo,
      title: request.title,
      description: request.description,
      status: request.status,
      priority: request.priority,
      createdAt: request.createdAt,
      submittedAt: request.submittedAt,
      type: request.requestType.key,
      typeName: request.requestType.name,
      requestType: {
        key: request.requestType.key,
        name: request.requestType.name,
        category: request.requestType.category,
      },
      submittedByName:
        request.requester.profile?.fullName || request.requester.email,
      requester: {
        id: request.requester.id,
        fullName: request.requester.profile?.fullName || request.requester.email,
        email: request.requester.email,
        role:
          request.requester.primaryRoles?.[0]?.role?.name || null,
        faculty: request.requester.profile?.faculty?.name || null,
        department:
          request.requester.profile?.department?.name ||
          request.requester.profile?.unit?.name ||
          null,
        studentNumber: request.requester.profile?.studentNumber || null,
        staffNumber: request.requester.profile?.staffNumber || null,
        title: request.requester.profile?.title || null,
      },
      currentAssignee: request.currentAssignee
        ? {
            id: request.currentAssignee.id,
            fullName:
              request.currentAssignee.profile?.fullName ||
              request.currentAssignee.email,
            email: request.currentAssignee.email,
            role:
              request.currentAssignee.primaryRoles?.[0]?.role?.name || null,
            title: request.currentAssignee.profile?.title || null,
          }
        : null,
      studentNumber: request.requester.profile?.studentNumber,
      formData: this.buildRequestDomainData(request),
      attachments: await Promise.all(
        request.fileLinks.map((fl) => this.filesService.buildAttachmentResponse(fl.file)),
      ),
      comments: request.comments.map((c) => ({
        id: c.id,
        authorId: c.user.id,
        author: c.user.profile?.fullName || c.user.email,
        authorRole: c.user.primaryRoles[0]?.role?.name.toLowerCase(),
        content: c.commentText,
        createdAt: c.createdAt,
      })),
      timeline: request.statusHistory.map((h) => ({
        id: h.id,
        status: h.newStatus,
        date: h.changedAt,
        note: h.changeReason,
      })),
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
              role:
                assignment.assignedTo.primaryRoles?.[0]?.role?.name || null,
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
      workflow: buildWorkflowSummary(request.workflowInstance, request.status),
    };
    }); // end cacheService.getOrSet
  }

  // ─── INTERNSHIP DEDICATED ENDPOINTS ──────────────────────────────────────

  async addCommentToRequest(userId: string, requestId: string, text: string) {
    const content = text?.trim();
    if (!content) {
      throw new BadRequestException('Comment text is required.');
    }

    const request = await this.prisma.request.findFirst({
      where: {
        id: requestId,
        OR: [
          { currentAssigneeUserId: userId },
          {
            assignments: {
              some: { assignedToUserId: userId, isActive: true },
            },
          },
          { approvalActions: { some: { actionByUserId: userId } } },
        ],
      },
    });

    if (!request) throw new NotFoundException('Request not found.');

    const comment = await this.prisma.requestComment.create({
      data: {
        requestId,
        userId,
        commentText: content,
        isInternal: false,
      },
      include: {
        user: {
          include: {
            profile: true,
            primaryRoles: { include: { role: true } },
          },
        },
      },
    });

    await this.prisma.$transaction(async (tx) => {
      await this.slaService.markFirstResponse(tx, requestId);
    });

    const response = {
      id: comment.id,
      author: comment.user.profile?.fullName || comment.user.email,
      authorRole:
        comment.user.primaryRoles?.[0]?.role?.name?.toLowerCase() ?? 'faculty',
      content: comment.commentText,
      createdAt: comment.createdAt,
    };

    await this.cacheService.bumpVersion(
      CacheKeys.version(`request:detail:${requestId}`),
    );

    return response;
  }

  async getInternships(userId: string) {
    const records = await this.prisma.internshipRequest.findMany({
      where: {
        OR: [
          { advisorUserId: userId },
          { request: { currentAssigneeUserId: userId } },
          { request: { assignments: { some: { assignedToUserId: userId } } } },
        ],
      },
      include: {
        request: {
          include: {
            requestType: { select: { id: true, key: true, name: true } },
            assignments: {
              where: { assignedToUserId: userId, isActive: true },
              select: { id: true },
            },
            workflowInstance: {
              include: {
                currentStep: { select: { stepKey: true, stepName: true } },
              },
            },
          },
        },
        student: { include: { profile: { select: { fullName: true, studentNumber: true } } } },
        term: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return records.map((r) => ({
      id: r.request.id,
      internshipId: r.id,
      requestNo: r.request.requestNo,
      title: r.request.title,
      status: r.request.status,
      displayStatus: r.request.workflowInstance?.currentStep?.stepKey ?? r.request.status,
      currentStepName: r.request.workflowInstance?.currentStep?.stepName ?? null,
      canAct:
        r.request.currentAssigneeUserId === userId ||
        r.request.assignments.length > 0,
      priority: r.request.priority,
      companyName: r.companyName,
      companySector: r.companySector,
      internshipType: r.internshipType,
      workMode: r.workMode,
      startDate: r.startDate,
      endDate: r.endDate,
      durationDays: r.durationDays,
      submittedByName: r.student?.profile?.fullName ?? (r.student as any)?.email ?? 'Unknown',
      studentNumber: r.student?.profile?.studentNumber ?? null,
      term: r.term ?? null,
      createdAt: r.createdAt,
    }));
  }

  async getInternshipById(userId: string, requestId: string) {
    const r = await this.prisma.internshipRequest.findFirst({
      where: {
        requestId,
        OR: [
          { advisorUserId: userId },
          { request: { currentAssigneeUserId: userId } },
          { request: { assignments: { some: { assignedToUserId: userId } } } },
          { request: { approvalActions: { some: { actionByUserId: userId } } } },
        ],
      },
      include: {
        request: {
          include: {
            requestType: true,
            workflowInstance: {
              include: {
                currentStep: { select: { stepKey: true, stepName: true } },
              },
            },
            assignments: {
              where: { assignedToUserId: userId, isActive: true },
              select: { id: true },
            },
            statusHistory: { orderBy: { changedAt: 'asc' } },
            fileLinks: { include: { file: true } },
            comments: {
              orderBy: { createdAt: 'asc' },
              include: {
                user: { include: { profile: true, primaryRoles: { include: { role: true } } } },
              },
            },
          },
        },
        student: {
          include: {
            profile: {
              include: { faculty: { select: { name: true } }, department: { select: { name: true } } },
            },
          },
        },
        term: true,
      },
    });

    if (!r) throw new NotFoundException('Internship request not found.');

    return {
      id: r.request.id,
      internshipId: r.id,
      requestNo: r.request.requestNo,
      title: r.request.title,
      description: r.request.description,
      status: r.request.status,
      displayStatus: (r.request as any).workflowInstance?.currentStep?.stepKey ?? r.request.status,
      currentStepName: (r.request as any).workflowInstance?.currentStep?.stepName ?? null,
      canAct:
        r.request.currentAssigneeUserId === userId ||
        (r.request as any).assignments.length > 0,
      priority: r.request.priority,
      createdAt: r.createdAt,
      companyName: r.companyName,
      companySector: r.companySector,
      companyContactName: r.companyContactName,
      companyContactEmail: r.companyContactEmail,
      internshipType: r.internshipType,
      workMode: r.workMode,
      startDate: r.startDate,
      endDate: r.endDate,
      durationDays: r.durationDays,
      insuranceRequired: r.insuranceRequired,
      currentStageNote: r.currentStageNote,
      finalDecisionNote: r.finalDecisionNote,
      student: {
        id: (r.student as any).id,
        fullName: r.student?.profile?.fullName ?? (r.student as any).email,
        studentNumber: r.student?.profile?.studentNumber ?? null,
        faculty: (r.student?.profile as any)?.faculty?.name ?? null,
        department: (r.student?.profile as any)?.department?.name ?? null,
      },
      term: r.term ?? null,
      attachments: await Promise.all(
        (r.request as any).fileLinks.map((fl: any) =>
          this.filesService.buildAttachmentResponse(fl.file),
        ),
      ),
      comments: (r.request as any).comments.map((c: any) => ({
        id: c.id,
        authorId: c.user?.id ?? null,
        author: c.user?.profile?.fullName ?? c.user?.email ?? 'Unknown',
        authorRole: c.user?.primaryRoles?.[0]?.role?.name?.toLowerCase() ?? 'unknown',
        content: c.commentText,
        createdAt: c.createdAt,
      })),
      timeline: (r.request as any).statusHistory.map((h: any) => ({
        id: h.id,
        status: h.newStatus,
        date: h.changedAt,
        note: h.changeReason,
      })),
    };
  }

  // 5. GET FACULTY CALENDAR EVENTS
  async getMyCalendarEvents(userId: string) {
    const events = await this.prisma.calendarEvent.findMany({
      where: { userId: userId },
      orderBy: { startDate: 'asc' },
    });

    return events.map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      startDate: e.startDate,
      endDate: e.endDate,
      requestId: e.requestId,
    }));
  }

  // 🔥 6. GET NOTIFICATIONS 🔥
  async getNotifications(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId: userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  // 🔥 7. BULK DELETE NOTIFICATIONS 🔥
  async deleteNotifications(userId: string, ids: string[]) {
    await this.prisma.notification.deleteMany({
      where: {
        userId: userId,
        id: { in: ids },
      },
    });

    // 🔥 AUDIT LOG 🔥
    await this.prisma.auditLog.create({
      data: {
        userId: userId,
        actionType: AuditActionType.DELETE,
        entityType: 'Notification',
        entityId: 'Multiple',
      },
    });

    return { message: 'Notifications successfully deleted.' };
  }

  // 🔥 8. MARK NOTIFICATION AS READ 🔥
  async markNotificationAsRead(userId: string, notificationId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, userId: userId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  // 🔥 9. MARK ALL NOTIFICATIONS AS READ 🔥
  async markAllNotificationsAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId: userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  // 🔥 SETTINGS: GET NOTIFICATION PREFS 🔥
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

  // 🔥 SETTINGS: UPDATE NOTIFICATION PREFS 🔥
  async updatePreferences(userId: string, data: any) {
    const updated = await this.prisma.notificationPreference.update({
      where: { userId },
      data,
    });

    // 🔥 AUDIT LOG 🔥
    await this.prisma.auditLog.create({
      data: {
        userId: userId,
        actionType: AuditActionType.UPDATE,
        entityType: 'NotificationPreference',
        entityId: updated.id,
      },
    });

    return updated;
  }

  // 🔥 SETTINGS: GET OFFICE HOURS 🔥
  async getOfficeHours(userId: string) {
    const slots = await this.prisma.userAvailabilitySlot.findMany({
      where: { userId },
      orderBy: { dayOfWeek: 'asc' },
    });

    if (slots.length > 0) {
      return { startTime: slots[0].startTime, endTime: slots[0].endTime };
    }

    return { startTime: '09:00', endTime: '17:00' };
  }

  // 🔥 SETTINGS: UPDATE OFFICE HOURS 🔥
  async updateOfficeHours(userId: string, startTime: string, endTime: string) {
    // 1. Delete old slots
    await this.prisma.userAvailabilitySlot.deleteMany({
      where: { userId },
    });

    // 2. Re-create Mon-Fri slots
    const slotsData = [1, 2, 3, 4, 5].map((day) => ({
      userId,
      dayOfWeek: day,
      startTime,
      endTime,
    }));

    await this.prisma.userAvailabilitySlot.createMany({
      data: slotsData,
    });

    // 🔥 AUDIT LOG 🔥
    await this.prisma.auditLog.create({
      data: {
        userId: userId,
        actionType: AuditActionType.UPDATE,
        entityType: 'UserAvailabilitySlot',
        entityId: userId,
      },
    });

    return { message: 'Office hours updated successfully.' };
  }

  async reviseRequest(
    userId: string,
    requestId: string,
    body: any,
  ) {
    const existing = await this.prisma.request.findFirst({
      where: { id: requestId, requesterUserId: userId },
      include: {
        requestType: true,
        itTicket: true,
        workflowInstance: true,
      },
    });

    if (!existing) throw new NotFoundException('Request not found or access denied.');
    if (existing.status !== RequestStatus.REVISION_REQUESTED) {
      throw new BadRequestException('Only revision-requested requests can be revised.');
    }

    await this.prisma.$transaction(async (tx) => {
      const updateData: any = {
        title: body.title ?? existing.title,
        description: body.description !== undefined ? body.description : existing.description,
        status: RequestStatus.IN_REVIEW,
      };

      if (body.priority !== undefined) {
        updateData.priority = body.priority;
      }

      if (body.dynamicData !== undefined) {
        updateData.dynamicData = body.dynamicData;
      }

      await tx.request.update({
        where: { id: requestId },
        data: updateData,
      });

      switch (existing.requestType?.key) {
        case 'DOCUMENT_REQUEST':
          await tx.documentRequest.updateMany({
            where: { requestId },
            data: this.definedData({
              documentType: body.documentType,
              language: this.toNullableText(body.language),
              copiesCount: this.toNullableInt(body.copiesCount),
              deliveryMethod: body.deliveryMethod,
              deliveryAddress: this.toNullableText(body.deliveryAddress),
            }),
          });
          break;
        case 'ROOM_RESERVATION':
          await tx.roomReservationRequest.updateMany({
            where: { requestId },
            data: this.definedData({
              resourceId: body.resourceId,
              eventName: body.eventName,
              reservationPurpose: body.reservationPurpose,
              attendeeCount: this.toNullableInt(body.attendeeCount),
              startAt: this.toNullableDate(body.startAt),
              endAt: this.toNullableDate(body.endAt),
              requiresSecurityApproval: body.requiresSecurityApproval,
              requiresTechnicalSupport: body.requiresTechnicalSupport,
              setupNotes: this.toNullableText(body.setupNotes),
            }),
          });
          break;
        case 'APPOINTMENT':
          await tx.appointmentRequest.updateMany({
            where: { requestId },
            data: this.definedData({
              targetUserId: body.targetUserId,
              appointmentType: body.appointmentType,
              topic: body.topic,
              details: this.toNullableText(body.details),
              preferredStartAt: this.toNullableDate(body.preferredStartAt),
              preferredEndAt: this.toNullableDate(body.preferredEndAt),
            }),
          });
          break;
        case 'PROCUREMENT_REQUEST':
          await tx.procurementRequest.updateMany({
            where: { requestId },
            data: this.definedData({
              itemName: body.itemName,
              itemCategory: body.itemCategory,
              quantity: this.toNullableInt(body.quantity),
              unitPriceEstimate: this.toNullableNumber(body.unitPriceEstimate),
              vendorPreference: this.toNullableText(body.vendorPreference),
              justification: body.justification,
              budgetCode: this.toNullableText(body.budgetCode),
            }),
          });
          break;
        case 'ACCESS_REQUEST':
          await tx.accessRequest.updateMany({
            where: { requestId },
            data: this.definedData({
              accessType: body.accessType,
              targetResource: body.targetResource,
              requestedRoleOrPermission: this.toNullableText(body.requestedRoleOrPermission),
              justification: body.justification,
              startAt: this.toNullableDate(body.startAt),
              endAt: this.toNullableDate(body.endAt),
            }),
          });
          break;
        case 'EVENT_REQUEST':
          await tx.eventRequest.updateMany({
            where: { requestId },
            data: this.definedData({
              eventName: body.eventName,
              eventType: body.eventType,
              description: body.description,
              expectedAttendance: this.toNullableInt(body.expectedAttendance),
              locationPreference: this.toNullableText(body.locationPreference),
              startAt: this.toNullableDate(body.startAt),
              endAt: this.toNullableDate(body.endAt),
              needsBudget: body.needsBudget,
              estimatedBudget: this.toNullableNumber(body.estimatedBudget),
              needsPosterApproval: body.needsPosterApproval,
              needsSecuritySupport: body.needsSecuritySupport,
              needsTechnicalSupport: body.needsTechnicalSupport,
            }),
          });
          break;
        case 'EQUIPMENT':
          await tx.equipmentRequest.updateMany({
            where: { requestId },
            data: this.definedData({
              labResourceId: this.toNullableText(body.labResourceId),
              equipmentName: body.equipmentName,
              equipmentCategory: body.equipmentCategory,
              quantity: this.toNullableInt(body.quantity),
              purpose: body.purpose,
              neededFrom: this.toNullableDate(body.neededFrom),
              neededUntil: this.toNullableDate(body.neededUntil),
              urgencyReason: this.toNullableText(body.urgencyReason),
            }),
          });
          break;
        case 'INTERNSHIP_REQUEST':
          await tx.internshipRequest.updateMany({
            where: { requestId },
            data: this.definedData({
              companyName: body.companyName,
              companySector: this.toNullableText(body.companySector),
              companyContactName: this.toNullableText(body.companyContactName),
              companyContactEmail: this.toNullableText(body.companyContactEmail),
              internshipType: body.internshipType,
              workMode: body.workMode,
              startDate: this.toNullableDate(body.startDate),
              endDate: this.toNullableDate(body.endDate),
              durationDays: this.toNullableInt(body.durationDays),
              insuranceRequired: body.insuranceRequired,
            }),
          });
          break;
        case 'IT_SUPPORT':
          await tx.itTicket.updateMany({
            where: { requestId },
            data: this.definedData({
              category: body.category,
              subcategory: this.toNullableText(body.subcategory),
              affectedSystem: this.toNullableText(body.affectedSystem),
              locationText: this.toNullableText(body.locationText),
              ticketStatus: TicketStatus.IN_PROGRESS,
            }),
          });
          break;
        default:
          break;
      }

      await tx.requestStatusHistory.create({
        data: {
          requestId,
          oldStatus: RequestStatus.REVISION_REQUESTED,
          newStatus: RequestStatus.IN_REVIEW,
          changedByUserId: userId,
          changeReason: 'Revised and resubmitted by requester.',
        },
      });

      const revisionAction = await tx.approvalAction.findFirst({
        where: { requestId, actionType: 'REQUEST_REVISION' as any },
        include: { workflowInstanceStep: true },
        orderBy: { createdAt: 'desc' },
      });

      if (revisionAction?.actionByUserId) {
        await tx.request.update({
          where: { id: requestId },
          data: { currentAssigneeUserId: revisionAction.actionByUserId },
        });

        const prevAssignment = await tx.requestAssignment.findFirst({
          where: { requestId, assignedToUserId: revisionAction.actionByUserId },
          orderBy: { assignedAt: 'desc' },
        });

        if (prevAssignment) {
          await tx.requestAssignment.update({
            where: { id: prevAssignment.id },
            data: { isActive: true, unassignedAt: null },
          });
        } else {
          await tx.requestAssignment.create({
            data: {
              requestId,
              assignedToUserId: revisionAction.actionByUserId,
              assignedByUserId: userId,
              assignmentNote: 'Resubmitted after revision.',
            },
          });
        }
      }

      const revisionStep = revisionAction?.workflowInstanceStep;
      const revisionActorUserId = revisionAction?.actionByUserId ?? null;
      if (existing.workflowInstanceId && revisionStep?.workflowStepId && revisionActorUserId) {
        await tx.workflowInstance.update({
          where: { id: existing.workflowInstanceId },
          data: {
            status: 'ACTIVE',
            endedAt: null,
            currentStepId: revisionStep.workflowStepId,
          },
        });

        const pendingStep = await tx.workflowInstanceStep.findFirst({
          where: {
            workflowInstanceId: existing.workflowInstanceId,
            workflowStepId: revisionStep.workflowStepId,
            status: 'PENDING',
          },
          orderBy: { createdAt: 'desc' },
        });

        if (pendingStep) {
          await tx.workflowInstanceStep.update({
            where: { id: pendingStep.id },
            data: { assignedToUserId: revisionActorUserId },
          });
        } else {
          await tx.workflowInstanceStep.create({
            data: {
              workflowInstanceId: existing.workflowInstanceId,
              workflowStepId: revisionStep.workflowStepId,
              status: 'PENDING',
              startedAt: new Date(),
              assignedToUserId: revisionActorUserId,
            },
          });
        }
      }
    });

    await this.cacheService.bumpVersion(CacheKeys.version(`request:detail:${requestId}`));
    await this.cacheService.bumpVersion(CacheKeys.version('staff:tickets:list'));
    return { success: true, requestId };
  }
}
