/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service';
import { SlaService } from '../workflow/sla.service';
import { CacheService } from '../infrastructure/cache/cache.service';
import * as bcrypt from 'bcrypt';
import { UserStatus, Gender, AuditActionType, RequestStatus } from '@prisma/client';
import { AssignRoleDto } from './dto/assign-role.dto';
import { AdminUpdateProfileDto } from './dto/admin-update-profile.dto';
import { UpdateRequestTypeDto } from '../requests/dto/update-request-type.dto';
import {
  CacheKeys,
  CacheTtls,
  makeCacheHash,
} from '../infrastructure/cache/cache-keys';
import { FilesService } from '../files/files.service';
import { buildWorkflowSummary } from '../workflow/workflow-summary';

const TERMINAL_REQUEST_STATUSES: RequestStatus[] = [
  'APPROVED',
  'REJECTED',
  'CANCELLED',
  'CLOSED',
  'COMPLETED',
  'EXPIRED',
];

function deriveAdminWorkflowStepStatus(params: {
  instanceStep: any;
  isCurrent: boolean;
  requestStatus: RequestStatus;
  workflowStatus?: string | null;
  stepType?: string | null;
}) {
  const { instanceStep, isCurrent, requestStatus, workflowStatus, stepType } = params;
  const isCompletedWorkflow = workflowStatus === 'COMPLETED';
  const isTerminalRequest = TERMINAL_REQUEST_STATUSES.includes(requestStatus);

  if (instanceStep?.isOverdue) return 'warning';
  if (instanceStep?.actionTaken === 'REJECT') return 'failed';
  if (instanceStep?.actionTaken === 'REQUEST_REVISION') return 'warning';
  if (isCurrent && requestStatus === RequestStatus.REJECTED) return 'failed';
  if (isCurrent && requestStatus === RequestStatus.REVISION_REQUESTED) return 'warning';
  if (isCurrent) return 'active';
  if (instanceStep?.status === 'COMPLETED') return 'completed';
  if (instanceStep?.status === 'FAILED') return 'failed';
  if (isCompletedWorkflow && isTerminalRequest && stepType === 'END') {
    return requestStatus === RequestStatus.REJECTED ? 'failed' : 'completed';
  }
  return 'pending';
}

function shouldShowAdminWorkflowStep(params: {
  step: any;
  instanceStep: any;
  requestStatus: RequestStatus;
}) {
  const { step, instanceStep, requestStatus } = params;
  const stepKey = String(step.stepKey ?? '').toUpperCase();
  const stepName = String(step.stepName ?? '').toUpperCase();

  if (step.stepType === 'REVISION') {
    return Boolean(instanceStep) || requestStatus === RequestStatus.REVISION_REQUESTED;
  }

  if (step.stepType !== 'END') return true;

  if (requestStatus === RequestStatus.APPROVED) {
    return stepKey.includes('APPROV') || stepName.includes('APPROV');
  }

  if (requestStatus === RequestStatus.REJECTED) {
    return stepKey.includes('REJECT') || stepName.includes('REJECT');
  }

  if (
    requestStatus === RequestStatus.COMPLETED ||
    requestStatus === RequestStatus.CLOSED
  ) {
    return (
      stepKey.includes('COMPLETE') ||
      stepName.includes('COMPLETE') ||
      stepKey.includes('APPROV') ||
      stepName.includes('APPROV')
    );
  }

  if (requestStatus === RequestStatus.CANCELLED) {
    return stepKey.includes('CANCEL') || stepName.includes('CANCEL');
  }

  return Boolean(instanceStep);
}

function buildAdminWorkflowStepLabel(step: any, instanceStep: any) {
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
export class AdminService {
  private readonly primaryRoleNames = ['ADMIN', 'STUDENT', 'FACULTY', 'STAFF', 'ORGANIZER'];

  constructor(
    private prisma: PrismaService,
    private slaService: SlaService,
    private cacheService: CacheService,
    private filesService: FilesService,
  ) {}

  private async getPrimaryRoleIds() {
    const roles = await this.prisma.role.findMany({
      where: { name: { in: this.primaryRoleNames } },
      select: { id: true },
    });
    return new Set(roles.map((role) => role.id));
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
              needsTechnicalSupport: request.eventRequest.needsTechnicalSupport,
            }
          : null;
      case 'EQUIPMENT':
        return request.equipmentRequest
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
              stockCheckStatus: request.equipmentRequest.stockCheckStatus,
              procurementRequired:
                request.equipmentRequest.procurementRequired,
              estimatedCost: request.equipmentRequest.estimatedCost
                ? Number(request.equipmentRequest.estimatedCost)
                : null,
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
              ticketStatus: request.itTicket.ticketStatus,
              incidentStartedAt: request.itTicket.incidentStartedAt,
              resolvedAt: request.itTicket.resolvedAt,
              reopenedCount: request.itTicket.reopenedCount,
              resolutionSummary: request.itTicket.resolutionSummary,
              assignedTo: request.itTicket.assignedTo
                ? {
                    fullName:
                      request.itTicket.assignedTo.profile?.fullName ||
                      request.itTicket.assignedTo.email,
                  }
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

  async getAllUsers(opts: { page?: number; limit?: number; search?: string; role?: string } = {}) {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
    const skip = (page - 1) * limit;

    const searchWhere: any = { deletedAt: null };

    if (opts.search) {
      const roleSearch = opts.search.trim().replace(/[\s-]+/g, '_');
      const roleNameFilters = [
        { name: { contains: opts.search, mode: 'insensitive' } },
        ...(roleSearch !== opts.search
          ? [{ name: { contains: roleSearch, mode: 'insensitive' } }]
          : []),
      ];

      searchWhere.OR = [
        { email: { contains: opts.search, mode: 'insensitive' } },
        { profile: { fullName: { contains: opts.search, mode: 'insensitive' } } },
        {
          primaryRoles: {
            some: {
              role: { OR: roleNameFilters },
            },
          },
        },
      ];
    }

    const where: any = { ...searchWhere };

    if (opts.role && opts.role !== 'all') {
      where.primaryRoles = {
        some: {
          isPrimary: true,
          role: { name: { equals: opts.role.toUpperCase(), mode: 'insensitive' } },
        },
      };
    }

    const [users, total, allCount, roleCountRows, roles] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: {
          profile: {
            include: {
              faculty: { select: { id: true, name: true } },
              department: { select: { id: true, name: true } },
              unit: { select: { id: true, name: true } },
            },
          },
          primaryRoles: {
            include: { role: true },
            orderBy: { isPrimary: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
      this.prisma.user.count({ where: searchWhere }),
      this.prisma.userRole.groupBy({
        by: ['roleId'],
        where: {
          isPrimary: true,
          user: searchWhere,
        },
        _count: { userId: true },
      }),
      this.prisma.role.findMany({ select: { id: true, name: true } }),
    ]);

    const roleNameById = new Map(roles.map((role) => [role.id, role.name.toLowerCase()]));
    const roleCounts = roleCountRows.reduce<Record<string, number>>((acc, row) => {
      const roleName = roleNameById.get(row.roleId);
      if (roleName) acc[roleName] = row._count.userId;
      return acc;
    }, { all: allCount });

    const data = users.map((user) => ({
      id: user.id,
      name: user.profile?.fullName || 'Unnamed User',
      email: user.email,
      phoneNumber: user.phoneNumber || '',
      department:
        user.profile?.department?.name ||
        user.profile?.unit?.name ||
        user.profile?.faculty?.name ||
        user.profile?.bio ||
        'Department not specified',
      role:
        user.primaryRoles.find((item) => item.isPrimary)?.role?.name?.toLowerCase() ||
        user.primaryRoles[0]?.role?.name?.toLowerCase() ||
        'student',
      roles: user.primaryRoles
        .map((ur) => ({
          id: ur.roleId,
          name: ur.role.name,
          isPrimary: ur.isPrimary,
        }))
        .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary)),
      lastLogin: user.updatedAt,
      status: user.status.toLowerCase(),
      title: user.profile?.title || '',
      staffNumber: user.profile?.staffNumber || '',
      studentNumber: user.profile?.studentNumber || '',
      gender: user.profile?.gender || 'MALE',
      birthDate: user.profile?.birthDate ? user.profile.birthDate.toISOString() : null,
      address: user.profile?.address || '',
      bio: user.profile?.bio || '',
      createdAt: user.createdAt,
    }));

    return { data, total, page, totalPages: Math.ceil(total / limit), roleCounts };
  }

  async getRoles() {
    return this.prisma.role.findMany({
      select: { id: true, name: true },
    });
  }

  // YENİ KULLANICI OLUŞTUR (AUDIT LOG EKLENDİ)
  async createUser(adminId: string, data: any) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new ConflictException('This email address is already in use.');
    }

    if (!data.password) {
      throw new BadRequestException('Password is required.');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);
    const fullName = `${data.firstName} ${data.lastName}`.trim();
    const primaryRoleId = data.primaryRoleId || data.roleId;
    const submittedRoleIds = Array.isArray(data.roleIds) ? data.roleIds : [];
    const primaryRoleIds = await this.getPrimaryRoleIds();
    const roleIds = Array.from(
      new Set(
        [
          primaryRoleId,
          ...submittedRoleIds.filter(
            (roleId) => roleId === primaryRoleId || !primaryRoleIds.has(roleId),
          ),
        ].filter(
          (value): value is string => typeof value === 'string' && value.length > 0,
        ),
      ),
    );

    if (roleIds.length === 0) {
      throw new BadRequestException('At least one role is required.');
    }

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: data.email,
          password: hashedPassword,
          phoneNumber: data.phoneNumber || null,
          status: (data.status as UserStatus) || UserStatus.ACTIVE,
          isEmailVerified: true,
          profile: {
            create: {
              firstName: data.firstName,
              lastName: data.lastName,
              fullName: fullName,
              title: data.title || null,
              staffNumber: data.staffNumber || null,
              studentNumber: data.studentNumber || null,
              gender: (data.gender as Gender) || null,
              birthDate: data.birthDate ? new Date(data.birthDate) : null,
              address: data.address || null,
              bio: data.bio || null,
              avatarUrl: data.avatarUrl || null,
            },
          },
        },
      });

      for (const roleId of roleIds) {
        await tx.userRole.create({
          data: {
            userId: user.id,
            roleId,
            isPrimary: roleId === primaryRoleId,
          },
        });
      }

      // 🔥 AUDIT LOG: USER CREATED 🔥
      await tx.auditLog.create({
        data: {
          userId: adminId,
          actionType: AuditActionType.CREATE,
          entityType: 'User',
          entityId: user.id,
        },
      });

      return { message: 'User successfully created', userId: user.id };
    });
  }

  // KULLANICI GÜNCELLE (AUDIT LOG EKLENDİ)
  async updateUser(adminId: string, id: string, data: any) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { profile: true, primaryRoles: true },
    });

    if (!user) throw new NotFoundException('User not found.');

    let passwordData = {};
    if (data.password && data.password.trim() !== '') {
      passwordData = { password: await bcrypt.hash(data.password, 10) };
    }

    const fullName = `${data.firstName} ${data.lastName}`.trim();
    const primaryRoleId = data.primaryRoleId || data.roleId;
    const submittedRoleIds = Array.isArray(data.roleIds) ? data.roleIds : [];
    const primaryRoleIds = await this.getPrimaryRoleIds();
    const roleIds = Array.from(
      new Set(
        [
          primaryRoleId,
          ...submittedRoleIds.filter(
            (roleId) => roleId === primaryRoleId || !primaryRoleIds.has(roleId),
          ),
        ].filter(
          (value): value is string => typeof value === 'string' && value.length > 0,
        ),
      ),
    );

    if (roleIds.length === 0) {
      throw new BadRequestException('At least one role is required.');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Update Core User
      await tx.user.update({
        where: { id },
        data: {
          email: data.email,
          phoneNumber: data.phoneNumber || null,
          status: (data.status as UserStatus) || user.status,
          ...passwordData,
        },
      });

      // 2. Update Profile
      if (user.profile) {
        await tx.userProfile.update({
          where: { userId: id },
          data: {
            firstName: data.firstName,
            lastName: data.lastName,
            fullName: fullName || user.profile.fullName,
            title: data.title || null,
            staffNumber: data.staffNumber || null,
            studentNumber: data.studentNumber || null,
            gender: (data.gender as Gender) || null,
            birthDate: data.birthDate ? new Date(data.birthDate) : null,
            address: data.address || null,
            bio: data.bio || null,
            avatarUrl: data.avatarUrl !== undefined ? data.avatarUrl || null : user.profile.avatarUrl,
          },
        });
      }

      // 3. Update Roles
      await tx.userRole.deleteMany({ where: { userId: id } });
      for (const roleId of roleIds) {
        await tx.userRole.create({
          data: {
            userId: id,
            roleId,
            isPrimary: roleId === primaryRoleId,
          },
        });
      }

      // 🔥 AUDIT LOG: USER UPDATED 🔥
      await tx.auditLog.create({
        data: {
          userId: adminId,
          actionType: AuditActionType.UPDATE,
          entityType: 'User',
          entityId: id,
        },
      });

      return { message: 'User successfully updated' };
    });
  }

  // KULLANICI SİL (AUDIT LOG EKLENDİ)
  async deleteUser(adminId: string, id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found.');

    const deletedAt = new Date();
    const anonymizedEmail = `deleted-${id}-${deletedAt.getTime()}@deleted.local`;

    await this.prisma.$transaction(async (tx) => {
      await tx.requestAssignment.updateMany({
        where: { assignedToUserId: id, isActive: true },
        data: { isActive: false, unassignedAt: deletedAt },
      });

      await tx.request.updateMany({
        where: { currentAssigneeUserId: id },
        data: { currentAssigneeUserId: null },
      });

      await tx.userRole.deleteMany({ where: { userId: id } });

      await tx.userProfile.deleteMany({ where: { userId: id } });

      await tx.user.update({
        where: { id },
        data: {
          email: anonymizedEmail,
          phoneNumber: null,
          status: UserStatus.INACTIVE,
          isEmailVerified: false,
          deletedAt,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: adminId,
          actionType: AuditActionType.DELETE,
          entityType: 'User',
          entityId: id,
          oldValuesJson: { email: user.email },
        },
      });
    });

    return { message: 'User successfully deleted' };
/*
    // Delete uploaded files first (FK: File.uploadedByUserId -> User.id)
    const userFiles = await this.prisma.file.findMany({
      where: { uploadedByUserId: id },
      select: { id: true },
    });
    if (userFiles.length > 0) {
      const fileIds = userFiles.map((f) => f.id);
      await this.prisma.fileLink.deleteMany({ where: { fileId: { in: fileIds } } });
      await this.prisma.file.deleteMany({ where: { uploadedByUserId: id } });
    }

    try {
      await this.prisma.user.update({
        where: { id },
        data: { profile: { delete: true } },
      });
      // eslint-disable-next-line no-empty
    } catch (e) {}

    await this.prisma.user.delete({ where: { id } });

    // 🔥 AUDIT LOG: USER DELETED 🔥
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        actionType: AuditActionType.DELETE,
        entityType: 'User',
        entityId: id,
      },
    });

    return { message: 'User successfully deleted' };
*/
  }

  // TOPLU SİLME FONKSİYONU (Requests)
  async bulkDeleteRequests(requestIds: string[]) {
    if (!requestIds || requestIds.length === 0) {
      throw new BadRequestException('No IDs provided for deletion');
    }
    return this.prisma.request.deleteMany({
      where: { id: { in: requestIds } },
    });
  }

  async getAllRequests() {
    const version = await this.cacheService.getVersion(
      CacheKeys.version('admin:requests:list'),
    );
    const key = CacheKeys.adminRequestsList(
      makeCacheHash({ scope: 'all' }),
      version,
    );

    return this.cacheService.getOrSet(key, CacheTtls.medium, async () => {
      const requests = await this.prisma.request.findMany({
        include: {
          requester: { include: { profile: true } },
          requestType: true,
          currentAssignee: { include: { profile: true } },
          assignments: {
            where: { isActive: true },
            include: { assignedTo: { include: { profile: true } } },
            orderBy: { assignedAt: 'desc' },
          },
          itTicket: { include: { assignedTo: { include: { profile: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      });

      return requests.map((req) => {
        const assignedToNames = req.assignments
          .map((assignment) =>
            assignment.assignedTo.profile?.fullName || assignment.assignedTo.email,
          )
          .filter(Boolean);

        const itTicketAssignee = (req as any).itTicket?.assignedTo?.profile?.fullName
          || (req as any).itTicket?.assignedTo?.email;

        return {
        id: req.id,
        requestNo: req.requestNo,
        title: req.title,
        status: req.status,
        priority: req.priority,
        type: req.requestType.key,
        typeName: req.requestType.name,
        submittedByName:
          req.requester.profile?.fullName || req.requester.email,
        assignedToName:
          assignedToNames.length > 0
            ? assignedToNames.join(', ')
            : req.currentAssignee?.profile?.fullName || itTicketAssignee || 'Unassigned',
        assignedToNames,
        createdAt: req.createdAt,
        updatedAt: req.updatedAt,
        };
      });
    });
  }

  async getRequestById(requestId: string) {
    const version = await this.cacheService.getVersion(
      CacheKeys.version(`request:detail:${requestId}`),
    );
    const cacheKey = `admin:request:detail:${requestId}:v${version}:workflow-preview-v8`;

    return this.cacheService.getOrSet(cacheKey, CacheTtls.long, async () => {
    const request = await this.prisma.request.findUnique({
      where: { id: requestId },
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
        currentAssignee: {
          select: {
            id: true,
            email: true,
            profile: { select: { fullName: true, title: true } },
            primaryRoles: { select: { role: { select: { name: true } } }, take: 1 },
          },
        },
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
        statusHistory: { orderBy: { changedAt: 'desc' } },
        comments: {
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
          orderBy: { createdAt: 'asc' },
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
                primaryRoles: { select: { role: { select: { name: true } } }, take: 1 },
              },
            },
            workflowInstanceStep: {
              select: { workflowStep: { select: { id: true, stepKey: true, stepName: true } } },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
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
        internshipRequest: true,
        itTicket: {
          include: {
            assignedTo: {
              select: {
                id: true,
                email: true,
                profile: { select: { fullName: true } },
              },
            },
          },
        },
      },
    });
    if (!request) throw new NotFoundException('Request not found');

    return {
      id: request.id,
      requestNo: request.requestNo,
      title: request.title,
      description: request.description,
      status: request.status,
      priority: request.priority,
      createdAt: request.createdAt,
      submittedAt: request.submittedAt,
      dueAt: request.dueAt,
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
        role: request.requester.primaryRoles?.[0]?.role?.name || null,
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
      assignedToNames: request.assignments
        .filter((assignment) => assignment.isActive)
        .map((assignment) =>
          assignment.assignedTo?.profile?.fullName ||
          assignment.assignedTo?.email ||
          null,
        )
        .filter(Boolean),
      formData: this.buildRequestDomainData(request),
      attachments: await Promise.all(
        request.fileLinks.map((fl) => this.filesService.buildAttachmentResponse(fl.file)),
      ),
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
      statusHistory: request.statusHistory.map((h) => ({
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
          role: action.actionBy.primaryRoles?.[0]?.role?.name ?? null,
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

  async deleteRequest(requestId: string) {
    const request = await this.prisma.request.findUnique({
      where: { id: requestId },
    });
    if (!request) throw new NotFoundException('Request not found');
    const result = await this.prisma.request.delete({ where: { id: requestId } });
    await Promise.all([
      this.cacheService.bumpVersion(CacheKeys.version(`request:detail:${requestId}`)),
      this.cacheService.bumpVersion(CacheKeys.version('admin:requests:list')),
      this.cacheService.bumpVersion(CacheKeys.version('admin:dashboard:summary')),
    ]);
    return result;
  }

  // 🔥 BİLDİRİM (NOTIFICATION) OPERASYONLARI 🔥
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
    return { message: 'Notifications successfully deleted.' };
  }

  // 🔥 AYARLAR VE GÜVENLİK YÖNETİMİ 🔥
  async getPreferences(userId: string) {
    let prefs = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });
    if (!prefs)
      prefs = await this.prisma.notificationPreference.create({
        data: { userId },
      });
    return prefs;
  }

  async updatePreferences(userId: string, data: any) {
    return this.prisma.notificationPreference.update({
      where: { userId },
      data: {
        emailEnabled: data.emailEnabled,
        inAppEnabled: data.inAppEnabled,
        marketingEmailEnabled: data.marketingEmailEnabled,
        reminderEmailEnabled: data.reminderEmailEnabled,
      },
    });
  }

  async changePassword(userId: string, body: any) {
    const { currentPassword, newPassword } = body;
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');

    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );
    if (!isPasswordValid)
      throw new BadRequestException('Current password is incorrect!');
    if (newPassword.length < 6)
      throw new BadRequestException(
        'New password must be at least 6 characters long.',
      );

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword },
    });
    return { message: 'Password successfully updated.' };
  }

  // Admin'in kendi bilgilerini çek ve güncelle
  async getMe(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
  }

  async updateMe(userId: string, data: any) {
    const firstName = data.firstName ?? data.name?.trim().split(' ')[0] ?? '';
    const lastName = data.lastName ?? (data.name?.trim().split(' ').slice(1).join(' ') ?? '');
    const fullName = `${firstName} ${lastName}`.trim();

    return this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          email: data.email,
          phoneNumber: data.phoneNumber || null,
        },
      });
      await tx.userProfile.upsert({
        where: { userId },
        update: {
          firstName,
          lastName,
          fullName,
          title: data.title || null,
          gender: data.gender || null,
          birthDate: data.birthDate ? new Date(data.birthDate) : null,
          address: data.address || null,
          bio: data.bio || null,
          avatarUrl: data.avatarUrl !== undefined ? data.avatarUrl || null : undefined,
        },
        create: {
          userId,
          firstName,
          lastName,
          fullName,
          title: data.title || null,
          gender: data.gender || null,
          birthDate: data.birthDate ? new Date(data.birthDate) : null,
          address: data.address || null,
          bio: data.bio || null,
          avatarUrl: data.avatarUrl || null,
        },
      });
      return { message: 'Profile updated successfully' };
    });
  }

  // 🔥 TALEP TİPLERİ (REQUEST TYPES) OPERASYONLARI 🔥

  async getRequestTypes() {
    return this.prisma.requestType.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async createRequestType(data: any) {
    const existing = await this.prisma.requestType.findUnique({
      where: { key: data.key },
    });

    if (existing) {
      throw new BadRequestException(
        'A request type with this unique key already exists.',
      );
    }

    return this.prisma.requestType.create({
      data: {
        name: data.name,
        key: data.key,
        category: data.category,
        description: data.description || null,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });
  }

  async bulkDeleteRequestTypes(ids: string[]) {
    if (!ids || ids.length === 0) {
      throw new BadRequestException('No IDs provided for deletion.');
    }

    try {
      const result = await this.prisma.requestType.deleteMany({
        where: {
          id: { in: ids },
        },
      });

      return {
        message: `${result.count} request types deleted successfully.`,
        count: result.count,
      };
    } catch (error) {
      throw new BadRequestException(
        'Cannot delete request types that have active requests linked to them. Delete the requests first.',
      );
    }
  }

  // 🔥 AUDIT (SİSTEM GEÇMİŞİ) İŞLEMLERİ 🔥
  async getAuditLogs(opts: { page?: number; limit?: number; search?: string } = {}) {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(200, Math.max(10, opts.limit ?? 100));
    const fetchCount = page * limit + limit; // fetch extra for pagination

    const [audits, logins] = await Promise.all([
      this.prisma.auditLog.findMany({
        include: { user: { include: { profile: true } } },
        orderBy: { createdAt: 'desc' },
        take: fetchCount,
      }),
      this.prisma.loginHistory.findMany({
        include: { user: { include: { profile: true } } },
        orderBy: { loginAt: 'desc' },
        take: fetchCount,
      }),
    ]);

    const combinedLogs: Array<{
      id: string;
      action: string;
      actor: string;
      target: string;
      ip: string;
      status: string;
      timestamp: Date;
    }> = [];

    audits.forEach((a) => {
      combinedLogs.push({
        id: a.id,
        action: a.actionType,
        actor: a.user?.profile?.fullName || a.user?.email || 'System',
        target: `${a.entityType} (${a.entityId})`,
        ip: a.ipAddress || 'Unknown',
        status: 'success',
        timestamp: a.createdAt,
      });
    });

    logins.forEach((l) => {
      combinedLogs.push({
        id: l.id,
        action: 'LOGIN',
        actor: l.user?.profile?.fullName || l.user?.email || 'Unknown User',
        target: 'System Authentication',
        ip: l.ipAddress || 'Unknown',
        status: l.success ? 'success' : 'failed',
        timestamp: l.loginAt,
      });
    });

    combinedLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    const search = opts.search?.toLowerCase();
    const filtered = search
      ? combinedLogs.filter(
          (l) =>
            l.action.toLowerCase().includes(search) ||
            l.actor.toLowerCase().includes(search) ||
            l.target.toLowerCase().includes(search) ||
            l.ip.includes(search),
        )
      : combinedLogs;

    const offset = (page - 1) * limit;
    const paginated = filtered.slice(offset, offset + limit);

    return {
      data: paginated,
      total: filtered.length,
      page,
      limit,
      totalPages: Math.ceil(filtered.length / limit),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ORGANIZATION MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────

  async getOrganization() {
    const [campuses, faculties, departments, units] = await Promise.all([
      this.prisma.campus.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.faculty.findMany({
        include: { campus: { select: { id: true, name: true } } },
        orderBy: { name: 'asc' },
      }),
      this.prisma.department.findMany({
        include: { faculty: { select: { id: true, name: true } } },
        orderBy: { name: 'asc' },
      }),
      this.prisma.unit.findMany({
        include: {
          campus: { select: { id: true, name: true } },
          faculty: { select: { id: true, name: true } },
          department: { select: { id: true, name: true } },
        },
        orderBy: { name: 'asc' },
      }),
    ]);
    return { campuses, faculties, departments, units };
  }

  // CAMPUS CRUD
  async getCampuses() {
    return this.prisma.campus.findMany({ orderBy: { name: 'asc' } });
  }

  async createCampus(adminId: string, data: any) {
    const campus = await this.prisma.campus.create({
      data: {
        name: data.name,
        code: data.code,
        address: data.address || null,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        actionType: AuditActionType.CREATE,
        entityType: 'Campus',
        entityId: campus.id,
      },
    });
    return campus;
  }

  async updateCampus(adminId: string, id: string, data: any) {
    const existing = await this.prisma.campus.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Campus not found.');
    const campus = await this.prisma.campus.update({
      where: { id },
      data: {
        name: data.name !== undefined ? data.name : existing.name,
        code: data.code !== undefined ? data.code : existing.code,
        address: data.address !== undefined ? data.address : existing.address,
        isActive: data.isActive !== undefined ? data.isActive : existing.isActive,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        actionType: AuditActionType.UPDATE,
        entityType: 'Campus',
        entityId: id,
      },
    });
    return campus;
  }

  async deleteCampus(adminId: string, id: string) {
    const existing = await this.prisma.campus.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Campus not found.');
    await this.prisma.campus.delete({ where: { id } });
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        actionType: AuditActionType.DELETE,
        entityType: 'Campus',
        entityId: id,
      },
    });
    return { message: 'Campus deleted successfully.' };
  }

  // FACULTY CRUD
  async getFaculties() {
    return this.prisma.faculty.findMany({
      include: { campus: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async createFaculty(adminId: string, data: any) {
    const faculty = await this.prisma.faculty.create({
      data: {
        campusId: data.campusId,
        name: data.name,
        code: data.code,
        deanUserId: data.deanUserId || null,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        actionType: AuditActionType.CREATE,
        entityType: 'Faculty',
        entityId: faculty.id,
      },
    });
    return faculty;
  }

  async updateFaculty(adminId: string, id: string, data: any) {
    const existing = await this.prisma.faculty.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Faculty not found.');
    const faculty = await this.prisma.faculty.update({
      where: { id },
      data: {
        campusId: data.campusId !== undefined ? data.campusId : existing.campusId,
        name: data.name !== undefined ? data.name : existing.name,
        code: data.code !== undefined ? data.code : existing.code,
        deanUserId: data.deanUserId !== undefined ? data.deanUserId : existing.deanUserId,
        isActive: data.isActive !== undefined ? data.isActive : existing.isActive,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        actionType: AuditActionType.UPDATE,
        entityType: 'Faculty',
        entityId: id,
      },
    });
    return faculty;
  }

  async deleteFaculty(adminId: string, id: string) {
    const existing = await this.prisma.faculty.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Faculty not found.');
    await this.prisma.faculty.delete({ where: { id } });
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        actionType: AuditActionType.DELETE,
        entityType: 'Faculty',
        entityId: id,
      },
    });
    return { message: 'Faculty deleted successfully.' };
  }

  // DEPARTMENT CRUD
  async getDepartments() {
    return this.prisma.department.findMany({
      include: { faculty: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async createDepartment(adminId: string, data: any) {
    const department = await this.prisma.department.create({
      data: {
        facultyId: data.facultyId,
        name: data.name,
        code: data.code,
        chairUserId: data.chairUserId || null,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        actionType: AuditActionType.CREATE,
        entityType: 'Department',
        entityId: department.id,
      },
    });
    return department;
  }

  async updateDepartment(adminId: string, id: string, data: any) {
    const existing = await this.prisma.department.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Department not found.');
    const department = await this.prisma.department.update({
      where: { id },
      data: {
        facultyId: data.facultyId !== undefined ? data.facultyId : existing.facultyId,
        name: data.name !== undefined ? data.name : existing.name,
        code: data.code !== undefined ? data.code : existing.code,
        chairUserId: data.chairUserId !== undefined ? data.chairUserId : existing.chairUserId,
        isActive: data.isActive !== undefined ? data.isActive : existing.isActive,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        actionType: AuditActionType.UPDATE,
        entityType: 'Department',
        entityId: id,
      },
    });
    return department;
  }

  async deleteDepartment(adminId: string, id: string) {
    const existing = await this.prisma.department.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Department not found.');
    await this.prisma.department.delete({ where: { id } });
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        actionType: AuditActionType.DELETE,
        entityType: 'Department',
        entityId: id,
      },
    });
    return { message: 'Department deleted successfully.' };
  }

  // UNIT CRUD
  async getUnits() {
    return this.prisma.unit.findMany({
      include: {
        campus: { select: { id: true, name: true } },
        faculty: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createUnit(adminId: string, data: any) {
    const unit = await this.prisma.unit.create({
      data: {
        name: data.name,
        code: data.code,
        type: data.type,
        campusId: data.campusId || null,
        facultyId: data.facultyId || null,
        departmentId: data.departmentId || null,
        managerUserId: data.managerUserId || null,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        actionType: AuditActionType.CREATE,
        entityType: 'Unit',
        entityId: unit.id,
      },
    });
    return unit;
  }

  async updateUnit(adminId: string, id: string, data: any) {
    const existing = await this.prisma.unit.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Unit not found.');
    const unit = await this.prisma.unit.update({
      where: { id },
      data: {
        name: data.name !== undefined ? data.name : existing.name,
        code: data.code !== undefined ? data.code : existing.code,
        type: data.type !== undefined ? data.type : existing.type,
        campusId: data.campusId !== undefined ? data.campusId : existing.campusId,
        facultyId: data.facultyId !== undefined ? data.facultyId : existing.facultyId,
        departmentId: data.departmentId !== undefined ? data.departmentId : existing.departmentId,
        managerUserId: data.managerUserId !== undefined ? data.managerUserId : existing.managerUserId,
        isActive: data.isActive !== undefined ? data.isActive : existing.isActive,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        actionType: AuditActionType.UPDATE,
        entityType: 'Unit',
        entityId: id,
      },
    });
    return unit;
  }

  async deleteUnit(adminId: string, id: string) {
    const existing = await this.prisma.unit.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Unit not found.');
    await this.prisma.unit.delete({ where: { id } });
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        actionType: AuditActionType.DELETE,
        entityType: 'Unit',
        entityId: id,
      },
    });
    return { message: 'Unit deleted successfully.' };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ROLES FULL CRUD
  // ─────────────────────────────────────────────────────────────────────────

  async getRolesFull() {
    const roles = await this.prisma.role.findMany({
      include: { _count: { select: { permissions: true, userRoles: true } } },
      orderBy: { name: 'asc' },
    });
    return roles.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      scopeType: r.scopeType,
      isSystem: r.isSystem,
      permissionsCount: r._count.permissions,
      usersCount: r._count.userRoles,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  async createRole(adminId: string, data: any) {
    const existing = await this.prisma.role.findUnique({ where: { name: data.name } });
    if (existing) throw new BadRequestException('A role with this name already exists.');
    const role = await this.prisma.role.create({
      data: {
        name: data.name,
        description: data.description || null,
        scopeType: data.scopeType,
        isSystem: data.isSystem !== undefined ? data.isSystem : false,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        actionType: AuditActionType.CREATE,
        entityType: 'Role',
        entityId: role.id,
      },
    });
    return role;
  }

  async updateRole(adminId: string, id: string, data: any) {
    const existing = await this.prisma.role.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Role not found.');
    if (existing.isSystem) throw new BadRequestException('System roles cannot be modified.');
    const role = await this.prisma.role.update({
      where: { id },
      data: {
        name: data.name !== undefined ? data.name : existing.name,
        description: data.description !== undefined ? data.description : existing.description,
        scopeType: data.scopeType !== undefined ? data.scopeType : existing.scopeType,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        actionType: AuditActionType.UPDATE,
        entityType: 'Role',
        entityId: id,
      },
    });
    return role;
  }

  async deleteRole(adminId: string, id: string) {
    const existing = await this.prisma.role.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Role not found.');
    if (existing.isSystem) throw new BadRequestException('System roles cannot be deleted.');
    await this.prisma.role.delete({ where: { id } });
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        actionType: AuditActionType.DELETE,
        entityType: 'Role',
        entityId: id,
      },
    });
    return { message: 'Role deleted successfully.' };
  }

  async getPermissions() {
    return this.prisma.permission.findMany({ orderBy: { name: 'asc' } });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RESOURCES CRUD
  // ─────────────────────────────────────────────────────────────────────────

  async getResources(opts: { page?: number; limit?: number; search?: string; type?: string } = {}) {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (opts.type && opts.type !== 'all') {
      where.resourceType = opts.type.toUpperCase();
    }

    if (opts.search) {
      where.OR = [
        { name: { contains: opts.search, mode: 'insensitive' } },
        { code: { contains: opts.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.resource.findMany({
        where,
        include: {
          campus: { select: { id: true, name: true } },
          faculty: { select: { id: true, name: true } },
          department: { select: { id: true, name: true } },
          unit: { select: { id: true, name: true } },
        },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.resource.count({ where }),
    ]);

    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  async createResource(adminId: string, data: any) {
    const resource = await this.prisma.resource.create({
      data: {
        resourceType: data.resourceType,
        code: data.code,
        name: data.name,
        description: data.description || null,
        campusId: data.campusId || null,
        facultyId: data.facultyId || null,
        departmentId: data.departmentId || null,
        unitId: data.unitId || null,
        locationText: data.locationText || null,
        capacity: data.capacity || null,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        actionType: AuditActionType.CREATE,
        entityType: 'Resource',
        entityId: resource.id,
      },
    });
    return resource;
  }

  async updateResource(adminId: string, id: string, data: any) {
    const existing = await this.prisma.resource.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Resource not found.');
    const resource = await this.prisma.resource.update({
      where: { id },
      data: {
        resourceType: data.resourceType !== undefined ? data.resourceType : existing.resourceType,
        code: data.code !== undefined ? data.code : existing.code,
        name: data.name !== undefined ? data.name : existing.name,
        description: data.description !== undefined ? data.description : existing.description,
        campusId: data.campusId !== undefined ? data.campusId : existing.campusId,
        facultyId: data.facultyId !== undefined ? data.facultyId : existing.facultyId,
        departmentId: data.departmentId !== undefined ? data.departmentId : existing.departmentId,
        unitId: data.unitId !== undefined ? data.unitId : existing.unitId,
        locationText: data.locationText !== undefined ? data.locationText : existing.locationText,
        capacity: data.capacity !== undefined ? data.capacity : existing.capacity,
        isActive: data.isActive !== undefined ? data.isActive : existing.isActive,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        actionType: AuditActionType.UPDATE,
        entityType: 'Resource',
        entityId: id,
      },
    });
    return resource;
  }

  async getResourceById(id: string) {
    const r = await this.prisma.resource.findUnique({
      where: { id },
      include: {
        campus: { select: { id: true, name: true } },
        faculty: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        unit: { select: { id: true, name: true } },
        availabilitySlots: { orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] },
      },
    });
    if (!r) throw new NotFoundException('Resource not found.');
    return r;
  }

  async deleteResource(adminId: string, id: string) {
    const existing = await this.prisma.resource.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Resource not found.');
    await this.prisma.resource.delete({ where: { id } });
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        actionType: AuditActionType.DELETE,
        entityType: 'Resource',
        entityId: id,
      },
    });
    return { message: 'Resource deleted successfully.' };
  }

  async replaceResourceAvailability(
    adminId: string,
    id: string,
    slots: { dayOfWeek: number; startTime: string; endTime: string; isAvailable?: boolean }[],
  ) {
    const existing = await this.prisma.resource.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Resource not found.');
    await this.prisma.$transaction(async (tx) => {
      await tx.resourceAvailability.deleteMany({ where: { resourceId: id } });
      if (slots.length > 0) {
        await tx.resourceAvailability.createMany({
          data: slots.map((s) => ({
            resourceId: id,
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
            isAvailable: s.isAvailable !== false,
          })),
        });
      }
    });
    await this.prisma.auditLog.create({
      data: { userId: adminId, actionType: AuditActionType.UPDATE, entityType: 'ResourceAvailability', entityId: id },
    });
    return this.prisma.resourceAvailability.findMany({
      where: { resourceId: id },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // READ-ONLY LISTS
  // ─────────────────────────────────────────────────────────────────────────

  async getReservations() {
    return this.prisma.reservation.findMany({
      include: {
        resource: { select: { id: true, name: true, resourceType: true } },
        reservedBy: { include: { profile: { select: { fullName: true } } } },
        approvedBy: { include: { profile: { select: { fullName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async getAppointments() {
    return this.prisma.appointment.findMany({
      include: {
        requester: { include: { profile: { select: { fullName: true } } } },
        host: { include: { profile: { select: { fullName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async getTickets() {
    return this.prisma.itTicket.findMany({
      include: {
        request: { select: { id: true, requestNo: true, title: true, status: true } },
        reportedBy: { include: { profile: { select: { fullName: true } } } },
        assignedTo: { include: { profile: { select: { fullName: true } } } },
        slaPolicy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async getSLAPolicies(opts: { page?: number; limit?: number } = {}) {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.slaPolicy.findMany({
        include: { requestType: { select: { id: true, name: true, key: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.slaPolicy.count(),
    ]);

    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  async getSLAEvents(opts: { page?: number; limit?: number } = {}) {
    return this.slaService.getSLAEvents(opts);
  }

  async getSLAOverview() {
    const [requestVersion, slaVersion] = await Promise.all([
      this.cacheService.getVersion(CacheKeys.version('admin:requests:list')),
      this.cacheService.getVersion(CacheKeys.version('admin:sla:overview')),
    ]);
    const key = CacheKeys.adminSlaOverview(requestVersion, slaVersion);

    return this.cacheService.getOrSet(key, CacheTtls.sla, async () =>
      this.slaService.getAdminOverview(),
    );
  }

  async createSLAPolicy(adminId: string, data: any) {
    const policy = await this.prisma.slaPolicy.create({
      data: {
        name: data.name,
        requestTypeId: data.requestTypeId || null,
        priority: data.priority || null,
        firstResponseMinutes: data.firstResponseMinutes || null,
        resolutionMinutes: data.resolutionMinutes || null,
        escalationMinutes: data.escalationMinutes || null,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        actionType: AuditActionType.CREATE,
        entityType: 'SlaPolicy',
        entityId: policy.id,
      },
    });
    await Promise.all([
      this.cacheService.bumpVersion(CacheKeys.version('admin:sla:policies')),
      this.cacheService.bumpVersion(CacheKeys.version('admin:sla:overview')),
    ]);
    return policy;
  }

  async getSLAPolicyById(id: string) {
    const p = await this.prisma.slaPolicy.findUnique({
      where: { id },
      include: { requestType: { select: { id: true, name: true, key: true } } },
    });
    if (!p) throw new NotFoundException('SLA Policy not found.');
    return p;
  }

  async updateSLAPolicy(adminId: string, id: string, data: any) {
    const existing = await this.prisma.slaPolicy.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('SLA Policy not found.');
    const policy = await this.prisma.slaPolicy.update({
      where: { id },
      data: {
        name: data.name !== undefined ? data.name : existing.name,
        requestTypeId: data.requestTypeId !== undefined ? (data.requestTypeId || null) : existing.requestTypeId,
        priority: data.priority !== undefined ? (data.priority || null) : existing.priority,
        firstResponseMinutes: data.firstResponseMinutes !== undefined ? (data.firstResponseMinutes || null) : existing.firstResponseMinutes,
        resolutionMinutes: data.resolutionMinutes !== undefined ? (data.resolutionMinutes || null) : existing.resolutionMinutes,
        escalationMinutes: data.escalationMinutes !== undefined ? (data.escalationMinutes || null) : existing.escalationMinutes,
        isActive: data.isActive !== undefined ? data.isActive : existing.isActive,
      },
      include: { requestType: { select: { id: true, name: true, key: true } } },
    });
    await this.prisma.auditLog.create({
      data: { userId: adminId, actionType: AuditActionType.UPDATE, entityType: 'SlaPolicy', entityId: id },
    });
    await Promise.all([
      this.cacheService.bumpVersion(CacheKeys.version('admin:sla:policies')),
      this.cacheService.bumpVersion(CacheKeys.version('admin:sla:overview')),
    ]);
    return policy;
  }

  async deleteSLAPolicy(adminId: string, id: string) {
    const existing = await this.prisma.slaPolicy.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('SLA Policy not found.');
    await this.prisma.slaPolicy.delete({ where: { id } });
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        actionType: AuditActionType.DELETE,
        entityType: 'SlaPolicy',
        entityId: id,
      },
    });
    await Promise.all([
      this.cacheService.bumpVersion(CacheKeys.version('admin:sla:policies')),
      this.cacheService.bumpVersion(CacheKeys.version('admin:sla:overview')),
    ]);
    return { message: 'SLA Policy deleted successfully.' };
  }

  async getSystemEvents(severity?: string) {
    const where: any = {};
    if (severity && severity !== 'all') where.severity = severity.toUpperCase();
    const events = await this.prisma.systemEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
    return events.map((e) => ({
      id: e.id,
      eventType: e.eventKey,
      severity: e.severity,
      message: e.message,
      source: e.sourceService,
      entityType: e.entityType ?? null,
      entityId: e.entityId ?? null,
      metadata: e.metadataJson ?? null,
      createdAt: e.createdAt,
    }));
  }

  async getWebhookLogs(success?: string) {
    const where: any = {};
    if (success === 'success') where.status = 'SUCCESS';
    else if (success === 'failure') where.status = { not: 'SUCCESS' };
    const logs = await this.prisma.webhookLog.findMany({
      where,
      include: {
        integration: { select: { id: true, name: true, provider: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
    return logs.map((l) => ({
      id: l.id,
      url: l.endpointUrl,
      method: l.httpMethod,
      statusCode: l.responseStatusCode ?? null,
      success: l.status === 'SUCCESS',
      responseTime: (l as any).responseTimeMs ?? null,
      payload: l.requestBodyJson ? JSON.stringify(l.requestBodyJson) : null,
      response: l.responseBodyJson ? JSON.stringify(l.responseBodyJson) : null,
      retryCount: l.retryCount,
      direction: l.direction,
      integration: l.integration ?? null,
      createdAt: l.createdAt,
    }));
  }

  async createIntegration(adminId: string, data: any) {
    if (!data.key || !data.name || !data.provider) {
      throw new BadRequestException('key, name and provider are required.');
    }
    const existing = await this.prisma.integration.findUnique({ where: { key: data.key } });
    if (existing) throw new BadRequestException('An integration with this key already exists.');
    const integration = await this.prisma.integration.create({
      data: {
        key: String(data.key).toUpperCase().replace(/\s+/g, '_'),
        name: data.name,
        provider: data.provider,
        isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
        configJson: data.webhookUrl ? { webhookUrl: data.webhookUrl } : {},
        createdByUserId: adminId,
      },
    });
    await this.prisma.systemEvent.create({
      data: {
        eventKey: 'INTEGRATION_CREATED',
        severity: 'INFO',
        sourceService: 'admin',
        entityType: 'Integration',
        entityId: integration.id,
        message: `Integration "${integration.name}" (${integration.provider}) created.`,
      },
    });
    return { ...integration, webhookUrl: data.webhookUrl ?? null };
  }

  async updateIntegration(adminId: string, id: string, data: any) {
    const existing = await this.prisma.integration.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Integration not found.');
    const existingConfig = (existing.configJson as Record<string, unknown>) ?? {};
    const mergedConfig = data.webhookUrl !== undefined
      ? { ...existingConfig, webhookUrl: data.webhookUrl }
      : existingConfig;
    const integration = await this.prisma.integration.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.isActive !== undefined && { isActive: Boolean(data.isActive) }),
        ...(data.webhookUrl !== undefined && { configJson: mergedConfig as any }),
      },
    });
    await this.prisma.systemEvent.create({
      data: {
        eventKey: 'INTEGRATION_UPDATED',
        severity: 'INFO',
        sourceService: 'admin',
        entityType: 'Integration',
        entityId: id,
        message: `Integration "${integration.name}" updated.`,
      },
    });
    return integration;
  }

  async deleteIntegration(adminId: string, id: string) {
    const existing = await this.prisma.integration.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Integration not found.');
    await this.prisma.integration.delete({ where: { id } });
    await this.prisma.systemEvent.create({
      data: {
        eventKey: 'INTEGRATION_DELETED',
        severity: 'WARNING',
        sourceService: 'admin',
        entityType: 'Integration',
        entityId: id,
        message: `Integration "${existing.name}" was deleted.`,
      },
    });
    return { deleted: true };
  }

  async syncIntegration(_adminId: string, id: string) {
    const integration = await this.prisma.integration.findUnique({ where: { id } });
    if (!integration) throw new NotFoundException('Integration not found.');
    const config = (integration.configJson as Record<string, unknown>) ?? {};
    const webhookUrl = config.webhookUrl as string | undefined;
    const startedAt = Date.now();
    let statusCode: number | null = null;
    let success = false;
    let responseBody: unknown = null;
    let errorMessage: string | null = null;
    if (webhookUrl) {
      try {
        const res = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: 'PING', integrationId: id, timestamp: new Date().toISOString() }),
          signal: AbortSignal.timeout(10000),
        });
        statusCode = res.status;
        success = res.ok;
        try { responseBody = await res.json(); } catch { /* non-JSON body */ }
      } catch (err: unknown) {
        errorMessage = err instanceof Error ? err.message : String(err);
      }
    } else {
      success = true;
      statusCode = 200;
    }
    const responseTime = Date.now() - startedAt;
    const log = await this.prisma.webhookLog.create({
      data: {
        integrationId: id,
        direction: 'OUTGOING',
        endpointUrl: webhookUrl ?? '(no url configured)',
        httpMethod: 'POST',
        requestBodyJson: { event: 'PING', integrationId: id },
        responseStatusCode: statusCode,
        responseBodyJson: responseBody as any,
        status: success ? 'SUCCESS' : 'FAILED',
        executedAt: new Date(),
      },
    });
    await this.prisma.integration.update({ where: { id }, data: { updatedAt: new Date() } });
    await this.prisma.systemEvent.create({
      data: {
        eventKey: success ? 'INTEGRATION_SYNC_SUCCESS' : 'INTEGRATION_SYNC_FAILED',
        severity: success ? 'INFO' : 'ERROR',
        sourceService: 'admin',
        entityType: 'Integration',
        entityId: id,
        message: success
          ? `Integration "${integration.name}" synced successfully (${responseTime}ms).`
          : `Integration "${integration.name}" sync failed: ${errorMessage ?? `HTTP ${statusCode}`}`,
        metadataJson: { responseTime, statusCode, error: errorMessage },
      },
    });
    return { success, statusCode, responseTime, error: errorMessage, logId: log.id };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WORKFLOWS CRUD
  // ─────────────────────────────────────────────────────────────────────────

  async getWorkflows() {
    return this.prisma.workflowDefinition.findMany({
      include: {
        _count: { select: { steps: true, instances: true } },
        createdBy: { include: { profile: { select: { fullName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createWorkflow(adminId: string, data: any) {
    const existing = await this.prisma.workflowDefinition.findUnique({ where: { key: data.key } });
    if (existing) throw new BadRequestException('A workflow with this key already exists.');
    const workflow = await this.prisma.workflowDefinition.create({
      data: {
        key: data.key,
        name: data.name,
        description: data.description || null,
        version: data.version || 1,
        isActive: data.isActive !== undefined ? data.isActive : true,
        isDefault: data.isDefault !== undefined ? data.isDefault : false,
        createdByUserId: adminId,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        actionType: AuditActionType.CREATE,
        entityType: 'WorkflowDefinition',
        entityId: workflow.id,
      },
    });
    return workflow;
  }

  async deleteWorkflow(adminId: string, id: string) {
    const existing = await this.prisma.workflowDefinition.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Workflow not found.');
    await this.prisma.workflowDefinition.delete({ where: { id } });
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        actionType: AuditActionType.DELETE,
        entityType: 'WorkflowDefinition',
        entityId: id,
      },
    });
    return { message: 'Workflow deleted successfully.' };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DASHBOARD METRICS
  // ─────────────────────────────────────────────────────────────────────────

  async getDashboardMetrics() {
    const version = await this.cacheService.getVersion(
      CacheKeys.version('admin:dashboard:summary'),
    );
    const key = CacheKeys.adminDashboardSummary(version);

    return this.cacheService.getOrSet(key, CacheTtls.medium, async () => {
      const now = new Date();
      const todayStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );

      const [
        totalRequests,
        openRequests,
        overdueRequests,
        totalUsers,
        activeUsers,
        totalApproved,
        totalRejected,
        todayRequests,
        openTickets,
        todayReservations,
        todayAppointments,
      ] = await Promise.all([
        this.prisma.request.count({ where: { deletedAt: null } }),
        this.prisma.request.count({
          where: {
            deletedAt: null,
            status: {
              notIn: [
                'COMPLETED',
                'APPROVED',
                'REJECTED',
                'CANCELLED',
                'CLOSED',
                'EXPIRED',
              ],
            },
          },
        }),
        this.prisma.request.count({
          where: {
            deletedAt: null,
            dueAt: { lt: now },
            status: {
              notIn: [
                'COMPLETED',
                'APPROVED',
                'REJECTED',
                'CANCELLED',
                'CLOSED',
                'EXPIRED',
              ],
            },
          },
        }),
        this.prisma.user.count({ where: { deletedAt: null } }),
        this.prisma.user.count({
          where: { deletedAt: null, status: 'ACTIVE' },
        }),
        this.prisma.request.count({
          where: { deletedAt: null, status: 'APPROVED' },
        }),
        this.prisma.request.count({
          where: { deletedAt: null, status: 'REJECTED' },
        }),
        this.prisma.request.count({
          where: { deletedAt: null, createdAt: { gte: todayStart } },
        }),
        this.prisma.itTicket.count({
          where: {
            ticketStatus: {
              in: [
                'OPEN',
                'IN_PROGRESS',
                'TRIAGED',
                'WAITING_USER',
                'REOPENED',
              ],
            },
          },
        }),
        this.prisma.reservation.count({ where: { startAt: { gte: todayStart } } }),
        this.prisma.appointment.count({ where: { startAt: { gte: todayStart } } }),
      ]);

      const total = totalApproved + totalRejected;
      const approvalRate =
        total > 0 ? Math.round((totalApproved / total) * 100) : 0;

      return {
        totalRequests,
        openRequests,
        overdueRequests,
        totalUsers,
        activeUsers,
        approvalRate,
        todayRequests,
        openTickets,
        todayReservations,
        todayAppointments,
      };
    });
  }

  async getLoginHistory(userId: string) {
    return this.prisma.loginHistory.findMany({
      where: { userId },
      orderBy: { loginAt: 'desc' },
      take: 20,
    });
  }

  async getIntegrations() {
    return this.prisma.integration.findMany({
      select: {
        id: true,
        name: true,
        provider: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REPORTS / ANALYTICS SUMMARY
  // ─────────────────────────────────────────────────────────────────────────

  async getReports() {
    const now = new Date();
    const [
      totalUsers,
      totalRequests,
      openRequests,
      resolvedRequests,
      openTickets,
      totalTickets,
      totalReservations,
      totalAppointments,
      requestsByStatus,
      requestsByTypRaw,
      ticketsByStatus,
      completedWithDates,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.request.count({ where: { deletedAt: null } }),
      this.prisma.request.count({
        where: {
          deletedAt: null,
          status: { notIn: ['COMPLETED', 'APPROVED', 'REJECTED', 'CANCELLED', 'CLOSED', 'EXPIRED'] },
        },
      }),
      this.prisma.request.count({
        where: { deletedAt: null, status: { in: ['COMPLETED', 'APPROVED'] } },
      }),
      this.prisma.itTicket.count({
        where: { ticketStatus: { in: ['OPEN', 'IN_PROGRESS', 'TRIAGED', 'WAITING_USER', 'REOPENED'] } },
      }),
      this.prisma.itTicket.count(),
      this.prisma.reservation.count(),
      this.prisma.appointment.count(),
      this.prisma.request.groupBy({
        by: ['status'],
        _count: { status: true },
        where: { deletedAt: null },
      }),
      this.prisma.request.groupBy({
        by: ['requestTypeId'],
        _count: { requestTypeId: true },
        where: { deletedAt: null },
      }),
      this.prisma.itTicket.groupBy({
        by: ['ticketStatus'],
        _count: { ticketStatus: true },
      }),
      this.prisma.request.findMany({
        where: { deletedAt: null, status: { in: ['COMPLETED', 'APPROVED'] }, submittedAt: { not: null } },
        select: { submittedAt: true, updatedAt: true },
        take: 500,
      }),
    ]);

    // Resolve request type names for the groupBy result
    const typeIds = requestsByTypRaw.map((r) => r.requestTypeId).filter(Boolean) as string[];
    const requestTypes = typeIds.length
      ? await this.prisma.requestType.findMany({ where: { id: { in: typeIds } }, select: { id: true, name: true } })
      : [];
    const typeMap = Object.fromEntries(requestTypes.map((rt) => [rt.id, rt.name]));

    // Average resolution days
    let avgResolutionDays: number | null = null;
    if (completedWithDates.length > 0) {
      const totalMs = completedWithDates.reduce((acc, r) => {
        const start = r.submittedAt?.getTime() ?? 0;
        const end = r.updatedAt?.getTime() ?? 0;
        return acc + Math.max(0, end - start);
      }, 0);
      avgResolutionDays = Math.round(totalMs / completedWithDates.length / (1000 * 60 * 60 * 24));
    }

    return {
      totalUsers,
      totalRequests,
      openRequests,
      resolvedRequests,
      openTickets,
      totalTickets,
      totalReservations,
      totalAppointments,
      avgResolutionDays,
      requestsByStatus: requestsByStatus.map((r) => ({ status: r.status, count: r._count.status })),
      requestsByType: requestsByTypRaw.map((r) => ({
        type: r.requestTypeId ? (typeMap[r.requestTypeId] ?? r.requestTypeId) : 'Unknown',
        count: r._count.requestTypeId,
      })).sort((a, b) => b.count - a.count),
      ticketsByStatus: ticketsByStatus.map((t) => ({ status: t.ticketStatus, count: t._count.ticketStatus })),
    };
  }

  async getAnalyticsOverview() {
    const [metrics, reports] = await Promise.all([
      this.getDashboardMetrics(),
      this.getReports(),
    ]);
    return { ...metrics, ...reports };
  }

  // ─── SINGLE USER ─────────────────────────────────────────────────────────

  async getUserById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        profile: {
          include: {
            faculty: { select: { id: true, name: true } },
            department: { select: { id: true, name: true } },
          },
        },
        primaryRoles: {
          include: {
            role: true,
            faculty: { select: { id: true, name: true } },
            department: { select: { id: true, name: true } },
            unit: { select: { id: true, name: true } },
          },
          orderBy: { isPrimary: 'desc' },
        },
      },
    });

    if (!user) throw new NotFoundException('User not found.');

    return {
      id: user.id,
      email: user.email,
      phoneNumber: user.phoneNumber,
      status: user.status,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      profile: user.profile,
      roles: user.primaryRoles.map((ur) => ({
        id: ur.id,
        name: ur.role.name,
        scopeType: ur.role.scopeType,
        isPrimary: ur.isPrimary,
        facultyId: ur.facultyId,
        facultyName: ur.faculty?.name ?? null,
        departmentId: ur.departmentId,
        departmentName: ur.department?.name ?? null,
        unitId: ur.unitId,
        unitName: ur.unit?.name ?? null,
        assignedAt: ur.assignedAt,
      })),
    };
  }

  // ─── USER ROLE MANAGEMENT ────────────────────────────────────────────────

  async getUserRoles(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');

    return this.prisma.userRole.findMany({
      where: { userId },
      include: {
        role: true,
        faculty: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        unit: { select: { id: true, name: true } },
      },
      orderBy: { isPrimary: 'desc' },
    });
  }

  async assignRole(adminId: string, userId: string, dto: AssignRoleDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');

    const role = await this.prisma.role.findUnique({ where: { id: dto.roleId } });
    if (!role) throw new NotFoundException('Role not found.');

    // Prevent duplicate assignment of same role + scope combo
    const existing = await this.prisma.userRole.findFirst({
      where: {
        userId,
        roleId: dto.roleId,
        facultyId: dto.facultyId ?? null,
        departmentId: dto.departmentId ?? null,
        unitId: dto.unitId ?? null,
      },
    });
    if (existing) throw new ConflictException('This role assignment already exists.');

    // If setting as primary, demote current primary
    if (dto.isPrimary) {
      await this.prisma.userRole.updateMany({
        where: { userId },
        data: { isPrimary: false },
      });
    }

    const userRole = await this.prisma.userRole.create({
      data: {
        userId,
        roleId: dto.roleId,
        facultyId: dto.facultyId ?? null,
        departmentId: dto.departmentId ?? null,
        unitId: dto.unitId ?? null,
        isPrimary: dto.isPrimary ?? false,
        assignedByUserId: adminId,
      },
      include: { role: true },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        actionType: AuditActionType.CREATE,
        entityType: 'UserRole',
        entityId: userRole.id,
      },
    });

    return userRole;
  }

  async removeRole(adminId: string, userId: string, userRoleId: string) {
    const userRole = await this.prisma.userRole.findFirst({
      where: { id: userRoleId, userId },
    });
    if (!userRole) throw new NotFoundException('Role assignment not found.');

    await this.prisma.userRole.delete({ where: { id: userRoleId } });

    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        actionType: AuditActionType.DELETE,
        entityType: 'UserRole',
        entityId: userRoleId,
      },
    });

    return { message: 'Role removed.' };
  }

  // ─── USER PROFILE (ADMIN) ────────────────────────────────────────────────

  async updateUserProfile(adminId: string, userId: string, dto: AdminUpdateProfileDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    if (!user) throw new NotFoundException('User not found.');

    if (dto.studentNumber) {
      const conflict = await this.prisma.userProfile.findFirst({
        where: { studentNumber: dto.studentNumber, userId: { not: userId } },
      });
      if (conflict) throw new ConflictException('Student number is already in use.');
    }
    if (dto.staffNumber) {
      const conflict = await this.prisma.userProfile.findFirst({
        where: { staffNumber: dto.staffNumber, userId: { not: userId } },
      });
      if (conflict) throw new ConflictException('Staff number is already in use.');
    }

    const firstName = dto.firstName ?? user.profile?.firstName ?? '';
    const lastName = dto.lastName ?? user.profile?.lastName ?? '';
    const fullName = [firstName, lastName].filter(Boolean).join(' ');

    if (dto.phoneNumber !== undefined) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { phoneNumber: dto.phoneNumber || null },
      });
    }

    const profile = await this.prisma.userProfile.upsert({
      where: { userId },
      create: {
        userId,
        firstName,
        lastName,
        fullName,
        title: dto.title ?? null,
        studentNumber: dto.studentNumber ?? null,
        staffNumber: dto.staffNumber ?? null,
        bio: dto.bio ?? null,
        address: dto.address ?? null,
        facultyId: dto.facultyId ?? null,
        departmentId: dto.departmentId ?? null,
      },
      update: {
        firstName: dto.firstName !== undefined ? dto.firstName : user.profile?.firstName ?? '',
        lastName: dto.lastName !== undefined ? dto.lastName : user.profile?.lastName ?? '',
        fullName,
        title: dto.title !== undefined ? dto.title : user.profile?.title,
        studentNumber: dto.studentNumber !== undefined ? dto.studentNumber : user.profile?.studentNumber,
        staffNumber: dto.staffNumber !== undefined ? dto.staffNumber : user.profile?.staffNumber,
        bio: dto.bio !== undefined ? dto.bio : user.profile?.bio,
        address: dto.address !== undefined ? dto.address : user.profile?.address,
        facultyId: dto.facultyId !== undefined ? dto.facultyId : user.profile?.facultyId,
        departmentId: dto.departmentId !== undefined ? dto.departmentId : user.profile?.departmentId,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        actionType: AuditActionType.UPDATE,
        entityType: 'UserProfile',
        entityId: userId,
      },
    });

    return profile;
  }

  // ─── REQUEST TYPE CRUD ────────────────────────────────────────────────────

  async getRequestTypeById(id: string) {
    const rt = await this.prisma.requestType.findUnique({ where: { id } });
    if (!rt) throw new NotFoundException('Request type not found.');
    return rt;
  }

  async updateRequestType(id: string, dto: UpdateRequestTypeDto) {
    const existing = await this.prisma.requestType.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Request type not found.');

    return this.prisma.requestType.update({
      where: { id },
      data: {
        name: dto.name !== undefined ? dto.name : existing.name,
        description: dto.description !== undefined ? dto.description : existing.description,
        category: dto.category !== undefined ? dto.category : existing.category,
        workflowDefinitionId:
          dto.workflowDefinitionId !== undefined
            ? dto.workflowDefinitionId
            : existing.workflowDefinitionId,
        isActive: dto.isActive !== undefined ? dto.isActive : existing.isActive,
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DOMAIN MODULE ADMIN VIEWS
  // ─────────────────────────────────────────────────────────────────────────

  async getEquipmentRequests() {
    const items = await this.prisma.equipmentRequest.findMany({
      include: {
        request: { select: { id: true, requestNo: true, title: true, status: true, createdAt: true } },
        requester: { include: { profile: { select: { fullName: true } } } },
        labResource: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
    const counts = await this.prisma.request.groupBy({
      by: ['status'],
      where: { equipmentRequest: { isNot: null } },
      _count: { _all: true },
    });
    const metrics = { total: 0, pending: 0, approved: 0, rejected: 0, completed: 0 };
    for (const c of counts) {
      metrics.total += c._count._all;
      if (['SUBMITTED', 'IN_REVIEW', 'WAITING_APPROVAL'].includes(c.status)) metrics.pending += c._count._all;
      if (c.status === 'APPROVED') metrics.approved += c._count._all;
      if (c.status === 'REJECTED') metrics.rejected += c._count._all;
      if (['COMPLETED', 'CLOSED'].includes(c.status)) metrics.completed += c._count._all;
    }
    return { items, metrics };
  }

  async getInternships() {
    const items = await this.prisma.internshipRequest.findMany({
      include: {
        request: { select: { id: true, requestNo: true, title: true, status: true, createdAt: true } },
        student: { include: { profile: { select: { fullName: true } } } },
        advisor: { include: { profile: { select: { fullName: true } } } },
        term: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
    const counts = await this.prisma.request.groupBy({
      by: ['status'],
      where: { internshipRequest: { isNot: null } },
      _count: { _all: true },
    });
    const metrics = { total: 0, pending: 0, approved: 0, rejected: 0, completed: 0 };
    for (const c of counts) {
      metrics.total += c._count._all;
      if (['SUBMITTED', 'IN_REVIEW', 'WAITING_APPROVAL'].includes(c.status)) metrics.pending += c._count._all;
      if (c.status === 'APPROVED') metrics.approved += c._count._all;
      if (c.status === 'REJECTED') metrics.rejected += c._count._all;
      if (['COMPLETED', 'CLOSED'].includes(c.status)) metrics.completed += c._count._all;
    }
    return { items, metrics };
  }

  async getProcurementRequests() {
    const items = await this.prisma.procurementRequest.findMany({
      include: {
        request: { select: { id: true, requestNo: true, title: true, status: true, createdAt: true } },
        requester: { include: { profile: { select: { fullName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
    const counts = await this.prisma.request.groupBy({
      by: ['status'],
      where: { procurementRequest: { isNot: null } },
      _count: { _all: true },
    });
    const metrics = { total: 0, pending: 0, approved: 0, rejected: 0, completed: 0 };
    for (const c of counts) {
      metrics.total += c._count._all;
      if (['SUBMITTED', 'IN_REVIEW', 'WAITING_APPROVAL'].includes(c.status)) metrics.pending += c._count._all;
      if (c.status === 'APPROVED') metrics.approved += c._count._all;
      if (c.status === 'REJECTED') metrics.rejected += c._count._all;
      if (['COMPLETED', 'CLOSED'].includes(c.status)) metrics.completed += c._count._all;
    }
    return { items, metrics };
  }

  async getEventRequests() {
    const items = await this.prisma.eventRequest.findMany({
      include: {
        request: { select: { id: true, requestNo: true, title: true, status: true, createdAt: true } },
        organizer: { include: { profile: { select: { fullName: true } } } },
        club: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
    const counts = await this.prisma.request.groupBy({
      by: ['status'],
      where: { eventRequest: { isNot: null } },
      _count: { _all: true },
    });
    const metrics = { total: 0, pending: 0, approved: 0, rejected: 0, completed: 0 };
    for (const c of counts) {
      metrics.total += c._count._all;
      if (['SUBMITTED', 'IN_REVIEW', 'WAITING_APPROVAL'].includes(c.status)) metrics.pending += c._count._all;
      if (c.status === 'APPROVED') metrics.approved += c._count._all;
      if (c.status === 'REJECTED') metrics.rejected += c._count._all;
      if (['COMPLETED', 'CLOSED'].includes(c.status)) metrics.completed += c._count._all;
    }
    return { items, metrics };
  }

  async getAdminAccessRequests() {
    const items = await this.prisma.accessRequest.findMany({
      include: {
        request: { select: { id: true, requestNo: true, title: true, status: true, createdAt: true } },
        requester: { include: { profile: { select: { fullName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
    const counts = await this.prisma.request.groupBy({
      by: ['status'],
      where: { accessRequest: { isNot: null } },
      _count: { _all: true },
    });
    const metrics = { total: 0, pending: 0, approved: 0, rejected: 0, completed: 0 };
    for (const c of counts) {
      metrics.total += c._count._all;
      if (['SUBMITTED', 'IN_REVIEW', 'WAITING_APPROVAL'].includes(c.status)) metrics.pending += c._count._all;
      if (c.status === 'APPROVED') metrics.approved += c._count._all;
      if (c.status === 'REJECTED') metrics.rejected += c._count._all;
      if (['COMPLETED', 'CLOSED'].includes(c.status)) metrics.completed += c._count._all;
    }
    return { items, metrics };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ACADEMIC TERMS
  // ─────────────────────────────────────────────────────────────────────────

  getAcademicTerms() {
    return this.prisma.academicTerm.findMany({ orderBy: { startDate: 'desc' } });
  }

  async createAcademicTerm(data: {
    name: string;
    code: string;
    startDate: string;
    endDate: string;
    isActive?: boolean;
  }) {
    const existing = await this.prisma.academicTerm.findUnique({ where: { code: data.code } });
    if (existing) throw new BadRequestException('A term with this code already exists.');
    return this.prisma.academicTerm.create({
      data: {
        name: data.name,
        code: data.code,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        isActive: data.isActive ?? false,
      },
    });
  }

  async updateAcademicTerm(
    id: string,
    data: { name?: string; startDate?: string; endDate?: string; isActive?: boolean },
  ) {
    const existing = await this.prisma.academicTerm.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Academic term not found.');
    return this.prisma.academicTerm.update({
      where: { id },
      data: {
        name: data.name ?? existing.name,
        startDate: data.startDate ? new Date(data.startDate) : existing.startDate,
        endDate: data.endDate ? new Date(data.endDate) : existing.endDate,
        isActive: data.isActive ?? existing.isActive,
      },
    });
  }
}
