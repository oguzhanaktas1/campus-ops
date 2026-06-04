import {
  PrismaClient,
  Prisma,
  WorkflowActionType,
  WorkflowStepType,
} from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

type StepInput = {
  stepKey: string;
  stepName: string;
  stepOrder: number;
  stepType: WorkflowStepType;
  assignedRoleName?: string;
  slaHours?: number | null;
  isRequired?: boolean;
  allowSkip?: boolean;
  configJson?: Record<string, unknown>;
};

type TransitionInput = {
  fromStepKey: string;
  toStepKey?: string | null;
  actionType: WorkflowActionType;
  conditionJson?: Record<string, unknown> | null;
};

type WorkflowSeedInput = {
  requestTypeKey: string;
  workflowKey: string;
  workflowName: string;
  description: string;
  steps: StepInput[];
  transitions: TransitionInput[];
};

async function getRoleIdByName(name: string): Promise<string> {
  const role = await prisma.role.findUnique({
    where: { name },
  });

  if (!role) {
    throw new Error(`Role not found: ${name}`);
  }

  return role.id;
}

async function getAdminUserId(): Promise<string> {
  const adminRole = await prisma.role.findUnique({
    where: { name: 'ADMIN' },
  });

  if (!adminRole) {
    throw new Error('ADMIN role not found.');
  }

  const adminUserRole = await prisma.userRole.findFirst({
    where: {
      roleId: adminRole.id,
    },
    orderBy: {
      assignedAt: 'asc',
    },
  });

  if (!adminUserRole) {
    throw new Error('No user found with ADMIN role.');
  }

  return adminUserRole.userId;
}

async function ensureRequestTypeExists(requestTypeKey: string) {
  const requestType = await prisma.requestType.findUnique({
    where: { key: requestTypeKey },
  });

  if (!requestType) {
    throw new Error(`RequestType not found: ${requestTypeKey}`);
  }

  return requestType;
}

async function upsertWorkflowDefinition(params: {
  key: string;
  name: string;
  description: string;
  createdByUserId: string;
}) {
  const { key, name, description, createdByUserId } = params;

  return prisma.workflowDefinition.upsert({
    where: { key },
    update: {
      name,
      description,
      isActive: true,
      isDefault: true,
      version: 1,
    },
    create: {
      key,
      name,
      description,
      version: 1,
      isActive: true,
      isDefault: true,
      createdByUserId,
    },
  });
}

async function upsertWorkflowStep(params: {
  workflowDefinitionId: string;
  step: StepInput;
}) {
  const { workflowDefinitionId, step } = params;

  const assignedRoleId = step.assignedRoleName
    ? await getRoleIdByName(step.assignedRoleName)
    : null;
  const configJson = {
    display: true,
    stageKey: step.stepKey,
    ...(step.configJson ?? {}),
  };

  return prisma.workflowStep.upsert({
    where: {
      workflowDefinitionId_stepKey: {
        workflowDefinitionId,
        stepKey: step.stepKey,
      },
    },
    update: {
      stepName: step.stepName,
      stepOrder: step.stepOrder,
      stepType: step.stepType,
      assignedRoleId,
      isRequired: step.isRequired ?? true,
      allowSkip: step.allowSkip ?? false,
      slaHours: step.slaHours ?? null,
      assignedUnitId: null,
      assignedUserId: null,
      configJson: configJson as Prisma.InputJsonValue,
    },
    create: {
      workflowDefinitionId,
      stepKey: step.stepKey,
      stepName: step.stepName,
      stepOrder: step.stepOrder,
      stepType: step.stepType,
      assignedRoleId,
      assignedUnitId: null,
      assignedUserId: null,
      isRequired: step.isRequired ?? true,
      allowSkip: step.allowSkip ?? false,
      slaHours: step.slaHours ?? null,
      configJson: configJson as Prisma.InputJsonValue,
    },
  });
}

async function ensureTransition(params: {
  workflowDefinitionId: string;
  fromStepId: string;
  toStepId?: string | null;
  actionType: WorkflowActionType;
  conditionJson?: Record<string, unknown> | null;
}) {
  const {
    workflowDefinitionId,
    fromStepId,
    toStepId = null,
    actionType,
    conditionJson = null,
  } = params;

  return prisma.workflowTransition.create({
    data: {
      workflowDefinitionId,
      fromStepId,
      toStepId,
      actionType,
      ...(conditionJson
        ? { conditionJson: conditionJson as Prisma.InputJsonValue }
        : {}),
    },
  });
}

async function attachWorkflowToRequestType(
  requestTypeKey: string,
  workflowDefinitionId: string,
) {
  const requestType = await ensureRequestTypeExists(requestTypeKey);

  await prisma.requestType.update({
    where: { id: requestType.id },
    data: {
      workflowDefinitionId,
    },
  });
}

async function seedWorkflow(
  input: WorkflowSeedInput,
  createdByUserId: string,
): Promise<void> {
  const workflow = await upsertWorkflowDefinition({
    key: input.workflowKey,
    name: input.workflowName,
    description: input.description,
    createdByUserId,
  });

  const existingSteps = await prisma.workflowStep.findMany({
    where: { workflowDefinitionId: workflow.id },
    orderBy: [{ stepOrder: 'asc' }, { id: 'asc' }],
  });

  for (let idx = 0; idx < existingSteps.length; idx += 1) {
    await prisma.workflowStep.update({
      where: { id: existingSteps[idx].id },
      data: { stepOrder: 1000 + idx },
    });
  }

  if (input.workflowKey === 'WF_INTERNSHIP_REQUEST_V1') {
    const legacyFinalDecision = await prisma.workflowStep.findFirst({
      where: {
        workflowDefinitionId: workflow.id,
        stepKey: 'FINAL_DECISION',
      },
    });
    const approvedEndExists = await prisma.workflowStep.findFirst({
      where: {
        workflowDefinitionId: workflow.id,
        stepKey: 'APPROVED_END',
      },
    });
    const rejectedEndExists = await prisma.workflowStep.findFirst({
      where: {
        workflowDefinitionId: workflow.id,
        stepKey: 'REJECTED_END',
      },
    });

    if (legacyFinalDecision) {
      const targetKey = approvedEndExists ? 'REJECTED_END' : 'APPROVED_END';
      const targetName = targetKey === 'APPROVED_END' ? 'Approved' : 'Rejected';
      const targetOrder = targetKey === 'APPROVED_END' ? 4 : 5;

      if (targetKey === 'REJECTED_END' && rejectedEndExists) {
        // Leave existing terminal nodes intact if both already exist.
      } else if (targetKey === 'APPROVED_END' && approvedEndExists) {
        // Leave existing terminal nodes intact if both already exist.
      } else {
        await prisma.workflowStep.update({
          where: { id: legacyFinalDecision.id },
          data: {
            stepKey: targetKey,
            stepName: targetName,
            stepOrder: targetOrder,
            stepType: WorkflowStepType.END,
            assignedRoleId: null,
            assignedUnitId: null,
            assignedUserId: null,
            slaHours: null,
          },
        });
      }
    }
  }

  const stepMap = new Map<string, string>();

  for (const step of input.steps) {
    const createdStep = await upsertWorkflowStep({
      workflowDefinitionId: workflow.id,
      step,
    });
    stepMap.set(step.stepKey, createdStep.id);
  }

  const activeStepIds = Array.from(stepMap.values());
  const staleSteps = await prisma.workflowStep.findMany({
    where: {
      workflowDefinitionId: workflow.id,
      id: activeStepIds.length > 0 ? { notIn: activeStepIds } : undefined,
    },
    orderBy: [{ stepOrder: 'asc' }, { id: 'asc' }],
  });

  for (let idx = 0; idx < staleSteps.length; idx += 1) {
    await prisma.workflowStep.update({
      where: { id: staleSteps[idx].id },
      data: {
        stepOrder: 1000 + idx,
        isRequired: false,
        allowSkip: true,
        configJson: {
          display: false,
          deprecated: true,
          supersededByWorkflowKey: input.workflowKey,
        } as Prisma.InputJsonValue,
      },
    });
  }

  await prisma.workflowTransition.deleteMany({
    where: { workflowDefinitionId: workflow.id },
  });

  for (const transition of input.transitions) {
    const fromStepId = stepMap.get(transition.fromStepKey);
    if (!fromStepId) {
      throw new Error(
        `fromStepKey not found in workflow ${input.workflowKey}: ${transition.fromStepKey}`,
      );
    }

    const toStepId = transition.toStepKey
      ? (stepMap.get(transition.toStepKey) ?? null)
      : null;

    if (transition.toStepKey && !toStepId) {
      throw new Error(
        `toStepKey not found in workflow ${input.workflowKey}: ${transition.toStepKey}`,
      );
    }

    await ensureTransition({
      workflowDefinitionId: workflow.id,
      fromStepId,
      toStepId,
      actionType: transition.actionType,
      conditionJson: transition.conditionJson ?? null,
    });
  }

  await attachWorkflowToRequestType(input.requestTypeKey, workflow.id);
}

const legacyWorkflows: WorkflowSeedInput[] = [
  {
    requestTypeKey: 'INTERNSHIP_REQUEST',
    workflowKey: 'WF_INTERNSHIP_REQUEST_V1',
    workflowName: 'Internship Request Workflow',
    description: 'Student internship approval workflow with advisor and coordinator reviews',
    steps: [
      {
        stepKey: 'SUBMIT',
        stepName: 'Submit',
        stepOrder: 1,
        stepType: WorkflowStepType.START,
      },
      {
        stepKey: 'ADVISOR_REVIEW',
        stepName: 'Advisor Review',
        stepOrder: 2,
        stepType: WorkflowStepType.REVIEW,
        assignedRoleName: 'ADVISOR',
        slaHours: 48,
      },
      {
        stepKey: 'COORDINATOR_REVIEW',
        stepName: 'Internship Coordinator Review',
        stepOrder: 3,
        stepType: WorkflowStepType.APPROVAL,
        assignedRoleName: 'INTERNSHIP_COORDINATOR',
        slaHours: 48,
      },
      {
        stepKey: 'REJECTED_END',
        stepName: 'Rejected',
        stepOrder: 4,
        stepType: WorkflowStepType.END,
      },
      {
        stepKey: 'APPROVED_END',
        stepName: 'Approved',
        stepOrder: 5,
        stepType: WorkflowStepType.END,
      },
    ],
    transitions: [
      {
        fromStepKey: 'SUBMIT',
        toStepKey: 'ADVISOR_REVIEW',
        actionType: WorkflowActionType.SUBMIT,
      },
      {
        fromStepKey: 'ADVISOR_REVIEW',
        toStepKey: 'COORDINATOR_REVIEW',
        actionType: WorkflowActionType.APPROVE,
      },
      {
        fromStepKey: 'ADVISOR_REVIEW',
        toStepKey: 'ADVISOR_REVIEW',
        actionType: WorkflowActionType.REQUEST_REVISION,
      },
      {
        fromStepKey: 'ADVISOR_REVIEW',
        toStepKey: 'REJECTED_END',
        actionType: WorkflowActionType.REJECT,
      },
      {
        fromStepKey: 'ADVISOR_REVIEW',
        toStepKey: 'ADVISOR_REVIEW',
        actionType: WorkflowActionType.SUBMIT,
      },
      {
        fromStepKey: 'COORDINATOR_REVIEW',
        toStepKey: 'APPROVED_END',
        actionType: WorkflowActionType.APPROVE,
      },
      {
        fromStepKey: 'COORDINATOR_REVIEW',
        toStepKey: 'COORDINATOR_REVIEW',
        actionType: WorkflowActionType.REQUEST_REVISION,
      },
      {
        fromStepKey: 'COORDINATOR_REVIEW',
        toStepKey: 'REJECTED_END',
        actionType: WorkflowActionType.REJECT,
      },
      {
        fromStepKey: 'COORDINATOR_REVIEW',
        toStepKey: 'COORDINATOR_REVIEW',
        actionType: WorkflowActionType.SUBMIT,
      },
    ],
  },

  {
    requestTypeKey: 'EQUIPMENT',
    workflowKey: 'WF_EQUIPMENT_REQUEST_V2',
    workflowName: 'Equipment Request Workflow',
    description: 'Equipment request and review workflow: Lab Technician reviews first, then Resource Manager approves',
    steps: [
      {
        stepKey: 'SUBMIT',
        stepName: 'Submit',
        stepOrder: 1,
        stepType: WorkflowStepType.START,
      },
      {
        stepKey: 'LAB_TECHNICIAN_REVIEW',
        stepName: 'Lab Technician Review',
        stepOrder: 2,
        stepType: WorkflowStepType.REVIEW,
        assignedRoleName: 'LAB_TECHNICIAN',
        slaHours: 48,
      },
      {
        stepKey: 'RESOURCE_REVIEW',
        stepName: 'Resource Manager Review',
        stepOrder: 3,
        stepType: WorkflowStepType.APPROVAL,
        assignedRoleName: 'RESOURCE_MANAGER',
        slaHours: 24,
      },
      {
        stepKey: 'REVISION',
        stepName: 'Revision',
        stepOrder: 4,
        stepType: WorkflowStepType.REVISION,
        slaHours: 72,
      },
      {
        stepKey: 'APPROVED_END',
        stepName: 'Approved',
        stepOrder: 5,
        stepType: WorkflowStepType.END,
      },
      {
        stepKey: 'REJECTED_END',
        stepName: 'Rejected',
        stepOrder: 6,
        stepType: WorkflowStepType.END,
      },
    ],
    transitions: [
      {
        fromStepKey: 'SUBMIT',
        toStepKey: 'LAB_TECHNICIAN_REVIEW',
        actionType: WorkflowActionType.SUBMIT,
      },
      {
        fromStepKey: 'LAB_TECHNICIAN_REVIEW',
        toStepKey: 'RESOURCE_REVIEW',
        actionType: WorkflowActionType.APPROVE,
      },
      {
        fromStepKey: 'LAB_TECHNICIAN_REVIEW',
        toStepKey: 'REVISION',
        actionType: WorkflowActionType.REQUEST_REVISION,
      },
      {
        fromStepKey: 'LAB_TECHNICIAN_REVIEW',
        toStepKey: 'REJECTED_END',
        actionType: WorkflowActionType.REJECT,
      },
      {
        fromStepKey: 'RESOURCE_REVIEW',
        toStepKey: 'APPROVED_END',
        actionType: WorkflowActionType.APPROVE,
      },
      {
        fromStepKey: 'RESOURCE_REVIEW',
        toStepKey: 'REVISION',
        actionType: WorkflowActionType.REQUEST_REVISION,
      },
      {
        fromStepKey: 'RESOURCE_REVIEW',
        toStepKey: 'REJECTED_END',
        actionType: WorkflowActionType.REJECT,
      },
      {
        fromStepKey: 'REVISION',
        toStepKey: 'LAB_TECHNICIAN_REVIEW',
        actionType: WorkflowActionType.SUBMIT,
      },
    ],
  },

  {
    requestTypeKey: 'IT_SUPPORT',
    workflowKey: 'WF_IT_SUPPORT_V1',
    workflowName: 'IT Support Workflow',
    description: 'IT ticket triage and resolution workflow',
    steps: [
      {
        stepKey: 'SUBMIT',
        stepName: 'Submit',
        stepOrder: 1,
        stepType: WorkflowStepType.START,
      },
      {
        stepKey: 'TRIAGE',
        stepName: 'IT Manager Triage',
        stepOrder: 2,
        stepType: WorkflowStepType.REVIEW,
        assignedRoleName: 'IT_MANAGER',
        slaHours: 8,
      },
      {
        stepKey: 'IN_PROGRESS',
        stepName: 'In Progress',
        stepOrder: 3,
        stepType: WorkflowStepType.ASSIGNMENT,
        assignedRoleName: 'IT_AGENT',
        slaHours: 24,
      },
      {
        stepKey: 'WAITING_USER',
        stepName: 'Waiting for User Revision',
        stepOrder: 4,
        stepType: WorkflowStepType.REVISION,
        slaHours: 72,
      },
      {
        stepKey: 'COMPLETED_END',
        stepName: 'Completed',
        stepOrder: 5,
        stepType: WorkflowStepType.END,
      },
      {
        stepKey: 'REJECTED_END',
        stepName: 'Rejected',
        stepOrder: 6,
        stepType: WorkflowStepType.END,
      },
    ],
    transitions: [
      {
        fromStepKey: 'SUBMIT',
        toStepKey: 'TRIAGE',
        actionType: WorkflowActionType.SUBMIT,
      },
      {
        fromStepKey: 'TRIAGE',
        toStepKey: 'IN_PROGRESS',
        actionType: WorkflowActionType.ASSIGN,
      },
      {
        fromStepKey: 'TRIAGE',
        toStepKey: 'WAITING_USER',
        actionType: WorkflowActionType.REQUEST_REVISION,
      },
      {
        fromStepKey: 'TRIAGE',
        toStepKey: 'REJECTED_END',
        actionType: WorkflowActionType.REJECT,
      },
      {
        fromStepKey: 'WAITING_USER',
        toStepKey: 'IN_PROGRESS',
        actionType: WorkflowActionType.SUBMIT,
      },
      {
        fromStepKey: 'IN_PROGRESS',
        toStepKey: 'COMPLETED_END',
        actionType: WorkflowActionType.COMPLETE,
      },
      {
        fromStepKey: 'IN_PROGRESS',
        toStepKey: 'WAITING_USER',
        actionType: WorkflowActionType.REQUEST_REVISION,
      },
      {
        fromStepKey: 'IN_PROGRESS',
        toStepKey: 'REJECTED_END',
        actionType: WorkflowActionType.REJECT,
      },
    ],
  },

  {
    requestTypeKey: 'ROOM_RESERVATION',
    workflowKey: 'WF_ROOM_RESERVATION_V1',
    workflowName: 'Room Reservation Workflow',
    description: 'Room reservation review workflow',
    steps: [
      {
        stepKey: 'SUBMIT',
        stepName: 'Submit',
        stepOrder: 1,
        stepType: WorkflowStepType.START,
      },
      {
        stepKey: 'RESOURCE_REVIEW',
        stepName: 'Resource Manager Review',
        stepOrder: 2,
        stepType: WorkflowStepType.REVIEW,
        assignedRoleName: 'RESOURCE_MANAGER',
        slaHours: 24,
      },
      {
        stepKey: 'SECURITY_APPROVAL',
        stepName: 'Security Approval',
        stepOrder: 3,
        stepType: WorkflowStepType.APPROVAL,
        assignedRoleName: 'SECURITY_OFFICER',
        slaHours: 24,
      },
      {
        stepKey: 'REVISION',
        stepName: 'Revision',
        stepOrder: 4,
        stepType: WorkflowStepType.REVISION,
        slaHours: 48,
      },
      {
        stepKey: 'APPROVED_END',
        stepName: 'Approved',
        stepOrder: 5,
        stepType: WorkflowStepType.END,
      },
      {
        stepKey: 'REJECTED_END',
        stepName: 'Rejected',
        stepOrder: 6,
        stepType: WorkflowStepType.END,
      },
    ],
    transitions: [
      {
        fromStepKey: 'SUBMIT',
        toStepKey: 'RESOURCE_REVIEW',
        actionType: WorkflowActionType.SUBMIT,
      },
      {
        fromStepKey: 'RESOURCE_REVIEW',
        toStepKey: 'SECURITY_APPROVAL',
        actionType: WorkflowActionType.APPROVE,
      },
      {
        fromStepKey: 'RESOURCE_REVIEW',
        toStepKey: 'REVISION',
        actionType: WorkflowActionType.REQUEST_REVISION,
      },
      {
        fromStepKey: 'RESOURCE_REVIEW',
        toStepKey: 'REJECTED_END',
        actionType: WorkflowActionType.REJECT,
      },
      {
        fromStepKey: 'REVISION',
        toStepKey: 'RESOURCE_REVIEW',
        actionType: WorkflowActionType.SUBMIT,
      },
      {
        fromStepKey: 'SECURITY_APPROVAL',
        toStepKey: 'APPROVED_END',
        actionType: WorkflowActionType.APPROVE,
      },
      {
        fromStepKey: 'SECURITY_APPROVAL',
        toStepKey: 'REVISION',
        actionType: WorkflowActionType.REQUEST_REVISION,
      },
      {
        fromStepKey: 'SECURITY_APPROVAL',
        toStepKey: 'REJECTED_END',
        actionType: WorkflowActionType.REJECT,
      },
    ],
  },

  {
    requestTypeKey: 'APPOINTMENT',
    workflowKey: 'WF_APPOINTMENT_V1',
    workflowName: 'Appointment Workflow',
    description:
      'Two-step appointment flow: target user reviews first, then RESOURCE_MANAGER approves.',
    steps: [
      {
        stepKey: 'SUBMIT',
        stepName: 'Submit',
        stepOrder: 1,
        stepType: WorkflowStepType.START,
      },
      {
        stepKey: 'TARGET_REVIEW',
        stepName: 'Target User Review',
        stepOrder: 2,
        stepType: WorkflowStepType.REVIEW,
        slaHours: 48,
        configJson: {
          assignment: 'dynamic',
          assigneeSource: 'calendar.targetUserId',
        },
      },
      {
        stepKey: 'RESOURCE_REVIEW',
        stepName: 'Resource Manager Approval',
        stepOrder: 3,
        stepType: WorkflowStepType.APPROVAL,
        assignedRoleName: 'RESOURCE_MANAGER',
        slaHours: 24,
      },
      {
        stepKey: 'REVISION',
        stepName: 'Revision',
        stepOrder: 4,
        stepType: WorkflowStepType.REVISION,
        slaHours: 72,
      },
      {
        stepKey: 'APPROVED_END',
        stepName: 'Approved',
        stepOrder: 5,
        stepType: WorkflowStepType.END,
      },
      {
        stepKey: 'REJECTED_END',
        stepName: 'Rejected',
        stepOrder: 6,
        stepType: WorkflowStepType.END,
      },
    ],
    transitions: [
      {
        fromStepKey: 'SUBMIT',
        toStepKey: 'TARGET_REVIEW',
        actionType: WorkflowActionType.SUBMIT,
      },
      {
        fromStepKey: 'TARGET_REVIEW',
        toStepKey: 'RESOURCE_REVIEW',
        actionType: WorkflowActionType.APPROVE,
      },
      {
        fromStepKey: 'TARGET_REVIEW',
        toStepKey: 'REVISION',
        actionType: WorkflowActionType.REQUEST_REVISION,
      },
      {
        fromStepKey: 'TARGET_REVIEW',
        toStepKey: 'REJECTED_END',
        actionType: WorkflowActionType.REJECT,
      },
      {
        fromStepKey: 'RESOURCE_REVIEW',
        toStepKey: 'APPROVED_END',
        actionType: WorkflowActionType.APPROVE,
      },
      {
        fromStepKey: 'RESOURCE_REVIEW',
        toStepKey: 'REVISION',
        actionType: WorkflowActionType.REQUEST_REVISION,
      },
      {
        fromStepKey: 'RESOURCE_REVIEW',
        toStepKey: 'REJECTED_END',
        actionType: WorkflowActionType.REJECT,
      },
      {
        fromStepKey: 'REVISION',
        toStepKey: 'TARGET_REVIEW',
        actionType: WorkflowActionType.SUBMIT,
      },
    ],
  },

  {
    requestTypeKey: 'EVENT_REQUEST',
    workflowKey: 'WF_EVENT_REQUEST_V2',
    workflowName: 'Event Request Workflow',
    description: 'Event request approval workflow',
    steps: [
      {
        stepKey: 'SUBMIT',
        stepName: 'Submit',
        stepOrder: 1,
        stepType: WorkflowStepType.START,
      },
      {
        stepKey: 'EVENT_COORDINATOR_REVIEW',
        stepName: 'Event Coordinator Review',
        stepOrder: 2,
        stepType: WorkflowStepType.REVIEW,
        assignedRoleName: 'EVENT_COORDINATOR',
        slaHours: 24,
      },
      {
        stepKey: 'DEPARTMENT_CHAIR_APPROVAL',
        stepName: 'Department Chair Approval',
        stepOrder: 3,
        stepType: WorkflowStepType.APPROVAL,
        assignedRoleName: 'DEPARTMENT_CHAIR',
        slaHours: 24,
      },
      {
        stepKey: 'SECURITY_APPROVAL',
        stepName: 'Security Approval',
        stepOrder: 4,
        stepType: WorkflowStepType.APPROVAL,
        assignedRoleName: 'SECURITY_OFFICER',
        slaHours: 24,
      },
      {
        stepKey: 'RESOURCE_REVIEW',
        stepName: 'Resource Manager Approval',
        stepOrder: 5,
        stepType: WorkflowStepType.APPROVAL,
        assignedRoleName: 'RESOURCE_MANAGER',
        slaHours: 24,
      },
      {
        stepKey: 'REVISION',
        stepName: 'Revision',
        stepOrder: 6,
        stepType: WorkflowStepType.REVISION,
        slaHours: 72,
      },
      {
        stepKey: 'APPROVED_END',
        stepName: 'Approved',
        stepOrder: 7,
        stepType: WorkflowStepType.END,
      },
      {
        stepKey: 'REJECTED_END',
        stepName: 'Rejected',
        stepOrder: 8,
        stepType: WorkflowStepType.END,
      },
    ],
    transitions: [
      {
        fromStepKey: 'SUBMIT',
        toStepKey: 'EVENT_COORDINATOR_REVIEW',
        actionType: WorkflowActionType.SUBMIT,
      },
      {
        fromStepKey: 'EVENT_COORDINATOR_REVIEW',
        toStepKey: 'DEPARTMENT_CHAIR_APPROVAL',
        actionType: WorkflowActionType.APPROVE,
      },
      {
        fromStepKey: 'EVENT_COORDINATOR_REVIEW',
        toStepKey: 'REVISION',
        actionType: WorkflowActionType.REQUEST_REVISION,
      },
      {
        fromStepKey: 'EVENT_COORDINATOR_REVIEW',
        toStepKey: 'REJECTED_END',
        actionType: WorkflowActionType.REJECT,
      },
      {
        fromStepKey: 'DEPARTMENT_CHAIR_APPROVAL',
        toStepKey: 'SECURITY_APPROVAL',
        actionType: WorkflowActionType.APPROVE,
      },
      {
        fromStepKey: 'DEPARTMENT_CHAIR_APPROVAL',
        toStepKey: 'REVISION',
        actionType: WorkflowActionType.REQUEST_REVISION,
      },
      {
        fromStepKey: 'DEPARTMENT_CHAIR_APPROVAL',
        toStepKey: 'REJECTED_END',
        actionType: WorkflowActionType.REJECT,
      },
      {
        fromStepKey: 'SECURITY_APPROVAL',
        toStepKey: 'RESOURCE_REVIEW',
        actionType: WorkflowActionType.APPROVE,
      },
      {
        fromStepKey: 'SECURITY_APPROVAL',
        toStepKey: 'REVISION',
        actionType: WorkflowActionType.REQUEST_REVISION,
      },
      {
        fromStepKey: 'SECURITY_APPROVAL',
        toStepKey: 'REJECTED_END',
        actionType: WorkflowActionType.REJECT,
      },
      {
        fromStepKey: 'RESOURCE_REVIEW',
        toStepKey: 'APPROVED_END',
        actionType: WorkflowActionType.APPROVE,
      },
      {
        fromStepKey: 'RESOURCE_REVIEW',
        toStepKey: 'REVISION',
        actionType: WorkflowActionType.REQUEST_REVISION,
      },
      {
        fromStepKey: 'RESOURCE_REVIEW',
        toStepKey: 'REJECTED_END',
        actionType: WorkflowActionType.REJECT,
      },
      {
        fromStepKey: 'REVISION',
        toStepKey: 'EVENT_COORDINATOR_REVIEW',
        actionType: WorkflowActionType.SUBMIT,
      },
    ],
  },

  {
    requestTypeKey: 'EVENT_CREATION_REQUEST',
    workflowKey: 'WF_EVENT_CREATION_REQUEST_V1',
    workflowName: 'Event Creation Request Workflow',
    description: 'Organizer event creation approval chain: Faculty Secretary → Department Chair → Finance Officer → Budget Approver → Event Coordinator',
    steps: [
      {
        stepKey: 'SUBMIT',
        stepName: 'Submit',
        stepOrder: 1,
        stepType: WorkflowStepType.START,
      },
      {
        stepKey: 'FACULTY_SECRETARY_REVIEW',
        stepName: 'Faculty Secretary Review',
        stepOrder: 2,
        stepType: WorkflowStepType.REVIEW,
        assignedRoleName: 'FACULTY_SECRETARY',
        slaHours: 48,
      },
      {
        stepKey: 'DEPARTMENT_CHAIR_APPROVAL',
        stepName: 'Department Chair Approval',
        stepOrder: 3,
        stepType: WorkflowStepType.APPROVAL,
        assignedRoleName: 'DEPARTMENT_CHAIR',
        slaHours: 48,
      },
      {
        stepKey: 'FINANCE_OFFICER_REVIEW',
        stepName: 'Finance Officer Review',
        stepOrder: 4,
        stepType: WorkflowStepType.APPROVAL,
        assignedRoleName: 'FINANCE_OFFICER',
        slaHours: 48,
      },
      {
        stepKey: 'BUDGET_APPROVER_APPROVAL',
        stepName: 'Budget Approver Approval',
        stepOrder: 5,
        stepType: WorkflowStepType.APPROVAL,
        assignedRoleName: 'BUDGET_APPROVER',
        slaHours: 48,
      },
      {
        stepKey: 'EVENT_COORDINATOR_FINAL',
        stepName: 'Event Coordinator Final Approval',
        stepOrder: 6,
        stepType: WorkflowStepType.APPROVAL,
        assignedRoleName: 'EVENT_COORDINATOR',
        slaHours: 24,
      },
      {
        stepKey: 'REVISION',
        stepName: 'Revision',
        stepOrder: 7,
        stepType: WorkflowStepType.REVISION,
        slaHours: 72,
      },
      {
        stepKey: 'APPROVED_END',
        stepName: 'Approved',
        stepOrder: 8,
        stepType: WorkflowStepType.END,
      },
      {
        stepKey: 'REJECTED_END',
        stepName: 'Rejected',
        stepOrder: 9,
        stepType: WorkflowStepType.END,
      },
    ],
    transitions: [
      {
        fromStepKey: 'SUBMIT',
        toStepKey: 'FACULTY_SECRETARY_REVIEW',
        actionType: WorkflowActionType.SUBMIT,
      },
      {
        fromStepKey: 'FACULTY_SECRETARY_REVIEW',
        toStepKey: 'DEPARTMENT_CHAIR_APPROVAL',
        actionType: WorkflowActionType.APPROVE,
      },
      {
        fromStepKey: 'FACULTY_SECRETARY_REVIEW',
        toStepKey: 'REVISION',
        actionType: WorkflowActionType.REQUEST_REVISION,
      },
      {
        fromStepKey: 'FACULTY_SECRETARY_REVIEW',
        toStepKey: 'REJECTED_END',
        actionType: WorkflowActionType.REJECT,
      },
      {
        fromStepKey: 'DEPARTMENT_CHAIR_APPROVAL',
        toStepKey: 'FINANCE_OFFICER_REVIEW',
        actionType: WorkflowActionType.APPROVE,
      },
      {
        fromStepKey: 'DEPARTMENT_CHAIR_APPROVAL',
        toStepKey: 'REVISION',
        actionType: WorkflowActionType.REQUEST_REVISION,
      },
      {
        fromStepKey: 'DEPARTMENT_CHAIR_APPROVAL',
        toStepKey: 'REJECTED_END',
        actionType: WorkflowActionType.REJECT,
      },
      {
        fromStepKey: 'FINANCE_OFFICER_REVIEW',
        toStepKey: 'BUDGET_APPROVER_APPROVAL',
        actionType: WorkflowActionType.APPROVE,
      },
      {
        fromStepKey: 'FINANCE_OFFICER_REVIEW',
        toStepKey: 'REVISION',
        actionType: WorkflowActionType.REQUEST_REVISION,
      },
      {
        fromStepKey: 'FINANCE_OFFICER_REVIEW',
        toStepKey: 'REJECTED_END',
        actionType: WorkflowActionType.REJECT,
      },
      {
        fromStepKey: 'BUDGET_APPROVER_APPROVAL',
        toStepKey: 'EVENT_COORDINATOR_FINAL',
        actionType: WorkflowActionType.APPROVE,
      },
      {
        fromStepKey: 'BUDGET_APPROVER_APPROVAL',
        toStepKey: 'REVISION',
        actionType: WorkflowActionType.REQUEST_REVISION,
      },
      {
        fromStepKey: 'BUDGET_APPROVER_APPROVAL',
        toStepKey: 'REJECTED_END',
        actionType: WorkflowActionType.REJECT,
      },
      {
        fromStepKey: 'EVENT_COORDINATOR_FINAL',
        toStepKey: 'APPROVED_END',
        actionType: WorkflowActionType.APPROVE,
      },
      {
        fromStepKey: 'EVENT_COORDINATOR_FINAL',
        toStepKey: 'REVISION',
        actionType: WorkflowActionType.REQUEST_REVISION,
      },
      {
        fromStepKey: 'EVENT_COORDINATOR_FINAL',
        toStepKey: 'REJECTED_END',
        actionType: WorkflowActionType.REJECT,
      },
      {
        fromStepKey: 'REVISION',
        toStepKey: 'FACULTY_SECRETARY_REVIEW',
        actionType: WorkflowActionType.SUBMIT,
      },
    ],
  },

  {
    requestTypeKey: 'ACCESS_REQUEST',
    workflowKey: 'WF_ACCESS_REQUEST_V2',
    workflowName: 'Access Request Workflow',
    description: 'Access request approval workflow',
    steps: [
      {
        stepKey: 'SUBMIT',
        stepName: 'Submit',
        stepOrder: 1,
        stepType: WorkflowStepType.START,
      },
      {
        stepKey: 'SECURITY_REVIEW',
        stepName: 'Security Review',
        stepOrder: 2,
        stepType: WorkflowStepType.REVIEW,
        assignedRoleName: 'SECURITY_OFFICER',
        slaHours: 24,
      },
      {
        stepKey: 'IT_AGENT_REVIEW',
        stepName: 'IT Agent Review',
        stepOrder: 3,
        stepType: WorkflowStepType.REVIEW,
        assignedRoleName: 'IT_AGENT',
        slaHours: 24,
      },
      {
        stepKey: 'SYSTEM_OWNER_APPROVAL',
        stepName: 'System Owner Approval',
        stepOrder: 4,
        stepType: WorkflowStepType.APPROVAL,
        assignedRoleName: 'SYSTEM_OWNER',
        slaHours: 24,
      },
      {
        stepKey: 'REVISION',
        stepName: 'Revision',
        stepOrder: 5,
        stepType: WorkflowStepType.REVISION,
        slaHours: 72,
      },
      {
        stepKey: 'APPROVED_END',
        stepName: 'Approved',
        stepOrder: 6,
        stepType: WorkflowStepType.END,
      },
      {
        stepKey: 'REJECTED_END',
        stepName: 'Rejected',
        stepOrder: 7,
        stepType: WorkflowStepType.END,
      },
    ],
    transitions: [
      {
        fromStepKey: 'SUBMIT',
        toStepKey: 'SECURITY_REVIEW',
        actionType: WorkflowActionType.SUBMIT,
      },
      {
        fromStepKey: 'SECURITY_REVIEW',
        toStepKey: 'IT_AGENT_REVIEW',
        actionType: WorkflowActionType.APPROVE,
      },
      {
        fromStepKey: 'SECURITY_REVIEW',
        toStepKey: 'REVISION',
        actionType: WorkflowActionType.REQUEST_REVISION,
      },
      {
        fromStepKey: 'SECURITY_REVIEW',
        toStepKey: 'REJECTED_END',
        actionType: WorkflowActionType.REJECT,
      },
      {
        fromStepKey: 'IT_AGENT_REVIEW',
        toStepKey: 'SYSTEM_OWNER_APPROVAL',
        actionType: WorkflowActionType.APPROVE,
      },
      {
        fromStepKey: 'IT_AGENT_REVIEW',
        toStepKey: 'REVISION',
        actionType: WorkflowActionType.REQUEST_REVISION,
      },
      {
        fromStepKey: 'IT_AGENT_REVIEW',
        toStepKey: 'REJECTED_END',
        actionType: WorkflowActionType.REJECT,
      },
      {
        fromStepKey: 'SYSTEM_OWNER_APPROVAL',
        toStepKey: 'APPROVED_END',
        actionType: WorkflowActionType.APPROVE,
      },
      {
        fromStepKey: 'SYSTEM_OWNER_APPROVAL',
        toStepKey: 'REVISION',
        actionType: WorkflowActionType.REQUEST_REVISION,
      },
      {
        fromStepKey: 'SYSTEM_OWNER_APPROVAL',
        toStepKey: 'REJECTED_END',
        actionType: WorkflowActionType.REJECT,
      },
      {
        fromStepKey: 'REVISION',
        toStepKey: 'SECURITY_REVIEW',
        actionType: WorkflowActionType.SUBMIT,
      },
    ],
  },

  {
    requestTypeKey: 'PROCUREMENT_REQUEST',
    workflowKey: 'WF_PROCUREMENT_REQUEST_V2',
    workflowName: 'Procurement Request Workflow',
    description: 'Procurement approval workflow',
    steps: [
      {
        stepKey: 'SUBMIT',
        stepName: 'Submit',
        stepOrder: 1,
        stepType: WorkflowStepType.START,
      },
      {
        stepKey: 'PROCUREMENT_INTAKE',
        stepName: 'Procurement Officer Intake',
        stepOrder: 2,
        stepType: WorkflowStepType.REVIEW,
        assignedRoleName: 'PROCUREMENT_OFFICER',
        slaHours: 24,
      },
      {
        stepKey: 'DEPARTMENT_CHAIR_APPROVAL',
        stepName: 'Department Chair Approval',
        stepOrder: 3,
        stepType: WorkflowStepType.APPROVAL,
        assignedRoleName: 'DEPARTMENT_CHAIR',
        slaHours: 24,
      },
      {
        stepKey: 'BUDGET_APPROVAL',
        stepName: 'Budget Approval',
        stepOrder: 4,
        stepType: WorkflowStepType.APPROVAL,
        assignedRoleName: 'BUDGET_APPROVER',
        slaHours: 24,
      },
      {
        stepKey: 'FINANCE_APPROVAL',
        stepName: 'Finance Approval',
        stepOrder: 5,
        stepType: WorkflowStepType.APPROVAL,
        assignedRoleName: 'FINANCE_OFFICER',
        slaHours: 24,
      },
      {
        stepKey: 'PROCUREMENT_FINAL_APPROVAL',
        stepName: 'Procurement Final Approval',
        stepOrder: 6,
        stepType: WorkflowStepType.APPROVAL,
        assignedRoleName: 'PROCUREMENT_OFFICER',
        slaHours: 48,
      },
      {
        stepKey: 'REVISION',
        stepName: 'Revision',
        stepOrder: 7,
        stepType: WorkflowStepType.REVISION,
        slaHours: 72,
      },
      {
        stepKey: 'APPROVED_END',
        stepName: 'Approved',
        stepOrder: 8,
        stepType: WorkflowStepType.END,
      },
      {
        stepKey: 'REJECTED_END',
        stepName: 'Rejected',
        stepOrder: 9,
        stepType: WorkflowStepType.END,
      },
    ],
    transitions: [
      {
        fromStepKey: 'SUBMIT',
        toStepKey: 'PROCUREMENT_INTAKE',
        actionType: WorkflowActionType.SUBMIT,
      },
      {
        fromStepKey: 'PROCUREMENT_INTAKE',
        toStepKey: 'DEPARTMENT_CHAIR_APPROVAL',
        actionType: WorkflowActionType.APPROVE,
      },
      {
        fromStepKey: 'PROCUREMENT_INTAKE',
        toStepKey: 'REVISION',
        actionType: WorkflowActionType.REQUEST_REVISION,
      },
      {
        fromStepKey: 'PROCUREMENT_INTAKE',
        toStepKey: 'REJECTED_END',
        actionType: WorkflowActionType.REJECT,
      },
      {
        fromStepKey: 'DEPARTMENT_CHAIR_APPROVAL',
        toStepKey: 'BUDGET_APPROVAL',
        actionType: WorkflowActionType.APPROVE,
      },
      {
        fromStepKey: 'DEPARTMENT_CHAIR_APPROVAL',
        toStepKey: 'REVISION',
        actionType: WorkflowActionType.REQUEST_REVISION,
      },
      {
        fromStepKey: 'DEPARTMENT_CHAIR_APPROVAL',
        toStepKey: 'REJECTED_END',
        actionType: WorkflowActionType.REJECT,
      },
      {
        fromStepKey: 'BUDGET_APPROVAL',
        toStepKey: 'FINANCE_APPROVAL',
        actionType: WorkflowActionType.APPROVE,
      },
      {
        fromStepKey: 'BUDGET_APPROVAL',
        toStepKey: 'REVISION',
        actionType: WorkflowActionType.REQUEST_REVISION,
      },
      {
        fromStepKey: 'BUDGET_APPROVAL',
        toStepKey: 'REJECTED_END',
        actionType: WorkflowActionType.REJECT,
      },
      {
        fromStepKey: 'FINANCE_APPROVAL',
        toStepKey: 'PROCUREMENT_FINAL_APPROVAL',
        actionType: WorkflowActionType.APPROVE,
      },
      {
        fromStepKey: 'FINANCE_APPROVAL',
        toStepKey: 'REVISION',
        actionType: WorkflowActionType.REQUEST_REVISION,
      },
      {
        fromStepKey: 'FINANCE_APPROVAL',
        toStepKey: 'REJECTED_END',
        actionType: WorkflowActionType.REJECT,
      },
      {
        fromStepKey: 'PROCUREMENT_FINAL_APPROVAL',
        toStepKey: 'APPROVED_END',
        actionType: WorkflowActionType.APPROVE,
      },
      {
        fromStepKey: 'PROCUREMENT_FINAL_APPROVAL',
        toStepKey: 'REVISION',
        actionType: WorkflowActionType.REQUEST_REVISION,
      },
      {
        fromStepKey: 'PROCUREMENT_FINAL_APPROVAL',
        toStepKey: 'REJECTED_END',
        actionType: WorkflowActionType.REJECT,
      },
      {
        fromStepKey: 'REVISION',
        toStepKey: 'PROCUREMENT_INTAKE',
        actionType: WorkflowActionType.SUBMIT,
      },
    ],
  },

  {
    requestTypeKey: 'DOCUMENT_REQUEST',
    workflowKey: 'WF_DOCUMENT_REQUEST_V1',
    workflowName: 'Document Request Workflow',
    description: 'Document request issuance workflow',
    steps: [
      {
        stepKey: 'SUBMIT',
        stepName: 'Submit',
        stepOrder: 1,
        stepType: WorkflowStepType.START,
      },
      {
        stepKey: 'DOCUMENT_REVIEW',
        stepName: 'Document Officer Review',
        stepOrder: 2,
        stepType: WorkflowStepType.REVIEW,
        assignedRoleName: 'DOCUMENT_OFFICER',
        slaHours: 24,
      },
      {
        stepKey: 'FACULTY_SECRETARY_APPROVAL',
        stepName: 'Faculty Secretary Approval',
        stepOrder: 3,
        stepType: WorkflowStepType.APPROVAL,
        assignedRoleName: 'FACULTY_SECRETARY',
        slaHours: 24,
      },
      {
        stepKey: 'REVISION',
        stepName: 'Revision',
        stepOrder: 4,
        stepType: WorkflowStepType.REVISION,
        slaHours: 72,
      },
      {
        stepKey: 'APPROVED_END',
        stepName: 'Approved',
        stepOrder: 5,
        stepType: WorkflowStepType.END,
      },
      {
        stepKey: 'REJECTED_END',
        stepName: 'Rejected',
        stepOrder: 6,
        stepType: WorkflowStepType.END,
      },
    ],
    transitions: [
      {
        fromStepKey: 'SUBMIT',
        toStepKey: 'DOCUMENT_REVIEW',
        actionType: WorkflowActionType.SUBMIT,
      },
      {
        fromStepKey: 'DOCUMENT_REVIEW',
        toStepKey: 'FACULTY_SECRETARY_APPROVAL',
        actionType: WorkflowActionType.APPROVE,
      },
      {
        fromStepKey: 'DOCUMENT_REVIEW',
        toStepKey: 'REVISION',
        actionType: WorkflowActionType.REQUEST_REVISION,
      },
      {
        fromStepKey: 'DOCUMENT_REVIEW',
        toStepKey: 'REJECTED_END',
        actionType: WorkflowActionType.REJECT,
      },
      {
        fromStepKey: 'FACULTY_SECRETARY_APPROVAL',
        toStepKey: 'APPROVED_END',
        actionType: WorkflowActionType.APPROVE,
      },
      {
        fromStepKey: 'FACULTY_SECRETARY_APPROVAL',
        toStepKey: 'REVISION',
        actionType: WorkflowActionType.REQUEST_REVISION,
      },
      {
        fromStepKey: 'FACULTY_SECRETARY_APPROVAL',
        toStepKey: 'REJECTED_END',
        actionType: WorkflowActionType.REJECT,
      },
      {
        fromStepKey: 'REVISION',
        toStepKey: 'DOCUMENT_REVIEW',
        actionType: WorkflowActionType.SUBMIT,
      },
    ],
  },
];

type UnifiedWorkflowStage = Omit<StepInput, 'stepOrder'>;

function buildUnifiedWorkflow(input: {
  requestTypeKey: string;
  workflowKey: string;
  workflowName: string;
  description: string;
  stages: UnifiedWorkflowStage[];
  revisionReturnStepKey?: string;
}): WorkflowSeedInput {
  const steps: StepInput[] = [
    {
      stepKey: 'SUBMIT',
      stepName: 'Submitted',
      stepOrder: 1,
      stepType: WorkflowStepType.START,
      configJson: { lifecycleStatus: 'SUBMITTED' },
    },
    ...input.stages.map((stage, index) => ({
      ...stage,
      stepOrder: index + 2,
      configJson: {
        lifecycleStatus: 'IN_REVIEW',
        ...(stage.configJson ?? {}),
      },
    })),
    {
      stepKey: 'REVISION',
      stepName: 'Revision Requested',
      stepOrder: input.stages.length + 2,
      stepType: WorkflowStepType.REVISION,
      slaHours: 72,
      configJson: { display: false, lifecycleStatus: 'IN_REVIEW' },
    },
    {
      stepKey: 'APPROVED_END',
      stepName: 'Approved',
      stepOrder: input.stages.length + 3,
      stepType: WorkflowStepType.END,
      configJson: { lifecycleStatus: 'APPROVED' },
    },
    {
      stepKey: 'REJECTED_END',
      stepName: 'Rejected',
      stepOrder: input.stages.length + 4,
      stepType: WorkflowStepType.END,
      configJson: { display: false, lifecycleStatus: 'REJECTED' },
    },
  ];

  const firstStageKey = input.stages[0]?.stepKey ?? 'APPROVED_END';
  const transitions: TransitionInput[] = [
    {
      fromStepKey: 'SUBMIT',
      toStepKey: firstStageKey,
      actionType: WorkflowActionType.SUBMIT,
    },
  ];

  input.stages.forEach((stage, index) => {
    const nextStage = input.stages[index + 1];
    transitions.push(
      {
        fromStepKey: stage.stepKey,
        toStepKey: nextStage?.stepKey ?? 'APPROVED_END',
        actionType: WorkflowActionType.APPROVE,
      },
      {
        fromStepKey: stage.stepKey,
        toStepKey: 'REVISION',
        actionType: WorkflowActionType.REQUEST_REVISION,
      },
      {
        fromStepKey: stage.stepKey,
        toStepKey: 'REJECTED_END',
        actionType: WorkflowActionType.REJECT,
      },
    );
  });

  transitions.push({
    fromStepKey: 'REVISION',
    toStepKey: input.revisionReturnStepKey ?? firstStageKey,
    actionType: WorkflowActionType.SUBMIT,
  });

  return {
    requestTypeKey: input.requestTypeKey,
    workflowKey: input.workflowKey,
    workflowName: input.workflowName,
    description: input.description,
    steps,
    transitions,
  };
}

const workflows: WorkflowSeedInput[] = [
  buildUnifiedWorkflow({
    requestTypeKey: 'INTERNSHIP_REQUEST',
    workflowKey: 'WF_INTERNSHIP_REQUEST_V1',
    workflowName: 'Internship Request Workflow',
    description: 'Unified internship approval flow: Advisor Review -> Internship Coordinator Review -> Approved.',
    stages: [
      {
        stepKey: 'ADVISOR_REVIEW',
        stepName: 'Advisor Review',
        stepType: WorkflowStepType.REVIEW,
        assignedRoleName: 'ADVISOR',
        slaHours: 48,
      },
      {
        stepKey: 'INTERNSHIP_COORDINATOR_REVIEW',
        stepName: 'Internship Coordinator Review',
        stepType: WorkflowStepType.APPROVAL,
        assignedRoleName: 'INTERNSHIP_COORDINATOR',
        slaHours: 48,
      },
    ],
  }),
  buildUnifiedWorkflow({
    requestTypeKey: 'DOCUMENT_REQUEST',
    workflowKey: 'WF_DOCUMENT_REQUEST_V1',
    workflowName: 'Document Request Workflow',
    description: 'Unified document flow: Document Processing -> Approved.',
    stages: [
      {
        stepKey: 'DOCUMENT_PROCESSING',
        stepName: 'Document Processing',
        stepType: WorkflowStepType.REVIEW,
        assignedRoleName: 'DOCUMENT_OFFICER',
        slaHours: 24,
      },
    ],
  }),
  buildUnifiedWorkflow({
    requestTypeKey: 'ROOM_RESERVATION',
    workflowKey: 'WF_ROOM_RESERVATION_V1',
    workflowName: 'Room Reservation Workflow',
    description: 'Unified room reservation flow: Resource Review -> Security Review -> Approved.',
    stages: [
      {
        stepKey: 'RESOURCE_REVIEW',
        stepName: 'Resource Review',
        stepType: WorkflowStepType.REVIEW,
        assignedRoleName: 'RESOURCE_MANAGER',
        slaHours: 24,
      },
      {
        stepKey: 'SECURITY_REVIEW',
        stepName: 'Security Review',
        stepType: WorkflowStepType.APPROVAL,
        assignedRoleName: 'SECURITY_OFFICER',
        slaHours: 24,
      },
    ],
  }),
  buildUnifiedWorkflow({
    requestTypeKey: 'APPOINTMENT',
    workflowKey: 'WF_APPOINTMENT_V1',
    workflowName: 'Appointment Workflow',
    description:
      'Two-step appointment flow: Target User Review -> Resource Manager Approval -> Approved.',
    stages: [
      {
        stepKey: 'TARGET_REVIEW',
        stepName: 'Target User Review',
        stepType: WorkflowStepType.REVIEW,
        slaHours: 48,
        configJson: {
          assignment: 'dynamic',
          assigneeSource: 'calendar.targetUserId',
        },
      },
      {
        stepKey: 'RESOURCE_REVIEW',
        stepName: 'Resource Manager Approval',
        stepType: WorkflowStepType.APPROVAL,
        assignedRoleName: 'RESOURCE_MANAGER',
        slaHours: 24,
      },
    ],
  }),
  buildUnifiedWorkflow({
    requestTypeKey: 'IT_SUPPORT',
    workflowKey: 'WF_IT_SUPPORT_V1',
    workflowName: 'IT Support Workflow',
    description: 'Unified IT support flow: IT Agent Review -> Manager Approval -> Approved. Ticket execution continues with ticket status.',
    stages: [
      {
        stepKey: 'IT_REVIEW',
        stepName: 'IT Agent Review',
        stepType: WorkflowStepType.REVIEW,
        assignedRoleName: 'IT_AGENT',
        slaHours: 8,
      },
      {
        stepKey: 'MANAGER_APPROVAL',
        stepName: 'Manager Approval',
        stepType: WorkflowStepType.APPROVAL,
        assignedRoleName: 'IT_MANAGER',
        slaHours: 24,
      },
    ],
  }),
  buildUnifiedWorkflow({
    requestTypeKey: 'EQUIPMENT',
    workflowKey: 'WF_EQUIPMENT_REQUEST_V2',
    workflowName: 'Equipment Request Workflow',
    description: 'Unified equipment flow: Technical Review -> Resource Review -> Approved.',
    stages: [
      {
        stepKey: 'TECHNICAL_REVIEW',
        stepName: 'Technical Review',
        stepType: WorkflowStepType.REVIEW,
        assignedRoleName: 'LAB_TECHNICIAN',
        slaHours: 48,
      },
      {
        stepKey: 'RESOURCE_REVIEW',
        stepName: 'Resource Review',
        stepType: WorkflowStepType.APPROVAL,
        assignedRoleName: 'RESOURCE_MANAGER',
        slaHours: 24,
      },
    ],
  }),
  buildUnifiedWorkflow({
    requestTypeKey: 'ACCESS_REQUEST',
    workflowKey: 'WF_ACCESS_REQUEST_V2',
    workflowName: 'Access Request Workflow',
    description: 'Unified access flow: Security Review -> IT Agent Review -> Manager Approval -> Approved.',
    stages: [
      {
        stepKey: 'SECURITY_REVIEW',
        stepName: 'Security Review',
        stepType: WorkflowStepType.REVIEW,
        assignedRoleName: 'SECURITY_OFFICER',
        slaHours: 24,
      },
      {
        stepKey: 'IT_REVIEW',
        stepName: 'IT Agent Review',
        stepType: WorkflowStepType.REVIEW,
        assignedRoleName: 'IT_AGENT',
        slaHours: 24,
      },
      {
        stepKey: 'MANAGER_APPROVAL',
        stepName: 'Manager Approval',
        stepType: WorkflowStepType.APPROVAL,
        assignedRoleName: 'IT_MANAGER',
        slaHours: 24,
      },
    ],
  }),
  buildUnifiedWorkflow({
    requestTypeKey: 'PROCUREMENT_REQUEST',
    workflowKey: 'WF_PROCUREMENT_REQUEST_V2',
    workflowName: 'Procurement Request Workflow',
    description: 'Unified procurement flow: Budget Review -> Procurement Review -> Finance Review -> Approved.',
    stages: [
      {
        stepKey: 'BUDGET_REVIEW',
        stepName: 'Budget Review',
        stepType: WorkflowStepType.REVIEW,
        assignedRoleName: 'BUDGET_APPROVER',
        slaHours: 24,
      },
      {
        stepKey: 'PROCUREMENT_REVIEW',
        stepName: 'Procurement Review',
        stepType: WorkflowStepType.REVIEW,
        assignedRoleName: 'PROCUREMENT_OFFICER',
        slaHours: 24,
      },
      {
        stepKey: 'FINANCE_REVIEW',
        stepName: 'Finance Review',
        stepType: WorkflowStepType.APPROVAL,
        assignedRoleName: 'FINANCE_OFFICER',
        slaHours: 24,
      },
    ],
  }),
  buildUnifiedWorkflow({
    requestTypeKey: 'EVENT_REQUEST',
    workflowKey: 'WF_EVENT_REQUEST_V2',
    workflowName: 'Event Request Workflow',
    description: 'Unified event flow: Event Coordinator Review -> Resource Review -> Security Review -> Approved.',
    stages: [
      {
        stepKey: 'EVENT_COORDINATOR_REVIEW',
        stepName: 'Event Coordinator Review',
        stepType: WorkflowStepType.REVIEW,
        assignedRoleName: 'EVENT_COORDINATOR',
        slaHours: 24,
      },
      {
        stepKey: 'RESOURCE_REVIEW',
        stepName: 'Resource Review',
        stepType: WorkflowStepType.REVIEW,
        assignedRoleName: 'RESOURCE_MANAGER',
        slaHours: 24,
      },
      {
        stepKey: 'SECURITY_REVIEW',
        stepName: 'Security Review',
        stepType: WorkflowStepType.APPROVAL,
        assignedRoleName: 'SECURITY_OFFICER',
        slaHours: 24,
      },
    ],
  }),
  buildUnifiedWorkflow({
    requestTypeKey: 'EVENT_CREATION_REQUEST',
    workflowKey: 'WF_EVENT_CREATION_REQUEST_V1',
    workflowName: 'Event Creation Request Workflow',
    description: 'Unified event creation flow: Advisor Review -> Event Coordinator Review -> Resource Review -> Security Review -> Approved.',
    stages: [
      {
        stepKey: 'ADVISOR_REVIEW',
        stepName: 'Advisor Review',
        stepType: WorkflowStepType.REVIEW,
        assignedRoleName: 'ADVISOR',
        slaHours: 48,
      },
      {
        stepKey: 'EVENT_COORDINATOR_REVIEW',
        stepName: 'Event Coordinator Review',
        stepType: WorkflowStepType.REVIEW,
        assignedRoleName: 'EVENT_COORDINATOR',
        slaHours: 24,
      },
      {
        stepKey: 'RESOURCE_REVIEW',
        stepName: 'Resource Review',
        stepType: WorkflowStepType.REVIEW,
        assignedRoleName: 'RESOURCE_MANAGER',
        slaHours: 24,
      },
      {
        stepKey: 'SECURITY_REVIEW',
        stepName: 'Security Review',
        stepType: WorkflowStepType.APPROVAL,
        assignedRoleName: 'SECURITY_OFFICER',
        slaHours: 24,
      },
    ],
  }),
];

export async function seedWorkflows() {
  const createdByUserId = await getAdminUserId();

  for (const workflow of workflows) {
    await ensureRequestTypeExists(workflow.requestTypeKey);
    await seedWorkflow(workflow, createdByUserId);
    console.log(`Seeded workflow for request type: ${workflow.requestTypeKey}`);
  }

  console.log('All workflows seeded successfully.');
}

if (require.main === module) {
  seedWorkflows()
    .catch((error) => {
      console.error('Workflow seed failed:', error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
