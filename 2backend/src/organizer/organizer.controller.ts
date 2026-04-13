import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { extractUserId } from '../core/auth/extract-user-id';
import { StaffService } from '../staff/staff.service';

@Controller('organizer')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ORGANIZER')
export class OrganizerController {
  constructor(private readonly staffService: StaffService) {}

  @Get('notifications')
  getNotifications(@Request() req: any) {
    return this.staffService.getNotifications(extractUserId(req));
  }

  @Post('notifications/:id/read')
  markNotificationAsRead(@Request() req: any, @Param('id') id: string) {
    return this.staffService.markNotificationAsRead(extractUserId(req), id);
  }

  @Post('notifications/read-all')
  markAllNotificationsAsRead(@Request() req: any) {
    return this.staffService.markAllNotificationsAsRead(extractUserId(req));
  }

  @Delete('notifications')
  deleteNotifications(@Request() req: any, @Body('ids') ids: string[]) {
    return this.staffService.deleteNotifications(extractUserId(req), ids);
  }

  @Get('preferences')
  getPreferences(@Request() req: any) {
    return this.staffService.getPreferences(extractUserId(req));
  }

  @Put('preferences')
  updatePreferences(@Request() req: any, @Body() body: any) {
    return this.staffService.updatePreferences(extractUserId(req), body);
  }

  @Post('change-password')
  changePassword(@Request() req: any, @Body() body: any) {
    return this.staffService.changePassword(extractUserId(req), body);
  }
}
