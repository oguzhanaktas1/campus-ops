import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import type { AnyEventPayload } from './event-payloads';
import { randomUUID } from 'crypto';

/**
 * OutboxService — event kayıp riskini sıfırlar.
 *
 * Kullanım:
 *   // DB transaction içinde çağır
 *   await this.outbox.enqueue(tx, payload);
 *
 * OutboxProcessorService periyodik olarak pending event'leri
 * RabbitMQ'ya iletir ve processed olarak işaretler.
 */
@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Event'i aynı DB transaction içinde OutboxEvent tablosuna yazar.
   * tx: Prisma transaction client (opsiyonel — yoksa direkt prisma kullanır)
   */
  async enqueue(
    payload: AnyEventPayload,
    tx?: Parameters<Parameters<typeof this.prisma.$transaction>[0]>[0],
  ): Promise<void> {
    const db = (tx ?? this.prisma) as any;
    const enriched = {
      ...payload,
      correlationId: payload.correlationId ?? randomUUID(),
      occurredAt: payload.occurredAt ?? new Date().toISOString(),
    };

    await db.outboxEvent.create({
      data: {
        routingKey: payload.event,
        payload: enriched as any,
      },
    });
  }

  /** Birden fazla event'i tek seferde enqueue et */
  async enqueueMany(
    payloads: AnyEventPayload[],
    tx?: Parameters<Parameters<typeof this.prisma.$transaction>[0]>[0],
  ): Promise<void> {
    for (const p of payloads) {
      await this.enqueue(p, tx);
    }
  }
}
