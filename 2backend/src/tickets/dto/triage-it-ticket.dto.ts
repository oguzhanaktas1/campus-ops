import { IsString, IsOptional, IsEnum } from 'class-validator';
import { TicketStatus } from '@prisma/client';

export class TriageItTicketDto {
  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  subcategory?: string;

  @IsString()
  @IsOptional()
  assignedItUserId?: string;

  @IsEnum(TicketStatus)
  @IsOptional()
  newStatus?: TicketStatus;

  @IsString()
  @IsOptional()
  note?: string;
}
