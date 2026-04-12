import { IsOptional, IsString } from 'class-validator';

export class CloseItTicketDto {
  @IsOptional()
  @IsString()
  note?: string;
}
