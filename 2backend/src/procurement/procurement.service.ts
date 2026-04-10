import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service';
import { RequestStatus, PriorityLevel } from '@prisma/client';
import { WorkflowEngineService } from '../workflow/workflow-engine.service';

const TYPE_KEY = 'PROCUREMENT_REQUEST';

const STATUS_ACTION_MAP: Partial<Record<RequestStatus, 'approve' | 'reject' | 'revision' | 'cancel'>> = {
  [RequestStatus.APPROVED]: 'approve',
  [RequestStatus.REJECTED]: 'reject',
  [RequestStatus.REVISION_REQUESTED]: 'revision',
  [RequestStatus.CANCELLED]: 'cancel',
};

function makeRequestNo(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `PRC-${ymd}-${Math.floor(Math.random() * 9000) + 1000}`;
}

@Injectable()
export class ProcurementService {
  constructor(
    private prisma: PrismaService,
    private workflowEngine: WorkflowEngineService,
  ) {}

  private async getOrCreateRequestType() {
    let rt = await this.prisma.requestType.findUnique({ where: { key: TYPE_KEY } });
    if (!rt) {
      rt = await this.prisma.requestType.create({
        data: { key: TYPE_KEY, name: 'Procurement Request', category: 'ADMINISTRATIVE', description: 'Purchase or procurement request for goods and services', isActive: true },
      });
    }
    return rt;
  }

  async create(userId: string, dto: {
    itemName: string;
    itemCategory: string;
    quantity: number;
    unitPriceEstimate?: number;
    vendorPreference?: string;
    justification: string;
    budgetCode?: string;
    priority?: PriorityLevel;
  }) {
    const rt = await this.getOrCreateRequestType();
    const requestNo = makeRequestNo();
    const totalEstimate = dto.unitPriceEstimate ? dto.unitPriceEstimate * dto.quantity : undefined;

    const req = await this.prisma.$transaction(async (tx) => {
      const initialStatus = RequestStatus.SUBMITTED;
      const r = await tx.request.create({
        data: {
          requestNo,
          title: `Procurement: ${dto.itemName} (${dto.quantity})`,
          requestTypeId: rt.id,
          requesterUserId: userId,
          status: RequestStatus.SUBMITTED,
          priority: dto.priority ?? PriorityLevel.MEDIUM,
          submittedAt: new Date(),
          procurementRequest: {
            create: {
              requesterUserId: userId,
              itemName: dto.itemName,
              itemCategory: dto.itemCategory,
              quantity: dto.quantity,
              unitPriceEstimate: dto.unitPriceEstimate,
              totalEstimate,
              vendorPreference: dto.vendorPreference,
              justification: dto.justification,
              budgetCode: dto.budgetCode,
              procurementStatus: 'PENDING',
            },
          },
        },
        include: { procurementRequest: true },
      });
      await tx.requestStatusHistory.create({
        data: { requestId: r.id, oldStatus: null, newStatus: RequestStatus.SUBMITTED, changedByUserId: userId, changeReason: 'Procurement request submitted.' },
      });

      const wfDefId = rt.workflowDefinitionId;
      if (wfDefId) {
        const wfStatus = await this.workflowEngine.bootstrapInstance(tx, r.id, wfDefId);
        if (wfStatus && wfStatus !== initialStatus) {
          await tx.request.update({
            where: { id: r.id },
            data: { status: wfStatus },
          });
          await tx.requestStatusHistory.create({
            data: {
              requestId: r.id,
              oldStatus: initialStatus,
              newStatus: wfStatus,
              changedByUserId: userId,
              changeReason: 'Workflow started.',
            },
          });
        }
      }
      return r;
    });

    void this.prisma.auditLog.create({
      data: { userId, actionType: 'CREATE', entityType: 'ProcurementRequest', entityId: req.id },
    });

    return { requestNo: req.requestNo, requestId: req.id };
  }

  async findAll(userId: string, roles: string[]) {
    const isStaffOrAdmin = roles.some((r) => ['STAFF', 'ADMIN'].includes(r));
    const where = isStaffOrAdmin ? {} : { requesterUserId: userId };

    const rows = await this.prisma.request.findMany({
      where: { requestType: { key: TYPE_KEY }, deletedAt: null, ...where },
      include: {
        procurementRequest: true,
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
      itemName: r.procurementRequest?.itemName,
      itemCategory: r.procurementRequest?.itemCategory,
      quantity: r.procurementRequest?.quantity,
      totalEstimate: r.procurementRequest?.totalEstimate,
      procurementStatus: r.procurementRequest?.procurementStatus,
    }));
  }

  async findById(userId: string, id: string, roles: string[]) {
    const r = await this.prisma.request.findUnique({
      where: { id, deletedAt: null },
      include: {
        procurementRequest: true,
        requester: { include: { profile: { select: { fullName: true, title: true } } } },
        statusHistory: { orderBy: { changedAt: 'asc' } },
        workflowInstance: {
          include: {
            currentStep: true,
            workflowDefinition: { select: { name: true } },
          },
        },
      },
    });
    if (!r) throw new NotFoundException('Procurement request not found.');
    const isStaffOrAdmin = roles.some((ro) => ['STAFF', 'ADMIN'].includes(ro));
    if (!isStaffOrAdmin && r.requesterUserId !== userId) throw new ForbiddenException();
    return {
      ...r,
      workflow: r.workflowInstance
        ? {
            status: r.workflowInstance.status,
            currentStep: r.workflowInstance.currentStep?.stepName ?? null,
            workflowName: r.workflowInstance.workflowDefinition?.name ?? null,
          }
        : null,
    };
  }

  async updateStatus(userId: string, roles: string[], id: string, status: RequestStatus, note?: string) {
    const r = await this.prisma.request.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Procurement request not found.');

    const action = STATUS_ACTION_MAP[status];
    if (!action) {
      throw new BadRequestException('This endpoint only supports workflow actions: approve, reject, revision, cancel.');
    }

    const updated = await this.workflowEngine.processAction(userId, roles, id, {
      action,
      comment: note,
    });

    void this.prisma.auditLog.create({
      data: { userId, actionType: 'UPDATE', entityType: 'ProcurementRequest', entityId: id, newValuesJson: { status, note } },
    });

    return updated;
  }
}
