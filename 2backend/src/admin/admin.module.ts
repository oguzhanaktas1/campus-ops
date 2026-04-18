import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { SystemMonitorController } from './system-monitor.controller';
import { PrismaModule } from '../core/prisma/prisma.module';
import { WorkflowModule } from '../workflow/workflow.module';
import { AiModule } from '../modules/ai/ai.module';

@Module({
  imports: [PrismaModule, WorkflowModule, AiModule],
  providers: [AdminService],
  controllers: [AdminController, SystemMonitorController],
})
export class AdminModule {}
