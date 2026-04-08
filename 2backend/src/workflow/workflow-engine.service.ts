import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service';
import { RequestStatus, WorkflowActionType } from '@prisma/client';
import { ProcessActionDto } from './dto/process-action.dto';

const TERMINAL_STATUSES: RequestStatus[] = [
  'APPROVED',
  'REJECTED',
  'CANCELLED',
  'CLOSED',
  'COMPLETED',
  'EXPIRED',
];

const ACTION_MAP: Record<
  string,
  { status: RequestStatus; wfAction: WorkflowActionType }
> = {
  approve:  { status: RequestStatus.APPROVED,           wfAction: WorkflowActionType.APPROVE          },
  reject:   { status: RequestStatus.REJECTED,           wfAction: WorkflowActionType.REJECT           },
  revision: { status: RequestStatus.REVISION_REQUESTED, wfAction: WorkflowActionType.REQUEST_REVISION },
  cancel:   { status: RequestStatus.CANCELLED,          wfAction: WorkflowActionType.CANCEL           },
};

@Injectable()
export class WorkflowEngineService {
  constructor(private prisma: PrismaService) {}

  /**
   * Called inside a Prisma transaction when a Request is created.
   * Returns the RequestStatus the request should be set to (e.g. IN_REVIEW),
   * or null if the workflowDefinition is inactive / has no steps.
   */
  async bootstrapInstance(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx: any,
    requestId: string,
    workflowDefinitionId: string,
  ): Promise<RequestStatus | null> {
    const definition = await tx.workflowDefinition.findUnique({
      where: { id: workflowDefinitionId },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });

    if (!definition?.isActive || !definition.steps.length) return null;

    const firstStep = definition.steps[0] as {
      id: string;
      stepType: string;
      assignedUserId: string | null;
      slaHours: number | null;
    };

    const instance = await tx.workflowInstance.create({
      data: {
        workflowDefinitionId,
        requestId,
        currentStepId: firstStep.id,
        status: 'ACTIVE',
        startedAt: new Date(),
      },
    });

    await tx.workflowInstanceStep.create({
      data: {
        workflowInstanceId: instance.id,
        workflowStepId: firstStep.id,
        status: 'PENDING',
        startedAt: new Date(),
        assignedToUserId: firstStep.assignedUserId ?? null,
        dueAt: firstStep.slaHours
          ? new Date(Date.now() + firstStep.slaHours * 3600 * 1000)
          : null,
      },
    });

    return firstStep.stepType === 'APPROVAL'
      ? RequestStatus.WAITING_APPROVAL
      : RequestStatus.IN_REVIEW;
  }

  /**
   * Generic action handler for POST /requests/:id/actions.
   * Usable by STAFF, FACULTY, ADMIN.
   */
  async processAction(
    userId: string,
    roles: string[],
    requestId: string,
    dto: ProcessActionDto,
  ) {
    const canAct = roles.some((r) => ['ADMIN', 'FACULTY', 'STAFF'].includes(r));
    if (!canAct) throw new ForbiddenException('Insufficient permissions.');

    const mapped = ACTION_MAP[dto.action];
    if (!mapped) throw new BadRequestException('Invalid action type.');

    if (
      (dto.action === 'reject' || dto.action === 'revision') &&
      !dto.comment?.trim()
    ) {
      throw new BadRequestException(
        'A comment is required for reject/revision actions.',
      );
    }

    const request = await this.prisma.request.findUnique({
      where: { id: requestId },
      include: {
        workflowInstance: {
          include: {
            instanceSteps: {
              where: { status: 'PENDING' },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    if (!request) throw new NotFoundException('Request not found.');

    if (TERMINAL_STATUSES.includes(request.status)) {
      throw new BadRequestException('Request is already in a terminal state.');
    }

    const { status: newStatus, wfAction } = mapped;

    return this.prisma.$transaction(async (tx) => {
      await tx.request.update({
        where: { id: requestId },
        data: { status: newStatus },
      });

      await tx.requestStatusHistory.create({
        data: {
          requestId,
          oldStatus: request.status,
          newStatus,
          changedByUserId: userId,
          changeReason: dto.comment ?? null,
        },
      });

      await tx.approvalAction.create({
        data: {
          requestId,
          actionType: wfAction,
          actionByUserId: userId,
          decisionNote: dto.comment ?? null,
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const instance = (request as any).workflowInstance;
      if (instance) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pendingStep = (instance.instanceSteps as any[])?.[0];
        if (pendingStep) {
          await tx.workflowInstanceStep.update({
            where: { id: pendingStep.id },
            data: {
              status: 'COMPLETED',
              completedAt: new Date(),
              actionTaken: wfAction,
              actionByUserId: userId,
              actionNote: dto.comment ?? null,
            },
          });
        }

        const isTerminal = TERMINAL_STATUSES.includes(newStatus);

        if (!isTerminal && instance.currentStepId) {
          const transition = await tx.workflowTransition.findFirst({
            where: {
              workflowDefinitionId: instance.workflowDefinitionId,
              fromStepId: instance.currentStepId,
              actionType: wfAction,
            },
            include: { toStep: true },
          });

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const toStep = (transition as any)?.toStep;
          if (toStep) {
            await tx.workflowInstance.update({
              where: { id: instance.id },
              data: { currentStepId: toStep.id },
            });
            await tx.workflowInstanceStep.create({
              data: {
                workflowInstanceId: instance.id,
                workflowStepId: toStep.id,
                status: 'PENDING',
                startedAt: new Date(),
                assignedToUserId: toStep.assignedUserId ?? null,
              },
            });
          } else {
            await tx.workflowInstance.update({
              where: { id: instance.id },
              data: { status: 'COMPLETED', endedAt: new Date(), currentStepId: null },
            });
          }
        } else {
          await tx.workflowInstance.update({
            where: { id: instance.id },
            data: { status: 'COMPLETED', endedAt: new Date(), currentStepId: null },
          });
        }
      }

      return { message: 'Action processed successfully.', status: newStatus };
    });
  }
}
