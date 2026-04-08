import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { EventsService } from './events.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

interface ReqUser { userId: string; roles: string[] }

@Controller('events')
@UseGuards(JwtAuthGuard)
export class EventsController {
  constructor(private readonly svc: EventsService) {}

  @Post()
  create(@CurrentUser() user: ReqUser, @Body() dto: any) {
    return this.svc.create(user.userId, dto);
  }

  @Get()
  findAll(@CurrentUser() user: ReqUser) {
    return this.svc.findAll(user.userId, user.roles);
  }

  @Get(':id')
  findById(@CurrentUser() user: ReqUser, @Param('id') id: string) {
    return this.svc.findById(user.userId, id, user.roles);
  }

  @Patch(':id/status')
  updateStatus(@CurrentUser() user: ReqUser, @Param('id') id: string, @Body() body: { status: any; note?: string }) {
    return this.svc.updateStatus(user.userId, id, body.status, body.note);
  }
}
