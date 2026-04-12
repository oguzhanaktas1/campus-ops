import { IsOptional, IsString } from 'class-validator';

export class RejectItTicketDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
