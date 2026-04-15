import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../core/prisma/prisma.service';

/**
 * RabbitMQ Management API üzerinden kuyruk istatistiklerini çeker.
 * RabbitMQ Management Plugin (port 15672) aktif olmalı.
 */
@Injectable()
export class RabbitmqMonitorService {
  private readonly logger = new Logger(RabbitmqMonitorService.name);
  private readonly mgmtUrl: string;
  private readonly auth: string;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    const url = this.config.get<string>('RABBITMQ_MGMT_URL', 'http://localhost:15672');
    const user = this.config.get<string>('RABBITMQ_MGMT_USER', 'campusops');
    const pass = this.config.get<string>('RABBITMQ_MGMT_PASS', 'campusops_mq');
    this.mgmtUrl = url;
    this.auth = 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
  }

  /** Tüm queue istatistikleri */
  async getQueueStats(): Promise<QueueStats[]> {
    try {
      const res = await fetch(`${this.mgmtUrl}/api/queues/%2F`, {
        headers: { Authorization: this.auth },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const queues: any[] = await res.json();
      return queues.map((q) => ({
        name:          q.name,
        messages:      q.messages ?? 0,
        messagesReady: q.messages_ready ?? 0,
        messagesUnacked: q.messages_unacknowledged ?? 0,
        consumers:     q.consumers ?? 0,
        publishRate:   q.message_stats?.publish_details?.rate ?? 0,
        deliverRate:   q.message_stats?.deliver_details?.rate ?? 0,
      }));
    } catch (err: any) {
      this.logger.warn(`Queue stats unavailable: ${err.message}`);
      return [];
    }
  }

  /** Dead letter queue istatistiği */
  async getDlqStats(): Promise<{ count: number; messages: DlqMessage[] }> {
    try {
      const res = await fetch(
        `${this.mgmtUrl}/api/queues/%2F/q.deadletter/get`,
        {
          method: 'POST',
          headers: {
            Authorization: this.auth,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ count: 20, ackmode: 'ack_requeue_true', encoding: 'auto' }),
          signal: AbortSignal.timeout(5000),
        },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const messages: any[] = await res.json();
      return {
        count: messages.length,
        messages: messages.map((m) => ({
          routingKey:    m.routing_key,
          payload:       m.payload,
          deathReason:   m.properties?.headers?.['x-death']?.[0]?.reason ?? 'unknown',
          originalQueue: m.properties?.headers?.['x-death']?.[0]?.queue ?? 'unknown',
          timestamp:     m.properties?.timestamp,
        })),
      };
    } catch (err: any) {
      this.logger.warn(`DLQ stats unavailable: ${err.message}`);
      return { count: 0, messages: [] };
    }
  }

  /** Outbox istatistikleri */
  async getOutboxStats() {
    const [pending, failed, processed] = await Promise.all([
      this.prisma.outboxEvent.count({ where: { status: 'PENDING' } }),
      this.prisma.outboxEvent.count({ where: { status: 'FAILED' } }),
      this.prisma.outboxEvent.count({ where: { status: 'PROCESSED' } }),
    ]);

    const oldestPending = await this.prisma.outboxEvent.findFirst({
      where:   { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      select:  { createdAt: true },
    });

    const failedEvents = failed > 0
      ? await this.prisma.outboxEvent.findMany({
          where:   { status: 'FAILED' },
          orderBy: { createdAt: 'desc' },
          take:    10,
          select:  { id: true, routingKey: true, retryCount: true, lastError: true, createdAt: true },
        })
      : [];

    return {
      pending,
      failed,
      processed,
      oldestPendingAt: oldestPending?.createdAt ?? null,
      recentFailed:    failedEvents,
    };
  }

  /** Tüm monitoring verisi */
  async getFullStatus() {
    const [queues, dlq, outbox] = await Promise.all([
      this.getQueueStats(),
      this.getDlqStats(),
      this.getOutboxStats(),
    ]);

    return {
      timestamp: new Date().toISOString(),
      queues,
      dlq,
      outbox,
    };
  }
}

export interface QueueStats {
  name:            string;
  messages:        number;
  messagesReady:   number;
  messagesUnacked: number;
  consumers:       number;
  publishRate:     number;
  deliverRate:     number;
}

export interface DlqMessage {
  routingKey:    string;
  payload:       string;
  deathReason:   string;
  originalQueue: string;
  timestamp:     number;
}
