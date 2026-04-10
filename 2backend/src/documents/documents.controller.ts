import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequestStatus } from '@prisma/client';

interface ReqUser { userId: string; roles: string[] }

@Controller('document-requests')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(private readonly svc: DocumentsService) {}

  /** POST /document-requests */
  @Post()
  create(@CurrentUser() user: ReqUser, @Body() dto: any) {
    return this.svc.create(user.userId, dto);
  }

  /** GET /document-requests/my */
  @Get('my')
  findMy(@CurrentUser() user: ReqUser) {
    return this.svc.findMy(user.userId);
  }

  /** GET /document-requests/inbox */
  @Get('inbox')
  findInbox() {
    return this.svc.findInbox();
  }

  /** GET /document-requests/:id */
  @Get(':id')
  findById(@CurrentUser() user: ReqUser, @Param('id') id: string) {
    return this.svc.findById(user.userId, user.roles, id);
  }

  /** PATCH /document-requests/:id/status */
  @Patch(':id/status')
  processStatus(
    @CurrentUser() user: ReqUser,
    @Param('id') id: string,
    @Body() dto: { status?: RequestStatus; issuedAt?: string; note?: string },
  ) {
    return this.svc.process(user.userId, user.roles, id, dto);
  }

  /** PATCH /document-requests/:id/process */
  @Patch(':id/process')
  process(
    @CurrentUser() user: ReqUser,
    @Param('id') id: string,
    @Body() dto: { status?: RequestStatus; issuedAt?: string; note?: string },
  ) {
    return this.svc.process(user.userId, user.roles, id, dto);
  }
}
