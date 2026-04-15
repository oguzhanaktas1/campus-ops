import { Global, Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { RabbitmqPublisher } from './rabbitmq.publisher';
import { OutboxService } from './outbox.service';
import { OutboxProcessorService } from './outbox-processor.service';
import { RabbitmqMonitorService } from './rabbitmq-monitor.service';
import { PrismaModule } from '../../core/prisma/prisma.module';

@Global()
@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
  ],
  providers: [
    RabbitmqPublisher,
    OutboxService,
    OutboxProcessorService,
    RabbitmqMonitorService,
  ],
  exports: [
    RabbitmqPublisher,
    OutboxService,
    OutboxProcessorService,
    RabbitmqMonitorService,
  ],
})
export class RabbitmqModule {}
