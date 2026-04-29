import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SimilarTicketDto {
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  title: string;

  @IsString()
  @MinLength(3)
  @MaxLength(5000)
  description: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;
}
