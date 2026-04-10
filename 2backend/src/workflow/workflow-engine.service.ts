import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service';
import {
  RequestStatus,
  WorkflowActionType,
  WorkflowStepType,
} from '@prisma/client';
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
  { terminalStatus: RequestStatus; wfAction: WorkflowActionType }
> = {
  submit: {
    terminalStatus: RequestStatus.SUBMITTED,
    wfAction: WorkflowActionType.SUBMIT,
  },
  approve: {
    terminalStatus: RequestStatus.APPROVED,
    wfAction: WorkflowActionType.APPROVE,
  },
  reject: {
    terminalStatus: RequestStatus.REJECTED,
    wfAction: WorkflowActionType.REJECT,
  },
  revision: {
    terminalStatus: RequestStatus.REVISION_REQUESTED,
    wfAction: WorkflowActionType.REQUEST_REVISION,
  },
  cancel: {
    terminalStatus: RequestStatus.CANCELLED,
    wfAction: WorkflowActionType.CANCEL,
  },
  complete: {
    terminalStatus: RequestStatus.COMPLETED,
    wfAction: WorkflowActionType.COMPLETE,
  },
};

@Injectable()
export class WorkflowEngineService {
  constructor(private prisma: PrismaService) {}

  private mapStepTypeToStatus(
    stepType: WorkflowStepType,
    fallback: RequestStatus,
  ): RequestStatus {
    switch (stepType) {
      case 'APPROVAL':
        return RequestStatus.WAITING_APPROVAL;
      case 'REVISION':
        return RequestStatus.REVISION_REQUESTED;
      case 'END':
        return fallback;
      default:
        return RequestStatus.IN_REVIEW;
    }
  }

  private buildDueAt(slaHours: number | null | undefined): Date | null {
    if (!slaHours || slaHours <= 0) return null;
    return new Date(Date.now() + slaHours * 3600 * 1000);
  }

  private async resolveAssignedUserIds(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx: any,
    request: {
      facultyId?: string | null;
      departmentId?: string | null;
      unitId?: string | null;
    },
    step: {
      assignedUserId?: string | null;
      assignedRoleId?: string | null;
      assignedUnitId?: string | null;
    },
  ): Promise<string[]> {
    if (step.assignedUserId) return [step.assignedUserId];

    const candidateIds = new Set<string>();

    if (step.assignedRoleId) {
      const scopeFilters: Array<Record<string, unknown>> = [];
      if (request.facultyId) {
        scopeFilters.push({
          OR: [{ facultyId: null }, { facultyId: request.facultyId }],
        });
      }
      if (request.departmentId) {
        scopeFilters.push({
          OR: [{ departmentId: null }, { departmentId: request.departmentId }],
        });
      }
      if (request.unitId) {
        scopeFilters.push({
          OR: [{ unitId: null }, { unitId: request.unitId }],
        });
      }

      const roleBindings = await tx.userRole.findMany({
        where: {
          roleId: step.assignedRoleId,
          user: { status: 'ACTIVE' },
          ...(scopeFilters.length > 0 ? { AND: scopeFilters } : {}),
        },
        select: { userId: true },
      });

      for (const binding of roleBindings) candidateIds.add(binding.userId);
    }

    if (step.assignedUnitId) {
      const unitUsers = await tx.user.findMany({
        where: {
          status: 'ACTIVE',
          OR: [
            { profile: { unitId: step.assignedUnitId } },
            { managedUnits: { some: { id: step.assignedUnitId } } },
          ],
        },
        select: { id: true },
      });
      for (const user of unitUsers) candidateIds.add(user.id);
    }

    return Array.from(candidateIds);
  }

  private async syncAssignments(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx: any,
    requestId: string,
    assignedUserIds: string[],
    assignedByUserId: string | null,
    assignmentNote: string,
  ) {
    const dedupedUserIds = Array.from(new Set(assignedUserIds));
    const activeAssignments = await tx.requestAssignment.findMany({
      where: { requestId, isActive: true },
      select: { id: true, assignedToUserId: true },
    });

    const activeUserIds = new Set(activeAssignments.map((item: { assignedToUserId: string }) => item.assignedToUserId));
    const targetUserIds = new Set(dedupedUserIds);

    const assignmentIdsToClose = activeAssignments
      .filter((item: { assignedToUserId: string }) => !targetUserIds.has(item.assignedToUserId))
      .map((item: { id: string }) => item.id);

    if (assignmentIdsToClose.length > 0) {
      await tx.requestAssignment.updateMany({
        where: { id: { in: assignmentIdsToClose } },
        data: { isActive: false, unassignedAt: new Date() },
      });
    }

    const newAssignments = dedupedUserIds
      .filter((userId) => !activeUserIds.has(userId))
      .map((userId) => ({
        requestId,
        assignedToUserId: userId,
        assignedByUserId,
        assignmentNote,
      }));

    if (newAssignments.length > 0) {
      await tx.requestAssignment.createMany({ data: newAssignments });
    }

    if (dedupedUserIds.length > 0) {
      await tx.requestWatcher.createMany({
        data: dedupedUserIds.map((userId) => ({ requestId, userId })),
        skipDuplicates: true,
      });
    }

    await tx.request.update({
      where: { id: requestId },
      data: {
        currentAssigneeUserId: dedupedUserIds.length === 1 ? dedupedUserIds[0] : null,
      },
    });
  }

  private async activateStep(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx: any,
    request: {
      id: string;
      requestNo: string;
      title: string;
      requesterUserId: string;
      facultyId?: string | null;
      departmentId?: string | null;
      unitId?: string | null;
    },
    workflowInstanceId: string,
    step: {
      id: string;
      stepName: string;
      stepType: WorkflowStepType;
      assignedUserId?: string | null;
      assignedRoleId?: string | null;
      assignedUnitId?: string | null;
      slaHours?: number | null;
    },
    actorUserId: string | null,
    assignmentNote: string,
  ) {
    const assignedUserIds = await this.resolveAssignedUserIds(tx, request, step);
    const instanceStepAssignedUserId =
      assignedUserIds.length === 1 ? assignedUserIds[0] : step.assignedUserId ?? null;

    await tx.workflowInstanceStep.create({
      data: {
        workflowInstanceId,
        workflowStepId: step.id,
        status: 'PENDING',
        startedAt: new Date(),
        assignedToUserId: instanceStepAssignedUserId,
        dueAt: this.buildDueAt(step.slaHours),
      },
    });

    await this.syncAssignments(
      tx,
      request.id,
      assignedUserIds,
      actorUserId,
      assignmentNote,
    );

    if (assignedUserIds.length > 0) {
      await tx.notification.createMany({
        data: assignedUserIds.map((userId) => ({
          userId,
          requestId: request.id,
          type: 'IN_APP',
          title: 'Request Assigned',
          message: `${request.requestNo} is waiting at "${step.stepName}".`,
          actionUrl: '/staff/inbox',
        })),
        skipDuplicates: false,
      });
    }
  }

  private async createCompletedStep(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx: any,
    workflowInstanceId: string,
    step: {
      id: string;
      stepType: WorkflowStepType;
      slaHours?: number | null;
      assignedUserId?: string | null;
    },
    action: WorkflowActionType,
    actorUserId: string,
    note: string | null,
  ) {
    return tx.workflowInstanceStep.create({
      data: {
        workflowInstanceId,
        workflowStepId: step.id,
        status: 'COMPLETED',
        startedAt: new Date(),
        completedAt: new Date(),
        assignedToUserId: step.assignedUserId ?? actorUserId,
        dueAt: this.buildDueAt(step.slaHours),
        actionTaken: action,
        actionByUserId: actorUserId,
        actionNote: note,
      },
    });
  }

  /**
   * Called inside a Prisma transaction when a Request is created.
   * Returns the RequestStatus the request should be set to.
   */
  async bootstrapInstance(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx: any,
    requestId: string,
    workflowDefinitionId: string,
  ): Promise<RequestStatus | null> {
    const request = await tx.request.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        requestNo: true,
        title: true,
        requesterUserId: true,
        facultyId: true,
        departmentId: true,
        unitId: true,
      },
    });

    if (!request) throw new NotFoundException('Request not found.');

    const definition = await tx.workflowDefinition.findUnique({
      where: { id: workflowDefinitionId },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });

    if (!definition?.isActive || !definition.steps.length) return null;

    const firstStep = definition.steps[0];
    const instance = await tx.workflowInstance.create({
      data: {
        workflowDefinitionId,
        requestId,
        currentStepId: firstStep.id,
        status: 'ACTIVE',
        startedAt: new Date(),
      },
    });

    await tx.requestWatcher.createMany({
      data: [{ requestId, userId: request.requesterUserId }],
      skipDuplicates: true,
    });

    if (firstStep.stepType !== 'START') {
      await this.activateStep(
        tx,
        request,
        instance.id,
        firstStep,
        request.requesterUserId,
        `Workflow started at "${firstStep.stepName}".`,
      );

      return this.mapStepTypeToStatus(firstStep.stepType, RequestStatus.IN_REVIEW);
    }

    const submittedStep = await this.createCompletedStep(
      tx,
      instance.id,
      firstStep,
      WorkflowActionType.SUBMIT,
      request.requesterUserId,
      'Request submitted.',
    );

    await tx.approvalAction.create({
      data: {
        requestId,
        workflowInstanceStepId: submittedStep.id,
        actionType: WorkflowActionType.SUBMIT,
        actionByUserId: request.requesterUserId,
        decisionNote: 'Request submitted.',
      },
    });

    const submitTransition = await tx.workflowTransition.findFirst({
      where: {
        workflowDefinitionId,
        fromStepId: firstStep.id,
        actionType: WorkflowActionType.SUBMIT,
      },
      include: { toStep: true },
    });

    const nextStep = submitTransition?.toStep ?? null;
    if (!nextStep) {
      await tx.workflowInstance.update({
        where: { id: instance.id },
        data: {
          status: 'COMPLETED',
          endedAt: new Date(),
          currentStepId: null,
        },
      });
      await this.syncAssignments(
        tx,
        request.id,
        [],
        request.requesterUserId,
        'Workflow finished at submit.',
      );
      return RequestStatus.SUBMITTED;
    }

    if (nextStep.stepType === 'END') {
      const terminalStatus = this.mapStepTypeToStatus(
        nextStep.stepType,
        RequestStatus.APPROVED,
      );
      await tx.workflowInstance.update({
        where: { id: instance.id },
        data: {
          status: 'COMPLETED',
          endedAt: new Date(),
          currentStepId: null,
        },
      });
      await this.syncAssignments(
        tx,
        request.id,
        [],
        request.requesterUserId,
        `Workflow completed at "${nextStep.stepName}".`,
      );
      return terminalStatus;
    }

    await tx.workflowInstance.update({
      where: { id: instance.id },
      data: { currentStepId: nextStep.id, status: 'ACTIVE' },
    });

    await this.activateStep(
      tx,
      request,
      instance.id,
      nextStep,
      request.requesterUserId,
      `Workflow moved to "${nextStep.stepName}".`,
    );

    return this.mapStepTypeToStatus(nextStep.stepType, RequestStatus.IN_REVIEW);
  }

  /**
   * Generic action handler for POST /requests/:id/actions.
   */
  async processAction(
    userId: string,
    roles: string[],
    requestId: string,
    dto: ProcessActionDto,
  ) {
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
            currentStep: true,
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

    const isPrivileged = roles.some((r) =>
      ['ADMIN', 'FACULTY', 'STAFF'].includes(r),
    );
    const isRequesterSubmit =
      dto.action === 'submit' && request.requesterUserId === userId;
    const isRequesterCancel =
      dto.action === 'cancel' && request.requesterUserId === userId;
    if (!isPrivileged && !isRequesterCancel && !isRequesterSubmit) {
      throw new ForbiddenException('Insufficient permissions.');
    }

    if (TERMINAL_STATUSES.includes(request.status)) {
      throw new BadRequestException('Request is already in a terminal state.');
    }

    return this.prisma.$transaction(async (tx) => {
      const workflowInstance = request.workflowInstance;
      const pendingStep = workflowInstance?.instanceSteps?.[0] ?? null;

      let nextStep: {
        id: string;
        stepName: string;
        stepType: WorkflowStepType;
        assignedUserId: string | null;
        assignedRoleId: string | null;
        assignedUnitId: string | null;
        slaHours: number | null;
      } | null = null;

      if (workflowInstance?.currentStepId) {
        const transition = await tx.workflowTransition.findFirst({
          where: {
            workflowDefinitionId: workflowInstance.workflowDefinitionId,
            fromStepId: workflowInstance.currentStepId,
            actionType: mapped.wfAction,
          },
          include: { toStep: true },
        });
        nextStep = transition?.toStep ?? null;
      }

      const nextStatus = nextStep
        ? this.mapStepTypeToStatus(nextStep.stepType, mapped.terminalStatus)
        : mapped.terminalStatus;

      await tx.request.update({
        where: { id: requestId },
        data: {
          status: nextStatus,
          ...(nextStatus === RequestStatus.CANCELLED
            ? { cancelledAt: new Date() }
            : {}),
          ...(nextStatus === RequestStatus.COMPLETED
            ? { completedAt: new Date() }
            : {}),
          ...(TERMINAL_STATUSES.includes(nextStatus)
            ? { closedAt: new Date() }
            : {}),
        },
      });

      await tx.requestStatusHistory.create({
        data: {
          requestId,
          oldStatus: request.status,
          newStatus: nextStatus,
          changedByUserId: userId,
          changeReason: dto.comment?.trim() || `${dto.action} action processed.`,
        },
      });

      await tx.approvalAction.create({
        data: {
          requestId,
          workflowInstanceStepId: pendingStep?.id ?? null,
          actionType: mapped.wfAction,
          actionByUserId: userId,
          decisionNote: dto.comment ?? null,
        },
      });

      await tx.requestWatcher.createMany({
        data: [
          { requestId, userId: request.requesterUserId },
          { requestId, userId },
        ],
        skipDuplicates: true,
      });

      if (pendingStep) {
        await tx.workflowInstanceStep.update({
          where: { id: pendingStep.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            actionTaken: mapped.wfAction,
            actionByUserId: userId,
            actionNote: dto.comment ?? null,
          },
        });
      }

      const shouldContinue = nextStep && nextStep.stepType !== 'END';

      if (workflowInstance) {
        if (shouldContinue && nextStep) {
          await tx.workflowInstance.update({
            where: { id: workflowInstance.id },
            data: { currentStepId: nextStep.id, status: 'ACTIVE' },
          });

          await this.activateStep(
            tx,
            {
              id: request.id,
              requestNo: request.requestNo,
              title: request.title,
              requesterUserId: request.requesterUserId,
              facultyId: request.facultyId,
              departmentId: request.departmentId,
              unitId: request.unitId,
            },
            workflowInstance.id,
            nextStep,
            userId,
            `Workflow moved to "${nextStep.stepName}".`,
          );
        } else {
          await tx.workflowInstance.update({
            where: { id: workflowInstance.id },
            data: {
              status: 'COMPLETED',
              endedAt: new Date(),
              currentStepId: null,
            },
          });

          await this.syncAssignments(
            tx,
            requestId,
            [],
            userId,
            `Workflow ${dto.action} completed.`,
          );
        }
      }

      return {
        message: 'Action processed successfully.',
        status: nextStatus,
        nextStep: shouldContinue ? nextStep?.stepName ?? null : null,
      };
    });
  }
}
