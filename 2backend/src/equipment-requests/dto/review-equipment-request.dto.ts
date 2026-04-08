import { IsString, IsOptional, IsBoolean, IsNumber } from 'class-validator';

export class ReviewEquipmentRequestDto {
  @IsString()
  @IsOptional()
  stockCheckStatus?: string;

  @IsBoolean()
  @IsOptional()
  procurementRequired?: boolean;

  @IsNumber()
  @IsOptional()
  estimatedCost?: number;

  @IsString()
  @IsOptional()
  reviewNote?: string;
}
