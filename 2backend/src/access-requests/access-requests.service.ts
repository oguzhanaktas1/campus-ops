import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service';
import { RequestStatus, PriorityLevel } from '@prisma/client';

const TYPE_KEY = 'ACCESS_REQUEST';

function makeRequestNo(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `ACC-${ymd}-${Math.floor(Math.random() * 9000) + 1000}`;
}

@Injectable()
export class AccessRequestsService {
  constructor(private prisma: PrismaService) {}

  private async getOrCreateRequestType() {
    let rt = await this.prisma.requestType.findUnique({ where: { key: TYPE_KEY } });
    if (!rt) {
      rt = await this.prisma.requestType.create({
        data: { key: TYPE_KEY, name: 'Access / Permission Request', category: 'IT_SUPPORT', description: 'Request for system, resource or campus area access', isActive: true },
      });
    }
    return rt;
  }

  async create(userId: string, dto: {
    accessType: string;
    targetResource: string;
    requestedRoleOrPermission?: string;
    justification: string;
    startAt?: string;
    endAt?: string;
    priority?: PriorityLevel;
  }) {
    const rt = await this.getOrCreateRequestType();
    const requestNo = makeRequestNo();

    const req = await this.prisma.$transaction(async (tx) => {
      const r = await tx.request.create({
        data: {
          requestNo,
          title: `Access Request: ${dto.targetResource}`,
          requestTypeId: rt.id,
          requesterUserId: userId,
          status: RequestStatus.SUBMITTED,
          priority: dto.priority ?? PriorityLevel.MEDIUM,
          submittedAt: new Date(),
          accessRequest: {
            create: {
              requesterUserId: userId,
              accessType: dto.accessType,
              targetResource: dto.targetResource,
              requestedRoleOrPermission: dto.requestedRoleOrPermission,
              justification: dto.justification,
              startAt: dto.startAt ? new Date(dto.startAt) : null,
              endAt: dto.endAt ? new Date(dto.endAt) : null,
            },
          },
        },
        include: { accessRequest: true },
      });
      await tx.requestStatusHistory.create({
        data: { requestId: r.id, oldStatus: null, newStatus: RequestStatus.SUBMITTED, changedByUserId: userId, changeReason: 'Access request submitted.' },
      });
      return r;
    });

    void this.prisma.auditLog.create({
      data: { userId, actionType: 'CREATE', entityType: 'AccessRequest', entityId: req.id },
    });

    return { requestNo: req.requestNo, requestId: req.id };
  }

  async findAll(userId: string, roles: string[]) {
    const isStaffOrAdmin = roles.some((r) => ['STAFF', 'ADMIN'].includes(r));
    const where = isStaffOrAdmin ? {} : { requesterUserId: userId };

    const rows = await this.prisma.request.findMany({
      where: { requestType: { key: TYPE_KEY }, deletedAt: null, ...where },
      include: {
        accessRequest: true,
        requester: { include: { profile: { select: { fullName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((r) => ({
      id: r.id,
      requestNo: r.requestNo,
      status: r.status,
      priority: r.priority,
      createdAt: r.createdAt,
      requesterName: r.requester.profile?.fullName ?? r.requester.email,
      accessType: r.accessRequest?.accessType,
      targetResource: r.accessRequest?.targetResource,
      justification: r.accessRequest?.justification,
    }));
  }

  async findById(userId: string, id: string, roles: string[]) {
    const r = await this.prisma.request.findUnique({
      where: { id, deletedAt: null },
      include: {
        accessRequest: true,
        requester: { include: { profile: { select: { fullName: true, title: true } } } },
        statusHistory: { orderBy: { changedAt: 'asc' } },
      },
    });
    if (!r) throw new NotFoundException('Access request not found.');
    const isStaffOrAdmin = roles.some((ro) => ['STAFF', 'ADMIN'].includes(ro));
    if (!isStaffOrAdmin && r.requesterUserId !== userId) throw new ForbiddenException();
    return r;
  }

  async updateStatus(userId: string, id: string, status: RequestStatus, note?: string) {
    const r = await this.prisma.request.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Access request not found.');

    const updated = await this.prisma.$transaction(async (tx) => {
      const upd = await tx.request.update({ where: { id }, data: { status } });
      await tx.requestStatusHistory.create({
        data: { requestId: id, oldStatus: r.status, newStatus: status, changedByUserId: userId, changeReason: note ?? '' },
      });
      return upd;
    });

    void this.prisma.auditLog.create({
      data: { userId, actionType: 'UPDATE', entityType: 'AccessRequest', entityId: id, newValuesJson: { status, note } },
    });

    return updated;
  }
}
