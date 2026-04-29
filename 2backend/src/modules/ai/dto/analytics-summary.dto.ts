import { IsIn, IsObject } from 'class-validator';

export class AnalyticsSummaryDto {
  @IsIn(['IT', 'ADMIN', 'DASHBOARD'])
  domain!: 'IT' | 'ADMIN' | 'DASHBOARD';

  @IsObject()
  kpis: Record<string, string | number | null> = {};

  @IsObject()
  chartData: Record<string, unknown> = {};

  @IsObject()
  trendDeltas: Record<string, number> = {};

  @IsObject()
  groupedCounts: Record<string, number> = {};
}
