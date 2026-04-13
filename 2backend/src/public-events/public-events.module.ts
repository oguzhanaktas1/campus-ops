import { Module } from '@nestjs/common';
import { PublicEventsService } from './public-events.service';
import { PublicEventsController } from './public-events.controller';
import { PrismaModule } from '../core/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PublicEventsController],
  providers: [PublicEventsService],
  exports: [PublicEventsService],
})
export class PublicEventsModule {}
