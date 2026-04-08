import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateItTicketDto } from './dto/create-it-ticket.dto';
import { TriageItTicketDto } from './dto/triage-it-ticket.dto';
import { ResolveItTicketDto } from './dto/resolve-it-ticket.dto';
import { TicketStatus, PriorityLevel } from '@prisma/client';

interface ReqUser {
  userId: string;
  roles: string[];
}

@Controller('it-tickets')
@UseGuards(JwtAuthGuard)
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  /** POST /it-tickets */
  @Post()
  create(@CurrentUser() user: ReqUser, @Body() dto: CreateItTicketDto) {
    return this.ticketsService.create(user.userId, dto);
  }

  /** GET /it-tickets/my */
  @Get('my')
  findMy(@CurrentUser() user: ReqUser) {
    return this.ticketsService.findMy(user.userId);
  }

  /** GET /it-tickets/staff-members */
  @Get('staff-members')
  findStaffMembers() {
    return this.ticketsService.findStaffMembers();
  }

  /** GET /it-tickets/inbox */
  @Get('inbox')
  findInbox(
    @Query('ticketStatus') ticketStatus?: TicketStatus,
    @Query('priority') priority?: PriorityLevel,
    @Query('category') category?: string,
    @Query('assignedItUserId') assignedItUserId?: string,
  ) {
    return this.ticketsService.findInbox({
      ticketStatus,
      priority,
      category,
      assignedItUserId,
    });
  }

  /** GET /it-tickets/:id */
  @Get(':id')
  findById(@CurrentUser() user: ReqUser, @Param('id') requestId: string) {
    return this.ticketsService.findById(user.userId, user.roles, requestId);
  }

  /** PATCH /it-tickets/:id/triage */
  @Patch(':id/triage')
  triage(
    @CurrentUser() user: ReqUser,
    @Param('id') requestId: string,
    @Body() dto: TriageItTicketDto,
  ) {
    return this.ticketsService.triage(user.userId, user.roles, requestId, dto);
  }

  /** PATCH /it-tickets/:id/resolve */
  @Patch(':id/resolve')
  resolve(
    @CurrentUser() user: ReqUser,
    @Param('id') requestId: string,
    @Body() dto: ResolveItTicketDto,
  ) {
    return this.ticketsService.resolve(user.userId, user.roles, requestId, dto);
  }

  /** PATCH /it-tickets/:id/close */
  @Patch(':id/close')
  close(@CurrentUser() user: ReqUser, @Param('id') requestId: string) {
    return this.ticketsService.close(user.userId, user.roles, requestId);
  }

  /** PATCH /it-tickets/:id/reopen */
  @Patch(':id/reopen')
  reopen(@CurrentUser() user: ReqUser, @Param('id') requestId: string) {
    return this.ticketsService.reopen(user.userId, user.roles, requestId);
  }
}
