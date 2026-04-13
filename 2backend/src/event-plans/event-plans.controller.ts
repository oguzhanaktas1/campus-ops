import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { EventPlansService } from './event-plans.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('event-plans')
export class EventPlansController {
  constructor(private readonly service: EventPlansService) {}

  // ─────────────────────────────────────────────────────────────
  // EventPlan CRUD
  // ─────────────────────────────────────────────────────────────

  @Post()
  create(@Req() req: any, @Body() dto: any) {
    return this.service.createPlan(req.user.id, dto);
  }

  @Get()
  findAll(@Req() req: any) {
    return this.service.findAllPlans(req.user.id, req.user.roles ?? []);
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.service.findPlanById(req.user.id, id, req.user.roles ?? []);
  }

  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: any) {
    return this.service.updatePlan(req.user.id, id, req.user.roles ?? [], dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  cancel(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.service.cancelPlan(
      req.user.id,
      id,
      req.user.roles ?? [],
      body.reason,
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Pre-registration
  // ─────────────────────────────────────────────────────────────

  @Post(':id/register')
  @HttpCode(HttpStatus.OK)
  register(@Req() req: any, @Param('id') id: string) {
    return this.service.registerForPlan(req.user.id, id);
  }

  @Delete(':id/register')
  @HttpCode(HttpStatus.OK)
  cancelRegistration(@Req() req: any, @Param('id') id: string) {
    return this.service.cancelPlanRegistration(req.user.id, id);
  }

  // ─────────────────────────────────────────────────────────────
  // Decision log
  // ─────────────────────────────────────────────────────────────

  @Post(':id/decisions')
  @HttpCode(HttpStatus.OK)
  recordDecision(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: any,
  ) {
    return this.service.recordDecision(
      req.user.id,
      id,
      req.user.roles ?? [],
      dto,
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Event Creation Request
  // ─────────────────────────────────────────────────────────────

  @Post(':id/creation-request')
  createEventCreationRequest(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: any,
  ) {
    return this.service.createEventCreationRequest(
      req.user.id,
      id,
      req.user.roles ?? [],
      dto,
    );
  }
}
