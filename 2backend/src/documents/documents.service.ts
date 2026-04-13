/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service';
import { WorkflowEngineService } from '../workflow/workflow-engine.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PriorityLevel, RequestStatus } from '@prisma/client';

const KEY = 'DOCUMENT_REQUEST';
const STATUS_ACTION_MAP: Partial<Record<RequestStatus, 'approve' | 'reject' | 'revision' | 'cancel'>> = {
  [RequestStatus.APPROVED]: 'approve',
  [RequestStatus.REJECTED]: 'reject',
  [RequestStatus.REVISION_REQUESTED]: 'revision',
  [RequestStatus.CANCELLED]: 'cancel',
};

function makeNo() {
  const d = new Date();
  return (
    'DOC-' +
    d.getFullYear() +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0') +
    '-' +
    (Math.floor(Math.random() * 9000) + 1000)
  );
}

@Injectable()
export class DocumentsService {
  constructor(
    private prisma: PrismaService,
    private workflowEngine: WorkflowEngineService,
    private notificationsService: NotificationsService,
  ) {}

  private async getOrCreateRequestType() {
    let rt = await this.prisma.requestType.findUnique({ where: { key: KEY } });
    if (!rt) {
      rt = await this.prisma.requestType.create({
        data: { key: KEY, name: 'Document Request', category: 'DOCUMENT', description: 'Official document requests', isActive: true },
      });
    }
    return rt;
  }

  private toListItem(dr: any) {
    const req = dr.request;
    return {
      id: req.id,
      documentRequestId: dr.id,
      requestNo: req.requestNo,
      title: req.title,
      status: req.status,
      priority: req.priority,
      documentType: dr.documentType,
      language: dr.language,
      copiesCount: dr.copiesCount,
      deliveryMethod: dr.deliveryMethod,
      deliveryAddress: dr.deliveryAddress,
      issuedAt: dr.issuedAt,
      requesterName: dr.requester?.profile?.fullName ?? dr.requester?.email ?? 'Unknown',
      createdAt: dr.createdAt,
    };
  }

  async create(
    userId: string,
    dto: {
      documentType: string;
      language?: string;
      copiesCount?: number;
      deliveryMethod: string;
      deliveryAddress?: string;
      title?: string;
      description?: string;
      priority?: PriorityLevel;
    },
  ) {
    if (!dto.documentType?.trim()) throw new BadRequestException('documentType is required.');
    if (!dto.deliveryMethod?.trim()) throw new BadRequestException('deliveryMethod is required.');
    const reqType = await this.getOrCreateRequestType();
    let requestNo = makeNo();
    while (await this.prisma.request.findUnique({ where: { requestNo } })) requestNo = makeNo();
    const title = dto.title?.trim() || dto.documentType + ' Request';

    const result = await this.prisma.$transaction(async (tx) => {
      const s = RequestStatus.SUBMITTED;
      const req = await tx.request.create({
        data: {
          requestNo, requestTypeId: reqType.id, requesterUserId: userId,
          title, description: dto.description ?? null,
          priority: dto.priority ?? PriorityLevel.MEDIUM, status: s, submittedAt: new Date(),
        },
      });
      await tx.requestStatusHistory.create({ data: { requestId: req.id, oldStatus: null, newStatus: s, changedByUserId: userId, changeReason: 'Document request submitted.' } });
      await tx.documentRequest.create({
        data: {
          requestId: req.id, requesterUserId: userId,
          documentType: dto.documentType.trim(), language: dto.language ?? null,
          copiesCount: dto.copiesCount ?? 1, deliveryMethod: dto.deliveryMethod.trim(), deliveryAddress: dto.deliveryAddress ?? null,
        },
      });
      const wfDefId = reqType.workflowDefinitionId;
      if (wfDefId) {
        const wfStatus = await this.workflowEngine.bootstrapInstance(tx, req.id, wfDefId);
        if (wfStatus && wfStatus !== s) {
          await tx.request.update({ where: { id: req.id }, data: { status: wfStatus } });
          await tx.requestStatusHistory.create({ data: { requestId: req.id, oldStatus: s, newStatus: wfStatus, changedByUserId: userId, changeReason: 'Workflow started.' } });
        }
      }
      return req;
    });

    await this.prisma.notification.deleteMany({
      where: {
        userId,
        requestId: result.id,
        OR: [
          {
            title: {
              contains: 'Document Request Submitted',
              mode: 'insensitive',
            },
          },
          {
            actionUrl: `/student/documents/${result.id}`,
          },
        ],
      },
    });

    return { requestId: result.id, requestNo: result.requestNo };
  }

  async findMy(userId: string) {
    const records = await this.prisma.documentRequest.findMany({
      where: { requesterUserId: userId },
      include: {
        request: { select: { id: true, requestNo: true, title: true, status: true, priority: true, createdAt: true } },
        requester: { include: { profile: { select: { fullName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => this.toListItem(r));
  }

  async findInbox(roles: string[]) {
    if (!roles.some((role) => ['ADMIN', 'STAFF'].includes(role))) {
      throw new ForbiddenException('Insufficient permissions.');
    }

    const records = await this.prisma.documentRequest.findMany({
      include: {
        request: { select: { id: true, requestNo: true, title: true, status: true, priority: true, createdAt: true } },
        requester: { include: { profile: { select: { fullName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => this.toListItem(r));
  }

  async findById(userId: string, roles: string[], requestId: string) {
    const dr = await this.prisma.documentRequest.findFirst({
      where: { requestId },
      include: {
        request: {
          include: {
            requestType: true,
            requester: { include: { profile: { include: { faculty: { select: { name: true } }, department: { select: { name: true } } } } } },
            statusHistory: { orderBy: { changedAt: 'asc' } },
            comments: { where: { isInternal: false }, orderBy: { createdAt: 'asc' }, include: { user: { include: { profile: true } } } },
          },
        },
        requester: { include: { profile: true } },
      },
    });
    if (!dr) throw new NotFoundException('Document request not found.');
    const req = dr.request as any;
    if (!roles.includes('ADMIN') && !roles.includes('STAFF') && req.requesterUserId !== userId) {
      throw new ForbiddenException('Access denied.');
    }
    return {
      id: req.id, requestNo: req.requestNo, title: req.title, description: req.description,
      status: req.status, priority: req.priority, createdAt: req.createdAt, submittedAt: req.submittedAt,
      documentType: dr.documentType, language: dr.language, copiesCount: dr.copiesCount,
      deliveryMethod: dr.deliveryMethod, deliveryAddress: dr.deliveryAddress, issuedAt: dr.issuedAt,
      requester: {
        id: req.requester.id, fullName: req.requester.profile?.fullName ?? req.requester.email,
        faculty: req.requester.profile?.faculty?.name ?? null,
        department: req.requester.profile?.department?.name ?? null,
      },
      statusHistory: req.statusHistory.map((h: any) => ({ id: h.id, status: h.newStatus, date: h.changedAt, note: h.changeReason })),
      comments: req.comments.map((c: any) => ({ id: c.id, author: c.user?.profile?.fullName ?? c.user?.email, content: c.commentText, createdAt: c.createdAt })),
    };
  }

  async process(
    userId: string,
    roles: string[],
    requestId: string,
    dto: { status?: RequestStatus; issuedAt?: string; note?: string },
  ) {
    if (!roles.some((r) => ['ADMIN', 'STAFF'].includes(r))) throw new ForbiddenException('Insufficient permissions.');
    const dr = await this.prisma.documentRequest.findFirst({ where: { requestId } });
    if (!dr) throw new NotFoundException('Document request not found.');
    const newStatus = dto.status ?? RequestStatus.APPROVED;
    const action = STATUS_ACTION_MAP[newStatus];
    if (!action) {
      throw new BadRequestException('This endpoint only supports workflow actions: approve, reject, revision, cancel.');
    }

    await this.workflowEngine.processAction(userId, roles, requestId, {
      action,
      comment: dto.note?.trim() || undefined,
    });

    await this.prisma.$transaction(async (tx) => {
      if (dto.issuedAt || newStatus === RequestStatus.APPROVED) {
        await tx.documentRequest.update({
          where: { id: dr.id },
          data: { issuedAt: dto.issuedAt ? new Date(dto.issuedAt) : new Date() },
        });
      }
      if (dto.note?.trim()) {
        await tx.requestComment.create({
          data: { requestId, userId, commentText: dto.note, isInternal: false },
        });
      }
    });

    const req = await this.prisma.request.findUnique({ where: { id: requestId } });
    if (req?.requesterUserId) {
      void this.notificationsService.createNotification({
        userId: req.requesterUserId, title: 'Document Request Updated',
        message: 'Status changed to ' + newStatus + '.', requestId,
        actionUrl: '/student/documents/' + requestId,
      });
    }
    return { requestId, status: newStatus };
  }
}
