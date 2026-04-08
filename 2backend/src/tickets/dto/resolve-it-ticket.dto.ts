import { IsString, IsOptional } from 'class-validator';

export class ResolveItTicketDto {
  @IsString()
  @IsOptional()
  resolutionSummary?: string;

  @IsString()
  @IsOptional()
  note?: string;
}
