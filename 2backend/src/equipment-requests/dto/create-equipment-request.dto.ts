import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsEnum,
  IsDateString,
  Min,
} from 'class-validator';
import { PriorityLevel } from '@prisma/client';

export class CreateEquipmentRequestDto {
  @IsString()
  @IsNotEmpty()
  equipmentName: string;

  @IsString()
  @IsNotEmpty()
  equipmentCategory: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsString()
  @IsNotEmpty()
  purpose: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(PriorityLevel)
  @IsOptional()
  priority?: PriorityLevel;

  @IsString()
  @IsOptional()
  labResourceId?: string;

  @IsDateString()
  @IsOptional()
  neededFrom?: string;

  @IsDateString()
  @IsOptional()
  neededUntil?: string;

  @IsString()
  @IsOptional()
  urgencyReason?: string;

  @IsString()
  @IsOptional()
  facultyId?: string;

  @IsString()
  @IsOptional()
  departmentId?: string;

  @IsString()
  @IsOptional()
  unitId?: string;
}
