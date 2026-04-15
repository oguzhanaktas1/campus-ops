import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../core/prisma/prisma.service';
import { RabbitmqPublisher } from './rabbitmq.publisher';
import type { AnyEventPayload } from './event-payloads';

const MAX_RETRY     = 5;
const BATCH_SIZE    = 50;
const RETRY_DELAYS  = [10, 30, 60, 300, 900]; // saniye cinsinden (exponential backoff)

@Injectable()
export class OutboxProcessorService implements OnModuleInit {
  private readonly logger = new Logger(OutboxProcessorService.name);
  private isRunning = false;

  constructor(
    private prisma: PrismaService,
    private publisher: RabbitmqPublisher,
  ) {}

  onModuleInit() {
    // Uygulama başlarken birikmiş pending event'leri işle
    void this.flush();
  }

  /** Her 5 saniyede pending outbox event'lerini tara ve publish et */
  @Cron(CronExpression.EVERY_5_SECONDS)
  async flush(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const now = new Date();

      const events = await this.prisma.outboxEvent.findMany({
        where: {
          status: 'PENDING',
          // Retry delay: ilk deneme hemen, sonrakiler gecikmeyle
          createdAt: { lte: now },
        },
        orderBy: { createdAt: 'asc' },
        take: BATCH_SIZE,
      });

      if (events.length === 0) return;

      this.logger.debug(`Outbox: processing ${events.length} pending events`);

      for (const event of events) {
        await this._processOne(event);
      }
    } catch (err: any) {
      this.logger.error('Outbox flush error', err?.message);
    } finally {
      this.isRunning = false;
    }
  }

  private async _processOne(event: any): Promise<void> {
    try {
      this.publisher.publish(event.payload as AnyEventPayload);

      await this.prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: 'PROCESSED',
          processedAt: new Date(),
        },
      });
    } catch (err: any) {
      const nextRetry = event.retryCount + 1;
      const isFailed  = nextRetry >= MAX_RETRY;

      this.logger.warn(
        `Outbox event ${event.id} failed (attempt ${nextRetry}/${MAX_RETRY}): ${err?.message}`,
      );

      await this.prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          retryCount: nextRetry,
          lastError:  String(err?.message ?? 'Unknown error').slice(0, 500),
          status:     isFailed ? 'FAILED' : 'PENDING',
        },
      });
    }
  }

  /** FAILED event'leri manuel olarak yeniden kuyruğa al */
  async retryFailed(): Promise<number> {
    const result = await this.prisma.outboxEvent.updateMany({
      where: { status: 'FAILED' },
      data:  { status: 'PENDING', retryCount: 0, lastError: null },
    });
    this.logger.log(`Retrying ${result.count} failed outbox events`);
    return result.count;
  }

  /** Son 7 günün işlenmiş event'lerini temizle */
  async purgeProcessed(): Promise<number> {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const result = await this.prisma.outboxEvent.deleteMany({
      where: { status: 'PROCESSED', processedAt: { lte: cutoff } },
    });
    this.logger.log(`Purged ${result.count} processed outbox events`);
    return result.count;
  }
}
