import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateRoomReservationDto } from './dto/create-room-reservation.dto';
import { ApproveReservationDto, RejectReservationDto } from './dto/approve-reservation.dto';

interface ReqUser {
  userId: string;
  roles: string[];
}

@Controller('room-reservation-requests')
@UseGuards(JwtAuthGuard)
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  /** POST /room-reservation-requests */
  @Post()
  create(@CurrentUser() user: ReqUser, @Body() dto: CreateRoomReservationDto) {
    return this.reservationsService.create(user.userId, dto);
  }

  /** GET /room-reservation-requests — all (admin/staff) */
  @Get()
  findAll() {
    return this.reservationsService.findAll();
  }

  /** GET /room-reservation-requests/my */
  @Get('my')
  findMy(@CurrentUser() user: ReqUser) {
    return this.reservationsService.findMy(user.userId);
  }

  /** GET /room-reservation-requests/inbox */
  @Get('inbox')
  findInbox() {
    return this.reservationsService.findInbox();
  }

  /** GET /room-reservation-requests/:id */
  @Get(':id')
  findById(@CurrentUser() user: ReqUser, @Param('id') requestId: string) {
    return this.reservationsService.findById(user.userId, user.roles, requestId);
  }

  /** POST /room-reservation-requests/:id/approve */
  @Post(':id/approve')
  approve(
    @CurrentUser() user: ReqUser,
    @Param('id') requestId: string,
    @Body() dto: ApproveReservationDto,
  ) {
    return this.reservationsService.approve(user.userId, user.roles, requestId, dto);
  }

  /** POST /room-reservation-requests/:id/reject */
  @Post(':id/reject')
  reject(
    @CurrentUser() user: ReqUser,
    @Param('id') requestId: string,
    @Body() dto: RejectReservationDto,
  ) {
    return this.reservationsService.reject(user.userId, user.roles, requestId, dto);
  }
}
