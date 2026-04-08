import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { CreateWorkflowStepDto } from './dto/create-workflow-step.dto';
import { CreateWorkflowTransitionDto } from './dto/create-workflow-transition.dto';

@Injectable()
export class WorkflowService {
  constructor(private prisma: PrismaService) {}

  getAll() {
    return this.prisma.workflowDefinition.findMany({
      include: {
        steps: { orderBy: { stepOrder: 'asc' } },
        _count: { select: { instances: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(id: string) {
    const wf = await this.prisma.workflowDefinition.findUnique({
      where: { id },
      include: {
        steps: {
          orderBy: { stepOrder: 'asc' },
          include: {
            assignedRole: { select: { id: true, name: true } },
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
        _count: { select: { instances: true } },
      },
    });
    if (!wf) throw new NotFoundException('Workflow not found.');
    return wf;
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
