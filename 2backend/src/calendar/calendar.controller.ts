import { Controller, Get, UseGuards } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

interface ReqUser { userId: string; roles: string[] }

@Controller('calendar')
@UseGuards(JwtAuthGuard)
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  /** GET /calendar/events */
  @Get('events')
  getMyEvents(@CurrentUser() user: ReqUser) {
    return this.calendarService.getMyEvents(user.userId);
  }
}
