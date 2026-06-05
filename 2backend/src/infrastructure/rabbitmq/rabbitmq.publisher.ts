/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import { EXCHANGE, QUEUE_BINDINGS, Queues } from './routing-keys';
import type { AnyEventPayload } from './event-payloads';
import { randomUUID } from 'crypto';

@Injectable()
export class RabbitmqPublisher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitmqPublisher.name);
  // any kullanıyoruz — amqplib v1.x ile ChannelModel/Connection tip uyuşmazlığı
  private connection: any = null;
  private channel: any = null;
  private readonly url: string;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly config: ConfigService) {
    this.url = this.config.get<string>('RABBITMQ_URL', 'amqp://guest:guest@localhost:5672');
  }

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.close();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Connection
  // ─────────────────────────────────────────────────────────────────────────

  private async connect() {
    try {
      this.connection = await amqp.connect(this.url);
      this.channel    = await this.connection.createChannel();

      this.connection.on('error', (err: any) => {
        this.logger.error('RabbitMQ connection error', err?.message);
        this.scheduleReconnect();
      });
      this.connection.on('close', () => {
        this.logger.warn('RabbitMQ connection closed — reconnecting...');
        this.scheduleReconnect();
      });

      await this.setupTopology();
      this.logger.log(`✓ RabbitMQ connected — exchange: ${EXCHANGE}`);
    } catch (err: any) {
      this.logger.warn(`RabbitMQ unavailable (${err?.message}) — will retry in 10s`);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(delayMs = 10_000) {
    this.connection = null;
    this.channel    = null;
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      await this.connect();
    }, delayMs);
  }

  private async close() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    try { await this.channel?.close(); }    catch { /* already closed */ }
    try { await this.connection?.close(); } catch { /* already closed */ }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Topology
  // ─────────────────────────────────────────────────────────────────────────

  private async setupTopology() {
    const ch = this.channel;

    await ch.assertExchange(EXCHANGE, 'topic', { durable: true });
    await ch.assertQueue(Queues.DEADLETTER, { durable: true });

    for (const [queueName, patterns] of Object.entries(QUEUE_BINDINGS)) {
      await ch.assertQueue(queueName, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange':   '',
          'x-dead-letter-routing-key': Queues.DEADLETTER,
          'x-message-ttl': 7 * 24 * 60 * 60 * 1000,
        },
      });
      for (const pattern of patterns as string[]) {
        await ch.bindQueue(queueName, EXCHANGE, pattern);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Publish
  // ─────────────────────────────────────────────────────────────────────────

  isConnected(): boolean {
    return this.channel !== null;
  }

  publish(payload: AnyEventPayload): void {
    if (!this.channel) {
      this.logger.warn(`RabbitMQ not ready — skipping event: ${payload.event}`);
      return;
    }

    const enriched: AnyEventPayload = {
      ...payload,
      correlationId: (payload as any).correlationId ?? randomUUID(),
      occurredAt:    payload.occurredAt ?? new Date().toISOString(),
    };

    try {
      const buffer = Buffer.from(JSON.stringify(enriched));
      this.channel.publish(EXCHANGE, payload.event, buffer, {
        persistent:  true,
        contentType: 'application/json',
        messageId:   (enriched as any).correlationId,
        timestamp:   Math.floor(Date.now() / 1000),
      });
      this.logger.debug(`→ [${payload.event}] published`);
    } catch (err: any) {
      this.logger.error(`Failed to publish [${payload.event}]: ${err?.message}`);
    }
  }
}
