/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
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
import { FacultyService } from './faculty.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { extractUserId } from '../core/auth/extract-user-id';

@Controller('faculty')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('FACULTY')
export class FacultyController {
  constructor(private readonly facultyService: FacultyService) {}

  @Get('requests/pending')
  getPendingApprovals(@Request() req: any) {
    return this.facultyService.getPendingApprovals(extractUserId(req));
  }

  @Post('requests/:id/action')
  processAction(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { action: string; comment?: string },
  ) {
    return this.facultyService.processAction(extractUserId(req), id, body);
  }

  @Get('requests/all')
  getAllRequests(@Request() req: any) {
    const userId = req.user?.userId || req.user?.id;
    return this.facultyService.getAllRequests(userId);
  }

  @Get('requests/:id')
  getRequestDetail(@Request() req: any, @Param('id') id: string) {
    const userId = req.user?.userId || req.user?.id;
    return this.facultyService.getRequestDetail(userId, id);
  }

  @Post('requests/:id/comments')
  addComment(
    @Request() req: any,
    @Param('id') id: string,
    @Body('text') text: string,
  ) {
    return this.facultyService.addCommentToRequest(extractUserId(req), id, text);
  }

  @Get('internships')
  getInternships(@Request() req: any) {
    return this.facultyService.getInternships(extractUserId(req));
  }

  @Get('internships/:id')
  getInternshipById(@Request() req: any, @Param('id') id: string) {
    return this.facultyService.getInternshipById(extractUserId(req), id);
  }

  @Get('calendar/events')
  getMyCalendarEvents(@Request() req: any) {
    const userId = req.user?.userId || req.user?.id;
    return this.facultyService.getMyCalendarEvents(userId);
  }

  @Get('notifications')
  getNotifications(@Request() req: any) {
    return this.facultyService.getNotifications(extractUserId(req));
  }

  @Delete('notifications')
  deleteNotifications(@Request() req: any, @Body('ids') ids: string[]) {
    return this.facultyService.deleteNotifications(extractUserId(req), ids);
  }

  @Post('notifications/:id/read')
  markNotificationAsRead(@Request() req: any, @Param('id') id: string) {
    return this.facultyService.markNotificationAsRead(extractUserId(req), id);
  }

  @Post('notifications/read-all')
  markAllNotificationsAsRead(@Request() req: any) {
    return this.facultyService.markAllNotificationsAsRead(extractUserId(req));
  }

  @Get('preferences')
  getPreferences(@Request() req: any) {
    return this.facultyService.getPreferences(extractUserId(req));
  }

  @Put('preferences')
  updatePreferences(@Request() req: any, @Body() body: any) {
    return this.facultyService.updatePreferences(extractUserId(req), body);
  }

  @Get('office-hours')
  getOfficeHours(@Request() req: any) {
    return this.facultyService.getOfficeHours(extractUserId(req));
  }

  @Put('office-hours')
  updateOfficeHours(
    @Request() req: any,
    @Body() body: { startTime: string; endTime: string },
  ) {
    return this.facultyService.updateOfficeHours(
      extractUserId(req),
      body.startTime,
      body.endTime,
    );
  }
}
