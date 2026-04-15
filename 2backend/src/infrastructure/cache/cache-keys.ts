import { createHash } from 'crypto';

type JsonLike =
  | string
  | number
  | boolean
  | null
  | JsonLike[]
  | { [key: string]: JsonLike };

function normalize(value: unknown): JsonLike {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalize(item));
  }

  if (typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, JsonLike>>((acc, key) => {
        acc[key] = normalize((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  return String(value);
}

function stableStringify(input: unknown): string {
  return JSON.stringify(normalize(input));
}

export function makeCacheHash(input: unknown): string {
  return createHash('sha1')
    .update(stableStringify(input))
    .digest('hex')
    .slice(0, 12);
}

export function getPortalFromRoles(roles: string[]): string {
  if (roles.includes('ADMIN')) return 'admin';
  if (roles.includes('STAFF')) return 'staff';
  if (roles.includes('FACULTY')) return 'faculty';
  return 'student';
}

export const cacheKeys = {
  admin: {
    dashboard: () => 'admin:dashboard:summary',
    requestsList: (filters: unknown) =>
      `admin:requests:list:${makeCacheHash(filters)}`,
  },
  faculty: {
    approvalsList: (userId: string, filters: unknown) =>
      `faculty:approvals:list:${userId}:${makeCacheHash(filters)}`,
    approvalsSummary: (userId: string) => `faculty:approvals:summary:${userId}`,
  },
  requests: {
    detailBase: (portal: string, requestId: string, userId: string) =>
      `request:detail:${portal}:${requestId}:${userId}`,
  },
  notifications: {
    unreadCount: (userId: string) => `notifications:unread:${userId}`,
  },
  reference: {
    resources: (filters: unknown) =>
      `reference:resources:${makeCacheHash(filters)}`,
  },
  resources: {
    availabilityWindow: (resourceId: string) =>
      `resource:availability:${resourceId}:window:30d`,
  },
};

export const CacheKeys = {
  version: (scope: string) => scope,
  adminDashboardSummary: (version: number) =>
    `${cacheKeys.admin.dashboard()}:v${version}`,
  adminWorkflowsList: (requestVersion: number, workflowVersion: number) =>
    `admin:workflows:list:reqv${requestVersion}:wfv${workflowVersion}`,
  adminWorkflowDetail: (
    workflowId: string,
    requestVersion: number,
    workflowVersion: number,
  ) => `admin:workflow:detail:${workflowId}:reqv${requestVersion}:wfv${workflowVersion}`,
  adminWorkflowInstancesOverview: (
    requestVersion: number,
    workflowVersion: number,
  ) => `admin:workflow-instances:overview:reqv${requestVersion}:wfv${workflowVersion}`,
  adminSlaPolicies: (version: number) => `admin:sla:policies:v${version}`,
  adminSlaOverview: (requestVersion: number, slaVersion: number) =>
    `admin:sla:overview:reqv${requestVersion}:slav${slaVersion}`,
  adminRequestsList: (filterHash: string, version: number) =>
    `admin:requests:list:${filterHash}:v${version}`,
  facultyApprovalsList: (userId: string, filterHash: string, version: number) =>
    `faculty:approvals:list:${userId}:${filterHash}:v${version}`,
  staffTicketsList: (filterHash: string, version: number) =>
    `staff:tickets:list:${filterHash}:v${version}`,
  requestDetail: (
    portal: string,
    requestId: string,
    userId: string,
    version: number,
  ) => `${cacheKeys.requests.detailBase(portal, requestId, userId)}:v${version}`,
  notificationsUnread: (userId: string) =>
    cacheKeys.notifications.unreadCount(userId),
  referenceResources: (filterHash: string, version: number) =>
    `reference:resources:${filterHash}:v${version}`,
  resourceAvailabilityWindow: (resourceId: string) =>
    cacheKeys.resources.availabilityWindow(resourceId),
};

export const CacheTtls = {
  short: 15,
  medium: 45,
  long: 60 * 15,
  reference: 60 * 5,
  notifications: 60,
  workflowOverview: 20,
  sla: 30,
};
