import { Controller, Get, Patch, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

interface ReqUser { userId: string; roles: string[] }

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  /** GET /notifications */
  @Get()
  getMyNotifications(@CurrentUser() user: ReqUser) {
    return this.svc.getMyNotifications(user.userId);
  }

  /** PATCH /notifications/read-all */
  @Patch('read-all')
  markAllRead(@CurrentUser() user: ReqUser) {
    return this.svc.markAllRead(user.userId);
  }

  /** GET /notifications/preferences */
  @Get('preferences')
  getPreferences(@CurrentUser() user: ReqUser) {
    return this.svc.getPreferences(user.userId);
  }

  /** PUT /notifications/preferences */
  @Put('preferences')
  updatePreferences(@CurrentUser() user: ReqUser, @Body() dto: any) {
    return this.svc.updatePreferences(user.userId, dto);
  }

  /** PATCH /notifications/:id/read */
  @Patch(':id/read')
  markRead(@CurrentUser() user: ReqUser, @Param('id') id: string) {
    return this.svc.markRead(user.userId, id);
  }

  /** DELETE /notifications — bulk delete by ids */
  @Delete()
  deleteNotifications(@CurrentUser() user: ReqUser, @Body('ids') ids: string[]) {
    return this.svc.deleteNotifications(user.userId, ids ?? []);
  }
}
