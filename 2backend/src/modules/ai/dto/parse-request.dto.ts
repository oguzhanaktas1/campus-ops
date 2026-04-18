import { IsArray, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ParseRequestDto {
  @IsString()
  @MinLength(3)
  @MaxLength(6000)
  text!: string;

  @IsOptional()
  @IsString()
  portal?: string;

  @IsArray()
  @IsString({ each: true })
  requestTypeCandidates: string[] = [];
}
