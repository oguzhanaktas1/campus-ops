import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import type { JwtUser } from '../../auth/jwt.strategy';
import { RateLimitGuard } from '../../infrastructure/rate-limit/rate-limit.guard';
import { Throttle } from '../../infrastructure/rate-limit/rate-limit.decorator';
import { AiService } from './ai.service';
import { AnalyticsSummaryDto } from './dto/analytics-summary.dto';
import { AssistantAskDto } from './dto/assistant-ask.dto';
import { ParseRequestDto } from './dto/parse-request.dto';
import { SimilarTicketDto } from './dto/similar-ticket.dto';
import { SummaryApprovalDto } from './dto/summary-approval.dto';
import { TriageTicketDto } from './dto/triage-ticket.dto';

@UseGuards(JwtAuthGuard, RateLimitGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get('health')
  getHealth() {
    return this.aiService.getHealth();
  }

  @Post('triage/ticket')
  @Throttle({ limit: 20, windowSeconds: 60, keyType: 'user', namespace: 'ai' })
  triageTicket(@Body() dto: TriageTicketDto) {
    return this.aiService.triageTicket(dto);
  }

  @Post('parse/request')
  @Throttle({ limit: 20, windowSeconds: 60, keyType: 'user', namespace: 'ai' })
  parseRequest(@Body() dto: ParseRequestDto) {
    return this.aiService.parseRequest(dto);
  }

  @Post('summary/approval')
  @Throttle({ limit: 20, windowSeconds: 60, keyType: 'user', namespace: 'ai' })
  summarizeApproval(@Body() dto: SummaryApprovalDto) {
    return this.aiService.summarizeApproval(dto);
  }

  @Post('analytics/summary')
  @Throttle({ limit: 20, windowSeconds: 60, keyType: 'user', namespace: 'ai' })
  summarizeAnalytics(@Body() dto: AnalyticsSummaryDto) {
    return this.aiService.summarizeAnalytics(dto);
  }

  @Get('analytics/admin-overview')
  getAdminAnalyticsNarration() {
    return this.aiService.getAdminAnalyticsNarration();
  }

  @Get('analytics/it-overview')
  getItAnalyticsNarration(@CurrentUser() user: JwtUser) {
    return this.aiService.getItAnalyticsNarration(user);
  }

  @Post('assistant/ask')
  @Throttle({ limit: 10, windowSeconds: 60, keyType: 'user', namespace: 'ai:ask' })
  askAssistant(@CurrentUser() user: JwtUser, @Body() dto: AssistantAskDto) {
    return this.aiService.askAssistant(user, dto);
  }

  @Post('tickets/similar')
  @Throttle({ limit: 20, windowSeconds: 60, keyType: 'user', namespace: 'ai' })
  findSimilarTickets(@Body() dto: SimilarTicketDto) {
    return this.aiService.findSimilarTickets(dto);
  }

  @Get('dashboard/summary')
  getDashboardSummary(@CurrentUser() user: JwtUser) {
    return this.aiService.getDashboardSummary(user);
  }
}
