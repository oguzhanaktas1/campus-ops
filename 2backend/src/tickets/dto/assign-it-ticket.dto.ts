import { IsOptional, IsString } from 'class-validator';

export class AssignItTicketDto {
  @IsString()
  assignedItUserId: string;

  @IsOptional()
  @IsString()
  note?: string;
}
