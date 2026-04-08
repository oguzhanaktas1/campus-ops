import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsInt,
  IsEnum,
  IsDateString,
  Min,
} from 'class-validator';
import { PriorityLevel } from '@prisma/client';

export class CreateRoomReservationDto {
  @IsString()
  @IsNotEmpty()
  resourceId: string;

  @IsString()
  @IsNotEmpty()
  eventName: string;

  @IsString()
  @IsNotEmpty()
  reservationPurpose: string;

  @IsInt()
  @Min(1)
  attendeeCount: number;

  @IsDateString()
  startAt: string;

  @IsDateString()
  endAt: string;

  @IsBoolean()
  @IsOptional()
  requiresSecurityApproval?: boolean;

  @IsBoolean()
  @IsOptional()
  requiresTechnicalSupport?: boolean;

  @IsString()
  @IsOptional()
  setupNotes?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(PriorityLevel)
  @IsOptional()
  priority?: PriorityLevel;

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
