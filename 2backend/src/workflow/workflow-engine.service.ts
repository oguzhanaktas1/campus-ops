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
  Prisma,
} from '@prisma/client';
import { ProcessActionDto } from './dto/process-action.dto';
import { SlaService } from './sla.service';
import { RabbitmqPublisher } from '../infrastructure/rabbitmq/rabbitmq.publisher';
import { RoutingKeys } from '../infrastructure/rabbitmq/routing-keys';

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
  constructor(
    private prisma: PrismaService,
    private slaService: SlaService,
    private mq: RabbitmqPublisher,
  ) {}

  private getJsonPathValue(
    value: Prisma.JsonValue | null | undefined,
    path: string,
  ): unknown {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return undefined;
    }

    let current: unknown = value;
    for (const segment of path.split('.')) {
      if (!current || typeof current !== 'object' || Array.isArray(current)) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[segment];
    }

    return current;
  }

  private matchesTransitionCondition(
    condition: Prisma.JsonValue | null | undefined,
    dynamicData: Prisma.JsonValue | null | undefined,
  ): boolean {
    if (!condition || typeof condition !== 'object' || Array.isArray(condition)) {
      return true;
    }

    const record = condition as Record<string, unknown>;
    const path = typeof record.path === 'string' ? record.path : null;
    if (!path) return true;

    const actual = this.getJsonPathValue(dynamicData, path);

    if (Object.prototype.hasOwnProperty.call(record, 'equals')) {
      return actual === record.equals;
    }

    if (Object.prototype.hasOwnProperty.call(record, 'notEquals')) {
      return actual !== record.notEquals;
    }

    if (record.exists === true) {
      return actual !== undefined && actual !== null;
    }

    if (record.exists === false) {
      return actual === undefined || actual === null;
    }

    return true;
  }

  private async resolveTransition(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx: any,
    workflowDefinitionId: string,
    fromStepId: string,
    actionType: WorkflowActionType,
    dynamicData: Prisma.JsonValue | null | undefined,
  ) {
    const transitions = await tx.workflowTransition.findMany({
      where: {
        workflowDefinitionId,
        fromStepId,
        actionType,
      },
      include: { toStep: true },
      orderBy: { createdAt: 'asc' },
    });

    const matched =
      transitions.find((transition: { conditionJson?: Prisma.JsonValue | null }) =>
        transition.conditionJson &&
        this.matchesTransitionCondition(transition.conditionJson, dynamicData),
      ) ??
      transitions.find((transition: { conditionJson?: Prisma.JsonValue | null }) =>
        !transition.conditionJson,
      ) ??
      null;

    return matched;
  }

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
      currentAssigneeUserId?: string | null;
      dynamicData?: Prisma.JsonValue | null;
    },
    step: {
      stepKey?: string;
      assignedUserId?: string | null;
      assignedRoleId?: string | null;
      assignedUnitId?: string | null;
      assignedRole?: { name: string } | null;
    },
  ): Promise<string[]> {
    if (step.assignedUserId) return [step.assignedUserId];

    if (step.stepKey === 'MANAGER_APPROVAL') {
      const managerUserId = this.getJsonPathValue(
        request.dynamicData,
        'calendar.managerUserId',
      );
      return typeof managerUserId === 'string' ? [managerUserId] : [];
    }

    if (step.stepKey === 'TARGET_REVIEW') {
      const targetUserId = this.getJsonPathValue(
        request.dynamicData,
        'calendar.targetUserId',
      );
      if (typeof targetUserId === 'string') {
        return [targetUserId];
      }
    }

    if (
      request.currentAssigneeUserId &&
      step.assignedRole?.name === 'FACULTY'
    ) {
      return [request.currentAssigneeUserId];
    }

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

    if (dedupedUserIds.length === 1) {
      await tx.request.updateMany({
        where: {
          id: requestId,
          status: RequestStatus.SUBMITTED,
        },
        data: {
          status: RequestStatus.IN_REVIEW,
        },
      });
    }
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
      dynamicData?: Prisma.JsonValue | null;
    },
    workflowInstanceId: string,
    step: {
      id: string;
      stepKey: string;
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
        currentAssigneeUserId: true,
        dynamicData: true,
      },
    });

    if (!request) throw new NotFoundException('Request not found.');

    const definition = await tx.workflowDefinition.findUnique({
      where: { id: workflowDefinitionId },
      include: {
        steps: {
          include: {
            assignedRole: { select: { name: true } },
          },
          orderBy: { stepOrder: 'asc' },
        },
      },
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

    await this.slaService.startRequestSla(tx, requestId);

    if (firstStep.stepType !== 'START') {
      await this.activateStep(
        tx,
        request,
        instance.id,
        firstStep,
        request.requesterUserId,
        `Workflow started at "${firstStep.stepName}".`,
      );

      return RequestStatus.SUBMITTED;
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

    const submitTransition = await this.resolveTransition(
      tx,
      workflowDefinitionId,
      firstStep.id,
      WorkflowActionType.SUBMIT,
      request.dynamicData,
    );

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
      return RequestStatus.SUBMITTED;
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

    return RequestStatus.SUBMITTED;
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

    // workflow.assigned için transaction dışında publish edilecek veri
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const assignedPublishRef: { data: any } = { data: null };

    const txResult = await this.prisma.$transaction(async (tx) => {
      const workflowInstance = request.workflowInstance;
      const pendingStep = workflowInstance?.instanceSteps?.[0] ?? null;

      let nextStep: {
        id: string;
        stepKey: string;
        stepName: string;
        stepType: WorkflowStepType;
        assignedUserId: string | null;
        assignedRoleId: string | null;
        assignedUnitId: string | null;
        slaHours: number | null;
      } | null = null;

      if (workflowInstance?.currentStepId) {
        const transition = await this.resolveTransition(
          tx,
          workflowInstance.workflowDefinitionId,
          workflowInstance.currentStepId,
          mapped.wfAction,
          request.dynamicData,
        );
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
        if (pendingStep.dueAt && pendingStep.dueAt < new Date()) {
          await this.slaService.markStepOverdue(tx, pendingStep.id);
        }

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

      if (dto.action !== 'submit' && dto.action !== 'cancel') {
        await this.slaService.markFirstResponse(tx, requestId);
      }

      if (workflowInstance) {
        if (shouldContinue && nextStep) {
          await tx.workflowInstance.update({
            where: { id: workflowInstance.id },
            data: { currentStepId: nextStep.id, status: 'ACTIVE' },
          });

          const resolvedIds = await this.resolveAssignedUserIds(
            tx,
            {
              facultyId:    request.facultyId,
              departmentId: request.departmentId,
              unitId:       request.unitId,
              dynamicData:  request.dynamicData,
            },
            nextStep,
          );

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
              dynamicData: request.dynamicData,
            },
            workflowInstance.id,
            nextStep,
            userId,
            `Workflow moved to "${nextStep.stepName}".`,
          );

          // Transaction dışında publish için ref'e yaz
          assignedPublishRef.data = {
            assigneeUserIds: resolvedIds,
            stepCode: nextStep.stepKey,
            workflowInstanceId: workflowInstance.id,
            requestType: (request as any).requestType?.key ?? '',
          };
        } else {
          await this.slaService.markResolution(tx, requestId, nextStatus);

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

    // ── workflow.assigned event — transaction dışında publish ──────────────
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const apd = assignedPublishRef.data;
    if (apd) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      for (const assigneeUserId of apd.assigneeUserIds as string[]) {
        this.mq.publish({
          event:              RoutingKeys.WORKFLOW_ASSIGNED,
          occurredAt:         new Date().toISOString(),
          requestId,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          requestType:        apd.requestType,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          workflowInstanceId: apd.workflowInstanceId,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          stepCode:           apd.stepCode,
          assigneeUserId,
          triggeredByUserId:  userId,
        });
      }
    }

    return txResult;
  }
}
