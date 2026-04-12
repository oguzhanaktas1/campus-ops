import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PriorityLevel, TicketStatus } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AddCommentDto } from '../requests/dto/add-comment.dto';
import { TicketsService } from './tickets.service';
import { AssignItTicketDto } from './dto/assign-it-ticket.dto';
import { ChangeCategoryDto } from './dto/change-category.dto';
import { ChangePriorityDto } from './dto/change-priority.dto';
import { CloseItTicketDto } from './dto/close-it-ticket.dto';
import { CreateItTicketDto } from './dto/create-it-ticket.dto';
import { EscalateItTicketDto } from './dto/escalate-it-ticket.dto';
import { RejectItTicketDto } from './dto/reject-it-ticket.dto';
import { ReopenItTicketDto } from './dto/reopen-it-ticket.dto';
import { RequestUserInfoDto } from './dto/request-user-info.dto';
import { ResolveItTicketDto } from './dto/resolve-it-ticket.dto';
import { StartProgressDto } from './dto/start-progress.dto';
import { TriageItTicketDto } from './dto/triage-it-ticket.dto';

interface ReqUser {
  userId: string;
  roles: string[];
}

@Controller('it-tickets')
@UseGuards(JwtAuthGuard)
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  create(@CurrentUser() user: ReqUser, @Body() dto: CreateItTicketDto) {
    return this.ticketsService.create(user.userId, dto);
  }

  @Post(':id/submit')
  submit(@CurrentUser() user: ReqUser, @Param('id') requestId: string) {
    return this.ticketsService.submit(user.userId, requestId);
  }

  @Get('my')
  findMy(@CurrentUser() user: ReqUser) {
    return this.ticketsService.findMy(user.userId);
  }

  @Get('triage')
  findTriage(@CurrentUser() user: ReqUser) {
    return this.ticketsService.findTriage(user.roles);
  }

  @Get('assigned')
  findAssigned(
    @CurrentUser() user: ReqUser,
    @Query('ticketStatus') ticketStatus?: TicketStatus,
  ) {
    return this.ticketsService.findAssigned(user.userId, user.roles, {
      ticketStatus,
    });
  }

  @Get('overdue')
  findOverdue(@CurrentUser() user: ReqUser) {
    return this.ticketsService.findOverdue(user.roles);
  }

  @Get('completed')
  findCompleted(@CurrentUser() user: ReqUser) {
    return this.ticketsService.findCompleted(user.userId, user.roles);
  }

  @Get('staff-members')
  findStaffMembers() {
    return this.ticketsService.findStaffMembers();
  }

  @Get('inbox')
  findInbox(
    @CurrentUser() user: ReqUser,
    @Query('ticketStatus') ticketStatus?: TicketStatus,
    @Query('priority') priority?: PriorityLevel,
    @Query('category') category?: string,
    @Query('assignedItUserId') assignedItUserId?: string,
  ) {
    return this.ticketsService.findInbox(user.userId, user.roles, {
      ticketStatus,
      priority,
      category,
      assignedItUserId,
    });
  }

  @Get(':id/comments')
  getComments(@CurrentUser() user: ReqUser, @Param('id') requestId: string) {
    return this.ticketsService.getComments(user.userId, user.roles, requestId);
  }

  @Get(':id/workflow')
  getWorkflow(@CurrentUser() user: ReqUser, @Param('id') requestId: string) {
    return this.ticketsService.getWorkflow(user.userId, user.roles, requestId);
  }

  @Get(':id/sla')
  getSla(@CurrentUser() user: ReqUser, @Param('id') requestId: string) {
    return this.ticketsService.getSla(user.userId, user.roles, requestId);
  }

  @Get(':id/activity')
  getActivity(@CurrentUser() user: ReqUser, @Param('id') requestId: string) {
    return this.ticketsService.getActivity(user.userId, user.roles, requestId);
  }

  @Get(':id')
  findById(@CurrentUser() user: ReqUser, @Param('id') requestId: string) {
    return this.ticketsService.findById(user.userId, user.roles, requestId);
  }

  @Post(':id/comments')
  addComment(
    @CurrentUser() user: ReqUser,
    @Param('id') requestId: string,
    @Body() dto: AddCommentDto,
  ) {
    return this.ticketsService.addComment(user.userId, user.roles, requestId, dto);
  }

  @Post(':id/internal-comments')
  addInternalComment(
    @CurrentUser() user: ReqUser,
    @Param('id') requestId: string,
    @Body() dto: AddCommentDto,
  ) {
    return this.ticketsService.addInternalComment(
      user.userId,
      user.roles,
      requestId,
      dto,
    );
  }

  @Post(':id/assign')
  assign(
    @CurrentUser() user: ReqUser,
    @Param('id') requestId: string,
    @Body() dto: AssignItTicketDto,
  ) {
    return this.ticketsService.assign(user.userId, user.roles, requestId, dto);
  }

  @Post(':id/reassign')
  reassign(
    @CurrentUser() user: ReqUser,
    @Param('id') requestId: string,
    @Body() dto: AssignItTicketDto,
  ) {
    return this.ticketsService.reassign(user.userId, user.roles, requestId, dto);
  }

  @Post(':id/start-progress')
  startProgress(
    @CurrentUser() user: ReqUser,
    @Param('id') requestId: string,
    @Body() dto: StartProgressDto,
  ) {
    return this.ticketsService.startProgress(
      user.userId,
      user.roles,
      requestId,
      dto,
    );
  }

  @Post(':id/request-user-info')
  requestUserInfo(
    @CurrentUser() user: ReqUser,
    @Param('id') requestId: string,
    @Body() dto: RequestUserInfoDto,
  ) {
    return this.ticketsService.requestUserInfo(
      user.userId,
      user.roles,
      requestId,
      dto,
    );
  }

  @Post(':id/resolve')
  resolve(
    @CurrentUser() user: ReqUser,
    @Param('id') requestId: string,
    @Body() dto: ResolveItTicketDto,
  ) {
    return this.ticketsService.resolve(user.userId, user.roles, requestId, dto);
  }

  @Post(':id/close')
  close(
    @CurrentUser() user: ReqUser,
    @Param('id') requestId: string,
    @Body() dto: CloseItTicketDto,
  ) {
    return this.ticketsService.close(user.userId, user.roles, requestId, dto);
  }

  @Post(':id/reopen')
  reopen(
    @CurrentUser() user: ReqUser,
    @Param('id') requestId: string,
    @Body() dto: ReopenItTicketDto,
  ) {
    return this.ticketsService.reopen(user.userId, user.roles, requestId, dto);
  }

  @Post(':id/reject')
  reject(
    @CurrentUser() user: ReqUser,
    @Param('id') requestId: string,
    @Body() dto: RejectItTicketDto,
  ) {
    return this.ticketsService.reject(user.userId, user.roles, requestId, dto);
  }

  @Post(':id/escalate')
  escalate(
    @CurrentUser() user: ReqUser,
    @Param('id') requestId: string,
    @Body() dto: EscalateItTicketDto,
  ) {
    return this.ticketsService.escalate(user.userId, user.roles, requestId, dto);
  }

  @Post(':id/change-priority')
  changePriority(
    @CurrentUser() user: ReqUser,
    @Param('id') requestId: string,
    @Body() dto: ChangePriorityDto,
  ) {
    return this.ticketsService.changePriority(
      user.userId,
      user.roles,
      requestId,
      dto,
    );
  }

  @Post(':id/change-category')
  changeCategory(
    @CurrentUser() user: ReqUser,
    @Param('id') requestId: string,
    @Body() dto: ChangeCategoryDto,
  ) {
    return this.ticketsService.changeCategory(
      user.userId,
      user.roles,
      requestId,
      dto,
    );
  }

  @Patch(':id/triage')
  triage(
    @CurrentUser() user: ReqUser,
    @Param('id') requestId: string,
    @Body() dto: TriageItTicketDto,
  ) {
    return this.ticketsService.triage(user.userId, user.roles, requestId, dto);
  }

  @Patch(':id/resolve')
  resolvePatch(
    @CurrentUser() user: ReqUser,
    @Param('id') requestId: string,
    @Body() dto: ResolveItTicketDto,
  ) {
    return this.ticketsService.resolve(user.userId, user.roles, requestId, dto);
  }

  @Patch(':id/close')
  closePatch(
    @CurrentUser() user: ReqUser,
    @Param('id') requestId: string,
    @Body() dto: CloseItTicketDto,
  ) {
    return this.ticketsService.close(user.userId, user.roles, requestId, dto);
  }

  @Patch(':id/reopen')
  reopenPatch(
    @CurrentUser() user: ReqUser,
    @Param('id') requestId: string,
    @Body() dto: ReopenItTicketDto,
  ) {
    return this.ticketsService.reopen(user.userId, user.roles, requestId, dto);
  }
}
