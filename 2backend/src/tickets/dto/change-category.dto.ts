import { IsOptional, IsString } from 'class-validator';

export class ChangeCategoryDto {
  @IsString()
  category: string;

  @IsOptional()
  @IsString()
  subcategory?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
