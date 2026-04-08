import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { EquipmentRequestsService } from './equipment-requests.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateEquipmentRequestDto } from './dto/create-equipment-request.dto';
import { ReviewEquipmentRequestDto } from './dto/review-equipment-request.dto';

interface ReqUser {
  userId: string;
  roles: string[];
}

@Controller('equipment-requests')
@UseGuards(JwtAuthGuard)
export class EquipmentRequestsController {
  constructor(
    private readonly equipmentRequestsService: EquipmentRequestsService,
  ) {}

  /** POST /equipment-requests — create (any authenticated user) */
  @Post()
  create(
    @CurrentUser() user: ReqUser,
    @Body() dto: CreateEquipmentRequestDto,
  ) {
    return this.equipmentRequestsService.create(user.userId, dto);
  }

  /** GET /equipment-requests/my — requester's own list */
  @Get('my')
  findMy(@CurrentUser() user: ReqUser) {
    return this.equipmentRequestsService.findMy(user.userId);
  }

  /** GET /equipment-requests/inbox — open requests (STAFF / ADMIN) */
  @Get('inbox')
  findInbox() {
    return this.equipmentRequestsService.findInbox();
  }

  /** GET /equipment-requests/:id — full detail with role-based access */
  @Get(':id')
  findById(@CurrentUser() user: ReqUser, @Param('id') requestId: string) {
    return this.equipmentRequestsService.findById(
      user.userId,
      user.roles,
      requestId,
    );
  }

  /** PATCH /equipment-requests/:id/review — STAFF/ADMIN review update */
  @Patch(':id/review')
  review(
    @CurrentUser() user: ReqUser,
    @Param('id') requestId: string,
    @Body() dto: ReviewEquipmentRequestDto,
  ) {
    return this.equipmentRequestsService.review(
      user.userId,
      user.roles,
      requestId,
      dto,
    );
  }
}
