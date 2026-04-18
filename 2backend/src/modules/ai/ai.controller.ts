import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import type { JwtUser } from '../../auth/jwt.strategy';
import { AiService } from './ai.service';
import { AnalyticsSummaryDto } from './dto/analytics-summary.dto';
import { AssistantAskDto } from './dto/assistant-ask.dto';
import { ParseRequestDto } from './dto/parse-request.dto';
import { SummaryApprovalDto } from './dto/summary-approval.dto';
import { TriageTicketDto } from './dto/triage-ticket.dto';

@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get('health')
  getHealth() {
    return this.aiService.getHealth();
  }

  @Post('triage/ticket')
  triageTicket(@Body() dto: TriageTicketDto) {
    return this.aiService.triageTicket(dto);
  }

  @Post('parse/request')
  parseRequest(@Body() dto: ParseRequestDto) {
    return this.aiService.parseRequest(dto);
  }

  @Post('summary/approval')
  summarizeApproval(@Body() dto: SummaryApprovalDto) {
    return this.aiService.summarizeApproval(dto);
  }

  @Post('analytics/summary')
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
  askAssistant(@CurrentUser() user: JwtUser, @Body() dto: AssistantAskDto) {
    return this.aiService.askAssistant(user, dto);
  }
}
