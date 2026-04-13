import { Module } from '@nestjs/common';
import { EventPlansService } from './event-plans.service';
import { EventPlansController } from './event-plans.controller';
import { PrismaModule } from '../core/prisma/prisma.module';
import { WorkflowModule } from '../workflow/workflow.module';

@Module({
  imports: [PrismaModule, WorkflowModule],
  controllers: [EventPlansController],
  providers: [EventPlansService],
  exports: [EventPlansService],
})
export class EventPlansModule {}
