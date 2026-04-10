import { Module } from '@nestjs/common';
import { PrismaModule } from '../core/prisma/prisma.module';
import { FacultyController } from './faculty.controller';
import { FacultyService } from './faculty.service';
import { WorkflowModule } from '../workflow/workflow.module';

@Module({
  imports: [PrismaModule, WorkflowModule],
  controllers: [FacultyController],
  providers: [FacultyService],
})
export class FacultyModule {}
