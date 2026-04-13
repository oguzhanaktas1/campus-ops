import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { CalendarService } from './calendar.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

interface ReqUser {
  userId: string;
  roles: string[];
}

@Controller('calendar')
@UseGuards(JwtAuthGuard)
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get('events')
  getMyEvents(
    @CurrentUser() user: ReqUser,
    @Query('start') start?: string,
    @Query('end') end?: string,
  ) {
    return this.calendarService.getMyEvents(user.userId, {
      start: start ? new Date(start) : undefined,
      end: end ? new Date(end) : undefined,
    });
  }

  @Get('events.ics')
  async exportMyEvents(
    @CurrentUser() user: ReqUser,
    @Res() res: Response,
    @Query('start') start?: string,
    @Query('end') end?: string,
  ) {
    const ics = await this.calendarService.exportMyEventsAsIcs(user.userId, {
      start: start ? new Date(start) : undefined,
      end: end ? new Date(end) : undefined,
    });

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="campusops-calendar.ics"',
    );
    res.send(ics);
  }
}
