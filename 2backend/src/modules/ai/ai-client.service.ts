import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OLLAMA_URL } from './ai.constants';

type JsonRecord = Record<string, unknown>;

@Injectable()
export class AiClientService {
  private readonly logger = new Logger(AiClientService.name);

  constructor(private readonly configService: ConfigService) {}

  isEnabled(): boolean {
    return this.configService.get<string>('AI_SERVICE_ENABLED', 'false') === 'true';
  }

  getRuntimeTarget(): string {
    return this.configService.get<string>('OLLAMA_URL', OLLAMA_URL);
  }

  async getHealth(): Promise<JsonRecord> {
    if (!this.isEnabled()) {
      return {
        status: 'disabled',
        enabled: false,
      };
    }

    return this.request('health', '/health', {
      method: 'GET',
      fallback: {
        status: 'unavailable',
        enabled: true,
      },
    });
  }

  async post<TResponse extends JsonRecord>(
    path: string,
    body: JsonRecord,
    fallback: TResponse,
  ): Promise<TResponse> {
    if (!this.isEnabled()) {
      return fallback;
    }

    return this.request<TResponse>('post', path, {
      method: 'POST',
      body,
      fallback,
    });
  }

  private async request<TResponse extends JsonRecord>(
    action: string,
    path: string,
    options: {
      method: 'GET' | 'POST';
      body?: JsonRecord;
      fallback: TResponse;
    },
  ): Promise<TResponse> {
    const baseUrl = this.configService.get<string>(
      'AI_SERVICE_BASE_URL',
      'http://localhost:8010',
    );
    const apiKey = this.configService.get<string>(
      'AI_SERVICE_API_KEY',
      'campusops-ai-internal-dev-key',
    );
    const timeoutMs = this.resolveTimeoutMs(path);

    try {
      const response = await fetch(`${baseUrl}${path}`, {
        method: options.method,
        headers: {
          'Content-Type': 'application/json',
          'x-ai-service-key': apiKey,
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        throw new ServiceUnavailableException(
          `AI service ${action} failed with status ${response.status}`,
        );
      }

      return (await response.json()) as TResponse;
    } catch (error) {
      this.logger.warn(
        `AI service ${action} ${path} failed after ${timeoutMs}ms: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      return options.fallback;
    }
  }

  private resolveTimeoutMs(path: string): number {
    const defaultTimeoutMs = Number(
      this.configService.get<string>('AI_SERVICE_TIMEOUT_MS', '120000'),
    );

    const timeoutKeyByPath: Record<string, string> = {
      '/analytics/summary': 'AI_SERVICE_ANALYTICS_TIMEOUT_MS',
      '/assistant/ask': 'AI_SERVICE_ASSISTANT_TIMEOUT_MS',
      '/summary/approval': 'AI_SERVICE_SUMMARY_TIMEOUT_MS',
      '/parse/request': 'AI_SERVICE_PARSE_TIMEOUT_MS',
      '/triage/ticket': 'AI_SERVICE_TRIAGE_TIMEOUT_MS',
      '/health': 'AI_SERVICE_HEALTH_TIMEOUT_MS',
    };

    const defaultByPath: Record<string, string> = {
      '/analytics/summary': '120000',
      '/assistant/ask': '120000',
      '/summary/approval': '120000',
      '/parse/request': '120000',
      '/triage/ticket': '120000',
      '/health': '120000',
    };

    const timeoutKey = timeoutKeyByPath[path];
    if (!timeoutKey) {
      return defaultTimeoutMs;
    }

    const resolved = Number(
      this.configService.get<string>(
        timeoutKey,
        defaultByPath[path] ?? String(defaultTimeoutMs),
      ),
    );

    if (Number.isFinite(resolved) && resolved > 0) {
      return resolved;
    }

    return defaultTimeoutMs;
  }
}
