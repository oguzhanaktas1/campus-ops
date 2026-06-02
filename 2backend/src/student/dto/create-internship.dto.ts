import { IsString, IsOptional, IsBoolean, IsNumber, IsArray } from 'class-validator';

export class CreateInternshipDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsString()
  companyName: string;

  @IsOptional()
  @IsString()
  companySector?: string;

  @IsOptional()
  @IsString()
  companyContactName?: string;

  @IsOptional()
  @IsString()
  companyContactEmail?: string;

  @IsString()
  internshipType: string;

  @IsString()
  workMode: string;

  @IsString()
  startDate: string;

  @IsString()
  endDate: string;

  @IsNumber()
  durationDays: number;

  @IsOptional()
  @IsBoolean()
  insuranceRequired?: boolean;

  @IsOptional()
  @IsString()
  advisorUserId?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  attachmentFileIds?: string[];
}
