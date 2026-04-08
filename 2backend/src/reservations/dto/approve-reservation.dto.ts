import { IsString, IsOptional } from 'class-validator';

export class ApproveReservationDto {
  @IsString()
  @IsOptional()
  note?: string;
}

export class RejectReservationDto {
  @IsString()
  @IsOptional()
  reason?: string;
}
