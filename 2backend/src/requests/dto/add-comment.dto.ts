import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class AddCommentDto {
  @IsString()
  @IsNotEmpty()
  commentText: string;

  @IsOptional()
  @IsBoolean()
  isInternal?: boolean;

  @IsOptional()
  @IsString()
  parentCommentId?: string;
}
