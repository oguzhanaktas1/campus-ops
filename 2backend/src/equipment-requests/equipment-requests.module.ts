import { Module } from '@nestjs/common';
import { EquipmentRequestsService } from './equipment-requests.service';
import { EquipmentRequestsController } from './equipment-requests.controller';
import { PrismaModule } from '../core/prisma/prisma.module';
import { WorkflowModule } from '../workflow/workflow.module';

@Module({
  imports: [PrismaModule, WorkflowModule],
  controllers: [EquipmentRequestsController],
  providers: [EquipmentRequestsService],
  exports: [EquipmentRequestsService],
})
export class EquipmentRequestsModule {}
