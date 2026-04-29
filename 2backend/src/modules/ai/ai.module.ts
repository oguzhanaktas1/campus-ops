import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PrismaModule } from '../../core/prisma/prisma.module';
import { AiClientService } from './ai-client.service';
import { AiController } from './ai.controller';
import { AiResponseValidatorService } from './ai-response-validator.service';
import { AiService } from './ai.service';
import { SqlValidatorService } from './sql-validator.service';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [AiController],
  providers: [AiClientService, AiService, SqlValidatorService, AiResponseValidatorService],
  exports: [AiClientService, AiService, SqlValidatorService, AiResponseValidatorService],
})
export class AiModule {}
