import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { AvailabilityService, AvailabilitySlotDto } from './availability.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

interface ReqUser {
  userId: string;
  roles: string[];
}

// ── /appointment-requests ─────────────────────────────────────────────────────

@Controller('appointment-requests')
@UseGuards(JwtAuthGuard)
export class AppointmentRequestsController {
  constructor(private readonly svc: AppointmentsService) {}

  /** GET /appointment-requests/faculty-users */
  @Get('faculty-users')
  getFacultyUsers() {
    return this.svc.getFacultyUsers();
  }

  /** POST /appointment-requests */
  @Post()
  create(@CurrentUser() user: ReqUser, @Body() dto: any) {
    return this.svc.create(user.userId, dto);
  }

  /** GET /appointment-requests/my */
  @Get('my')
  findMy(@CurrentUser() user: ReqUser) {
    return this.svc.findMy(user.userId);
  }

  /** GET /appointment-requests/incoming */
  @Get('incoming')
  findIncoming(@CurrentUser() user: ReqUser) {
    return this.svc.findIncoming(user.userId, user.roles);
  }

  /** GET /appointment-requests/:id */
  @Get(':id')
  findById(@CurrentUser() user: ReqUser, @Param('id') id: string) {
    return this.svc.findById(user.userId, user.roles, id);
  }

  /** POST /appointment-requests/:id/confirm — target user accepts; routes to RESOURCE_MANAGER */
  @Post(':id/confirm')
  confirm(@CurrentUser() user: ReqUser, @Param('id') id: string, @Body() dto: any) {
    return this.svc.confirm(user.userId, user.roles, id, dto);
  }

  /** POST /appointment-requests/:id/decline — target user rejects */
  @Post(':id/decline')
  decline(@CurrentUser() user: ReqUser, @Param('id') id: string, @Body() dto: any) {
    return this.svc.decline(user.userId, user.roles, id, dto);
  }

  /** POST /appointment-requests/:id/manager-approve — RESOURCE_MANAGER final approval */
  @Post(':id/manager-approve')
  managerApprove(
    @CurrentUser() user: ReqUser,
    @Param('id') id: string,
    @Body() dto: any,
  ) {
    return this.svc.managerApprove(user.userId, user.roles, id, dto);
  }

  /** POST /appointment-requests/:id/manager-decline — RESOURCE_MANAGER rejects */
  @Post(':id/manager-decline')
  managerDecline(
    @CurrentUser() user: ReqUser,
    @Param('id') id: string,
    @Body() dto: any,
  ) {
    return this.svc.managerDecline(user.userId, user.roles, id, dto);
  }

  /** POST /appointment-requests/:id/cancel */
  @Post(':id/cancel')
  cancel(@CurrentUser() user: ReqUser, @Param('id') id: string, @Body() dto: any) {
    return this.svc.cancel(user.userId, user.roles, id, dto);
  }
}

// ── /appointments ─────────────────────────────────────────────────────────────

@Controller('appointments')
@UseGuards(JwtAuthGuard)
export class AppointmentsController {
  constructor(private readonly svc: AppointmentsService) {}

  /** GET /appointments/my */
  @Get('my')
  getMyAppointments(@CurrentUser() user: ReqUser) {
    return this.svc.getMyAppointments(user.userId);
  }

  /** GET /appointments/:id */
  @Get(':id')
  getById(@CurrentUser() user: ReqUser, @Param('id') id: string) {
    return this.svc.getAppointmentById(user.userId, id);
  }
}

// ── /availability ─────────────────────────────────────────────────────────────

@Controller('availability')
@UseGuards(JwtAuthGuard)
export class AvailabilityController {
  constructor(private readonly availSvc: AvailabilityService) {}

  /** GET /availability/me */
  @Get('me')
  getMyAvailability(@CurrentUser() user: ReqUser) {
    return this.availSvc.getAvailability(user.userId);
  }

  /** PUT /availability/me (implemented as POST for simplicity) */
  @Post('me')
  updateMyAvailability(
    @CurrentUser() user: ReqUser,
    @Body() body: { slots: AvailabilitySlotDto[] },
  ) {
    return this.availSvc.replaceAvailability(user.userId, body.slots ?? []);
  }

  /** GET /availability/:userId */
  @Get(':userId')
  getAvailability(@Param('userId') userId: string) {
    return this.availSvc.getAvailability(userId);
  }
}
