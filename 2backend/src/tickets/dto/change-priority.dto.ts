import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PriorityLevel } from '@prisma/client';

export class ChangePriorityDto {
  @IsEnum(PriorityLevel)
  priority: PriorityLevel;

  @IsOptional()
  @IsString()
  note?: string;
}
