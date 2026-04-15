import { Module } from '@nestjs/common';
import { StudentService } from './student.service';
import { StudentController } from './student.controller';
import { PrismaModule } from '../core/prisma/prisma.module';
import { WorkflowModule } from '../workflow/workflow.module';
import { RabbitmqModule } from '../infrastructure/rabbitmq/rabbitmq.module';

@Module({
  imports: [PrismaModule, WorkflowModule, RabbitmqModule],
  providers: [StudentService],
  controllers: [StudentController],
})
export class StudentModule {}
