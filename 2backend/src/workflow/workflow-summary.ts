import { RequestStatus } from '@prisma/client';

type WorkflowStepStatus =
  | 'pending'
  | 'active'
  | 'completed'
  | 'failed'
  | 'warning';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function displayName(user: any): string | null {
  return user?.profile?.fullName ?? user?.email ?? null;
}

function actorPayload(user: any) {
  if (!user) return null;
  return {
    id: user.id ?? null,
    fullName: displayName(user),
    email: user.email ?? null,
    role: user.primaryRoles?.[0]?.role?.name ?? null,
  };
}

function shouldDisplayStep(
  step: any,
  requestStatus: RequestStatus | string,
): boolean {
  const safeRequestStatus = String(requestStatus).toUpperCase();
  const safeStepKey = String(step?.stepKey ?? '').toUpperCase();
  const config = isRecord(step?.configJson) ? step.configJson : null;

  if (safeStepKey === 'REJECTED_END') {
    return safeRequestStatus === 'REJECTED';
  }

  if (safeStepKey === 'APPROVED_END' && safeRequestStatus === 'REJECTED') {
    return false;
  }

  if (config?.display === false) return false;
  return true;
}

function deriveStepStatus(params: {
  instanceStep: any;
  isCurrent: boolean;
  requestStatus: RequestStatus | string;
  workflowStatus?: string | null;
  step?: any;
}): WorkflowStepStatus {
  const { instanceStep, isCurrent, requestStatus, workflowStatus, step } = params;
  const safeRequestStatus = String(requestStatus).toUpperCase();
  const safeWorkflowStatus = String(workflowStatus ?? '').toUpperCase();
  const safeStepType = String(step?.stepType ?? '').toUpperCase();
  const safeStepKey = String(step?.stepKey ?? '').toUpperCase();
  const safeStepName = String(step?.stepName ?? '').toUpperCase();

  if (instanceStep?.isOverdue) return 'warning';
  if (instanceStep?.actionTaken === 'REJECT') return 'failed';
  if (instanceStep?.actionTaken === 'REQUEST_REVISION') return 'warning';
  if (isCurrent && safeRequestStatus === 'REJECTED') return 'failed';
  if (isCurrent && safeRequestStatus === 'REVISION_REQUESTED') return 'warning';
  if (isCurrent && safeWorkflowStatus !== 'COMPLETED') return 'active';
  if (instanceStep?.status === 'COMPLETED') return 'completed';
  if (instanceStep?.status === 'FAILED') return 'failed';
  if (safeWorkflowStatus === 'COMPLETED' && safeStepType === 'END') {
    if (
      safeRequestStatus === 'REJECTED' &&
      (safeStepKey.includes('REJECT') || safeStepName.includes('REJECT'))
    ) {
      return 'failed';
    }

    if (
      safeRequestStatus !== 'REJECTED' &&
      (safeStepKey.includes('APPROV') ||
        safeStepName.includes('APPROV') ||
        safeStepKey.includes('COMPLETE') ||
        safeStepName.includes('COMPLETE'))
    ) {
      return 'completed';
    }
  }
  return 'pending';
}

function terminalCurrentStep(
  requestStatus: RequestStatus | string,
  workflowStatus?: string | null,
) {
  if (String(workflowStatus ?? '').toUpperCase() !== 'COMPLETED') return null;
  return String(requestStatus)
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

type WorkflowSummaryContext = {
  targetUser?: {
    id: string | null;
    fullName: string | null;
    email?: string | null;
    role?: string | null;
  } | null;
};

export function deriveAppointmentTargetUser(request: any): WorkflowSummaryContext['targetUser'] {
  const ar = request?.appointmentRequest;
  const user = ar?.targetUser;
  if (!user) return null;
  return {
    id: user.id ?? null,
    fullName: user.profile?.fullName ?? user.email ?? null,
    email: user.email ?? null,
    role: user.primaryRoles?.[0]?.role?.name ?? null,
  };
}

export function buildWorkflowSummary(
  workflowInstance: any,
  requestStatus: RequestStatus | string,
  context: WorkflowSummaryContext = {},
) {
  if (!workflowInstance) return null;

  const targetUser = context.targetUser ?? null;

  const steps = (workflowInstance.workflowDefinition?.steps ?? [])
    .filter((step: any) => shouldDisplayStep(step, requestStatus))
    .map((step: any) => {
      const instanceStep = workflowInstance.instanceSteps?.findLast(
        (item: any) => item.workflowStepId === step.id,
      );
      const isCurrent = step.id === workflowInstance.currentStepId;
      const isTargetReviewStep =
        String(step.stepKey ?? '').toUpperCase() === 'TARGET_REVIEW';

      const baseAssignedTo = actorPayload(
        instanceStep?.assignedTo ?? step.assignedUser,
      );
      const assignedTo =
        isTargetReviewStep && targetUser && (targetUser.fullName || targetUser.id)
          ? {
              id: targetUser.id ?? null,
              fullName: targetUser.fullName ?? null,
              email: targetUser.email ?? null,
              role: targetUser.role ?? null,
            }
          : baseAssignedTo;
      const actionBy = actorPayload(instanceStep?.actionBy);

      const label =
        isTargetReviewStep && assignedTo?.fullName
          ? `${assignedTo.fullName} Review`
          : step.stepName;

      return {
        id: step.id,
        workflowStepId: step.id,
        key: step.stepKey,
        stepKey: step.stepKey,
        label,
        name: step.stepName,
        type: step.stepType,
        status: deriveStepStatus({
          instanceStep,
          isCurrent,
          requestStatus,
          workflowStatus: workflowInstance.status,
          step,
        }),
        isCurrent,
        assignedRole: step.assignedRole?.name ?? null,
        role: step.assignedRole?.name ?? null,
        assignedUnit: step.assignedUnit
          ? {
              id: step.assignedUnit.id,
              name: step.assignedUnit.name,
            }
          : null,
        unitName: step.assignedUnit?.name ?? null,
        assignedTo,
        assignedToName: assignedTo?.fullName ?? null,
        actionBy,
        actionByName: actionBy?.fullName ?? null,
        actionTaken: instanceStep?.actionTaken ?? null,
        actionNote: instanceStep?.actionNote ?? null,
        startedAt: instanceStep?.startedAt ?? null,
        completedAt: instanceStep?.completedAt ?? null,
        actedAt: instanceStep?.completedAt ?? null,
        dueAt: instanceStep?.dueAt ?? null,
        slaHours: step.slaHours ?? null,
        isOverdue: instanceStep?.isOverdue ?? false,
      };
    });

  const currentStepName =
    workflowInstance.currentStep?.stepName ??
    terminalCurrentStep(requestStatus, workflowInstance.status);
  const isCurrentTargetReview =
    String(workflowInstance.currentStep?.stepKey ?? '').toUpperCase() ===
    'TARGET_REVIEW';
  const enrichedCurrentStep =
    isCurrentTargetReview && targetUser?.fullName
      ? `${targetUser.fullName} Review`
      : currentStepName;

  return {
    id: workflowInstance.id,
    status: workflowInstance.status,
    currentStep: enrichedCurrentStep,
    currentStepKey: workflowInstance.currentStep?.stepKey ?? null,
    workflowName: workflowInstance.workflowDefinition?.name ?? null,
    steps,
  };
}
