import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { SlaService } from './sla.service';

const SLA_SWEEP_INTERVAL_MS = 5 * 60 * 1000;

@Injectable()
export class SlaSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SlaSchedulerService.name);
  private intervalRef: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(private readonly slaService: SlaService) {}

  onModuleInit() {
    void this.runSweep('startup');

    this.intervalRef = setInterval(() => {
      void this.runSweep('interval');
    }, SLA_SWEEP_INTERVAL_MS);

    this.logger.log('SLA scheduler started. Sweep interval: 5 minutes.');
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
      await this.slaService.runSlaSweep();
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
}
