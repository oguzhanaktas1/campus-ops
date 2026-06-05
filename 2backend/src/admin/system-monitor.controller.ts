import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RabbitmqMonitorService } from '../infrastructure/rabbitmq/rabbitmq-monitor.service';
import { OutboxProcessorService } from '../infrastructure/rabbitmq/outbox-processor.service';
import { PrismaService } from '../core/prisma/prisma.service';
import { RabbitmqPublisher } from '../infrastructure/rabbitmq/rabbitmq.publisher';
import { AiClientService } from '../modules/ai/ai-client.service';

/**
 * System Monitoring — admin yetkisiyle erişilir.
 *
 * Local:  http://localhost:5000/admin/system/...
 * Prod:   https://yourdomain.com/api/admin/system/...   (nginx → backend:5000)
 *
 * Env değişkenleri:
 *   PUBLIC_API_URL        public backend URL'i  (ör: https://api.yourdomain.com)
 *   RABBITMQ_MGMT_PUBLIC  tarayıcıdan erişilecek RabbitMQ UI (ör: https://mq.yourdomain.com)
 *   WORKERS_INTERNAL_URL  iç ağ worker URL       varsayılan: http://localhost:8001
 *   METRICS_INTERNAL_URL  iç ağ metrics URL      varsayılan: http://localhost:8000
 */
@Controller('admin/system')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class SystemMonitorController {
  private readonly workersUrl: string;
  private readonly metricsUrl: string;

  private readonly publicApiUrl: string;
  private readonly rabbitmqMgmtPublic: string;

  constructor(
    private readonly mqMonitor: RabbitmqMonitorService,
    private readonly outboxProcessor: OutboxProcessorService,
    private readonly prisma: PrismaService,
    private readonly mqPublisher: RabbitmqPublisher,
    private readonly aiClientService: AiClientService,
  ) {
    this.workersUrl      = process.env.WORKERS_INTERNAL_URL ?? 'http://localhost:8001';
    this.metricsUrl      = process.env.METRICS_INTERNAL_URL ?? 'http://localhost:8000';
    this.publicApiUrl    = process.env.PUBLIC_API_URL        ?? 'http://localhost:5000';
    this.rabbitmqMgmtPublic = process.env.RABBITMQ_MGMT_PUBLIC ?? process.env.RABBITMQ_MGMT_URL ?? 'http://localhost:15672';
  }

  // ── NestJS health ────────────────────────────────────────────────────────

  @Get('backend/health')
  backendHealth() {
    return { status: 'ok', service: 'backend', timestamp: new Date().toISOString() };
  }

  @Get('backend/ready')
  async backendReady() {
    const checks: Record<string, boolean> = {};
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = true;
    } catch { checks.database = false; }
    checks.rabbitmq = this.mqPublisher.isConnected();
    const allReady = Object.values(checks).every(Boolean);
    return { status: allReady ? 'ready' : 'not_ready', checks, service: 'backend', timestamp: new Date().toISOString() };
  }

  // ── Python workers proxy ─────────────────────────────────────────────────

  @Get('workers/health')
  async workersHealth() {
    return this._proxy(`${this.workersUrl}/health`, 'workers');
  }

  @Get('workers/ready')
  async workersReady() {
    return this._proxy(`${this.workersUrl}/ready`, 'workers');
  }

  @Get('workers/metrics/raw')
  async workersMetricsRaw() {
    return this._proxyText(`${this.metricsUrl}/metrics`);
  }

  @Get('ai/health')
  async aiHealth() {
    const payload = await this.aiClientService.getHealth();
    return {
      ...payload,
      service: 'ai-service',
      timestamp: new Date().toISOString(),
    };
  }

  // ── Queue & outbox ───────────────────────────────────────────────────────

  @Get('rabbitmq/queues')
  getRabbitmqQueues() { return this.mqMonitor.getQueueStats(); }

  @Get('rabbitmq/dlq')
  getRabbitmqDlq() { return this.mqMonitor.getDlqStats(); }

  @Get('outbox/stats')
  getOutboxStats() { return this.mqMonitor.getOutboxStats(); }

  // ── Full snapshot ────────────────────────────────────────────────────────

  /** Tek çağrıda tüm monitoring verisi */
  @Get('snapshot')
  async getSnapshot() {
    const [backend, workers, ai, rabbitmq, outbox] = await Promise.allSettled([
      this.backendReady(),
      this._proxy(`${this.workersUrl}/ready`, 'workers'),
      this.aiHealth(),
      this.mqMonitor.getFullStatus(),
      this.mqMonitor.getOutboxStats(),
    ]);

    return {
      timestamp: new Date().toISOString(),
      backend:   backend.status  === 'fulfilled' ? backend.value  : { status: 'error', error: (backend  as any).reason?.message },
      workers:   workers.status  === 'fulfilled' ? workers.value  : { status: 'error', error: (workers  as any).reason?.message },
      ai:        ai.status       === 'fulfilled' ? ai.value       : { status: 'error', error: (ai as any).reason?.message },
      rabbitmq:  rabbitmq.status === 'fulfilled' ? rabbitmq.value : { status: 'error', error: (rabbitmq as any).reason?.message },
      outbox:    outbox.status   === 'fulfilled' ? outbox.value   : { status: 'error', error: (outbox   as any).reason?.message },
      urls: {
        backendHealth:  `${this.publicApiUrl}/health`,
        backendReady:   `${this.publicApiUrl}/ready`,
        workersHealth:  `${this.publicApiUrl}/admin/system/workers/health`,
        workersReady:   `${this.publicApiUrl}/admin/system/workers/ready`,
        aiHealth:       `${this.publicApiUrl}/admin/system/ai/health`,
        metrics:        `${this.publicApiUrl}/admin/system/workers/metrics/raw`,
        rabbitmqMgmt:   this.rabbitmqMgmtPublic,
        prometheus:     `${this.publicApiUrl}/admin/system/workers/metrics/raw`,
      },
    };
  }

  // ── Yardımcılar ──────────────────────────────────────────────────────────

  private async _proxy(url: string, service: string): Promise<any> {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      const json = await res.json();
      return { ...json, service };
    } catch (err: any) {
      return { status: 'unreachable', service, error: err?.message ?? 'timeout' };
    }
  }

  private async _proxyText(url: string): Promise<{ content: string }> {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      const text = await res.text();
      return { content: text };
    } catch {
      return { content: '# metrics endpoint unreachable' };
    }
  }
}
