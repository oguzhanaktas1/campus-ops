# CampusOps Redis Integration Guide

## Amaç

Bu doküman, `campusops_redis_nest_starter.zip` içindeki yapıyı mevcut CampusOps projesine:

- **eklemek**
- veya eksikse **sıfırdan oluşturmak**

için hazırlanmıştır.

---

# 1. Kurulum

## Gerekli paketler

```bash
npm install ioredis @nestjs/config @nestjs/bullmq bullmq
```

## ENV

`.env` dosyana ekle:

```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

---

# 2. Redis Docker Servisi

Projene `docker-compose.redis.yml` ekle:

```yaml
version: "3.9"

services:
  redis:
    image: redis:7-alpine
    container_name: campusops-redis
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    restart: unless-stopped
```

Çalıştır:

```bash
docker compose -f docker-compose.redis.yml up -d
```

---

# 3. Projede Oluşturulacak Folder Structure

Aşağıdaki klasör yapısını oluştur:

```txt
src/
  infrastructure/
    redis/
      redis.module.ts
      redis.tokens.ts
    cache/
      cache.module.ts
      cache.service.ts
      cache-keys.ts
    queue/
      queue.module.ts

  modules/
    admin/
      dashboard/
        admin-dashboard-query.service.ts
    faculty/
      approvals/
        faculty-approvals-query.service.ts
    requests/
      detail/
        request-detail.service.ts
```

---

# 4. Redis Module

## `src/infrastructure/redis/redis.tokens.ts`

```ts
export const REDIS_CLIENT = Symbol('REDIS_CLIENT');
```

## `src/infrastructure/redis/redis.module.ts`

```ts
import { Global, Module } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { REDIS_CLIENT } from './redis.tokens';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return new Redis({
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
          password: configService.get<string>('REDIS_PASSWORD') || undefined,
          db: configService.get<number>('REDIS_DB', 0),
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
```

---

# 5. Cache Module ve CacheService

## `src/infrastructure/cache/cache.module.ts`

```ts
import { Global, Module } from '@nestjs/common';
import { CacheService } from './cache.service';

@Global()
@Module({
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}
```

## `src/infrastructure/cache/cache.service.ts`

```ts
import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.tokens';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.redis.get(key);
    if (!raw) return null;

    try {
      return JSON.parse(raw) as T;
    } catch {
      this.logger.warn(`Failed to parse cache value for key: ${key}`);
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async incr(key: string): Promise<number> {
    return this.redis.incr(key);
  }

  async decr(key: string): Promise<number> {
    return this.redis.decr(key);
  }

  async getOrSet<T>(
    key: string,
    ttlSeconds: number,
    factory: () => Promise<T>,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    const value = await factory();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  async getVersion(namespace: string): Promise<number> {
    const key = `version:${namespace}`;
    const value = await this.redis.get(key);
    return value ? Number(value) : 1;
  }

  async bumpVersion(namespace: string): Promise<number> {
    const key = `version:${namespace}`;
    const exists = await this.redis.exists(key);
    if (!exists) {
      await this.redis.set(key, '1');
    }
    return this.redis.incr(key);
  }

  async getVersionedKey(namespace: string, baseKey: string): Promise<string> {
    const version = await this.getVersion(namespace);
    return `${baseKey}:v${version}`;
  }
}
```

---

# 6. Cache Key Builder

## `src/infrastructure/cache/cache-keys.ts`

```ts
import { createHash } from 'crypto';

function stableStringify(input: unknown): string {
  if (input === null || input === undefined) return '';
  if (typeof input !== 'object') return String(input);
  if (Array.isArray(input)) return `[${input.map(stableStringify).join(',')}]`;

  const entries = Object.entries(input as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}:${stableStringify(value)}`);

  return `{${entries.join(',')}}`;
}

function hashFilters(filters: unknown): string {
  const raw = stableStringify(filters);
  return createHash('sha1').update(raw).digest('hex');
}

export const cacheKeys = {
  admin: {
    dashboard: () => 'admin:dashboard:summary',
    requestsList: (filters: unknown) => `admin:requests:list:${hashFilters(filters)}`,
  },
  faculty: {
    approvalsList: (userId: string, filters: unknown) =>
      `faculty:approvals:list:${userId}:${hashFilters(filters)}`,
    approvalsSummary: (userId: string) => `faculty:approvals:summary:${userId}`,
  },
  requests: {
    detailBase: (portal: string, requestId: string, userId: string) =>
      `request:detail:${portal}:${requestId}:${userId}`,
  },
  notifications: {
    unreadCount: (userId: string) => `notifications:unread:${userId}`,
  },
};
```

---

# 7. BullMQ Queue Module

## `src/infrastructure/queue/queue.module.ts`

```ts
import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
          password: configService.get<string>('REDIS_PASSWORD') || undefined,
          db: configService.get<number>('REDIS_DB', 0),
        },
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
```

---

# 8. Admin Dashboard Cache Örneği

## `src/modules/admin/dashboard/admin-dashboard-query.service.ts`

```ts
import { Injectable } from '@nestjs/common';
import { CacheService } from '../../../infrastructure/cache/cache.service';
import { cacheKeys } from '../../../infrastructure/cache/cache-keys';

/**
 * PrismaService import'unu kendi projendeki path'e göre düzelt.
 */
@Injectable()
export class AdminDashboardQueryService {
  constructor(
    private readonly cacheService: CacheService,
    // private readonly prisma: PrismaService,
  ) {}

  async getSummary() {
    const baseKey = cacheKeys.admin.dashboard();
    const key = await this.cacheService.getVersionedKey('admin-dashboard', baseKey);

    return this.cacheService.getOrSet(key, 60, async () => {
      // Aşağıdaki sorguları Prisma ile doldur.
      // const [openRequests, overdueRequests, activeTickets] = await Promise.all([
      //   this.prisma.request.count({ ... }),
      //   this.prisma.request.count({ ... }),
      //   this.prisma.itTicket.count({ ... }),
      // ]);

      return {
        openRequests: 0,
        overdueRequests: 0,
        activeTickets: 0,
        todayReservations: 0,
        todayAppointments: 0,
        generatedAt: new Date().toISOString(),
      };
    });
  }

  async invalidateDashboard(): Promise<void> {
    await this.cacheService.bumpVersion('admin-dashboard');
  }
}
```

---

# 9. Faculty Approvals Cache Örneği

## `src/modules/faculty/approvals/faculty-approvals-query.service.ts`

```ts
import { Injectable } from '@nestjs/common';
import { CacheService } from '../../../infrastructure/cache/cache.service';
import { cacheKeys } from '../../../infrastructure/cache/cache-keys';

@Injectable()
export class FacultyApprovalsQueryService {
  constructor(
    private readonly cacheService: CacheService,
    // private readonly prisma: PrismaService,
  ) {}

  async getApprovals(userId: string, filters: Record<string, unknown>) {
    const baseKey = cacheKeys.faculty.approvalsList(userId, filters);
    const key = await this.cacheService.getVersionedKey(`faculty-approvals:${userId}`, baseKey);

    return this.cacheService.getOrSet(key, 20, async () => {
      // Prisma sorgusu örneği:
      // return this.prisma.workflowInstanceStep.findMany({
      //   where: {
      //     assignedToUserId: userId,
      //     status: 'ACTIVE',
      //   },
      //   include: {
      //     workflowInstance: {
      //       include: {
      //         request: {
      //           include: {
      //             requestType: true,
      //             requester: { include: { profile: true } },
      //           },
      //         },
      //       },
      //     },
      //   },
      // });

      return {
        items: [],
        total: 0,
        generatedAt: new Date().toISOString(),
      };
    });
  }

  async getSummary(userId: string) {
    const key = cacheKeys.faculty.approvalsSummary(userId);

    return this.cacheService.getOrSet(key, 30, async () => {
      return {
        pendingCount: 0,
        overdueCount: 0,
      };
    });
  }

  async invalidateFacultyApprovals(userId: string): Promise<void> {
    await this.cacheService.bumpVersion(`faculty-approvals:${userId}`);
    await this.cacheService.del(cacheKeys.faculty.approvalsSummary(userId));
  }
}
```

---

# 10. Request Detail Cache Örneği

## `src/modules/requests/detail/request-detail.service.ts`

```ts
import { Injectable } from '@nestjs/common';
import { CacheService } from '../../../infrastructure/cache/cache.service';
import { cacheKeys } from '../../../infrastructure/cache/cache-keys';

type Portal = 'student' | 'faculty' | 'staff' | 'admin';

@Injectable()
export class RequestDetailService {
  constructor(
    private readonly cacheService: CacheService,
    // private readonly prisma: PrismaService,
  ) {}

  async getDetail(requestId: string, portal: Portal, userId: string) {
    const baseKey = cacheKeys.requests.detailBase(portal, requestId, userId);
    const key = await this.cacheService.getVersionedKey(`request-detail:${requestId}`, baseKey);

    return this.cacheService.getOrSet(key, 30, async () => {
      // Prisma include yapını burada kur.
      // requestType'a göre domain relation include etmek daha doğru olur.
      //
      // const request = await this.prisma.request.findUnique({
      //   where: { id: requestId },
      //   include: {
      //     requestType: true,
      //     requester: { include: { profile: true } },
      //     currentAssignee: { include: { profile: true } },
      //     comments: true,
      //     statusHistory: true,
      //     assignments: true,
      //     workflowInstance: {
      //       include: {
      //         instanceSteps: true,
      //       },
      //     },
      //     internshipRequest: true,
      //     itTicket: true,
      //     roomReservationRequest: true,
      //     documentRequest: true,
      //     appointmentRequest: true,
      //   },
      // });

      return {
        request: null,
        requestType: null,
        domainData: null,
        workflow: null,
        comments: [],
        attachments: [],
        statusHistory: [],
        assignments: [],
        availableActions: [],
        permissions: {},
      };
    });
  }

  async invalidateRequestDetail(requestId: string): Promise<void> {
    await this.cacheService.bumpVersion(`request-detail:${requestId}`);
  }
}
```

---

# 11. Mutation Sonrası Invalidasyon

Aşağıdaki durumlarda cache invalidasyonu yap:

- request status değişti
- workflow step tamamlandı
- approval action oluştu
- comment eklendi
- file yüklendi
- assignment değişti

## Örnek invalidasyon

```ts
await cacheService.bumpVersion(`request-detail:${requestId}`);
await cacheService.bumpVersion('admin-dashboard');
await cacheService.bumpVersion(`faculty-approvals:${userId}`);
```

İstersen bunları ortak utility olarak da yazabilirsin.

---

# 12. AppModule'e Ekleme

`AppModule` veya ortak infrastructure module içine şunları ekle:

```ts
imports: [
  ConfigModule.forRoot({ isGlobal: true }),
  RedisModule,
  CacheModule,
  QueueModule,
]
```

---

# 13. Nereden Başlamalısın?

## İlk bağlanacak yerler
1. `admin/dashboard`
2. `faculty/approvals`
3. `GET /requests/:id/detail`

## Sonra
4. `admin/requests`
5. `staff/tickets`
6. unread notification count
7. `student/reservations/new` availability cache
8. `student/appointments/new` availability cache

---

# 14. Kritik Kurallar

## Yap
- Redis'i hız katmanı olarak kullan
- kısa TTL kullan
- version-based invalidation uygula
- aynı key standardını proje genelinde koru

## Yapma
- Redis'i source of truth yapma
- approval / workflow transaction'larını Redis'e taşıma
- her yerde pattern delete spam yapma
- tam sayfa HTML/JSON cache mantığına kayma

---

# 15. Final Karar

Bu kurulumla:

- dashboard response süreleri düşer
- approval listeleri hızlanır
- request detail daha akıcı olur
- tekrar eden ağır query'ler azalır
- ileride BullMQ ile async iş katmanına geçiş kolaylaşır

## Kısa özet
- PostgreSQL = gerçek veri
- Redis = cache + speed layer
- BullMQ = async işler
