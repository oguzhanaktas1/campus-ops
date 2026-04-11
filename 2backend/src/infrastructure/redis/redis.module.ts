import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.tokens';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');
        if (redisUrl) {
          return new Redis(redisUrl, {
            lazyConnect: true,
            maxRetriesPerRequest: 2,
            enableReadyCheck: true,
          });
        }

        return new Redis({
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: Number(configService.get<string>('REDIS_PORT', '6379')),
          password: configService.get<string>('REDIS_PASSWORD') || undefined,
          db: Number(configService.get<string>('REDIS_DB', '0')),
          lazyConnect: true,
          maxRetriesPerRequest: 2,
          enableReadyCheck: true,
        });
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
