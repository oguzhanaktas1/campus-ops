import { Injectable } from '@nestjs/common';

const FORBIDDEN_KEYWORDS = [
  'insert', 'update', 'delete', 'drop', 'alter', 'truncate',
  'create', 'grant', 'revoke', 'execute', 'copy', 'pg_sleep',
  'pg_read_file', 'pg_write_file', 'lo_import', 'lo_export',
  '--', '/*',
];

export const AI_SAFE_VIEWS = [
  'ai_requests_view',
  'ai_tickets_view',
  'ai_approvals_view',
  'ai_dashboard_view',
  'ai_users_limited_view',
] as const;

export type AiSafeView = (typeof AI_SAFE_VIEWS)[number];

@Injectable()
export class SqlValidatorService {
  validate(sql: string): void {
    const lowered = sql.toLowerCase().trim();

    if (!lowered.startsWith('select')) {
      throw new Error('Only SELECT queries are allowed');
    }

    for (const keyword of FORBIDDEN_KEYWORDS) {
      if (lowered.includes(keyword)) {
        throw new Error(`Forbidden SQL keyword: ${keyword}`);
      }
    }

    const usesAllowedView = AI_SAFE_VIEWS.some((view) => lowered.includes(view));
    if (!usesAllowedView) {
      throw new Error('Query must reference at least one AI-safe view');
    }
  }

  isValid(sql: string): boolean {
    try {
      this.validate(sql);
      return true;
    } catch {
      return false;
    }
  }
}
