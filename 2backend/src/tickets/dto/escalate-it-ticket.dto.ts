import { IsOptional, IsString } from 'class-validator';

export class EscalateItTicketDto {
  @IsOptional()
  @IsString()
  note?: string;
}
