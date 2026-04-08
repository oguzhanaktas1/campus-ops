import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { WorkflowActionType } from '@prisma/client';

export class CreateWorkflowTransitionDto {
  @IsString()
  @IsNotEmpty()
  fromStepId: string;

  @IsString()
  @IsOptional()
  toStepId?: string;

  @IsEnum(WorkflowActionType)
  actionType: WorkflowActionType;
}
