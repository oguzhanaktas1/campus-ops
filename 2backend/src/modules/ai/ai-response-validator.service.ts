import { Injectable, Logger } from '@nestjs/common';

type JsonRecord = Record<string, unknown>;

const SENSITIVE_PATTERNS = [
  /password\s*[:=]/i,
  /bearer\s+[a-z0-9\-._~+/]+=*/i,
  /api[_-]?key\s*[:=]/i,
  /secret\s*[:=]/i,
  /private[_-]?key/i,
  /authorization:\s*bearer/i,
];

@Injectable()
export class AiResponseValidatorService {
  private readonly logger = new Logger(AiResponseValidatorService.name);

  validateAssistantResponse(response: JsonRecord): JsonRecord {
    const answer = response.answer;

    if (typeof answer !== 'string' || answer.trim().length === 0) {
      this.logger.warn('AI response missing or empty answer field');
      return { ...response, answer: 'Yanıt üretilemedi.', validationFailed: true };
    }

    if (this.containsSensitiveData(answer)) {
      this.logger.warn('AI response flagged for sensitive content, sanitized');
      return {
        ...response,
        answer: 'Bu bilgi güvenlik kısıtlamaları nedeniyle gösterilemiyor.',
        validationFailed: true,
      };
    }

    return response;
  }

  validateJsonFields(response: JsonRecord, required: string[]): { valid: boolean; missing: string[] } {
    const missing = required.filter((field) => !(field in response) || response[field] === null);
    return { valid: missing.length === 0, missing };
  }

  sanitizeConfidence(value: unknown): number {
    const num = Number(value);
    if (Number.isFinite(num) && num >= 0 && num <= 1) return num;
    return 0.5;
  }

  sanitizeStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === 'string');
  }

  private containsSensitiveData(text: string): boolean {
    return SENSITIVE_PATTERNS.some((pattern) => pattern.test(text));
  }
}
