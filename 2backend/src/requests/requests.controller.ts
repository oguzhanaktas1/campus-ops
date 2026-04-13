import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RequestsService } from './requests.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateRequestDto } from './dto/create-request.dto';
import { AddCommentDto } from './dto/add-comment.dto';
import { ProcessActionDto } from '../workflow/dto/process-action.dto';

interface ReqUser {
  userId: string;
  roles: string[];
}

@Controller('requests')
@UseGuards(JwtAuthGuard)
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  /** POST /requests — create a generic request (any authenticated role) */
  @Post()
  create(@CurrentUser() user: ReqUser, @Body() dto: CreateRequestDto) {
    return this.requestsService.create(user.userId, dto);
  }

  /** GET /requests/my — current user's own requests */
  @Get('my')
  findMy(
    @CurrentUser() user: ReqUser,
    @Query('type') type?: string,
    @Query('status') status?: string,
  ) {
    return this.requestsService.findMy(user.userId, type, status);
  }

  /** GET /requests/inbox — role-scoped open requests queue */
  @Get('inbox')
  findInbox(@CurrentUser() user: ReqUser) {
    return this.requestsService.findInbox(user.userId, user.roles);
  }

  /** GET /requests/:id — detail with role-based access */
  @Get(':id')
  findById(@CurrentUser() user: ReqUser, @Param('id') id: string) {
    return this.requestsService.findById(user.userId, user.roles, id);
  }

  // ─── Actions ──────────────────────────────────────────────────────────────

  /** POST /requests/:id/actions — approve / reject / revision / cancel */
  @Post(':id/actions')
  processAction(
    @CurrentUser() user: ReqUser,
    @Param('id') requestId: string,
    @Body() dto: ProcessActionDto,
  ) {
    return this.requestsService.processAction(user.userId, user.roles, requestId, dto);
  }

  // ─── Comments ─────────────────────────────────────────────────────────────

  /** POST /requests/:id/comments */
  @Post(':id/comments')
  addComment(
    @CurrentUser() user: ReqUser,
    @Param('id') requestId: string,
    @Body() dto: AddCommentDto,
  ) {
    return this.requestsService.addComment(user.userId, user.roles, requestId, dto);
  }

  /** GET /requests/:id/comments */
  @Get(':id/comments')
  getComments(@CurrentUser() user: ReqUser, @Param('id') requestId: string) {
    return this.requestsService.getComments(user.userId, user.roles, requestId);
  }

  // ─── Watchers ─────────────────────────────────────────────────────────────

  /** POST /requests/:id/watchers  body: { userId } */
  @Post(':id/watchers')
  addWatcher(
    @CurrentUser() user: ReqUser,
    @Param('id') requestId: string,
    @Body('userId') watchUserId: string,
  ) {
    return this.requestsService.addWatcher(
      requestId,
      watchUserId,
      user.userId,
      user.roles,
    );
  }

  /** DELETE /requests/:id/watchers/:userId */
  @Delete(':id/watchers/:userId')
  removeWatcher(
    @CurrentUser() user: ReqUser,
    @Param('id') requestId: string,
    @Param('userId') watchUserId: string,
  ) {
    return this.requestsService.removeWatcher(
      requestId,
      watchUserId,
      user.userId,
      user.roles,
    );
  }
}
