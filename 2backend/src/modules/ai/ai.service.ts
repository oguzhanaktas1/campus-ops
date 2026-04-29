import { Injectable } from '@nestjs/common';
import { TicketStatus } from '@prisma/client';

import type { JwtUser } from '../../auth/jwt.strategy';
import { PrismaService } from '../../core/prisma/prisma.service';
import { AiClientService } from './ai-client.service';
import { AiResponseValidatorService } from './ai-response-validator.service';
import { AnalyticsSummaryDto } from './dto/analytics-summary.dto';
import { AssistantAskDto } from './dto/assistant-ask.dto';
import { ParseRequestDto } from './dto/parse-request.dto';
import { SimilarTicketDto } from './dto/similar-ticket.dto';
import { SummaryApprovalDto } from './dto/summary-approval.dto';
import { TriageTicketDto } from './dto/triage-ticket.dto';

type JsonRecord = Record<string, unknown>;

type RouteDetail = {
  href: string;
  label: string;
  description: string;
  keywords: string[];
};

const SYSTEM_ASSISTANT_CONTEXT =
  'CampusOps is a multi-portal campus operations platform. It includes request workflows, approvals, documents, reservations, appointments, events, access requests, IT tickets, procurement, analytics, users, roles, permissions, workflows, integrations, monitoring, reports, and audit logs. The assistant must help only within the current user role, sub-roles, and visible scope.';

const PORTAL_CONTEXT_MAP: Record<string, string> = {
  student:
    'Student portal covers personal requests, internship applications, document requests, reservations, appointments, events, files, notifications, and access requests. Student answers should stay within the student user’s own scope.',
  faculty:
    'Faculty portal covers approvals, internships, appointments, faculty-visible requests, documents, reservations, IT tickets, notifications, and access requests. Faculty answers should focus on faculty workflows and visible approval scope.',
  staff:
    'Staff portal covers operational queues such as IT tickets, approvals, documents, reservations, procurement, events, inbox, reports, and access requests. Staff answers should respect any staff sub-role restrictions.',
  admin:
    'Admin portal covers users, roles, permissions, requests, request types, workflows, workflow instances, resources, SLA policies, monitoring, integrations, webhook logs, system events, audit logs, analytics, and reports. Admin answers can reference platform administration pages that are explicitly authorized.',
  organizer:
    'Organizer portal covers event plans, published events, reservations, equipment, procurement, notifications, settings, and access requests. Organizer answers should stay inside organizer operations.',
};

const PORTAL_ROUTE_MAP: Record<string, RouteDetail[]> = {
  student: [
    { href: '/student/dashboard', label: 'Student Dashboard', description: 'Overview of student activity and shortcuts.', keywords: ['dashboard', 'overview', 'home'] },
    { href: '/student/internships', label: 'Internships', description: 'Track internship requests and applications.', keywords: ['internship', 'staj'] },
    { href: '/student/internships/new', label: 'New Internship Application', description: 'Start a new internship-related request.', keywords: ['new internship', 'apply internship', 'staj başvurusu'] },
    { href: '/student/reservations', label: 'Reservations', description: 'View room or resource reservations.', keywords: ['reservation', 'rezervasyon', 'booking'] },
    { href: '/student/reservations/new', label: 'New Reservation', description: 'Create a new reservation request.', keywords: ['new reservation', 'reserve room', 'oda rezervasyon'] },
    { href: '/student/appointments', label: 'Appointments', description: 'See and manage appointment requests.', keywords: ['appointment', 'randevu', 'meeting'] },
    { href: '/student/appointments/new', label: 'New Appointment', description: 'Create a new appointment request.', keywords: ['new appointment', 'book appointment', 'randevu al'] },
    { href: '/student/documents', label: 'Documents', description: 'View and request student documents.', keywords: ['document', 'documents', 'belge'] },
    { href: '/student/documents/new', label: 'New Document Request', description: 'Start a document request.', keywords: ['new document', 'document request', 'belge talebi'] },
    { href: '/student/access-requests', label: 'Access Requests', description: 'Track access-related permissions and requests.', keywords: ['access', 'permission', 'erişim', 'izin'] },
    { href: '/student/access-requests/new', label: 'New Access Request', description: 'Submit a new access request.', keywords: ['new access request', 'erişim talebi'] },
    { href: '/student/events', label: 'Events', description: 'Browse student-facing campus events.', keywords: ['event', 'events', 'etkinlik'] },
    { href: '/student/events/new', label: 'New Event Request', description: 'Create an event-related request if permitted.', keywords: ['new event', 'event request', 'etkinlik oluştur'] },
  ],
  faculty: [
    { href: '/faculty/dashboard', label: 'Faculty Dashboard', description: 'Faculty overview page.', keywords: ['dashboard', 'overview', 'home'] },
    { href: '/faculty/approvals', label: 'Approvals', description: 'Review and decide pending approvals.', keywords: ['approval', 'approvals', 'onay'] },
    { href: '/faculty/internships', label: 'Internships', description: 'Manage internship-related faculty tasks.', keywords: ['internship', 'staj'] },
    { href: '/faculty/appointments', label: 'Appointments', description: 'Manage faculty appointment flows.', keywords: ['appointment', 'randevu', 'meeting'] },
    { href: '/faculty/requests', label: 'Requests', description: 'Browse faculty-visible requests.', keywords: ['request', 'requests', 'talep'] },
    { href: '/faculty/tickets', label: 'IT Tickets', description: 'Follow faculty IT tickets.', keywords: ['ticket', 'tickets', 'it support'] },
    { href: '/faculty/documents', label: 'Documents', description: 'Faculty document-related workflows.', keywords: ['document', 'documents', 'belge'] },
    { href: '/faculty/reservations', label: 'Reservations', description: 'Faculty reservation pages.', keywords: ['reservation', 'rezervasyon'] },
    { href: '/faculty/access-requests', label: 'Access Requests', description: 'Access and permission requests.', keywords: ['access', 'permission', 'erişim', 'izin'] },
  ],
  staff: [
    { href: '/staff/dashboard', label: 'Staff Dashboard', description: 'Operations overview page.', keywords: ['dashboard', 'overview', 'home'] },
    { href: '/staff/tickets', label: 'IT Tickets', description: 'Open and process support tickets.', keywords: ['ticket', 'tickets', 'it', 'support'] },
    { href: '/staff/approvals', label: 'Approvals', description: 'Process approval work queues.', keywords: ['approval', 'approvals', 'onay'] },
    { href: '/staff/documents', label: 'Documents', description: 'Handle document workflows.', keywords: ['document', 'documents', 'belge'] },
    { href: '/staff/reservations', label: 'Reservations', description: 'Manage reservations and allocations.', keywords: ['reservation', 'rezervasyon'] },
    { href: '/staff/access-requests', label: 'Access Requests', description: 'Process access-related requests.', keywords: ['access', 'permission', 'erişim', 'izin'] },
    { href: '/staff/procurement', label: 'Procurement', description: 'Procurement operations and requests.', keywords: ['procurement', 'purchase', 'satın alma'] },
    { href: '/staff/events', label: 'Events', description: 'Staff event operations pages.', keywords: ['event', 'events', 'etkinlik'] },
  ],
  admin: [
    { href: '/admin/dashboard', label: 'Admin Dashboard', description: 'Platform-wide overview and shortcuts.', keywords: ['dashboard', 'overview', 'home'] },
    { href: '/admin/users', label: 'Users', description: 'View and edit user accounts.', keywords: ['user', 'users', 'kullanıcı', 'kullanıcılar', 'edit user', 'manage users'] },
    { href: '/admin/roles', label: 'Roles', description: 'Manage system roles.', keywords: ['role', 'roles', 'rol', 'roller'] },
    { href: '/admin/permissions', label: 'Permissions', description: 'Manage permission definitions.', keywords: ['permission', 'permissions', 'yetki', 'izinler'] },
    { href: '/admin/analytics', label: 'Analytics', description: 'Platform analytics and charts.', keywords: ['analytics', 'analitik', 'istatistik'] },
    { href: '/admin/webhook-logs', label: 'Webhook Logs', description: 'Inspect webhook delivery logs.', keywords: ['webhook', 'webhook logs'] },
    { href: '/admin/workflows', label: 'Workflows', description: 'Manage workflow definitions.', keywords: ['workflow', 'workflows', 'iş akışı', 'onay akışı'] },
    { href: '/admin/requests', label: 'Requests', description: 'View and manage all requests.', keywords: ['request', 'requests', 'talep', 'talepler'] },
    { href: '/admin/request-types', label: 'Request Types', description: 'Configure request type definitions.', keywords: ['request type', 'request types', 'talep tipi'] },
    { href: '/admin/system-events', label: 'System Events', description: 'Inspect platform event records.', keywords: ['system event', 'system events', 'sistem olayları'] },
    { href: '/admin/audit-logs', label: 'Audit Logs', description: 'Review audit trail records.', keywords: ['audit', 'audit logs', 'denetim'] },
    { href: '/admin/integrations', label: 'Integrations', description: 'Manage third-party integrations.', keywords: ['integration', 'integrations', 'entegrasyon'] },
    { href: '/admin/sla', label: 'SLA Policies', description: 'Configure SLA rules and policies.', keywords: ['sla', 'policy', 'policies'] },
    { href: '/admin/reports', label: 'Reports', description: 'View generated reports.', keywords: ['report', 'reports', 'rapor'] },
  ],
  organizer: [
    { href: '/organizer/dashboard', label: 'Organizer Dashboard', description: 'Organizer overview and shortcuts.', keywords: ['dashboard', 'overview', 'home'] },
    { href: '/organizer/events', label: 'Events', description: 'Manage published events.', keywords: ['event', 'events', 'etkinlik'] },
    { href: '/organizer/reservations', label: 'Reservations', description: 'Handle organizer reservations.', keywords: ['reservation', 'rezervasyon'] },
    { href: '/organizer/equipment', label: 'Equipment', description: 'Manage equipment requests and allocations.', keywords: ['equipment', 'ekipman'] },
    { href: '/organizer/access-requests', label: 'Access Requests', description: 'Follow access requests.', keywords: ['access', 'permission', 'erişim', 'izin'] },
    { href: '/organizer/procurement', label: 'Procurement', description: 'Procurement requests for events.', keywords: ['procurement', 'satın alma'] },
    { href: '/organizer/plans', label: 'Event Plans', description: 'Create and manage event plans.', keywords: ['plan', 'plans', 'event plan', 'etkinlik planı'] },
  ],
};

const REQUEST_TYPE_MAP: Record<string, string[]> = {
  student: ['DOCUMENT', 'RESERVATION', 'APPOINTMENT', 'INTERNSHIP', 'ACCESS_REQUEST', 'EVENT'],
  faculty: ['INTERNSHIP', 'APPOINTMENT', 'DOCUMENT', 'ACCESS_REQUEST', 'IT_TICKET'],
  staff: ['IT_TICKET', 'DOCUMENT', 'RESERVATION', 'PROCUREMENT', 'ACCESS_REQUEST'],
  admin: ['ALL'],
  organizer: ['EVENT', 'RESERVATION', 'PROCUREMENT', 'ACCESS_REQUEST', 'EQUIPMENT'],
};

@Injectable()
export class AiService {
  constructor(
    private readonly aiClientService: AiClientService,
    private readonly prisma: PrismaService,
    private readonly responseValidator: AiResponseValidatorService,
  ) {}

  getHealth(): Promise<JsonRecord> {
    return this.aiClientService.getHealth();
  }

  triageTicket(dto: TriageTicketDto): Promise<JsonRecord> {
    return this.aiClientService.post(
      '/triage/ticket',
      {
        title: dto.title,
        description: dto.description,
        requester_faculty: dto.requesterFaculty ?? null,
        requester_department: dto.requesterDepartment ?? null,
        source_channel: dto.sourceChannel ?? null,
        similar_resolutions: dto.similarResolutions,
      },
      {
        requestType: 'IT_TICKET',
        category: 'General Support',
        priority: 'MEDIUM',
        suggestedUnit: 'IT',
        summary: dto.title,
        missingFields: [],
        confidence: 0.25,
        fallbackUsed: true,
      },
    );
  }

  parseRequest(dto: ParseRequestDto): Promise<JsonRecord> {
    return this.aiClientService.post(
      '/parse/request',
      {
        text: dto.text,
        portal: dto.portal ?? null,
        request_type_candidates: dto.requestTypeCandidates,
      },
      {
        requestType: 'GENERAL_REQUEST',
        title: dto.text.slice(0, 80),
        summary: dto.text.slice(0, 240),
        extractedFields: {},
        missingFields: [],
        confidence: 0.25,
        fallbackUsed: true,
      },
    );
  }

  summarizeApproval(dto: SummaryApprovalDto): Promise<JsonRecord> {
    return this.aiClientService.post(
      '/summary/approval',
      {
        requestTitle: dto.requestTitle,
        requestDescription: dto.requestDescription ?? null,
        domainData: dto.domainData,
        currentWorkflowStep: dto.currentWorkflowStep ?? null,
        previousActions: dto.previousActions,
        commentsSummary: dto.commentsSummary ?? null,
        attachedDocuments: dto.attachedDocuments,
      },
      {
        summary: dto.requestTitle,
        risks: [],
        recommendations: [],
        confidence: 0.25,
        fallbackUsed: true,
      },
    );
  }

  summarizeAnalytics(dto: AnalyticsSummaryDto): Promise<JsonRecord> {
    return this.aiClientService.post(
      '/analytics/summary',
      {
        domain: dto.domain,
        kpis: dto.kpis,
        chartData: dto.chartData,
        trendDeltas: dto.trendDeltas,
        groupedCounts: dto.groupedCounts,
      },
      {
        summary: `${dto.domain} analytics summary is temporarily unavailable.`,
        highlights: [],
        confidence: 0.25,
        fallbackUsed: true,
      },
    );
  }

  async getAdminAnalyticsNarration(): Promise<JsonRecord> {
    const now = new Date();
    const last7Days = new Date(now);
    last7Days.setDate(now.getDate() - 6);
    last7Days.setHours(0, 0, 0, 0);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
      requestTypes,
      departments,
      requests,
      dailyMetrics,
      totalRequests,
      openRequests,
      overdueRequests,
      totalUsers,
      activeUsers,
      totalApproved,
      totalRejected,
      todayRequests,
      openTickets,
      todayReservations,
      todayAppointments,
    ] = await Promise.all([
      this.prisma.request.groupBy({
        by: ['requestTypeId'],
        _count: { requestTypeId: true },
        where: { deletedAt: null },
      }),
      this.prisma.request.groupBy({
        by: ['departmentId'],
        _count: { departmentId: true },
        where: { deletedAt: null, departmentId: { not: null } },
      }),
      this.prisma.request.findMany({
        where: {
          deletedAt: null,
          createdAt: { gte: last7Days },
        },
        select: {
          createdAt: true,
          requestType: { select: { key: true, name: true } },
          department: { select: { name: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.dailyMetric.findMany({
        where: {
          metricDate: { gte: last7Days },
        },
        orderBy: { metricDate: 'asc' },
      }),
      this.prisma.request.count({ where: { deletedAt: null } }),
      this.prisma.request.count({
        where: {
          deletedAt: null,
          status: {
            notIn: [
              'COMPLETED',
              'APPROVED',
              'REJECTED',
              'CANCELLED',
              'CLOSED',
              'EXPIRED',
            ],
          },
        },
      }),
      this.prisma.request.count({
        where: {
          deletedAt: null,
          dueAt: { lt: now },
          status: {
            notIn: [
              'COMPLETED',
              'APPROVED',
              'REJECTED',
              'CANCELLED',
              'CLOSED',
              'EXPIRED',
            ],
          },
        },
      }),
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({
        where: { deletedAt: null, status: 'ACTIVE' },
      }),
      this.prisma.request.count({
        where: { deletedAt: null, status: 'APPROVED' },
      }),
      this.prisma.request.count({
        where: { deletedAt: null, status: 'REJECTED' },
      }),
      this.prisma.request.count({
        where: { deletedAt: null, createdAt: { gte: todayStart } },
      }),
      this.prisma.itTicket.count({
        where: {
          ticketStatus: {
            in: [
              'OPEN',
              'IN_PROGRESS',
              'TRIAGED',
              'WAITING_USER',
              'REOPENED',
            ],
          },
        },
      }),
      this.prisma.reservation.count({ where: { startAt: { gte: todayStart } } }),
      this.prisma.appointment.count({ where: { startAt: { gte: todayStart } } }),
    ]);

    const requestTypeIds = requestTypes.map((entry) => entry.requestTypeId);
    const departmentIds = departments
      .map((entry) => entry.departmentId)
      .filter((value): value is string => Boolean(value));

    const [requestTypeMeta, departmentMeta] = await Promise.all([
      requestTypeIds.length
        ? this.prisma.requestType.findMany({
            where: { id: { in: requestTypeIds } },
            select: { id: true, key: true, name: true },
          })
        : Promise.resolve([]),
      departmentIds.length
        ? this.prisma.department.findMany({
            where: { id: { in: departmentIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
    ]);

    const requestTypeMap = Object.fromEntries(
      requestTypeMeta.map((item) => [item.id, item.name || item.key]),
    );
    const departmentMap = Object.fromEntries(
      departmentMeta.map((item) => [item.id, item.name]),
    );

    const peakHourCounts = new Map<string, number>();
    const trendByDate = new Map<string, number>();

    for (const request of requests) {
      const hourKey = String(request.createdAt.getHours()).padStart(2, '0');
      peakHourCounts.set(hourKey, (peakHourCounts.get(hourKey) ?? 0) + 1);

      const dateKey = request.createdAt.toISOString().slice(0, 10);
      trendByDate.set(dateKey, (trendByDate.get(dateKey) ?? 0) + 1);
    }

    const peakHours = Object.fromEntries(
      Array.from(peakHourCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6),
    );

    const groupedCounts: Record<string, number> = Object.fromEntries(
      requestTypes.map((entry) => [
        requestTypeMap[entry.requestTypeId] ?? entry.requestTypeId,
        entry._count.requestTypeId,
      ]),
    );

    const departmentLoad: Record<string, number> = Object.fromEntries(
      departments.map((entry) => [
        departmentMap[entry.departmentId ?? ''] ?? 'Unassigned',
        entry._count.departmentId,
      ]),
    );

    const todayKey = now.toISOString().slice(0, 10);
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayKey = yesterday.toISOString().slice(0, 10);
    const todayCount = trendByDate.get(todayKey) ?? 0;
    const yesterdayCount = trendByDate.get(yesterdayKey) ?? 0;
    const topRequestType =
      Object.entries(groupedCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const topDepartment =
      Object.entries(departmentLoad).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const totalDecisionCount = totalApproved + totalRejected;
    const approvalRate =
      totalDecisionCount > 0
        ? Math.round((totalApproved / totalDecisionCount) * 100)
        : 0;
    const latestDailyMetric = dailyMetrics[dailyMetrics.length - 1] ?? null;
    const dashboardSnapshot = {
      totalRequests,
      openRequests,
      overdueRequests,
      totalUsers,
      activeUsers,
      approvalRate,
      todayRequests,
      openTickets,
      todayReservations,
      todayAppointments,
    };
    const dailySummary = {
      date: todayKey,
      todayRequests,
      todayReservations,
      todayAppointments,
      openTickets,
      overdueRequests,
      latestDailyMetric: latestDailyMetric
        ? {
            metricDate: latestDailyMetric.metricDate.toISOString(),
            totalCreatedRequests: latestDailyMetric.totalCreatedRequests,
            totalClosedRequests: latestDailyMetric.totalClosedRequests,
          }
        : null,
    };

    return this.summarizeAnalytics({
      domain: 'ADMIN',
      kpis: {
        totalRequests,
        openRequests,
        overdueRequests,
        totalUsers,
        activeUsers,
        approvalRate,
        todayRequests,
        openTickets,
        todayReservations,
        todayAppointments,
        topRequestType,
        topDepartment,
      },
      chartData: {
        dashboardSnapshot,
        dailySummary,
        trendByDate: Object.fromEntries(trendByDate),
        departmentLoad,
        peakHours,
        dailyMetrics: dailyMetrics.map((metric) => ({
          metricDate: metric.metricDate.toISOString(),
          totalCreatedRequests: metric.totalCreatedRequests,
          totalClosedRequests: metric.totalClosedRequests,
        })),
      },
      trendDeltas: {
        dailyRequestDelta: todayCount - yesterdayCount,
        dailySummaryAvailable:
          latestDailyMetric || todayRequests || todayReservations || todayAppointments
            ? 1
            : 0,
      },
      groupedCounts,
    });
  }

  async getItAnalyticsNarration(user: JwtUser): Promise<JsonRecord> {
    const now = new Date();
    const last7Days = new Date(now);
    last7Days.setDate(now.getDate() - 6);
    last7Days.setHours(0, 0, 0, 0);

    const scopeUserIds = await this.resolveItScopeUserIds(user);

    const ticketWhere = scopeUserIds
      ? {
          OR: [
            { assignedItUserId: { in: scopeUserIds } },
            { reportedByUserId: user.userId },
          ],
        }
      : {};

    const tickets = await this.prisma.itTicket.findMany({
      where: {
        ...ticketWhere,
        createdAt: { gte: last7Days },
      },
      include: {
        request: {
          select: {
            createdAt: true,
            dueAt: true,
            priority: true,
            status: true,
          },
        },
        slaPolicy: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const categoryCounts = new Map<string, number>();
    const heatmap = new Map<string, number>();
    const trendByDate = new Map<string, number>();
    const closedStatuses = new Set<TicketStatus>([
      TicketStatus.RESOLVED,
      TicketStatus.CLOSED,
    ]);
    const resolvedTickets = tickets.filter((ticket) =>
      closedStatuses.has(ticket.ticketStatus),
    );
    const breachedTickets = tickets.filter(
      (ticket) =>
        ticket.request.dueAt &&
        ticket.request.dueAt < now &&
        !closedStatuses.has(ticket.ticketStatus),
    );

    for (const ticket of tickets) {
      categoryCounts.set(ticket.category, (categoryCounts.get(ticket.category) ?? 0) + 1);

      const hour = String(ticket.createdAt.getHours()).padStart(2, '0');
      const day = ticket.createdAt.toLocaleDateString('en-US', { weekday: 'short' });
      heatmap.set(`${day}-${hour}`, (heatmap.get(`${day}-${hour}`) ?? 0) + 1);

      const dateKey = ticket.createdAt.toISOString().slice(0, 10);
      trendByDate.set(dateKey, (trendByDate.get(dateKey) ?? 0) + 1);
    }

    const avgResolutionHours =
      resolvedTickets.length > 0
        ? Number(
            (
              resolvedTickets.reduce((sum, ticket) => {
                const endAt = ticket.closedAt ?? ticket.resolvedAt ?? ticket.createdAt;
                return (
                  sum +
                  (endAt.getTime() - ticket.request.createdAt.getTime()) /
                    (1000 * 60 * 60)
                );
              }, 0) / resolvedTickets.length
            ).toFixed(1),
          )
        : 0;

    const slaBreachRate =
      tickets.length > 0
        ? Number(((breachedTickets.length / tickets.length) * 100).toFixed(1))
        : 0;

    return this.summarizeAnalytics({
      domain: 'IT',
      kpis: {
        avgResolutionHours,
        slaBreachRate,
        totalTickets: tickets.length,
      },
      chartData: {
        trendByDate: Object.fromEntries(trendByDate),
        ticketHeatmap: Object.fromEntries(heatmap),
      },
      trendDeltas: {
        activeVsResolved: tickets.length - resolvedTickets.length,
      },
      groupedCounts: Object.fromEntries(categoryCounts),
    });
  }

  async askAssistant(user: JwtUser, dto: AssistantAskDto): Promise<JsonRecord> {
    const portal = dto.portal.toLowerCase();
    const userContext = await this.prisma.user.findUnique({
      where: { id: user.userId },
      include: {
        profile: {
          include: {
            faculty: { select: { id: true, name: true } },
            department: { select: { id: true, name: true } },
            unit: { select: { id: true, name: true } },
          },
        },
        primaryRoles: {
          include: {
            role: true,
            faculty: { select: { id: true, name: true } },
            department: { select: { id: true, name: true } },
            unit: { select: { id: true, name: true } },
          },
        },
      },
    });
    const subRoles = this.resolveSubRoles(user.roles);
    const authorizedRoutes = this.resolveAuthorizedRoutes(
      portal,
      user.roles,
      subRoles,
    );
    const authorizedRouteDetails = this.resolveAuthorizedRouteDetails(
      portal,
      user.roles,
      subRoles,
    );
    const conversation = await this.getOrCreateConversation(user, dto, portal);
    const [openRequests, liveDataContext, conversationHistory] = await Promise.all([
      this.resolveVisibleRequests(user, portal),
      this.resolveAssistantLiveDataContext(user, portal),
      this.loadConversationHistory(conversation.id, 6),
    ]);

    await this.persistMessage(conversation.id, user.userId, 'user', dto.message, {
      portal,
      sessionId: dto.sessionId ?? null,
    });

    const response = await this.aiClientService.post(
      '/assistant/ask',
      {
        portal,
        message: dto.message,
        mainRole: this.resolveMainRole(user.roles, portal),
        subRoles,
        systemContext: SYSTEM_ASSISTANT_CONTEXT,
        portalContext:
          PORTAL_CONTEXT_MAP[portal] ??
          'Stay within the current portal and authorized role scope.',
        authorizedRoutes,
        authorizedRouteDetails,
        allowedRequestTypes: this.resolveAllowedRequestTypes(
          portal,
          user.roles,
          subRoles,
        ),
        visibilityScope: {
          requesterUserId: user.userId,
          portal,
          faculty: userContext?.profile?.faculty ?? null,
          department: userContext?.profile?.department ?? null,
          unit: userContext?.profile?.unit ?? null,
          roleAssignments:
            userContext?.primaryRoles.map((assignment) => ({
              role: assignment.role.name,
              faculty: assignment.faculty?.name ?? null,
              department: assignment.department?.name ?? null,
              unit: assignment.unit?.name ?? null,
            })) ?? [],
        },
        openRequests,
        liveDataContext,
        conversationHistory,
        requestTypeHelpMapping: Object.fromEntries(
          authorizedRouteDetails.map((route) => [route.label, route.href]),
        ),
      },
      {
        answer: 'AI assistant is currently unavailable.',
        links: [],
        cards: [],
        confidence: 0.25,
        fallbackUsed: true,
      },
    );

    const firstLink =
      Array.isArray(response.links) &&
      response.links.length > 0 &&
      typeof (response.links[0] as Record<string, unknown>)?.href === 'string'
        ? String((response.links[0] as Record<string, unknown>).href)
        : null;

    await this.persistMessage(
      conversation.id,
      user.userId,
      'assistant',
      String(response.answer ?? ''),
      {
        links: Array.isArray(response.links) ? response.links : [],
        cards: Array.isArray((response as Record<string, unknown>).cards)
          ? ((response as Record<string, unknown>).cards as unknown[])
          : [],
        confidence: response.confidence ?? null,
        fallbackUsed: response.fallbackUsed ?? false,
      },
      firstLink,
    );

    return response;
  }

  private resolveMainRole(roles: string[], portal: string): string {
    const normalizedRoles = roles.map((role) => role.toLowerCase());
    if (normalizedRoles.includes(portal)) {
      return portal.toUpperCase();
    }
    return roles[0] ?? portal.toUpperCase();
  }

  private resolveSubRoles(roles: string[]): string[] {
    return roles.filter(
      (role) =>
        !['ADMIN', 'STUDENT', 'FACULTY', 'STAFF', 'ORGANIZER'].includes(role),
    );
  }

  private resolveAuthorizedRoutes(
    portal: string,
    roles: string[],
    subRoles: string[],
  ): string[] {
    const baseRoutes = (PORTAL_ROUTE_MAP[portal] ?? []).map((route) => route.href);
    const normalizedRoles = roles.map((role) => role.toUpperCase());
    const normalizedSubRoles = subRoles.map((role) => role.toUpperCase());

    if (portal !== 'staff') {
      return baseRoutes;
    }

    if (
      normalizedRoles.includes('ADMIN') ||
      normalizedSubRoles.includes('IT_MANAGER')
    ) {
      return baseRoutes;
    }

    return baseRoutes.filter((route) => {
      if (normalizedSubRoles.includes('DOCUMENT_OFFICER')) {
        return !route.includes('/tickets') && !route.includes('/procurement');
      }
      if (normalizedSubRoles.includes('PROCUREMENT_OFFICER')) {
        return !route.includes('/tickets') && !route.includes('/documents');
      }
      if (normalizedSubRoles.includes('SECURITY_OFFICER')) {
        return !route.includes('/tickets') && !route.includes('/procurement');
      }
      if (normalizedSubRoles.includes('RESOURCE_MANAGER')) {
        return !route.includes('/procurement') && !route.includes('/documents');
      }
      return true;
    });
  }

  private resolveAuthorizedRouteDetails(
    portal: string,
    roles: string[],
    subRoles: string[],
  ): RouteDetail[] {
    const allowedRoutes = new Set(
      this.resolveAuthorizedRoutes(portal, roles, subRoles),
    );

    return (PORTAL_ROUTE_MAP[portal] ?? []).filter((route) =>
      allowedRoutes.has(route.href),
    );
  }

  private resolveAllowedRequestTypes(
    portal: string,
    roles: string[],
    subRoles: string[],
  ): string[] {
    const normalizedRoles = roles.map((role) => role.toUpperCase());
    const normalizedSubRoles = subRoles.map((role) => role.toUpperCase());

    if (portal !== 'staff' || normalizedRoles.includes('ADMIN')) {
      return REQUEST_TYPE_MAP[portal] ?? [];
    }

    if (normalizedSubRoles.includes('DOCUMENT_OFFICER')) {
      return ['DOCUMENT'];
    }
    if (normalizedSubRoles.includes('PROCUREMENT_OFFICER')) {
      return ['PROCUREMENT'];
    }
    if (normalizedSubRoles.includes('SECURITY_OFFICER')) {
      return ['ACCESS_REQUEST', 'EVENT'];
    }
    if (normalizedSubRoles.includes('RESOURCE_MANAGER')) {
      return ['RESERVATION', 'EQUIPMENT'];
    }
    if (
      normalizedSubRoles.includes('IT_AGENT') ||
      normalizedSubRoles.includes('IT_MANAGER')
    ) {
      return ['IT_TICKET'];
    }

    return REQUEST_TYPE_MAP[portal] ?? [];
  }

  private async resolveAssistantLiveDataContext(
    user: JwtUser,
    portal: string,
  ): Promise<JsonRecord> {
    const now = new Date();

    if (portal === 'admin') {
      const [
        totalUsers,
        activeUsers,
        totalRoles,
        totalPermissions,
        totalRequests,
        openRequestsCount,
        totalRequestTypes,
        totalWorkflows,
        totalResources,
        totalIntegrations,
        recentUsers,
        recentRequests,
        recentAuditLogs,
        recentWebhookLogs,
      ] = await Promise.all([
        this.prisma.user.count({ where: { deletedAt: null } }),
        this.prisma.user.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
        this.prisma.role.count(),
        this.prisma.permission.count(),
        this.prisma.request.count({ where: { deletedAt: null } }),
        this.prisma.request.count({
          where: {
            deletedAt: null,
            status: {
              notIn: ['COMPLETED', 'APPROVED', 'REJECTED', 'CANCELLED', 'CLOSED', 'EXPIRED'],
            },
          },
        }),
        this.prisma.requestType.count(),
        this.prisma.workflowDefinition.count({ where: { isActive: true } }),
        this.prisma.resource.count({ where: { isActive: true } }),
        this.prisma.integration.count(),
        this.prisma.user.findMany({
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            email: true,
            status: true,
            createdAt: true,
            profile: { select: { fullName: true } },
          },
        }),
        this.prisma.request.findMany({
          where: { deletedAt: null },
          orderBy: { updatedAt: 'desc' },
          take: 8,
          select: {
            id: true,
            requestNo: true,
            title: true,
            status: true,
            updatedAt: true,
            requestType: { select: { key: true, name: true } },
          },
        }),
        this.prisma.auditLog.findMany({
          orderBy: { createdAt: 'desc' },
          take: 6,
          select: {
            actionType: true,
            entityType: true,
            entityId: true,
            createdAt: true,
          },
        }),
        this.prisma.webhookLog.findMany({
          orderBy: { createdAt: 'desc' },
          take: 6,
          select: {
            status: true,
            direction: true,
            responseStatusCode: true,
            createdAt: true,
            integration: { select: { name: true, provider: true } },
          },
        }),
      ]);

      return {
        generatedAt: now.toISOString(),
        portal,
        summary: {
          totalUsers,
          activeUsers,
          totalRoles,
          totalPermissions,
          totalRequests,
          openRequests: openRequestsCount,
          totalRequestTypes,
          activeWorkflows: totalWorkflows,
          activeResources: totalResources,
          totalIntegrations,
        },
        recentUsers: recentUsers.map((item) => ({
          id: item.id,
          fullName: item.profile?.fullName ?? null,
          email: item.email,
          status: item.status,
          createdAt: item.createdAt,
        })),
        recentRequests: recentRequests.map((item) => ({
          id: item.id,
          requestNo: item.requestNo,
          title: item.title,
          status: item.status,
          requestType: item.requestType?.name ?? item.requestType?.key ?? null,
          updatedAt: item.updatedAt,
        })),
        recentAuditLogs,
        recentWebhookLogs: recentWebhookLogs.map((item) => ({
          status: item.status,
          direction: item.direction,
          responseStatusCode: item.responseStatusCode,
          createdAt: item.createdAt,
          integrationName: item.integration?.name ?? null,
          integrationProvider: item.integration?.provider ?? null,
        })),
      };
    }

    if (portal === 'student') {
      const [myRequests, upcomingAppointments, upcomingReservations, unreadNotifications, upcomingEvents] =
        await Promise.all([
          this.prisma.request.findMany({
            where: { requesterUserId: user.userId, deletedAt: null },
            orderBy: { updatedAt: 'desc' },
            take: 8,
            select: {
              requestNo: true,
              title: true,
              status: true,
              updatedAt: true,
              requestType: { select: { key: true, name: true } },
            },
          }),
          this.prisma.appointment.findMany({
            where: {
              OR: [{ requesterUserId: user.userId }, { hostUserId: user.userId }],
              startAt: { gte: now },
            },
            orderBy: { startAt: 'asc' },
            take: 5,
            select: {
              title: true,
              status: true,
              startAt: true,
              endAt: true,
              locationText: true,
            },
          }),
          this.prisma.reservation.findMany({
            where: { reservedByUserId: user.userId, startAt: { gte: now } },
            orderBy: { startAt: 'asc' },
            take: 5,
            select: {
              title: true,
              status: true,
              startAt: true,
              endAt: true,
            },
          }),
          this.prisma.notification.count({
            where: { userId: user.userId, isRead: false },
          }),
          this.prisma.event.findMany({
            where: { startAt: { gte: now }, status: 'PUBLISHED' },
            orderBy: { startAt: 'asc' },
            take: 5,
            select: {
              title: true,
              startAt: true,
              endAt: true,
              status: true,
              locationText: true,
            },
          }),
        ]);

      const openCount = myRequests.filter((item) =>
        !['COMPLETED', 'APPROVED', 'REJECTED', 'CANCELLED', 'CLOSED', 'EXPIRED'].includes(item.status),
      ).length;

      return {
        generatedAt: now.toISOString(),
        portal,
        summary: {
          totalRequests: myRequests.length,
          openRequests: openCount,
          unreadNotifications,
          upcomingAppointments: upcomingAppointments.length,
          upcomingEvents: upcomingEvents.length,
        },
        recentRequests: myRequests.map((item) => ({
          requestNo: item.requestNo,
          title: item.title,
          status: item.status,
          requestType: item.requestType?.name ?? item.requestType?.key ?? null,
          updatedAt: item.updatedAt,
        })),
        upcomingAppointments,
        upcomingReservations,
        upcomingEvents,
      };
    }

    if (portal === 'faculty') {
      const [visibleRequests, upcomingAppointments] = await Promise.all([
        this.prisma.request.findMany({
          where: {
            OR: [
              { currentAssigneeUserId: user.userId },
              { requesterUserId: user.userId },
              {
                workflowInstance: {
                  instanceSteps: {
                    some: { assignedToUserId: user.userId },
                  },
                },
              },
            ],
            deletedAt: null,
          },
          orderBy: { updatedAt: 'desc' },
          take: 10,
          select: {
            requestNo: true,
            title: true,
            status: true,
            updatedAt: true,
            requestType: { select: { key: true, name: true } },
          },
        }),
        this.prisma.appointment.findMany({
          where: {
            OR: [{ requesterUserId: user.userId }, { hostUserId: user.userId }],
            startAt: { gte: now },
          },
          orderBy: { startAt: 'asc' },
          take: 5,
          select: {
            title: true,
            status: true,
            startAt: true,
            endAt: true,
            locationText: true,
          },
        }),
      ]);

      const pendingApprovals = visibleRequests.filter((item) =>
        ['WAITING_APPROVAL', 'IN_REVIEW', 'SUBMITTED'].includes(item.status),
      ).length;

      return {
        generatedAt: now.toISOString(),
        portal,
        summary: {
          visibleRequests: visibleRequests.length,
          pendingApprovals,
        },
        recentRequests: visibleRequests.map((item) => ({
          requestNo: item.requestNo,
          title: item.title,
          status: item.status,
          requestType: item.requestType?.name ?? item.requestType?.key ?? null,
          updatedAt: item.updatedAt,
        })),
        upcomingAppointments,
      };
    }

    if (portal === 'staff') {
      const scopeUserIds = await this.resolveItScopeUserIds(user);
      const ticketWhere = scopeUserIds
        ? {
            OR: [
              { assignedItUserId: { in: scopeUserIds } },
              { reportedByUserId: user.userId },
            ],
          }
        : { reportedByUserId: user.userId };

      const [recentTickets, recentRequests] = await Promise.all([
        this.prisma.itTicket.findMany({
          where: ticketWhere,
          orderBy: { updatedAt: 'desc' },
          take: 8,
          select: {
            category: true,
            ticketStatus: true,
            updatedAt: true,
            request: { select: { requestNo: true, title: true, status: true } },
          },
        }),
        this.prisma.request.findMany({
          where: {
            OR: [
              { currentAssigneeUserId: user.userId },
              { requesterUserId: user.userId },
            ],
            deletedAt: null,
          },
          orderBy: { updatedAt: 'desc' },
          take: 8,
          select: {
            requestNo: true,
            title: true,
            status: true,
            updatedAt: true,
            requestType: { select: { key: true, name: true } },
          },
        }),
      ]);

      return {
        generatedAt: now.toISOString(),
        portal,
        summary: {
          visibleTickets: recentTickets.length,
          visibleRequests: recentRequests.length,
          openTickets: recentTickets.filter((item) =>
            ['OPEN', 'TRIAGED', 'IN_PROGRESS', 'WAITING_USER', 'REOPENED'].includes(item.ticketStatus),
          ).length,
        },
        recentTickets: recentTickets.map((item) => ({
          category: item.category,
          ticketStatus: item.ticketStatus,
          updatedAt: item.updatedAt,
          requestNo: item.request.requestNo,
          title: item.request.title,
          requestStatus: item.request.status,
        })),
        recentRequests: recentRequests.map((item) => ({
          requestNo: item.requestNo,
          title: item.title,
          status: item.status,
          requestType: item.requestType?.name ?? item.requestType?.key ?? null,
          updatedAt: item.updatedAt,
        })),
      };
    }

    if (portal === 'organizer') {
      const [recentEventRequests, upcomingEvents, recentProcurement] = await Promise.all([
        this.prisma.eventRequest.findMany({
          where: { organizerUserId: user.userId },
          orderBy: { updatedAt: 'desc' },
          take: 8,
          select: {
            eventName: true,
            eventType: true,
            startAt: true,
            endAt: true,
            request: { select: { requestNo: true, status: true, title: true } },
          },
        }),
        this.prisma.event.findMany({
          where: { organizerUserId: user.userId, startAt: { gte: now } },
          orderBy: { startAt: 'asc' },
          take: 5,
          select: {
            title: true,
            startAt: true,
            endAt: true,
            status: true,
            locationText: true,
          },
        }),
        this.prisma.procurementRequest.findMany({
          where: { requesterUserId: user.userId },
          orderBy: { updatedAt: 'desc' },
          take: 5,
          select: {
            itemName: true,
            procurementStatus: true,
            updatedAt: true,
            request: { select: { requestNo: true, status: true } },
          },
        }),
      ]);

      return {
        generatedAt: now.toISOString(),
        portal,
        summary: {
          eventRequests: recentEventRequests.length,
          upcomingEvents: upcomingEvents.length,
          procurementItems: recentProcurement.length,
        },
        recentEventRequests: recentEventRequests.map((item) => ({
          eventName: item.eventName,
          eventType: item.eventType,
          startAt: item.startAt,
          endAt: item.endAt,
          requestNo: item.request.requestNo,
          requestStatus: item.request.status,
          title: item.request.title,
        })),
        upcomingEvents,
        recentProcurement: recentProcurement.map((item) => ({
          itemName: item.itemName,
          procurementStatus: item.procurementStatus,
          updatedAt: item.updatedAt,
          requestNo: item.request.requestNo,
          requestStatus: item.request.status,
        })),
      };
    }

    return {
      generatedAt: now.toISOString(),
      portal,
      summary: {},
    };
  }

  private async loadConversationHistory(
    conversationId: string,
    limit: number,
  ): Promise<Array<{ role: string; content: string }>> {
    if (conversationId === 'ephemeral') {
      return [];
    }

    const aiMessage = (this.prisma as any).aiMessage;
    if (!aiMessage) {
      return [];
    }

    try {
      const messages = await aiMessage.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        take: limit,
        select: { messageType: true, content: true },
      });

      return (messages as Array<{ messageType: string; content: string }>).map((msg) => ({
        role: msg.messageType === 'assistant' ? 'assistant' : 'user',
        content: msg.content,
      }));
    } catch {
      return [];
    }
  }

  private async getOrCreateConversation(
    user: JwtUser,
    dto: AssistantAskDto,
    portal: string,
  ): Promise<{ id: string }> {
    const sessionId = dto.sessionId?.trim();
    if (!sessionId) {
      return { id: 'ephemeral' };
    }

    const aiConversation = (this.prisma as any).aiConversation;
    if (!aiConversation) {
      return { id: 'ephemeral' };
    }

    try {
      return await aiConversation.upsert({
        where: {
          userId_sessionId_portal: {
            userId: user.userId,
            sessionId,
            portal,
          },
        },
        update: {
          metadataJson: {
            conversationId: dto.conversationId ?? null,
          },
        },
        create: {
          userId: user.userId,
          portal,
          sessionId,
          roleSnapshotJson: {
            mainRole: this.resolveMainRole(user.roles, portal),
          },
          subRoleSnapshotJson: this.resolveSubRoles(user.roles),
          metadataJson: {
            conversationId: dto.conversationId ?? null,
          },
        },
        select: {
          id: true,
        },
      });
    } catch {
      return { id: 'ephemeral' };
    }
  }

  private async persistMessage(
    conversationId: string,
    userId: string,
    messageType: 'user' | 'assistant',
    content: string,
    metadataJson: JsonRecord,
    linkedRoute?: string | null,
  ): Promise<void> {
    if (conversationId === 'ephemeral') {
      return;
    }

    const aiMessage = (this.prisma as any).aiMessage;
    if (!aiMessage) {
      return;
    }

    try {
      await aiMessage.create({
        data: {
          conversationId,
          userId,
          messageType,
          content,
          metadataJson,
          linkedRoute: linkedRoute ?? null,
          featureContext: 'portal_assistant',
        },
      });
    } catch {
      return;
    }
  }

  private async resolveItScopeUserIds(user: JwtUser): Promise<string[] | null> {
    const normalizedRoles = user.roles.map((role) => role.toUpperCase());
    if (normalizedRoles.includes('ADMIN') || normalizedRoles.includes('IT_MANAGER')) {
      const members = await this.prisma.userRole.findMany({
        where: {
          role: {
            name: {
              in: ['STAFF', 'IT_AGENT', 'IT_MANAGER'],
            },
          },
        },
        select: { userId: true },
      });
      return Array.from(new Set(members.map((member) => member.userId)));
    }

    if (normalizedRoles.includes('STAFF') || normalizedRoles.includes('IT_AGENT')) {
      return [user.userId];
    }

    return null;
  }

  private async resolveVisibleRequests(
    user: JwtUser,
    portal: string,
  ): Promise<
    Array<{
      id: string;
      title: string;
      status: string;
      requestNo: string;
      updatedAt: Date;
    }>
  > {
    const normalizedRoles = user.roles.map((role) => role.toUpperCase());

    if (portal === 'student' || portal === 'organizer') {
      return this.prisma.request.findMany({
        where: { requesterUserId: user.userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          status: true,
          requestNo: true,
          updatedAt: true,
        },
      });
    }

    if (portal === 'faculty') {
      return this.prisma.request.findMany({
        where: {
          OR: [
            { currentAssigneeUserId: user.userId },
            {
              workflowInstance: {
                instanceSteps: {
                  some: {
                    assignedToUserId: user.userId,
                  },
                },
              },
            },
            { requesterUserId: user.userId },
          ],
        },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          status: true,
          requestNo: true,
          updatedAt: true,
        },
      });
    }

    if (portal === 'staff') {
      const isManager =
        normalizedRoles.includes('ADMIN') || normalizedRoles.includes('IT_MANAGER');
      return this.prisma.request.findMany({
        where: isManager
          ? {
              OR: [
                {
                  itTicket: {
                    isNot: null,
                  },
                },
                { currentAssigneeUserId: user.userId },
              ],
            }
          : {
              OR: [
                { currentAssigneeUserId: user.userId },
                {
                  itTicket: {
                    assignedItUserId: user.userId,
                  },
                },
              ],
            },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          status: true,
          requestNo: true,
          updatedAt: true,
        },
      });
    }

    if (portal === 'admin') {
      return this.prisma.request.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          status: true,
          requestNo: true,
          updatedAt: true,
        },
      });
    }

    return [];
  }

  async findSimilarTickets(dto: SimilarTicketDto): Promise<JsonRecord> {
    const titleWords = dto.title.split(/\s+/).slice(0, 6).join(' ');
    const descWords = dto.description.split(/\s+/).slice(0, 12).join(' ');

    const candidates = await this.prisma.itTicket.findMany({
      where: {
        OR: [
          { request: { title: { contains: titleWords, mode: 'insensitive' } } },
          { request: { description: { contains: descWords, mode: 'insensitive' } } },
          ...(dto.category ? [{ category: { contains: dto.category, mode: 'insensitive' as const } }] : []),
        ],
      },
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        category: true,
        ticketStatus: true,
        resolutionSummary: true,
        request: {
          select: { title: true, requestNo: true, status: true },
        },
      },
    });

    return this.aiClientService.post(
      '/tickets/similar',
      {
        title: dto.title,
        description: dto.description,
        category: dto.category ?? null,
        candidates: candidates.map((t) => ({
          id: t.id,
          title: t.request.title,
          request_no: t.request.requestNo,
          category: t.category,
          ticket_status: t.ticketStatus,
          resolution_summary: t.resolutionSummary ?? null,
        })),
      },
      {
        summary: `${candidates.length} benzer ticket bulundu.`,
        similarCount: candidates.length,
        highlights: candidates.slice(0, 3).map((t) => t.request.title),
        confidence: 0.25,
        fallbackUsed: true,
      },
    );
  }

  async getDashboardSummary(user: JwtUser): Promise<JsonRecord> {
    const now = new Date();

    const [myRequests, openRequests, pendingApprovals, upcomingAppointments, upcomingReservations] =
      await Promise.all([
        this.prisma.request.count({
          where: { requesterUserId: user.userId, deletedAt: null },
        }),
        this.prisma.request.count({
          where: {
            requesterUserId: user.userId,
            deletedAt: null,
            status: { notIn: ['COMPLETED', 'APPROVED', 'REJECTED', 'CANCELLED', 'CLOSED', 'EXPIRED'] },
          },
        }),
        this.prisma.request.count({
          where: {
            currentAssigneeUserId: user.userId,
            deletedAt: null,
            status: { in: ['SUBMITTED', 'IN_REVIEW', 'WAITING_APPROVAL'] },
          },
        }),
        this.prisma.appointmentRequest.count({
          where: {
            OR: [{ requesterUserId: user.userId }, { targetUserId: user.userId }],
            request: {
              status: { notIn: ['REJECTED', 'CANCELLED', 'CLOSED', 'EXPIRED'] },
            },
          },
        }),
        this.prisma.roomReservationRequest.count({
          where: {
            requesterUserId: user.userId,
            startAt: { gte: now },
          },
        }),
      ]);

    const raw = await this.summarizeAnalytics({
      domain: 'DASHBOARD',
      kpis: { myRequests, openRequests, pendingApprovals, upcomingAppointments, upcomingReservations },
      chartData: {},
      trendDeltas: {},
      groupedCounts: {},
    });

    return this.responseValidator.validateAssistantResponse({
      ...raw,
      answer: raw['summary'] ?? raw['answer'],
    });
  }
}
