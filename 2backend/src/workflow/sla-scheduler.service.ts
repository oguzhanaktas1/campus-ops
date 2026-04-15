import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { SlaService } from './sla.service';

const SLA_SWEEP_INTERVAL_MS = 5 * 60 * 1000;
// DB bağlantı havuzunun stabilize olması için bekleme süresi (ms)
const STARTUP_DELAY_MS = 5_000;
// Geçici bağlantı hatalarında tekrar deneme sayısı
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 3_000;

// Prisma'nın geçici bağlantı/transaction hatalarını tanımlar
const isTransientError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  const msg = error.message;
  return (
    msg.includes('Transaction not found') ||
    msg.includes('Transaction API error') ||
    msg.includes("Can't reach database") ||
    msg.includes('Connection refused') ||
    msg.includes('P1001') ||
    msg.includes('P1008') ||
    msg.includes('P1017')
  );
};

@Injectable()
export class SlaSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SlaSchedulerService.name);
  private intervalRef: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(private readonly slaService: SlaService) {}

  onModuleInit() {
    // Startup sweep'i geciktir — DB bağlantısının tam oturmasını bekle
    setTimeout(() => {
      void this.runSweep('startup');
    }, STARTUP_DELAY_MS);

    this.intervalRef = setInterval(() => {
      void this.runSweep('interval');
    }, SLA_SWEEP_INTERVAL_MS);

    this.logger.log(
      `SLA scheduler started. Startup sweep in ${STARTUP_DELAY_MS / 1000}s, interval: 5 minutes.`,
    );
  }

  onModuleDestroy() {
    if (this.intervalRef) {
      clearInterval(this.intervalRef);
      this.intervalRef = null;
    }
  }

  private async runSweep(trigger: 'startup' | 'interval') {
    if (this.isRunning) {
      this.logger.warn(
        `Skipping SLA sweep (${trigger}) because a previous run is still active.`,
      );
      return;
    }

    this.isRunning = true;
    const startedAt = Date.now();

    try {
      await this.runWithRetry(trigger);
      const elapsedMs = Date.now() - startedAt;
      this.logger.log(
        `SLA sweep completed via ${trigger} trigger in ${elapsedMs}ms.`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown SLA sweep error.';
      this.logger.error(`SLA sweep failed via ${trigger}: ${message}`);
    } finally {
      this.isRunning = false;
    }
  }

  private async runWithRetry(trigger: string): Promise<void> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        await this.slaService.runSlaSweep();
        return;
      } catch (error) {
        lastError = error;

        if (!isTransientError(error) || attempt === MAX_RETRIES) {
          throw error;
        }

        this.logger.warn(
          `SLA sweep attempt ${attempt}/${MAX_RETRIES} failed (${trigger}): ${
            error instanceof Error ? error.message : String(error)
          } — retrying in ${RETRY_DELAY_MS / 1000}s...`,
        );

        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }

    throw lastError;
  }
}
