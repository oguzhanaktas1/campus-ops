import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsEnum,
} from 'class-validator';
import { WorkflowStepType } from '@prisma/client';

export class CreateWorkflowStepDto {
  @IsString()
  @IsNotEmpty()
  stepKey: string;

  @IsString()
  @IsNotEmpty()
  stepName: string;

  @IsNumber()
  stepOrder: number;

  @IsEnum(WorkflowStepType)
  stepType: WorkflowStepType;

  @IsString()
  @IsOptional()
  assignedRoleId?: string;

  @IsString()
  @IsOptional()
  assignedUnitId?: string;

  @IsString()
  @IsOptional()
  assignedUserId?: string;

  @IsBoolean()
  @IsOptional()
  isRequired?: boolean;

  @IsNumber()
  @IsOptional()
  slaHours?: number;
}
