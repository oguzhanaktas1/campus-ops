import { IsOptional, IsString } from 'class-validator';

export class ReopenItTicketDto {
  @IsOptional()
  @IsString()
  note?: string;
}
