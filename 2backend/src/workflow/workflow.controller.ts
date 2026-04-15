import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { extractUserId } from '../core/auth/extract-user-id';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { CreateWorkflowStepDto } from './dto/create-workflow-step.dto';
import { CreateWorkflowTransitionDto } from './dto/create-workflow-transition.dto';

@Controller('admin/workflows')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Get()
  getAll() {
    return this.workflowService.getAll();
  }

  @Get('instances/overview')
  getInstancesOverview() {
    return this.workflowService.getInstancesOverview();
  }

  @Get(':id')
  getById(@Param('id') id: string, @Query('view') view?: string) {
    return this.workflowService.getById(id, view);
  }

  @Post()
  create(@Request() req: any, @Body() dto: CreateWorkflowDto) {
    return this.workflowService.create(extractUserId(req), dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.workflowService.delete(id);
  }

  @Post(':id/steps')
  addStep(@Param('id') workflowId: string, @Body() dto: CreateWorkflowStepDto) {
    return this.workflowService.addStep(workflowId, dto);
  }

  @Post(':id/transitions')
  addTransition(
    @Param('id') workflowId: string,
    @Body() dto: CreateWorkflowTransitionDto,
  ) {
    return this.workflowService.addTransition(workflowId, dto);
  }
}
