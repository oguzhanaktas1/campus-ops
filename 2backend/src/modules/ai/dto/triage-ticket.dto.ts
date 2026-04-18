import { IsArray, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class TriageTicketDto {
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  title!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(5000)
  description!: string;

  @IsOptional()
  @IsString()
  requesterFaculty?: string;

  @IsOptional()
  @IsString()
  requesterDepartment?: string;

  @IsOptional()
  @IsString()
  sourceChannel?: string;

  @IsArray()
  @IsString({ each: true })
  similarResolutions: string[] = [];
}
