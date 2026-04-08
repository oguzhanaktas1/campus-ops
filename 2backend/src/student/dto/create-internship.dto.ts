import { IsString, IsOptional, IsBoolean, IsNumber } from 'class-validator';

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

  // 🔥 YENİ EKLENEN HOCA (DANIŞMAN) ID ALANI 🔥
  @IsOptional()
  @IsString()
  advisorUserId?: string;
}
