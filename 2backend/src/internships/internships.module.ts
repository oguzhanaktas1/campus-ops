import { Module } from '@nestjs/common';
import { InternshipsService } from './internships.service';
import { InternshipsController } from './internships.controller';
import { PrismaModule } from '../core/prisma/prisma.module';
import { WorkflowModule } from '../workflow/workflow.module';

@Module({
  imports: [PrismaModule, WorkflowModule],
  controllers: [InternshipsController],
  providers: [InternshipsService],
  exports: [InternshipsService],
})
export class InternshipsModule {}
