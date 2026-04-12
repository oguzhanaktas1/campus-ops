import { IsOptional, IsString } from 'class-validator';

export class StartProgressDto {
  @IsOptional()
  @IsString()
  note?: string;
}
