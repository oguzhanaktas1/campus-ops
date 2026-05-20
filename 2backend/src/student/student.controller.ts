import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFiles,
  UploadedFile,
  Delete,
  BadRequestException,
  Put,
  Query,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { StudentService } from './student.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateInternshipDto } from './dto/create-internship.dto';
import { CreateGenericRequestDto } from './dto/create-generic-request.dto';
import { extractUserId } from '../core/auth/extract-user-id';
import { RateLimitGuard } from '../infrastructure/rate-limit/rate-limit.guard';
import { Throttle } from '../infrastructure/rate-limit/rate-limit.decorator';
import {
  MAX_MULTI_FILE_COUNT,
  MAX_SINGLE_FILE_BYTES,
} from '../files/file-security';

export interface RequestWithUser extends Request {
  user?: {
    id?: string;
    userId?: string;
    sub?: string;
  };
}

@Controller('student')
@UseGuards(JwtAuthGuard, RolesGuard, RateLimitGuard)
@Roles('STUDENT')
export class StudentController {
  constructor(private readonly studentService: StudentService) {}

  @Get('requests')
  getMyRequests(
    @Request() req: RequestWithUser,
    @Query('type') type?: string,
    @Query('category') category?: string,
  ) {
    return this.studentService.getMyRequests(
      extractUserId(req),
      type,
      category,
    );
  }

  @Post('requests')
  @Throttle({ limit: 5, windowSeconds: 60, keyType: 'user', namespace: 'upload:request' })
  @UseInterceptors(
    FilesInterceptor('attachments', MAX_MULTI_FILE_COUNT, {
      limits: { fileSize: MAX_SINGLE_FILE_BYTES, files: MAX_MULTI_FILE_COUNT },
    }),
  )
  createGenericRequest(
    @Request() req: RequestWithUser,
    @Body() body: CreateGenericRequestDto,
    @UploadedFiles() files: Array<Express.Multer.File>,
  ) {
    return this.studentService.createGenericRequest(
      extractUserId(req),
      body,
      files,
    );
  }

  @Get('requests/:id')
  getRequestById(@Request() req: RequestWithUser, @Param('id') id: string) {
    return this.studentService.getRequestById(extractUserId(req), id);
  }

  @Put('requests/:id')
  @Throttle({ limit: 5, windowSeconds: 60, keyType: 'user', namespace: 'upload:revision' })
  @UseInterceptors(
    FilesInterceptor('attachments', MAX_MULTI_FILE_COUNT, {
      limits: { fileSize: MAX_SINGLE_FILE_BYTES, files: MAX_MULTI_FILE_COUNT },
    }),
  )
  updateGenericRequest(
    @Request() req: RequestWithUser,
    @Param('id') id: string,
    @Body() body: any,
    @UploadedFiles() files: Array<Express.Multer.File>,
  ) {
    return this.studentService.updateGenericRequest(
      extractUserId(req),
      id,
      body,
      files,
    );
  }

  @Post('internship')
  createInternship(
    @Request() req: RequestWithUser,
    @Body() body: CreateInternshipDto,
  ) {
    return this.studentService.createInternshipRequest(
      extractUserId(req),
      body,
    );
  }

  @Get('internships')
  getInternships(@Request() req: RequestWithUser) {
    return this.studentService.getInternships(extractUserId(req));
  }

  @Post('internships')
  createInternshipV2(
    @Request() req: RequestWithUser,
    @Body() body: CreateInternshipDto,
  ) {
    return this.studentService.createInternshipRequest(extractUserId(req), body);
  }

  @Get('internships/:id')
  getInternshipById(@Request() req: RequestWithUser, @Param('id') id: string) {
    return this.studentService.getInternshipById(extractUserId(req), id);
  }

  @Get('request-types')
  getRequestTypes() {
    return this.studentService.getRequestTypes();
  }

  @Post('requests/:id/comments')
  @Roles('STUDENT', 'FACULTY', 'STAFF', 'ADMIN')
  @Throttle({ limit: 20, windowSeconds: 60, keyType: 'user', namespace: 'req:comment' })
  addComment(
    @Request() req: RequestWithUser,
    @Param('id') id: string,
    @Body('text') text: string,
  ) {
    return this.studentService.addCommentToRequest(
      extractUserId(req),
      id,
      text,
    );
  }

  @Get('faculty-members')
  getFacultyMembers() {
    return this.studentService.getFacultyMembers();
  }

  @Get('appointments')
  getMyAppointments(@Request() req: RequestWithUser) {
    return this.studentService.getMyAppointments(extractUserId(req));
  }

  @Get('reservations')
  getMyReservations(@Request() req: RequestWithUser) {
    return this.studentService.getMyReservations(extractUserId(req));
  }

  @Get('files')
  getMyFiles(@Request() req: RequestWithUser) {
    return this.studentService.getMyFiles(extractUserId(req));
  }

  @Post('upload')
  @Throttle({ limit: 10, windowSeconds: 60, keyType: 'user', namespace: 'upload:general' })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_SINGLE_FILE_BYTES, files: 1 },
    }),
  )
  uploadFile(
    @Request() req: RequestWithUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Herhangi bir dosya yüklenmedi!');
    }
    return this.studentService.uploadGeneralFile(extractUserId(req), file);
  }

  @Delete('files/:id')
  deleteFile(@Request() req: RequestWithUser, @Param('id') id: string) {
    return this.studentService.deleteFile(extractUserId(req), id);
  }

  @Get('notifications')
  getNotifications(@Request() req: RequestWithUser) {
    return this.studentService.getNotifications(extractUserId(req));
  }

  @Delete('notifications')
  deleteNotifications(
    @Request() req: RequestWithUser,
    @Body('ids') ids: string[],
  ) {
    return this.studentService.deleteNotifications(extractUserId(req), ids);
  }

  @Post('notifications/:id/read')
  markNotificationAsRead(
    @Request() req: RequestWithUser,
    @Param('id') id: string,
  ) {
    return this.studentService.markNotificationAsRead(extractUserId(req), id);
  }

  @Post('notifications/read-all')
  markAllNotificationsAsRead(@Request() req: RequestWithUser) {
    return this.studentService.markAllNotificationsAsRead(extractUserId(req));
  }

  @Get('preferences')
  getPreferences(@Request() req: RequestWithUser) {
    return this.studentService.getPreferences(extractUserId(req));
  }

  @Put('preferences')
  updatePreferences(@Request() req: RequestWithUser, @Body() body: any) {
    return this.studentService.updatePreferences(extractUserId(req), body);
  }

  @Put('profile')
  updateProfile(@Request() req: RequestWithUser, @Body() body: any) {
    return this.studentService.updateProfile(extractUserId(req), body);
  }

  @Post('change-password')
  changePassword(@Request() req: RequestWithUser, @Body() body: any) {
    return this.studentService.changePassword(extractUserId(req), body);
  }
}
