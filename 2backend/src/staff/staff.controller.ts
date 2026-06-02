/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StaffService } from './staff.service';
import { FilesService } from '../files/files.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { extractUserId } from '../core/auth/extract-user-id';
import { MAX_SINGLE_FILE_BYTES } from '../files/file-security';

@Controller('staff')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('STAFF') // Sadece Personel girebilir
export class StaffController {
  constructor(
    private readonly staffService: StaffService,
    private readonly filesService: FilesService,
  ) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_SINGLE_FILE_BYTES, files: 1 } }))
  uploadFile(@Request() req: any, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Herhangi bir dosya yüklenmedi!');
    return this.filesService.uploadGeneralFile(extractUserId(req), file);
  }

  @Get('metrics')
  getMetrics() {
    return this.staffService.getDashboardMetrics();
  }

  @Get('reports')
  getReports(@Request() req: any) {
    return this.staffService.getReports(extractUserId(req));
  }

  @Get('requests')
  getAllRequests(
    @Query('filter') filter?: string,
    @Query('category') category?: string, // URL'den gelen kategoriyi yakala
  ) {
    return this.staffService.getAllRequests(filter, category);
  }

  @Get('requests/:id')
  getRequestDetail(@Param('id') id: string) {
    return this.staffService.getRequestDetail(id);
  }

  @Put('requests/:id')
  reviseRequest(
    @Request() req: any,
    @Param('id') requestId: string,
    @Body() body: any,
  ) {
    return this.staffService.reviseRequest(extractUserId(req), requestId, body);
  }

  // staff.controller.ts

  @Get('faculty-members') // 🔥 Frontend bu ismi bekliyor!
  getFacultyMembers() {
    return this.staffService.getFacultyMembers();
  }

  // 🔥 TALEBİ BİRİNE ATA 🔥
  @Post('requests/:id/assign')
  assignRequest(
    @Request() req: any,
    @Param('id') requestId: string,
    @Body('assigneeId') assigneeId: string,
  ) {
    const staffId = extractUserId(req);
    return this.staffService.assignRequest(requestId, assigneeId, staffId);
  }

  // 🔥 BİLDİRİM ENDPOINTLERİ (STAFF) 🔥
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

  // 🔥 AYARLAR (SETTINGS) ENDPOINTLERİ 🔥

  @Get('settings/preferences')
  getPreferences(@Request() req: any) {
    return this.staffService.getPreferences(extractUserId(req));
  }

  @Put('settings/preferences')
  updatePreferences(@Request() req: any, @Body() body: any) {
    return this.staffService.updatePreferences(extractUserId(req), body);
  }

  @Post('settings/change-password')
  changePassword(@Request() req: any, @Body() body: any) {
    return this.staffService.changePassword(extractUserId(req), body);
  }
}
