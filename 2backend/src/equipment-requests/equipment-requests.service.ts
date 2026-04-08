/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service';
import { WorkflowEngineService } from '../workflow/workflow-engine.service';
import { PriorityLevel, RequestStatus } from '@prisma/client';
import { CreateEquipmentRequestDto } from './dto/create-equipment-request.dto';
import { ReviewEquipmentRequestDto } from './dto/review-equipment-request.dto';
import { Prisma } from '@prisma/client';

const OPEN_STATUSES: RequestStatus[] = [
  RequestStatus.SUBMITTED,
  RequestStatus.IN_REVIEW,
  RequestStatus.WAITING_APPROVAL,
  RequestStatus.REVISION_REQUESTED,
];

function makeRequestNo(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `EQ-${ymd}-${rand}`;
}

const EQUIPMENT_REQUEST_TYPE_KEY = 'EQUIPMENT';

@Injectable()
export class EquipmentRequestsService {
  constructor(
    private prisma: PrismaService,
    private workflowEngine: WorkflowEngineService,
  ) {}

  private async getOrCreateRequestType() {
    let reqType = await this.prisma.requestType.findUnique({
      where: { key: EQUIPMENT_REQUEST_TYPE_KEY },
    });
    if (!reqType) {
      reqType = await this.prisma.requestType.create({
        data: {
          key: EQUIPMENT_REQUEST_TYPE_KEY,
          name: 'Equipment Request',
          category: 'EQUIPMENT',
          description: 'Equipment and resource requests',
          isActive: true,
        },
      });
    }
    return reqType;
  }

  // ─── CREATE ───────────────────────────────────────────────────────────────

  async create(userId: string, dto: CreateEquipmentRequestDto) {
    const reqType = await this.getOrCreateRequestType();

    let requestNo = makeRequestNo();
    while (await this.prisma.request.findUnique({ where: { requestNo } })) {
      requestNo = makeRequestNo();
    }

    const title =
      dto.title ||
      `${dto.equipmentCategory} Request: ${dto.equipmentName} (x${dto.quantity})`;

    return this.prisma.$transaction(async (tx) => {
      let initialStatus = RequestStatus.SUBMITTED;

      const req = await tx.request.create({
        data: {
          requestNo,
          requestTypeId: reqType.id,
          requesterUserId: userId,
          title,
          description: dto.description ?? null,
          priority: dto.priority ?? PriorityLevel.MEDIUM,
          status: initialStatus,
          submittedAt: new Date(),
          facultyId: dto.facultyId ?? null,
          departmentId: dto.departmentId ?? null,
          unitId: dto.unitId ?? null,
        },
      });

      await tx.requestStatusHistory.create({
        data: {
          requestId: req.id,
          oldStatus: null,
          newStatus: initialStatus,
          changedByUserId: userId,
          changeReason: 'Equipment request submitted.',
        },
      });

      await tx.equipmentRequest.create({
        data: {
          requestId: req.id,
          requesterUserId: userId,
          equipmentName: dto.equipmentName,
          equipmentCategory: dto.equipmentCategory,
          quantity: dto.quantity,
          purpose: dto.purpose,
          labResourceId: dto.labResourceId ?? null,
          neededFrom: dto.neededFrom ? new Date(dto.neededFrom) : null,
          neededUntil: dto.neededUntil ? new Date(dto.neededUntil) : null,
          urgencyReason: dto.urgencyReason ?? null,
        },
      });

      // Bootstrap workflow if available
      const wfDefId = reqType.workflowDefinitionId;
      if (wfDefId) {
        const wfStatus = await this.workflowEngine.bootstrapInstance(
          tx,
          req.id,
          wfDefId,
        );
        if (wfStatus) {
          await tx.request.update({
            where: { id: req.id },
            data: { status: wfStatus },
          });
          await tx.requestStatusHistory.create({
            data: {
              requestId: req.id,
              oldStatus: initialStatus,
              newStatus: wfStatus,
              changedByUserId: userId,
              changeReason: 'Workflow started.',
            },
          });
        }
      }

      return { requestId: req.id, requestNo: req.requestNo };
    });
  }

  // ─── MY REQUESTS ──────────────────────────────────────────────────────────

  async findMy(userId: string) {
    const records = await this.prisma.equipmentRequest.findMany({
      where: { requesterUserId: userId },
      include: {
        request: {
          include: {
            requestType: { select: { id: true, key: true, name: true } },
          },
        },
        labResource: { select: { id: true, name: true, resourceType: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return records.map((r) => this.toListItem(r));
  }

  // ─── INBOX (STAFF / ADMIN) ─────────────────────────────────────────────────

  async findInbox() {
    const records = await this.prisma.equipmentRequest.findMany({
      where: {
        request: { status: { in: OPEN_STATUSES } },
      },
      include: {
        request: {
          include: {
            requestType: { select: { id: true, key: true, name: true } },
            requester: {
              include: {
                profile: { select: { fullName: true, studentNumber: true } },
              },
            },
            currentAssignee: {
              include: { profile: { select: { fullName: true } } },
            },
          },
        },
        labResource: { select: { id: true, name: true } },
      },
      orderBy: [{ request: { priority: 'desc' } }, { createdAt: 'asc' }],
    });

    return records.map((r) => ({
      ...this.toListItem(r),
      requesterName:
        (r.request as any).requester?.profile?.fullName ??
        (r.request as any).requester?.email ??
        'Unknown',
      currentAssignee: (r.request as any).currentAssignee
        ? {
            id: (r.request as any).currentAssignee.id,
            fullName:
              (r.request as any).currentAssignee.profile?.fullName ??
              (r.request as any).currentAssignee.email,
          }
        : null,
    }));
  }

  // ─── DETAIL ───────────────────────────────────────────────────────────────

  async findById(userId: string, roles: string[], requestId: string) {
    const isAdmin = roles.includes('ADMIN');
    const isStaff = roles.includes('STAFF');
    const isStudent = roles.includes('STUDENT') && !isAdmin && !isStaff;

    const r = await this.prisma.equipmentRequest.findFirst({
      where: { requestId },
      include: {
        request: {
          include: {
            requestType: true,
            requester: {
              include: {
                profile: {
                  include: {
                    faculty: { select: { name: true } },
                    department: { select: { name: true } },
                  },
                },
              },
            },
            currentAssignee: {
              include: { profile: { select: { fullName: true } } },
            },
            statusHistory: { orderBy: { changedAt: 'asc' } },
            comments: {
              where: isStudent ? { isInternal: false } : {},
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
            fileLinks: { include: { file: true } },
            workflowInstance: {
              include: {
                currentStep: true,
                workflowDefinition: { select: { name: true } },
              },
            },
          },
        },
        labResource: { select: { id: true, name: true, resourceType: true } },
      },
    });

    if (!r) throw new NotFoundException('Equipment request not found.');

    const req = r.request as any;

    // Access control: students can only see their own
    if (isStudent && req.requesterUserId !== userId) {
      throw new ForbiddenException('Access denied.');
    }

    return {
      id: req.id,
      requestNo: req.requestNo,
      title: req.title,
      description: req.description,
      status: req.status,
      priority: req.priority,
      createdAt: req.createdAt,
      submittedAt: req.submittedAt,
      requester: {
        id: req.requester.id,
        fullName: req.requester.profile?.fullName ?? req.requester.email,
        faculty: req.requester.profile?.faculty?.name ?? null,
        department: req.requester.profile?.department?.name ?? null,
      },
      currentAssignee: req.currentAssignee
        ? {
            id: req.currentAssignee.id,
            fullName:
              req.currentAssignee.profile?.fullName ?? req.currentAssignee.email,
          }
        : null,
      equipment: {
        id: r.id,
        equipmentName: r.equipmentName,
        equipmentCategory: r.equipmentCategory,
        quantity: r.quantity,
        purpose: r.purpose,
        neededFrom: r.neededFrom,
        neededUntil: r.neededUntil,
        urgencyReason: r.urgencyReason,
        stockCheckStatus: r.stockCheckStatus,
        procurementRequired: r.procurementRequired,
        estimatedCost: r.estimatedCost ? Number(r.estimatedCost) : null,
        labResource: r.labResource,
      },
      workflow: req.workflowInstance
        ? {
            status: req.workflowInstance.status,
            currentStep:
              req.workflowInstance.currentStep?.stepName ?? null,
            workflowName:
              req.workflowInstance.workflowDefinition?.name ?? null,
          }
        : null,
      statusHistory: req.statusHistory.map((h: any) => ({
        id: h.id,
        status: h.newStatus,
        date: h.changedAt,
        note: h.changeReason,
      })),
      comments: req.comments.map((c: any) => ({
        id: c.id,
        author: c.user?.profile?.fullName ?? c.user?.email ?? 'Unknown',
        authorRole:
          c.user?.primaryRoles?.[0]?.role?.name?.toLowerCase() ?? 'unknown',
        content: c.commentText,
        isInternal: c.isInternal,
        createdAt: c.createdAt,
      })),
      attachments: req.fileLinks.map((fl: any) => ({
        id: fl.file.id,
        name: fl.file.originalFileName,
        size: fl.file.fileSizeBytes,
        url: fl.file.storagePath,
      })),
    };
  }

  // ─── REVIEW (STAFF / ADMIN) ────────────────────────────────────────────────

  async review(
    userId: string,
    roles: string[],
    requestId: string,
    dto: ReviewEquipmentRequestDto,
  ) {
    const canReview = roles.some((r) => ['ADMIN', 'STAFF'].includes(r));
    if (!canReview) throw new ForbiddenException('Insufficient permissions.');

    const equipReq = await this.prisma.equipmentRequest.findFirst({
      where: { requestId },
    });
    if (!equipReq) throw new NotFoundException('Equipment request not found.');

    const updated = await this.prisma.equipmentRequest.update({
      where: { id: equipReq.id },
      data: {
        ...(dto.stockCheckStatus !== undefined && {
          stockCheckStatus: dto.stockCheckStatus,
        }),
        ...(dto.procurementRequired !== undefined && {
          procurementRequired: dto.procurementRequired,
        }),
        ...(dto.estimatedCost !== undefined && {
          estimatedCost: dto.estimatedCost
            ? new Prisma.Decimal(dto.estimatedCost)
            : null,
        }),
      },
    });

    if (dto.reviewNote?.trim()) {
      await this.prisma.requestComment.create({
        data: {
          requestId,
          userId,
          commentText: dto.reviewNote,
          isInternal: true,
        },
      });
    }

    return {
      id: requestId,
      stockCheckStatus: updated.stockCheckStatus,
      procurementRequired: updated.procurementRequired,
      estimatedCost: updated.estimatedCost
        ? Number(updated.estimatedCost)
        : null,
    };
  }

  // ─── PRIVATE ──────────────────────────────────────────────────────────────

  private toListItem(r: any) {
    return {
      id: r.request.id,
      equipmentRequestId: r.id,
      requestNo: r.request.requestNo,
      title: r.request.title,
      status: r.request.status,
      priority: r.request.priority,
      equipmentName: r.equipmentName,
      equipmentCategory: r.equipmentCategory,
      quantity: r.quantity,
      purpose: r.purpose,
      neededFrom: r.neededFrom,
      neededUntil: r.neededUntil,
      stockCheckStatus: r.stockCheckStatus,
      procurementRequired: r.procurementRequired,
      labResource: r.labResource ?? null,
      createdAt: r.createdAt,
    };
  }
}
