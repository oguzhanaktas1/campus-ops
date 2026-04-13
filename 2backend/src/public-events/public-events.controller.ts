import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PublicEventsService } from './public-events.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('campus-events')
export class PublicEventsController {
  constructor(private readonly service: PublicEventsService) {}

  // Public listing (no auth required for list, auth optional for detail)
  @Get()
  findAll() {
    return this.service.findPublishedEvents();
  }

  @UseGuards(JwtAuthGuard)
  @Get('organizer')
  findOrganizerEvents(@Req() req: any) {
    return this.service.findOrganizerEvents(req.user.id, req.user.roles ?? []);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.service.findEventById(id, req.user?.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/register')
  @HttpCode(HttpStatus.OK)
  register(@Req() req: any, @Param('id') id: string) {
    return this.service.register(req.user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/register')
  @HttpCode(HttpStatus.OK)
  cancelRegistration(@Req() req: any, @Param('id') id: string) {
    return this.service.cancelRegistration(req.user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  publish(@Req() req: any, @Param('id') id: string) {
    return this.service.publishEvent(req.user.id, id, req.user.roles ?? []);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  confirm(@Req() req: any, @Param('id') id: string) {
    return this.service.confirmEvent(req.user.id, id, req.user.roles ?? []);
  }

  @UseGuards(JwtAuthGuard)
  @Post('from-creation-request/:creationRequestId')
  createFromRequest(
    @Req() req: any,
    @Param('creationRequestId') creationRequestId: string,
  ) {
    return this.service.createEventFromApprovedRequest(
      req.user.id,
      creationRequestId,
      req.user.roles ?? [],
    );
  }
}
