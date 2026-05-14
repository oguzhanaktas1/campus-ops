import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../core/prisma/prisma.service';
import { CacheService } from '../infrastructure/cache/cache.service';
import { CacheKeys, CacheTtls } from '../infrastructure/cache/cache-keys';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { CreateWorkflowStepDto } from './dto/create-workflow-step.dto';
import { CreateWorkflowTransitionDto } from './dto/create-workflow-transition.dto';
import { SlaService } from './sla.service';

@Injectable()
export class WorkflowService {
  constructor(
    private prisma: PrismaService,
    private cacheService: CacheService,
    private slaService: SlaService,
  ) {}

  private minutesBetween(from: Date | null | undefined, to: Date | null | undefined) {
    if (!from || !to) return null;
    return Math.max(0, Math.round((to.getTime() - from.getTime()) / 60000));
  }

  private buildTicketLifecycle(request: any) {
    if (!request?.itTicket) return null;

    const actorName = (user: any) => user?.profile?.fullName ?? user?.email ?? null;
    const statusHistory = [...(request.statusHistory ?? [])].sort(
      (a: any, b: any) =>
        new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime(),
    );
    const assignmentsAsc = [...(request.assignments ?? [])].sort(
      (a: any, b: any) =>
        new Date(a.assignedAt).getTime() - new Date(b.assignedAt).getTime(),
    );
    const findHistory = (predicate: (item: any) => boolean) =>
      statusHistory.find(predicate) ?? null;

    const triagedAssignment = assignmentsAsc[0] ?? null;
    const inProgressHistory = findHistory(
      (item: any) => item.changeReason === 'Work started on the IT ticket.',
    );
    const waitingUserHistory = findHistory(
      (item: any) => item.newStatus === 'REVISION_REQUESTED',
    );
    const resolvedHistory = findHistory(
      (item: any) =>
        item.newStatus === 'COMPLETED' && item.changeReason === 'Ticket resolved.',
    );
    const closedHistory = findHistory((item: any) => item.newStatus === 'CLOSED');

    return {
      status: request.itTicket.ticketStatus,
      openedAt: request.itTicket.createdAt ?? request.createdAt,
      openedBy: actorName(request.itTicket.reportedBy) ?? actorName(request.requester),
      currentAssigneeName:
        request.currentAssignee?.profile?.fullName ?? request.currentAssignee?.email ?? null,
      resolvedAt: request.itTicket.resolvedAt ?? null,
      resolvedBy: actorName(resolvedHistory?.changedBy),
      closedAt: request.itTicket.closedAt ?? null,
      closedBy: actorName(closedHistory?.changedBy),
      reopenedCount: request.itTicket.reopenedCount ?? 0,
      stages: [
        {
          key: 'OPEN',
          label: 'Open',
          at: request.itTicket.createdAt ?? request.createdAt ?? null,
          by: actorName(request.itTicket.reportedBy) ?? actorName(request.requester),
          note: 'Ticket submitted.',
        },
        {
          key: 'TRIAGED',
          label: 'Triaged',
          at: triagedAssignment?.assignedAt ?? null,
          by: actorName(triagedAssignment?.assignedBy),
          note: triagedAssignment?.assignmentNote ?? null,
        },
        {
          key: 'IN_PROGRESS',
          label: 'In Progress',
          at: inProgressHistory?.changedAt ?? null,
          by: actorName(inProgressHistory?.changedBy),
          note: inProgressHistory?.changeReason ?? null,
        },
        {
          key: 'WAITING_USER',
          label: 'Waiting for User',
          at: waitingUserHistory?.changedAt ?? null,
          by: actorName(waitingUserHistory?.changedBy),
          note: waitingUserHistory?.changeReason ?? null,
        },
        {
          key: 'RESOLVED',
          label: 'Resolved',
          at: request.itTicket.resolvedAt ?? null,
          by: actorName(resolvedHistory?.changedBy),
          note: request.itTicket.resolutionSummary ?? resolvedHistory?.changeReason ?? null,
        },
        {
          key: 'CLOSED',
          label: 'Closed',
          at: request.itTicket.closedAt ?? null,
          by: actorName(closedHistory?.changedBy),
          note: closedHistory?.changeReason ?? null,
        },
      ],
    };
  }

  async getAll() {
    const [requestVersion, workflowVersion] = await Promise.all([
      this.cacheService.getVersion(CacheKeys.version('admin:requests:list')),
      this.cacheService.getVersion(CacheKeys.version('admin:workflows:definitions')),
    ]);
    const key = CacheKeys.adminWorkflowsList(requestVersion, workflowVersion);

    return this.cacheService.getOrSet(key, CacheTtls.workflowOverview, async () => {
      const now = new Date();
      const [definitions, groupedStatuses, startedAtGroups, overdueRows] =
        await Promise.all([
          this.prisma.workflowDefinition.findMany({
            include: {
              steps: { orderBy: { stepOrder: 'asc' } },
              _count: { select: { instances: true, requestTypes: true } },
            },
            orderBy: { createdAt: 'desc' },
          }),
          this.prisma.workflowInstance.groupBy({
            by: ['workflowDefinitionId', 'status'],
            _count: { _all: true },
          }),
          this.prisma.workflowInstance.groupBy({
            by: ['workflowDefinitionId'],
            _max: { startedAt: true },
          }),
          this.prisma.workflowInstance.findMany({
            where: {
              instanceSteps: {
                some: {
                  OR: [{ isOverdue: true }, { dueAt: { lt: now } }],
                },
              },
            },
            select: {
              id: true,
              workflowDefinitionId: true,
            },
          }),
        ]);

      const statusCounts = new Map<
        string,
        { activeInstances: number; completedInstances: number }
      >();

      groupedStatuses.forEach((row) => {
        const current = statusCounts.get(row.workflowDefinitionId) ?? {
          activeInstances: 0,
          completedInstances: 0,
        };

        if (row.status === 'ACTIVE') current.activeInstances = row._count._all;
        if (row.status === 'COMPLETED') current.completedInstances = row._count._all;

        statusCounts.set(row.workflowDefinitionId, current);
      });

      const lastStartedAtByWorkflow = new Map(
        startedAtGroups.map((row) => [row.workflowDefinitionId, row._max.startedAt ?? null]),
      );

      const overdueCounts = new Map<string, number>();
      const overdueSeen = new Set<string>();
      overdueRows.forEach((row) => {
        const rowKey = `${row.workflowDefinitionId}:${row.id}`;
        if (overdueSeen.has(rowKey)) return;
        overdueSeen.add(rowKey);
        overdueCounts.set(
          row.workflowDefinitionId,
          (overdueCounts.get(row.workflowDefinitionId) ?? 0) + 1,
        );
      });

      return definitions.map((definition) => {
        const counts = statusCounts.get(definition.id) ?? {
          activeInstances: 0,
          completedInstances: 0,
        };

        return {
          ...definition,
          metrics: {
            totalInstances: definition._count.instances,
            requestTypeCount: definition._count.requestTypes,
            activeInstances: counts.activeInstances,
            completedInstances: counts.completedInstances,
            overdueInstances: overdueCounts.get(definition.id) ?? 0,
            lastStartedAt: lastStartedAtByWorkflow.get(definition.id) ?? null,
          },
        };
      });
    });
  }

  async getInstancesOverview() {
    const [requestVersion, workflowVersion] = await Promise.all([
      this.cacheService.getVersion(CacheKeys.version('admin:requests:list')),
      this.cacheService.getVersion(CacheKeys.version('admin:workflows:definitions')),
    ]);

    const key = CacheKeys.adminWorkflowInstancesOverview(
      requestVersion,
      workflowVersion,
    );

    return this.cacheService.getOrSet(
      key,
      CacheTtls.workflowOverview,
      async () => {
        const workflows = await this.prisma.workflowDefinition.findMany({
          orderBy: { createdAt: 'desc' },
          include: {
            requestTypes: {
              select: { id: true, key: true, name: true, category: true },
              orderBy: { name: 'asc' },
            },
            steps: {
              orderBy: { stepOrder: 'asc' },
              select: {
                id: true,
                stepKey: true,
                stepName: true,
                stepOrder: true,
                stepType: true,
              },
            },
            instances: {
              orderBy: { startedAt: 'desc' },
              include: {
                currentStep: {
                  select: { id: true, stepKey: true, stepName: true, stepType: true },
                },
                request: {
                  select: {
                    id: true,
                    requestNo: true,
                    title: true,
                    status: true,
                    priority: true,
                    createdAt: true,
                    updatedAt: true,
                    dueAt: true,
                    requester: {
                      select: {
                        email: true,
                        profile: { select: { fullName: true } },
                      },
                    },
                    currentAssignee: {
                      select: {
                        email: true,
                        profile: { select: { fullName: true } },
                      },
                    },
                    assignments: {
                      where: { isActive: true },
                      orderBy: { assignedAt: 'desc' },
                      take: 1,
                      select: {
                        assignedAt: true,
                        unassignedAt: true,
                        assignedTo: {
                          select: {
                            email: true,
                            profile: { select: { fullName: true, title: true } },
                          },
                        },
                        assignedBy: {
                          select: {
                            email: true,
                            profile: { select: { fullName: true } },
                          },
                        },
                      },
                    },
                    slaEvents: {
                      orderBy: { occurredAt: 'desc' },
                      select: {
                        eventType: true,
                        occurredAt: true,
                      },
                    },
                    approvalActions: {
                      orderBy: { createdAt: 'desc' },
                      select: {
                        id: true,
                        actionType: true,
                        decisionNote: true,
                        createdAt: true,
                        actionBy: {
                          select: {
                            email: true,
                            profile: { select: { fullName: true } },
                          },
                        },
                      },
                    },
                    statusHistory: {
                      orderBy: { changedAt: 'asc' },
                      select: {
                        newStatus: true,
                        changeReason: true,
                        changedAt: true,
                        changedBy: {
                          select: {
                            email: true,
                            profile: { select: { fullName: true } },
                          },
                        },
                      },
                    },
                    itTicket: {
                      select: {
                        ticketStatus: true,
                        resolutionSummary: true,
                        resolvedAt: true,
                        closedAt: true,
                        reopenedCount: true,
                        createdAt: true,
                        reportedBy: {
                          select: {
                            email: true,
                            profile: { select: { fullName: true } },
                          },
                        },
                      },
                    },
                  },
                },
                instanceSteps: {
                  orderBy: { createdAt: 'asc' },
                  select: {
                    id: true,
                    status: true,
                    startedAt: true,
                    completedAt: true,
                    dueAt: true,
                    isOverdue: true,
                    actionTaken: true,
                    createdAt: true,
                    workflowStep: {
                      select: {
                        id: true,
                        stepName: true,
                        stepType: true,
                      },
                    },
                    assignedTo: {
                      select: {
                        email: true,
                        profile: { select: { fullName: true } },
                      },
                    },
                    actionBy: {
                      select: {
                        email: true,
                        profile: { select: { fullName: true } },
                      },
                    },
                  },
                },
              },
            },
            _count: { select: { instances: true, requestTypes: true } },
          },
        });

        const now = new Date();
        return workflows.map((wf) => {
          const instances = wf.instances.map((instance) => {
            const pendingStep =
              instance.instanceSteps.find((step) => step.status === 'PENDING') ?? null;
            const activeAssignment = instance.request.assignments[0] ?? null;

            return {
              id: instance.id,
              status: instance.status,
              startedAt: instance.startedAt,
              endedAt: instance.endedAt,
              currentStep: instance.currentStep,
              totalAgeMinutes: this.minutesBetween(instance.startedAt, instance.endedAt ?? now),
              currentStepAgeMinutes: pendingStep
                ? this.minutesBetween(pendingStep.startedAt ?? pendingStep.createdAt, now)
                : null,
              inactiveMinutes: this.minutesBetween(instance.request.updatedAt, now),
              isOverdue:
                Boolean(pendingStep?.dueAt && pendingStep.dueAt < now) ||
                Boolean(pendingStep?.isOverdue),
              request: {
                id: instance.request.id,
                requestNo: instance.request.requestNo,
                title: instance.request.title,
                status: instance.request.status,
                priority: instance.request.priority,
                requesterName:
                  instance.request.requester.profile?.fullName ??
                  instance.request.requester.email,
                currentAssigneeName:
                  instance.request.currentAssignee?.profile?.fullName ??
                  instance.request.currentAssignee?.email ??
                  null,
                sla: {
                  dueAt: instance.request.dueAt,
                  firstResponseState:
                    instance.request.slaEvents.find((event) =>
                      ['FIRST_RESPONSE_MET', 'FIRST_RESPONSE_BREACHED'].includes(
                        event.eventType,
                      ),
                    )?.eventType ??
                    (instance.request.slaEvents.some(
                      (event) => event.eventType === 'FIRST_RESPONSE_STARTED',
                    )
                      ? 'FIRST_RESPONSE_STARTED'
                      : null),
                  resolutionState:
                    instance.request.slaEvents.find((event) =>
                      ['RESOLUTION_MET', 'RESOLUTION_BREACHED'].includes(
                        event.eventType,
                      ),
                    )?.eventType ??
                    (instance.request.slaEvents.some(
                      (event) => event.eventType === 'RESOLUTION_STARTED',
                    )
                      ? 'RESOLUTION_STARTED'
                      : null),
                  escalationTriggered: instance.request.slaEvents.some(
                    (event) => event.eventType === 'ESCALATION_TRIGGERED',
                  ),
                  stepOverdueCount: instance.request.slaEvents.filter(
                    (event) => event.eventType === 'STEP_OVERDUE',
                  ).length,
                },
                ticketLifecycle: this.buildTicketLifecycle(instance.request),
              },
              activeAssignment: activeAssignment
                ? {
                    assignedAt: activeAssignment.assignedAt,
                    assignedToName:
                      activeAssignment.assignedTo.profile?.fullName ??
                      activeAssignment.assignedTo.email,
                    assignedByName:
                      activeAssignment.assignedBy?.profile?.fullName ??
                      activeAssignment.assignedBy?.email ??
                      null,
                    assignedAgeMinutes: this.minutesBetween(
                      activeAssignment.assignedAt,
                      activeAssignment.unassignedAt ?? now,
                    ),
                  }
                : null,
              approvalTimeline: instance.request.approvalActions.map((action) => ({
                id: action.id,
                actionType: action.actionType,
                decisionNote: action.decisionNote,
                createdAt: action.createdAt,
                actionBy: {
                  fullName: action.actionBy.profile?.fullName ?? action.actionBy.email,
                },
              })),
              instanceSteps: instance.instanceSteps.map((step) => ({
                id: step.id,
                status: step.status,
                startedAt: step.startedAt,
                completedAt: step.completedAt,
                dueAt: step.dueAt,
                isOverdue: step.isOverdue || Boolean(step.dueAt && step.dueAt < now),
                actionTaken: step.actionTaken,
                workflowStep: step.workflowStep,
                assignedTo: step.assignedTo
                  ? {
                      fullName:
                        step.assignedTo.profile?.fullName ?? step.assignedTo.email,
                      email: step.assignedTo.email,
                    }
                  : null,
                actionBy: step.actionBy
                  ? {
                      fullName: step.actionBy.profile?.fullName ?? step.actionBy.email,
                    }
                  : null,
              })),
            };
          });

          return {
            id: wf.id,
            key: wf.key,
            name: wf.name,
            description: wf.description,
            isActive: wf.isActive,
            isDefault: wf.isDefault,
            version: wf.version,
            steps: wf.steps,
            requestTypes: wf.requestTypes,
            instances,
            _count: wf._count,
          };
        });
      },
    );
  }

  async getById(id: string, view?: string) {
    if (view === 'instances') {
      const all = await this.getInstancesOverview();
      const workflow = all.find((item) => item.id === id);
      if (!workflow) throw new NotFoundException('Workflow not found.');
      return workflow;
    }

    const [requestVersion, workflowVersion] = await Promise.all([
      this.cacheService.getVersion(CacheKeys.version('admin:requests:list')),
      this.cacheService.getVersion(CacheKeys.version('admin:workflows:definitions')),
    ]);
    const key = CacheKeys.adminWorkflowDetail(id, requestVersion, workflowVersion);

    return this.cacheService.getOrSet(key, CacheTtls.workflowOverview, async () => {
      await this.slaService.runSlaSweep();

      const [wf, activeInstances, completedInstances, overdueInstances] = await Promise.all([
        this.prisma.workflowDefinition.findUnique({
          where: { id },
          include: {
          steps: {
            orderBy: { stepOrder: 'asc' },
            include: {
              assignedRole: { select: { id: true, name: true } },
              assignedUnit: { select: { id: true, name: true } },
              assignedUser: {
                select: {
                  id: true,
                  email: true,
                  profile: { select: { fullName: true } },
                },
              },
            },
          },
          transitions: {
            include: {
              fromStep: { select: { id: true, stepKey: true, stepName: true } },
              toStep: { select: { id: true, stepKey: true, stepName: true } },
            },
          },
          requestTypes: {
            select: { id: true, key: true, name: true, category: true },
            orderBy: { name: 'asc' },
          },
          _count: { select: { instances: true, requestTypes: true } },
        },
        }),
        this.prisma.workflowInstance.count({ where: { workflowDefinitionId: id, status: 'ACTIVE' } }),
        this.prisma.workflowInstance.count({ where: { workflowDefinitionId: id, status: 'COMPLETED' } }),
        this.prisma.workflowInstance.count({
          where: { workflowDefinitionId: id, instanceSteps: { some: { isOverdue: true, status: 'PENDING' } } },
        }),
      ]);
      if (!wf) throw new NotFoundException('Workflow not found.');


      return {
        ...wf,
        metrics: {
          totalInstances: wf._count.instances,
          requestTypeCount: wf._count.requestTypes,
          activeInstances,
          completedInstances,
          overdueInstances,
        },
      };
    });
  }

  async create(adminId: string, dto: CreateWorkflowDto) {
    const existing = await this.prisma.workflowDefinition.findUnique({
      where: { key: dto.key },
    });
    if (existing) throw new BadRequestException('A workflow with this key already exists.');

    const created = await this.prisma.workflowDefinition.create({
      data: {
        key: dto.key,
        name: dto.name,
        description: dto.description ?? null,
        version: dto.version ?? 1,
        isActive: dto.isActive ?? true,
        isDefault: dto.isDefault ?? false,
        createdByUserId: adminId,
      },
    });
    await this.cacheService.bumpVersion(
      CacheKeys.version('admin:workflows:definitions'),
    );
    return created;
  }

  async delete(id: string) {
    const existing = await this.prisma.workflowDefinition.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Workflow not found.');
    await this.prisma.workflowDefinition.delete({ where: { id } });
    await this.cacheService.bumpVersion(
      CacheKeys.version('admin:workflows:definitions'),
    );
    return { message: 'Workflow deleted.' };
  }

  async addStep(workflowId: string, dto: CreateWorkflowStepDto) {
    const wf = await this.prisma.workflowDefinition.findUnique({ where: { id: workflowId } });
    if (!wf) throw new NotFoundException('Workflow not found.');

    const step = await this.prisma.workflowStep.create({
      data: {
        workflowDefinitionId: workflowId,
        stepKey: dto.stepKey,
        stepName: dto.stepName,
        stepOrder: dto.stepOrder,
        stepType: dto.stepType,
        assignedRoleId: dto.assignedRoleId ?? null,
        assignedUnitId: dto.assignedUnitId ?? null,
        assignedUserId: dto.assignedUserId ?? null,
        isRequired: dto.isRequired ?? true,
        slaHours: dto.slaHours ?? null,
      },
    });
    await this.cacheService.bumpVersion(
      CacheKeys.version('admin:workflows:definitions'),
    );
    return step;
  }

  async addTransition(workflowId: string, dto: CreateWorkflowTransitionDto) {
    const wf = await this.prisma.workflowDefinition.findUnique({ where: { id: workflowId } });
    if (!wf) throw new NotFoundException('Workflow not found.');

    const transition = await this.prisma.workflowTransition.create({
      data: {
        workflowDefinitionId: workflowId,
        fromStepId: dto.fromStepId,
        toStepId: dto.toStepId ?? null,
        actionType: dto.actionType,
        ...(dto.conditionJson !== undefined
          ? { conditionJson: dto.conditionJson as Prisma.InputJsonValue }
          : {}),
      },
    });
    await this.cacheService.bumpVersion(
      CacheKeys.version('admin:workflows:definitions'),
    );
    return transition;
  }
}
