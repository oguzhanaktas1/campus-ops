import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { PrismaService } from './core/prisma/prisma.service';
import { RabbitmqPublisher } from './infrastructure/rabbitmq/rabbitmq.publisher';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
    private readonly mqPublisher: RabbitmqPublisher,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /** GET /health — liveness probe */
  @Get('health')
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  /** GET /ready — readiness probe (DB + RabbitMQ bağlantısı) */
  @Get('ready')
  async ready() {
    const checks: Record<string, boolean> = {};

    // DB check
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = true;
    } catch {
      checks.database = false;
    }

    // RabbitMQ check — publisher bağlı mı?
    checks.rabbitmq = (this.mqPublisher as any).channel !== null;

    const allReady = Object.values(checks).every(Boolean);
    return {
      status:    allReady ? 'ready' : 'not_ready',
      checks,
      timestamp: new Date().toISOString(),
    };
  }
}
