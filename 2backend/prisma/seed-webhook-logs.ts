import { IntegrationStatus, Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const rand = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const pick = <T>(items: T[]) => items[rand(0, items.length - 1)];

const minutesAgo = (minutes: number) =>
  new Date(Date.now() - minutes * 60_000);

const WEBHOOK_BASE_URL = 'https://webhooks.campusops.example';

const integrationSeeds = [
  {
    key: 'WEBHOOK_REQUEST_STATUS',
    name: 'Request Status Webhook',
    provider: 'CampusOps Connect',
    webhookUrl: `${WEBHOOK_BASE_URL}/request-status`,
  },
  {
    key: 'WEBHOOK_SLA_ALERTS',
    name: 'SLA Alert Webhook',
    provider: 'CampusOps Connect',
    webhookUrl: `${WEBHOOK_BASE_URL}/sla-alerts`,
  },
  {
    key: 'WEBHOOK_NOTIFICATION_SYNC',
    name: 'Notification Sync Webhook',
    provider: 'CampusOps Connect',
    webhookUrl: `${WEBHOOK_BASE_URL}/notification-sync`,
  },
  {
    key: 'WEBHOOK_EXTERNAL_TICKETS',
    name: 'External Ticket Webhook',
    provider: 'ServiceDesk Bridge',
    webhookUrl: `${WEBHOOK_BASE_URL}/external-tickets`,
  },
];

type SeedIntegration = {
  id: string;
  webhookUrl: string;
};

const eventTemplates = [
  {
    type: 'request.status.changed',
    direction: 'OUTBOUND',
    method: 'POST',
    statusCode: 200,
    status: IntegrationStatus.SUCCESS,
    message: 'Request status update delivered successfully.',
  },
  {
    type: 'sla.breach.warning',
    direction: 'OUTBOUND',
    method: 'POST',
    statusCode: 202,
    status: IntegrationStatus.SUCCESS,
    message: 'SLA warning accepted by the subscriber.',
  },
  {
    type: 'notification.delivered',
    direction: 'OUTBOUND',
    method: 'POST',
    statusCode: 200,
    status: IntegrationStatus.SUCCESS,
    message: 'Notification delivery event synchronized.',
  },
  {
    type: 'ticket.escalated',
    direction: 'OUTBOUND',
    method: 'POST',
    statusCode: 500,
    status: IntegrationStatus.FAILED,
    message: 'Subscriber returned an internal server error.',
  },
  {
    type: 'request.assignment.changed',
    direction: 'OUTBOUND',
    method: 'POST',
    statusCode: 429,
    status: IntegrationStatus.RETRYING,
    message: 'Subscriber rate limit reached; retry scheduled.',
  },
  {
    type: 'external.ticket.updated',
    direction: 'INBOUND',
    method: 'POST',
    statusCode: 401,
    status: IntegrationStatus.FAILED,
    message: 'Invalid webhook signature.',
  },
  {
    type: 'workflow.step.completed',
    direction: 'OUTBOUND',
    method: 'POST',
    statusCode: null,
    status: IntegrationStatus.PENDING,
    message: 'Webhook delivery is queued.',
  },
];

async function main() {
  console.log('Seeding webhook logs...');

  const integrations: SeedIntegration[] = [];
  for (const seed of integrationSeeds) {
    const integration = await prisma.integration.upsert({
      where: { key: seed.key },
      update: {
        name: seed.name,
        provider: seed.provider,
        isActive: true,
        configJson: {
          webhookUrl: seed.webhookUrl,
          description: 'Seeded integration for admin webhook log demos.',
        },
      },
      create: {
        key: seed.key,
        name: seed.name,
        provider: seed.provider,
        isActive: true,
        configJson: {
          webhookUrl: seed.webhookUrl,
          description: 'Seeded integration for admin webhook log demos.',
        },
      },
    });
    integrations.push({ ...integration, webhookUrl: seed.webhookUrl });
  }

  await prisma.webhookLog.deleteMany({
    where: {
      integrationId: { in: integrations.map((integration) => integration.id) },
      endpointUrl: { startsWith: WEBHOOK_BASE_URL },
    },
  });

  const requests = await prisma.request.findMany({
    select: {
      id: true,
      requestNo: true,
      title: true,
      status: true,
      priority: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 250,
  });

  if (requests.length === 0) {
    throw new Error('No requests found. Run the base request seed before webhook log seed.');
  }

  const logs: Prisma.WebhookLogCreateManyInput[] = Array.from({ length: 180 }, (_, index) => {
    const request = pick(requests);
    const integration = pick(integrations);
    const template = pick(eventTemplates);
    const createdAt = minutesAgo(rand(5, 45 * 24 * 60));
    const deliveryId = `wh_${String(index + 1).padStart(4, '0')}`;
    const isPending = template.status === IntegrationStatus.PENDING;
    const isFailure = template.status === IntegrationStatus.FAILED;
    const durationMs = isPending ? null : rand(80, isFailure ? 4200 : 900);

    return {
      integrationId: integration.id,
      requestId: request.id,
      direction: template.direction,
      endpointUrl: integration.webhookUrl,
      httpMethod: template.method,
      requestHeadersJson: {
        'content-type': 'application/json',
        'x-campusops-event': template.type,
        'x-campusops-delivery': deliveryId,
      },
      requestBodyJson: {
        event: template.type,
        deliveryId,
        request: {
          id: request.id,
          number: request.requestNo,
          title: request.title,
          status: request.status,
          priority: request.priority,
        },
        occurredAt: createdAt.toISOString(),
      },
      responseStatusCode: template.statusCode,
      responseBodyJson: isPending
        ? Prisma.JsonNull
        : {
            success: template.status === IntegrationStatus.SUCCESS,
            message: template.message,
            durationMs,
          },
      status: template.status,
      retryCount:
        template.status === IntegrationStatus.RETRYING
          ? rand(1, 3)
          : template.status === IntegrationStatus.FAILED
            ? rand(0, 2)
            : 0,
      executedAt: isPending ? null : createdAt,
      createdAt,
    };
  });

  await prisma.webhookLog.createMany({ data: logs });

  const counts = await prisma.webhookLog.groupBy({
    by: ['status'],
    where: {
      integrationId: { in: integrations.map((integration) => integration.id) },
      endpointUrl: { startsWith: WEBHOOK_BASE_URL },
    },
    _count: { _all: true },
  });

  console.log(`Seeded ${logs.length} webhook logs.`);
  for (const count of counts) {
    console.log(`  ${count.status}: ${count._count._all}`);
  }
}

main()
  .catch((error) => {
    console.error('Webhook log seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
