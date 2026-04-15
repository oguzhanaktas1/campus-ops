import { Module } from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { WorkflowEngineService } from './workflow-engine.service';
import { SlaService } from './sla.service';
import { SlaSchedulerService } from './sla-scheduler.service';
import { WorkflowController } from './workflow.controller';
import { PrismaModule } from '../core/prisma/prisma.module';
import { RabbitmqModule } from '../infrastructure/rabbitmq/rabbitmq.module';

@Module({
  imports: [PrismaModule, RabbitmqModule],
  controllers: [WorkflowController],
  providers: [
    WorkflowService,
    WorkflowEngineService,
    SlaService,
    SlaSchedulerService,
  ],
  exports: [WorkflowEngineService, SlaService],
})
export class WorkflowModule {}
