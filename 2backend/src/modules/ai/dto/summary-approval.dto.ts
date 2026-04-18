import { IsArray, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class SummaryApprovalDto {
  @IsString()
  @MaxLength(300)
  requestTitle!: string;

  @IsOptional()
  @IsString()
  requestDescription?: string;

  @IsObject()
  domainData: Record<string, unknown> = {};

  @IsOptional()
  @IsString()
  currentWorkflowStep?: string;

  @IsArray()
  @IsString({ each: true })
  previousActions: string[] = [];

  @IsOptional()
  @IsString()
  commentsSummary?: string;

  @IsArray()
  @IsString({ each: true })
  attachedDocuments: string[] = [];
}
