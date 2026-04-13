import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { Prisma } from '@prisma/client';
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

  @IsOptional()
  conditionJson?: Prisma.JsonValue;
}
