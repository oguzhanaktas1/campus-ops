import {
  PrismaClient,
  WorkflowActionType,
  WorkflowStepType,
} from '@prisma/client';

const prisma = new PrismaClient();

type StepInput = {
  stepKey: string;
  stepName: string;
  stepOrder: number;
  stepType: WorkflowStepType;
  assignedRoleName?: string;
  slaHours?: number | null;
  isRequired?: boolean;
  allowSkip?: boolean;
};

type TransitionInput = {
  fromStepKey: string;
  toStepKey?: string | null;
  actionType: WorkflowActionType;
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
    },
  });
}

async function ensureTransition(params: {
  workflowDefinitionId: string;
  fromStepId: string;
  toStepId?: string | null;
  actionType: WorkflowActionType;
}) {
  const {
    workflowDefinitionId,
    fromStepId,
    toStepId = null,
    actionType,
  } = params;

  const existing = await prisma.workflowTransition.findFirst({
    where: {
      workflowDefinitionId,
      fromStepId,
      toStepId,
      actionType,
    },
  });

  if (existing) return existing;

  return prisma.workflowTransition.create({
    data: {
      workflowDefinitionId,
      fromStepId,
      toStepId,
      actionType,
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

  const stepMap = new Map<string, string>();

  for (const step of input.steps) {
    const createdStep = await upsertWorkflowStep({
      workflowDefinitionId: workflow.id,
      step,
    });
    stepMap.set(step.stepKey, createdStep.id);
  }

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
    });
  }

  await attachWorkflowToRequestType(input.requestTypeKey, workflow.id);
}

const workflows: WorkflowSeedInput[] = [
  {
    requestTypeKey: 'INTERNSHIP_REQUEST',
    workflowKey: 'WF_INTERNSHIP_REQUEST_V1',
    workflowName: 'Internship Request Workflow',
    description: 'Student internship approval workflow',
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
        stepKey: 'REVISION',
        stepName: 'Student Revision',
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
        toStepKey: 'REVISION',
        actionType: WorkflowActionType.REQUEST_REVISION,
      },
      {
        fromStepKey: 'ADVISOR_REVIEW',
        toStepKey: 'REJECTED_END',
        actionType: WorkflowActionType.REJECT,
      },
      {
        fromStepKey: 'REVISION',
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
        toStepKey: 'REVISION',
        actionType: WorkflowActionType.REQUEST_REVISION,
      },
      {
        fromStepKey: 'COORDINATOR_REVIEW',
        toStepKey: 'REJECTED_END',
        actionType: WorkflowActionType.REJECT,
      },
    ],
  },

  {
    requestTypeKey: 'EQUIPMENT',
    workflowKey: 'WF_EQUIPMENT_REQUEST_V1',
    workflowName: 'Equipment Request Workflow',
    description: 'Equipment request and review workflow',
    steps: [
      {
        stepKey: 'SUBMIT',
        stepName: 'Submit',
        stepOrder: 1,
        stepType: WorkflowStepType.START,
      },
      {
        stepKey: 'STAFF_REVIEW',
        stepName: 'Staff Review',
        stepOrder: 2,
        stepType: WorkflowStepType.REVIEW,
        assignedRoleName: 'STAFF',
        slaHours: 24,
      },
      {
        stepKey: 'PROCUREMENT_REVIEW',
        stepName: 'Procurement Review',
        stepOrder: 3,
        stepType: WorkflowStepType.APPROVAL,
        assignedRoleName: 'PROCUREMENT_OFFICER',
        slaHours: 48,
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
        toStepKey: 'STAFF_REVIEW',
        actionType: WorkflowActionType.SUBMIT,
      },
      {
        fromStepKey: 'STAFF_REVIEW',
        toStepKey: 'PROCUREMENT_REVIEW',
        actionType: WorkflowActionType.APPROVE,
      },
      {
        fromStepKey: 'STAFF_REVIEW',
        toStepKey: 'REVISION',
        actionType: WorkflowActionType.REQUEST_REVISION,
      },
      {
        fromStepKey: 'STAFF_REVIEW',
        toStepKey: 'REJECTED_END',
        actionType: WorkflowActionType.REJECT,
      },
      {
        fromStepKey: 'REVISION',
        toStepKey: 'STAFF_REVIEW',
        actionType: WorkflowActionType.SUBMIT,
      },
      {
        fromStepKey: 'PROCUREMENT_REVIEW',
        toStepKey: 'APPROVED_END',
        actionType: WorkflowActionType.APPROVE,
      },
      {
        fromStepKey: 'PROCUREMENT_REVIEW',
        toStepKey: 'REVISION',
        actionType: WorkflowActionType.REQUEST_REVISION,
      },
      {
        fromStepKey: 'PROCUREMENT_REVIEW',
        toStepKey: 'REJECTED_END',
        actionType: WorkflowActionType.REJECT,
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
    description: 'Appointment request workflow',
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
        assignedRoleName: 'FACULTY',
        slaHours: 48,
      },
      {
        stepKey: 'REVISION',
        stepName: 'Revision',
        stepOrder: 3,
        stepType: WorkflowStepType.REVISION,
        slaHours: 72,
      },
      {
        stepKey: 'APPROVED_END',
        stepName: 'Approved',
        stepOrder: 4,
        stepType: WorkflowStepType.END,
      },
      {
        stepKey: 'REJECTED_END',
        stepName: 'Rejected',
        stepOrder: 5,
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
        toStepKey: 'APPROVED_END',
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
        fromStepKey: 'REVISION',
        toStepKey: 'TARGET_REVIEW',
        actionType: WorkflowActionType.SUBMIT,
      },
    ],
  },

  {
    requestTypeKey: 'EVENT_REQUEST',
    workflowKey: 'WF_EVENT_REQUEST_V1',
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
        stepKey: 'FACULTY_SECRETARY_REVIEW',
        stepName: 'Faculty Secretary Review',
        stepOrder: 2,
        stepType: WorkflowStepType.REVIEW,
        assignedRoleName: 'FACULTY_SECRETARY',
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
        stepKey: 'RESOURCE_REVIEW',
        stepName: 'Resource Review',
        stepOrder: 4,
        stepType: WorkflowStepType.APPROVAL,
        assignedRoleName: 'RESOURCE_MANAGER',
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
        toStepKey: 'FACULTY_SECRETARY_REVIEW',
        actionType: WorkflowActionType.SUBMIT,
      },
      {
        fromStepKey: 'FACULTY_SECRETARY_REVIEW',
        toStepKey: 'SECURITY_APPROVAL',
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
        toStepKey: 'FACULTY_SECRETARY_REVIEW',
        actionType: WorkflowActionType.SUBMIT,
      },
    ],
  },

  {
    requestTypeKey: 'ACCESS_REQUEST',
    workflowKey: 'WF_ACCESS_REQUEST_V1',
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
        stepKey: 'IT_APPROVAL',
        stepName: 'IT Manager Approval',
        stepOrder: 3,
        stepType: WorkflowStepType.APPROVAL,
        assignedRoleName: 'IT_MANAGER',
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
        toStepKey: 'SECURITY_REVIEW',
        actionType: WorkflowActionType.SUBMIT,
      },
      {
        fromStepKey: 'SECURITY_REVIEW',
        toStepKey: 'IT_APPROVAL',
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
        fromStepKey: 'IT_APPROVAL',
        toStepKey: 'APPROVED_END',
        actionType: WorkflowActionType.APPROVE,
      },
      {
        fromStepKey: 'IT_APPROVAL',
        toStepKey: 'REVISION',
        actionType: WorkflowActionType.REQUEST_REVISION,
      },
      {
        fromStepKey: 'IT_APPROVAL',
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
    workflowKey: 'WF_PROCUREMENT_REQUEST_V1',
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
        stepKey: 'STAFF_REVIEW',
        stepName: 'Staff Review',
        stepOrder: 2,
        stepType: WorkflowStepType.REVIEW,
        assignedRoleName: 'STAFF',
        slaHours: 24,
      },
      {
        stepKey: 'PROCUREMENT_APPROVAL',
        stepName: 'Procurement Officer Approval',
        stepOrder: 3,
        stepType: WorkflowStepType.APPROVAL,
        assignedRoleName: 'PROCUREMENT_OFFICER',
        slaHours: 48,
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
        toStepKey: 'STAFF_REVIEW',
        actionType: WorkflowActionType.SUBMIT,
      },
      {
        fromStepKey: 'STAFF_REVIEW',
        toStepKey: 'PROCUREMENT_APPROVAL',
        actionType: WorkflowActionType.APPROVE,
      },
      {
        fromStepKey: 'STAFF_REVIEW',
        toStepKey: 'REVISION',
        actionType: WorkflowActionType.REQUEST_REVISION,
      },
      {
        fromStepKey: 'STAFF_REVIEW',
        toStepKey: 'REJECTED_END',
        actionType: WorkflowActionType.REJECT,
      },
      {
        fromStepKey: 'PROCUREMENT_APPROVAL',
        toStepKey: 'APPROVED_END',
        actionType: WorkflowActionType.APPROVE,
      },
      {
        fromStepKey: 'PROCUREMENT_APPROVAL',
        toStepKey: 'REVISION',
        actionType: WorkflowActionType.REQUEST_REVISION,
      },
      {
        fromStepKey: 'PROCUREMENT_APPROVAL',
        toStepKey: 'REJECTED_END',
        actionType: WorkflowActionType.REJECT,
      },
      {
        fromStepKey: 'REVISION',
        toStepKey: 'STAFF_REVIEW',
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

async function main() {
  const createdByUserId = await getAdminUserId();

  for (const workflow of workflows) {
    await ensureRequestTypeExists(workflow.requestTypeKey);
    await seedWorkflow(workflow, createdByUserId);
    console.log(`Seeded workflow for request type: ${workflow.requestTypeKey}`);
  }

  console.log('All workflows seeded successfully.');
}

main()
  .catch((error) => {
    console.error('Workflow seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
