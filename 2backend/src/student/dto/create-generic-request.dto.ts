import { IsString, IsOptional, IsNotEmpty, IsArray } from 'class-validator';

export class CreateGenericRequestDto {
  @IsNotEmpty()
  @IsString()
  typeKey!: string; // 🔥 Ünlem eklendi

  @IsNotEmpty()
  @IsString()
  title!: string; // 🔥 Ünlem eklendi

  @IsNotEmpty()
  @IsString()
  description!: string; // 🔥 Ünlem eklendi

  @IsNotEmpty()
  @IsString()
  priority!: string; // 🔥 Ünlem eklendi

  @IsOptional()
  @IsString()
  preferredDate?: string;

  @IsOptional()
  @IsString()
  preferredTime?: string;

  @IsOptional()
  @IsString()
  facultyUserId?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  attachmentFileIds?: string[];
}
