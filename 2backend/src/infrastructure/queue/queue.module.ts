import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { ConnectionOptions } from 'tls';

function buildRedisConnection(configService: ConfigService) {
  const redisUrl = configService.get<string>('REDIS_URL');

  if (redisUrl) {
    const parsed = new URL(redisUrl);
    const password = parsed.password || undefined;
    const username = parsed.username || undefined;
    const tls =
      parsed.protocol === 'rediss:' ? ({} as ConnectionOptions) : undefined;

    return {
      host: parsed.hostname,
      port: Number(parsed.port || '6379'),
      username,
      password,
      tls,
    };
  }

  const tlsEnabled =
    configService.get<string>('REDIS_TLS', 'false').toLowerCase() === 'true';

  return {
    host: configService.get<string>('REDIS_HOST', 'localhost'),
    port: Number(configService.get<string>('REDIS_PORT', '6379')),
    password: configService.get<string>('REDIS_PASSWORD') || undefined,
    db: Number(configService.get<string>('REDIS_DB', '0')),
    tls: tlsEnabled ? ({} as ConnectionOptions) : undefined,
  };
}

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: buildRedisConnection(configService),
      }),
    }),
    BullModule.registerQueue(
      { name: 'emailQueue' },
      { name: 'notificationQueue' },
      { name: 'reportQueue' },
      { name: 'aiQueue' },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
