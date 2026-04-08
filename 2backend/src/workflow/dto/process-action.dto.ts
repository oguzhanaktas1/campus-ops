import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

export class ProcessActionDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['approve', 'reject', 'revision', 'cancel'])
  action: string;

  @IsString()
  @IsOptional()
  comment?: string;
}
