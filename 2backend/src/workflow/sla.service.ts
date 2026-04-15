import { Injectable } from '@nestjs/common';
import { PriorityLevel, RequestStatus } from '@prisma/client';
import { PrismaService } from '../core/prisma/prisma.service';

const TERMINAL_REQUEST_STATUSES: RequestStatus[] = [
  'APPROVED',
  'REJECTED',
  'CANCELLED',
  'COMPLETED',
  'CLOSED',
  'EXPIRED',
];

@Injectable()
export class SlaService {
  constructor(private prisma: PrismaService) {}

  private addMinutes(base: Date, minutes: number | null | undefined) {
    if (!minutes || minutes <= 0) return null;
    return new Date(base.getTime() + minutes * 60 * 1000);
  }

  private isTerminal(status: RequestStatus) {
    return TERMINAL_REQUEST_STATUSES.includes(status);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async resolvePolicy(tx: any, requestTypeId: string, priority: PriorityLevel) {
    let policy = await tx.slaPolicy.findFirst({
      where: { requestTypeId, priority, isActive: true },
    });

    if (!policy) {
      policy = await tx.slaPolicy.findFirst({
        where: { requestTypeId, priority: null, isActive: true },
      });
    }

    if (!policy) {
      policy = await tx.slaPolicy.findFirst({
        where: { requestTypeId: null, priority, isActive: true },
      });
    }

    return policy;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async ensureStartedEvent(tx: any, requestId: string, slaPolicyId: string, eventType: string) {
    const existing = await tx.slaEvent.findFirst({
      where: {
        requestId,
        slaPolicyId,
        eventType,
        resolvedAt: null,
      },
    });

    if (existing) return existing;

    return tx.slaEvent.create({
      data: {
        requestId,
        slaPolicyId,
        eventType,
      },
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async closeStartedEventWithOutcome(tx: any, requestId: string, slaPolicyId: string, startedType: string, outcomeType: string) {
    const started = await tx.slaEvent.findFirst({
      where: {
        requestId,
        slaPolicyId,
        eventType: startedType,
        resolvedAt: null,
      },
      orderBy: { occurredAt: 'asc' },
    });

    if (!started) return null;

    const existingOutcome = await tx.slaEvent.findFirst({
      where: {
        requestId,
        slaPolicyId,
        eventType: outcomeType,
        occurredAt: { gte: started.occurredAt },
      },
    });

    const now = new Date();

    await tx.slaEvent.update({
      where: { id: started.id },
      data: { resolvedAt: now },
    });

    if (existingOutcome) return existingOutcome;

    return tx.slaEvent.create({
      data: {
        requestId,
        slaPolicyId,
        eventType: outcomeType,
        occurredAt: now,
        resolvedAt: now,
      },
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async startRequestSla(tx: any, requestId: string) {
    const request = await tx.request.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        requestTypeId: true,
        priority: true,
        createdAt: true,
      },
    });

    if (!request) return null;

    const policy = await this.resolvePolicy(
      tx,
      request.requestTypeId,
      request.priority,
    );

    if (!policy) return null;

    await tx.request.update({
      where: { id: requestId },
      data: {
        dueAt:
          policy.resolutionMinutes && policy.resolutionMinutes > 0
            ? this.addMinutes(request.createdAt, policy.resolutionMinutes)
            : null,
      },
    });

    await this.ensureStartedEvent(
      tx,
      requestId,
      policy.id,
      'FIRST_RESPONSE_STARTED',
    );

    await this.ensureStartedEvent(
      tx,
      requestId,
      policy.id,
      'RESOLUTION_STARTED',
    );

    return policy;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async markFirstResponse(tx: any, requestId: string) {
    const request = await tx.request.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        requestTypeId: true,
        priority: true,
      },
    });

    if (!request) return null;

    const policy = await this.resolvePolicy(
      tx,
      request.requestTypeId,
      request.priority,
    );

    if (!policy?.firstResponseMinutes) return null;

    const started = await tx.slaEvent.findFirst({
      where: {
        requestId,
        slaPolicyId: policy.id,
        eventType: 'FIRST_RESPONSE_STARTED',
        resolvedAt: null,
      },
      orderBy: { occurredAt: 'asc' },
    });

    if (!started) return null;

    const deadline = this.addMinutes(started.occurredAt, policy.firstResponseMinutes);
    const outcomeType =
      deadline && deadline < new Date()
        ? 'FIRST_RESPONSE_BREACHED'
        : 'FIRST_RESPONSE_MET';

    return this.closeStartedEventWithOutcome(
      tx,
      requestId,
      policy.id,
      'FIRST_RESPONSE_STARTED',
      outcomeType,
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async markResolution(tx: any, requestId: string, finalStatus: RequestStatus) {
    if (!this.isTerminal(finalStatus)) return null;

    const request = await tx.request.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        requestTypeId: true,
        priority: true,
      },
    });

    if (!request) return null;

    const policy = await this.resolvePolicy(
      tx,
      request.requestTypeId,
      request.priority,
    );

    if (!policy?.resolutionMinutes) return null;

    const started = await tx.slaEvent.findFirst({
      where: {
        requestId,
        slaPolicyId: policy.id,
        eventType: 'RESOLUTION_STARTED',
        resolvedAt: null,
      },
      orderBy: { occurredAt: 'asc' },
    });

    if (!started) return null;

    const deadline = this.addMinutes(started.occurredAt, policy.resolutionMinutes);
    const outcomeType =
      deadline && deadline < new Date()
        ? 'RESOLUTION_BREACHED'
        : 'RESOLUTION_MET';

    return this.closeStartedEventWithOutcome(
      tx,
      requestId,
      policy.id,
      'RESOLUTION_STARTED',
      outcomeType,
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async markStepOverdue(tx: any, workflowInstanceStepId: string) {
    const instanceStep = await tx.workflowInstanceStep.findUnique({
      where: { id: workflowInstanceStepId },
      include: {
        workflowStep: true,
        workflowInstance: {
          include: {
            request: {
              select: {
                id: true,
                requestTypeId: true,
                priority: true,
              },
            },
          },
        },
      },
    });

    if (!instanceStep?.dueAt || instanceStep.completedAt) return null;
    if (instanceStep.dueAt >= new Date()) return null;

    const request = instanceStep.workflowInstance?.request;
    if (!request) return null;

    const policy = await this.resolvePolicy(
      tx,
      request.requestTypeId,
      request.priority,
    );

    await tx.workflowInstanceStep.update({
      where: { id: workflowInstanceStepId },
      data: { isOverdue: true },
    });

    if (!policy) return null;

    const existing = await tx.slaEvent.findFirst({
      where: {
        requestId: request.id,
        slaPolicyId: policy.id,
        eventType: 'STEP_OVERDUE',
        occurredAt: { gte: instanceStep.startedAt ?? instanceStep.createdAt },
      },
    });

    if (existing) return existing;

    return tx.slaEvent.create({
      data: {
        requestId: request.id,
        slaPolicyId: policy.id,
        eventType: 'STEP_OVERDUE',
      },
    });
  }

  async runSlaSweep() {
    const now = new Date();

    await this.prisma.$transaction(
      async (tx) => {
      const overdueSteps = await tx.workflowInstanceStep.findMany({
        where: {
          status: 'PENDING',
          completedAt: null,
          dueAt: { lt: now },
          isOverdue: false,
        },
        select: { id: true },
      });

      for (const step of overdueSteps) {
        await this.markStepOverdue(tx, step.id);
      }

      const openRequests = await tx.request.findMany({
        where: {
          status: { notIn: TERMINAL_REQUEST_STATUSES },
        },
        select: {
          id: true,
          requestNo: true,
          title: true,
          status: true,
          requestTypeId: true,
          priority: true,
          currentAssigneeUserId: true,
        },
      });

      for (const request of openRequests) {
        const policy = await this.resolvePolicy(
          tx,
          request.requestTypeId,
          request.priority,
        );

        if (!policy) continue;

        const firstResponseStarted = await tx.slaEvent.findFirst({
          where: {
            requestId: request.id,
            slaPolicyId: policy.id,
            eventType: 'FIRST_RESPONSE_STARTED',
            resolvedAt: null,
          },
        });

        if (
          firstResponseStarted &&
          policy.firstResponseMinutes &&
          this.addMinutes(
            firstResponseStarted.occurredAt,
            policy.firstResponseMinutes,
          )! < now
        ) {
          await this.closeStartedEventWithOutcome(
            tx,
            request.id,
            policy.id,
            'FIRST_RESPONSE_STARTED',
            'FIRST_RESPONSE_BREACHED',
          );
        }

        const resolutionStarted = await tx.slaEvent.findFirst({
          where: {
            requestId: request.id,
            slaPolicyId: policy.id,
            eventType: 'RESOLUTION_STARTED',
            resolvedAt: null,
          },
        });

        if (
          resolutionStarted &&
          policy.resolutionMinutes &&
          this.addMinutes(
            resolutionStarted.occurredAt,
            policy.resolutionMinutes,
          )! < now
        ) {
          await this.closeStartedEventWithOutcome(
            tx,
            request.id,
            policy.id,
            'RESOLUTION_STARTED',
            'RESOLUTION_BREACHED',
          );
        }

        if (!policy.escalationMinutes) continue;

        const existingEscalation = await tx.slaEvent.findFirst({
          where: {
            requestId: request.id,
            slaPolicyId: policy.id,
            eventType: 'ESCALATION_TRIGGERED',
          },
        });

        if (existingEscalation || !resolutionStarted) continue;

        const shouldEscalate =
          this.addMinutes(
            resolutionStarted.occurredAt,
            policy.escalationMinutes,
          )! < now;

        if (!shouldEscalate) continue;

        await tx.slaEvent.create({
          data: {
            requestId: request.id,
            slaPolicyId: policy.id,
            eventType: 'ESCALATION_TRIGGERED',
          },
        });

        await tx.systemEvent.create({
          data: {
            eventKey: 'SLA_ESCALATION_TRIGGERED',
            severity: 'warning',
            sourceService: 'workflow',
            entityType: 'Request',
            entityId: request.id,
            message: `${request.requestNo} exceeded escalation threshold.`,
          },
        });

        if (request.currentAssigneeUserId) {
          await tx.requestComment.create({
            data: {
              requestId: request.id,
              userId: request.currentAssigneeUserId,
              commentText:
                'SLA escalation triggered because the request has not been processed within the escalation threshold.',
              isInternal: true,
            },
          });

          await tx.notification.create({
            data: {
              userId: request.currentAssigneeUserId,
              requestId: request.id,
              type: 'IN_APP',
              title: 'SLA Escalation Triggered',
              message: `${request.requestNo} requires attention. No action has been taken within the escalation threshold.`,
              actionUrl: '/staff/inbox',
            },
          });
        }
      }
      },
      {
        // Sweep işlemi çok sayıda request içerebilir; timeout artırıldı
        timeout: 60_000,
      },
    );
  }

  async getSLAEvents(opts: { page?: number; limit?: number } = {}) {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
    const skip = (page - 1) * limit;

    const [events, total] = await Promise.all([
      this.prisma.slaEvent.findMany({
        include: {
          request: { select: { id: true, requestNo: true, title: true, status: true } },
          slaPolicy: {
            select: {
              id: true,
              name: true,
              requestType: { select: { key: true, name: true } },
              priority: true,
            },
          },
        },
        orderBy: { occurredAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.slaEvent.count(),
    ]);

    return {
      data: events.map((event) => ({
        id: event.id,
        eventType: event.eventType,
        occurredAt: event.occurredAt,
        resolvedAt: event.resolvedAt,
        request: event.request,
        policy: event.slaPolicy,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getAdminOverview() {
    await this.runSlaSweep();

    const [eventCounts, recentEvents, activePolicies] = await Promise.all([
      this.prisma.slaEvent.groupBy({
        by: ['eventType'],
        _count: { _all: true },
      }),
      this.prisma.slaEvent.findMany({
        include: {
          request: {
            select: {
              id: true,
              requestNo: true,
              title: true,
              status: true,
            },
          },
          slaPolicy: {
            select: {
              id: true,
              name: true,
              requestType: { select: { key: true, name: true } },
              priority: true,
            },
          },
        },
        orderBy: { occurredAt: 'desc' },
        take: 25,
      }),
      this.prisma.slaPolicy.count({ where: { isActive: true } }),
    ]);

    const countMap = new Map(
      eventCounts.map((item) => [item.eventType, item._count._all]),
    );

    return {
      metrics: {
        activePolicies,
        firstResponseBreaches:
          countMap.get('FIRST_RESPONSE_BREACHED') ?? 0,
        resolutionBreaches: countMap.get('RESOLUTION_BREACHED') ?? 0,
        escalations: countMap.get('ESCALATION_TRIGGERED') ?? 0,
        stepOverdues: countMap.get('STEP_OVERDUE') ?? 0,
      },
      recentEvents: recentEvents.map((event) => ({
        id: event.id,
        eventType: event.eventType,
        occurredAt: event.occurredAt,
        resolvedAt: event.resolvedAt,
        request: event.request,
        policy: event.slaPolicy,
      })),
    };
  }
}
