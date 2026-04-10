import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { CreateWorkflowStepDto } from './dto/create-workflow-step.dto';
import { CreateWorkflowTransitionDto } from './dto/create-workflow-transition.dto';
import { SlaService } from './sla.service';

@Injectable()
export class WorkflowService {
  constructor(
    private prisma: PrismaService,
    private slaService: SlaService,
  ) {}

  private minutesBetween(from: Date | null | undefined, to: Date | null | undefined) {
    if (!from || !to) return null;
    return Math.max(0, Math.round((to.getTime() - from.getTime()) / 60000));
  }

  async getAll() {
    await this.slaService.runSlaSweep();

    const now = new Date();
    const definitions = await this.prisma.workflowDefinition.findMany({
      include: {
        steps: { orderBy: { stepOrder: 'asc' } },
        instances: {
          select: {
            id: true,
            status: true,
            startedAt: true,
            endedAt: true,
            instanceSteps: {
              where: { status: 'PENDING' },
              select: {
                dueAt: true,
              },
            },
          },
        },
        _count: { select: { instances: true, requestTypes: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return definitions.map((definition) => {
      const activeInstances = definition.instances.filter(
        (instance) => instance.status === 'ACTIVE',
      );
      const completedInstances = definition.instances.filter(
        (instance) => instance.status === 'COMPLETED',
      );
      const overdueInstances = definition.instances.filter((instance) =>
        instance.instanceSteps.some((step) => step.dueAt && step.dueAt < now),
      );

      return {
        ...definition,
        metrics: {
          totalInstances: definition._count.instances,
          requestTypeCount: definition._count.requestTypes,
          activeInstances: activeInstances.length,
          completedInstances: completedInstances.length,
          overdueInstances: overdueInstances.length,
          lastStartedAt:
            definition.instances
              .map((instance) => instance.startedAt)
              .sort((a, b) => b.getTime() - a.getTime())[0] ?? null,
        },
      };
    });
  }

  async getById(id: string) {
    await this.slaService.runSlaSweep();

    const now = new Date();
    const wf = await this.prisma.workflowDefinition.findUnique({
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
        instances: {
          orderBy: { startedAt: 'desc' },
          take: 50,
          include: {
            currentStep: { select: { id: true, stepKey: true, stepName: true, stepType: true } },
            request: {
              select: {
                id: true,
                requestNo: true,
                title: true,
                status: true,
                priority: true,
                createdAt: true,
                updatedAt: true,
                submittedAt: true,
                dueAt: true,
                slaEvents: {
                  orderBy: { occurredAt: 'desc' },
                  select: {
                    id: true,
                    eventType: true,
                    occurredAt: true,
                    resolvedAt: true,
                  },
                },
                requester: {
                  select: {
                    id: true,
                    email: true,
                    profile: { select: { fullName: true, studentNumber: true, staffNumber: true } },
                  },
                },
                currentAssignee: {
                  select: {
                    id: true,
                    email: true,
                    profile: { select: { fullName: true, title: true } },
                  },
                },
                assignments: {
                  orderBy: { assignedAt: 'desc' },
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
                        profile: { select: { fullName: true, title: true } },
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
                        id: true,
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
              include: {
                workflowStep: {
                  select: {
                    id: true,
                    stepKey: true,
                    stepName: true,
                    stepOrder: true,
                    stepType: true,
                  },
                },
                assignedTo: {
                  select: {
                    id: true,
                    email: true,
                    profile: { select: { fullName: true, title: true } },
                  },
                },
                actionBy: {
                  select: {
                    id: true,
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
    if (!wf) throw new NotFoundException('Workflow not found.');

    const instances = wf.instances.map((instance) => {
      const pendingStep =
        instance.instanceSteps.find((step) => step.status === 'PENDING') ?? null;
      const activeAssignment =
        instance.request.assignments.find((assignment) => assignment.isActive) ?? null;

      return {
        id: instance.id,
        status: instance.status,
        startedAt: instance.startedAt,
        endedAt: instance.endedAt,
        currentStep: instance.currentStep,
        totalAgeMinutes: this.minutesBetween(
          instance.startedAt,
          instance.endedAt ?? now,
        ),
        currentStepAgeMinutes: pendingStep
          ? this.minutesBetween(pendingStep.startedAt ?? pendingStep.createdAt, now)
          : null,
        inactiveMinutes: this.minutesBetween(instance.request.updatedAt, now),
        isOverdue:
          Boolean(pendingStep?.dueAt && pendingStep.dueAt < now) ||
          Boolean(pendingStep?.isOverdue),
        request: {
          ...instance.request,
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
        },
        activeAssignment: activeAssignment
          ? {
              ...activeAssignment,
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
        instanceSteps: instance.instanceSteps.map((step) => ({
          id: step.id,
          status: step.status,
          startedAt: step.startedAt,
          completedAt: step.completedAt,
          dueAt: step.dueAt,
          isOverdue: step.isOverdue || Boolean(step.dueAt && step.dueAt < now),
          actionTaken: step.actionTaken,
          actionNote: step.actionNote,
          ageMinutes: this.minutesBetween(step.startedAt ?? step.createdAt, step.completedAt ?? now),
          workflowStep: step.workflowStep,
          assignedTo: step.assignedTo
            ? {
                id: step.assignedTo.id,
                fullName:
                  step.assignedTo.profile?.fullName ?? step.assignedTo.email,
                email: step.assignedTo.email,
                title: step.assignedTo.profile?.title ?? null,
              }
            : null,
          actionBy: step.actionBy
            ? {
                id: step.actionBy.id,
                fullName:
                  step.actionBy.profile?.fullName ?? step.actionBy.email,
                email: step.actionBy.email,
              }
            : null,
        })),
        approvalTimeline: instance.request.approvalActions.map((action) => ({
          id: action.id,
          actionType: action.actionType,
          decisionNote: action.decisionNote,
          createdAt: action.createdAt,
          actionBy: {
            id: action.actionBy.id,
            fullName: action.actionBy.profile?.fullName ?? action.actionBy.email,
            email: action.actionBy.email,
          },
        })),
      };
    });

    return {
      ...wf,
      metrics: {
        totalInstances: wf._count.instances,
        requestTypeCount: wf._count.requestTypes,
        activeInstances: instances.filter((instance) => instance.status === 'ACTIVE')
          .length,
        completedInstances: instances.filter(
          (instance) => instance.status === 'COMPLETED',
        ).length,
        overdueInstances: instances.filter((instance) => instance.isOverdue).length,
      },
      instances,
    };
  }

  async create(adminId: string, dto: CreateWorkflowDto) {
    const existing = await this.prisma.workflowDefinition.findUnique({
      where: { key: dto.key },
    });
    if (existing) throw new BadRequestException('A workflow with this key already exists.');

    return this.prisma.workflowDefinition.create({
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
  }

  async delete(id: string) {
    const existing = await this.prisma.workflowDefinition.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Workflow not found.');
    await this.prisma.workflowDefinition.delete({ where: { id } });
    return { message: 'Workflow deleted.' };
  }

  async addStep(workflowId: string, dto: CreateWorkflowStepDto) {
    const wf = await this.prisma.workflowDefinition.findUnique({ where: { id: workflowId } });
    if (!wf) throw new NotFoundException('Workflow not found.');

    return this.prisma.workflowStep.create({
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
  }

  async addTransition(workflowId: string, dto: CreateWorkflowTransitionDto) {
    const wf = await this.prisma.workflowDefinition.findUnique({ where: { id: workflowId } });
    if (!wf) throw new NotFoundException('Workflow not found.');

    return this.prisma.workflowTransition.create({
      data: {
        workflowDefinitionId: workflowId,
        fromStepId: dto.fromStepId,
        toStepId: dto.toStepId ?? null,
        actionType: dto.actionType,
      },
    });
  }
}
