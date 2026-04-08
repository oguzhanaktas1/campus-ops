import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';

export class UpdateRequestTypeDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  workflowDefinitionId?: string | null;

  @IsOptional()
  isActive?: boolean;
}
