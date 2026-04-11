/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service';
import { SlaService } from '../workflow/sla.service';
import { CacheService } from '../infrastructure/cache/cache.service';
import {
  CacheKeys,
  CacheTtls,
  makeCacheHash,
} from '../infrastructure/cache/cache-keys';
import {
  RequestStatus,
  WorkflowActionType,
  AuditActionType,
} from '@prisma/client'; // 🔥 AuditActionType Added

@Injectable()
export class FacultyService {
  constructor(
    private prisma: PrismaService,
    private slaService: SlaService,
    private cacheService: CacheService,
  ) {}

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
  async getRequestDetail(userId: string, requestId: string) {
    const request = await this.prisma.request.findFirst({
      where: {
        id: requestId,
        OR: [
          { currentAssigneeUserId: userId },
          { assignments: { some: { assignedToUserId: userId } } },
          { approvalActions: { some: { actionByUserId: userId } } },
        ],
      },
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
        fileLinks: { include: { file: true } },
        currentAssignee: {
          include: {
            profile: true,
            primaryRoles: { include: { role: true } },
          },
        },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: {
            user: {
              include: {
                profile: true,
                primaryRoles: { include: { role: true } },
              },
            },
          },
        },
        assignments: {
          include: {
            assignedTo: {
              include: {
                profile: true,
                primaryRoles: { include: { role: true } },
              },
            },
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
        statusHistory: { orderBy: { changedAt: 'desc' } },
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
      attachments: request.fileLinks.map((fl) => ({
        id: fl.file.id,
        name: fl.file.originalFileName,
        size: `${(fl.file.fileSizeBytes / 1024 / 1024).toFixed(2)} MB`,
        url: fl.file.storagePath,
      })),
      comments: request.comments.map((c) => ({
        id: c.id,
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
      workflow: (() => {
        const workflowInstance = request.workflowInstance;
        if (!workflowInstance) return null;

        return {
          status: workflowInstance.status,
          currentStep: workflowInstance.currentStep?.stepName || null,
          workflowName: workflowInstance.workflowDefinition?.name || null,
          steps:
            workflowInstance.workflowDefinition?.steps?.map((step) => {
              const instanceStep = workflowInstance.instanceSteps.find(
                (item) => item.workflowStepId === step.id,
              );
              return {
                id: step.id,
                label: step.stepName,
                status:
                  step.id === workflowInstance.currentStepId
                    ? 'active'
                    : instanceStep?.status === 'COMPLETED'
                      ? 'completed'
                      : 'pending',
              };
            }) || [],
        };
      })(),
    };
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
      attachments: (r.request as any).fileLinks.map((fl: any) => ({
        id: fl.file.id,
        name: fl.file.originalFileName,
        size: fl.file.fileSizeBytes,
        url: fl.file.storagePath,
      })),
      comments: (r.request as any).comments.map((c: any) => ({
        id: c.id,
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
}
