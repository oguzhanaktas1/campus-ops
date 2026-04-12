import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RequestUserInfoDto {
  @IsString()
  @IsNotEmpty()
  message: string;

  @IsOptional()
  @IsString()
  internalNote?: string;
}
