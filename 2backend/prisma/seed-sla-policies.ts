import { PrismaClient, PriorityLevel } from '@prisma/client';

const prisma = new PrismaClient();

type SlaTemplate = {
  firstResponseMinutes: number;
  resolutionMinutes: number;
  escalationMinutes: number;
};

type RequestTypeSlaConfig = Record<PriorityLevel, SlaTemplate>;

const SLA_CONFIG: Record<string, RequestTypeSlaConfig> = {
  DOCUMENT_REQUEST: {
    LOW: {
      firstResponseMinutes: 1440, // 24 saat
      resolutionMinutes: 4320, // 3 gün
      escalationMinutes: 2880, // 2 gün
    },
    MEDIUM: {
      firstResponseMinutes: 720, // 12 saat
      resolutionMinutes: 2880, // 2 gün
      escalationMinutes: 1440, // 1 gün
    },
    HIGH: {
      firstResponseMinutes: 240, // 4 saat
      resolutionMinutes: 1440, // 1 gün
      escalationMinutes: 720, // 12 saat
    },
    URGENT: {
      firstResponseMinutes: 60, // 1 saat
      resolutionMinutes: 480, // 8 saat
      escalationMinutes: 120, // 2 saat
    },
  },

  ROOM_RESERVATION: {
    LOW: {
      firstResponseMinutes: 720,
      resolutionMinutes: 2880,
      escalationMinutes: 1440,
    },
    MEDIUM: {
      firstResponseMinutes: 240,
      resolutionMinutes: 1440,
      escalationMinutes: 720,
    },
    HIGH: {
      firstResponseMinutes: 120,
      resolutionMinutes: 720,
      escalationMinutes: 240,
    },
    URGENT: {
      firstResponseMinutes: 30,
      resolutionMinutes: 240,
      escalationMinutes: 60,
    },
  },

  APPOINTMENT: {
    LOW: {
      firstResponseMinutes: 1440,
      resolutionMinutes: 4320,
      escalationMinutes: 2880,
    },
    MEDIUM: {
      firstResponseMinutes: 720,
      resolutionMinutes: 2880,
      escalationMinutes: 1440,
    },
    HIGH: {
      firstResponseMinutes: 240,
      resolutionMinutes: 1440,
      escalationMinutes: 720,
    },
    URGENT: {
      firstResponseMinutes: 60,
      resolutionMinutes: 480,
      escalationMinutes: 120,
    },
  },

  IT_SUPPORT: {
    LOW: {
      firstResponseMinutes: 240, // 4 saat
      resolutionMinutes: 2880, // 2 gün
      escalationMinutes: 720, // 12 saat
    },
    MEDIUM: {
      firstResponseMinutes: 120, // 2 saat
      resolutionMinutes: 1440, // 1 gün
      escalationMinutes: 480, // 8 saat
    },
    HIGH: {
      firstResponseMinutes: 30, // 30 dk
      resolutionMinutes: 480, // 8 saat
      escalationMinutes: 120, // 2 saat
    },
    URGENT: {
      firstResponseMinutes: 15, // 15 dk
      resolutionMinutes: 120, // 2 saat
      escalationMinutes: 30, // 30 dk
    },
  },

  EQUIPMENT: {
    LOW: {
      firstResponseMinutes: 1440,
      resolutionMinutes: 5760, // 4 gün
      escalationMinutes: 2880,
    },
    MEDIUM: {
      firstResponseMinutes: 720,
      resolutionMinutes: 4320,
      escalationMinutes: 1440,
    },
    HIGH: {
      firstResponseMinutes: 240,
      resolutionMinutes: 1440,
      escalationMinutes: 720,
    },
    URGENT: {
      firstResponseMinutes: 60,
      resolutionMinutes: 480,
      escalationMinutes: 120,
    },
  },

  INTERNSHIP_REQUEST: {
    LOW: {
      firstResponseMinutes: 1440,
      resolutionMinutes: 10080, // 7 gün
      escalationMinutes: 4320, // 3 gün
    },
    MEDIUM: {
      firstResponseMinutes: 720,
      resolutionMinutes: 7200, // 5 gün
      escalationMinutes: 2880,
    },
    HIGH: {
      firstResponseMinutes: 240,
      resolutionMinutes: 4320, // 3 gün
      escalationMinutes: 1440,
    },
    URGENT: {
      firstResponseMinutes: 60,
      resolutionMinutes: 1440, // 1 gün
      escalationMinutes: 240,
    },
  },

  ACCESS_REQUEST: {
    LOW: {
      firstResponseMinutes: 720,
      resolutionMinutes: 4320,
      escalationMinutes: 1440,
    },
    MEDIUM: {
      firstResponseMinutes: 240,
      resolutionMinutes: 2880,
      escalationMinutes: 720,
    },
    HIGH: {
      firstResponseMinutes: 60,
      resolutionMinutes: 720,
      escalationMinutes: 240,
    },
    URGENT: {
      firstResponseMinutes: 15,
      resolutionMinutes: 240,
      escalationMinutes: 60,
    },
  },

  PROCUREMENT_REQUEST: {
    LOW: {
      firstResponseMinutes: 1440,
      resolutionMinutes: 10080,
      escalationMinutes: 4320,
    },
    MEDIUM: {
      firstResponseMinutes: 720,
      resolutionMinutes: 7200,
      escalationMinutes: 2880,
    },
    HIGH: {
      firstResponseMinutes: 240,
      resolutionMinutes: 4320,
      escalationMinutes: 1440,
    },
    URGENT: {
      firstResponseMinutes: 60,
      resolutionMinutes: 1440,
      escalationMinutes: 240,
    },
  },

  EVENT_REQUEST: {
    LOW: {
      firstResponseMinutes: 1440,
      resolutionMinutes: 5760,
      escalationMinutes: 2880,
    },
    MEDIUM: {
      firstResponseMinutes: 720,
      resolutionMinutes: 4320,
      escalationMinutes: 1440,
    },
    HIGH: {
      firstResponseMinutes: 240,
      resolutionMinutes: 1440,
      escalationMinutes: 720,
    },
    URGENT: {
      firstResponseMinutes: 60,
      resolutionMinutes: 480,
      escalationMinutes: 120,
    },
  },
};

const ALL_PRIORITIES: PriorityLevel[] = [
  PriorityLevel.LOW,
  PriorityLevel.MEDIUM,
  PriorityLevel.HIGH,
  PriorityLevel.URGENT,
];

async function upsertSlaPolicyByCompositeFallback(params: {
  requestTypeId: string;
  requestTypeKey: string;
  priority: PriorityLevel;
  config: SlaTemplate;
}) {
  const { requestTypeId, requestTypeKey, priority, config } = params;

  const existing = await prisma.slaPolicy.findFirst({
    where: {
      requestTypeId,
      priority,
    },
  });

  const name = `${requestTypeKey}_${priority}_SLA`;

  if (existing) {
    return prisma.slaPolicy.update({
      where: { id: existing.id },
      data: {
        name,
        firstResponseMinutes: config.firstResponseMinutes,
        resolutionMinutes: config.resolutionMinutes,
        escalationMinutes: config.escalationMinutes,
        isActive: true,
      },
    });
  }

  return prisma.slaPolicy.create({
    data: {
      name,
      requestTypeId,
      priority,
      firstResponseMinutes: config.firstResponseMinutes,
      resolutionMinutes: config.resolutionMinutes,
      escalationMinutes: config.escalationMinutes,
      isActive: true,
    },
  });
}

async function main() {
  const requestTypes = await prisma.requestType.findMany({
    select: {
      id: true,
      key: true,
      name: true,
    },
  });

  if (requestTypes.length === 0) {
    throw new Error('No RequestType records found.');
  }

  for (const requestType of requestTypes) {
    const configForType = SLA_CONFIG[requestType.key];

    if (!configForType) {
      console.warn(
        `Skipping SLA seed for request type '${requestType.key}' because no config exists.`,
      );
      continue;
    }

    for (const priority of ALL_PRIORITIES) {
      const config = configForType[priority];

      await upsertSlaPolicyByCompositeFallback({
        requestTypeId: requestType.id,
        requestTypeKey: requestType.key,
        priority,
        config,
      });

      console.log(
        `Seeded SLA policy -> requestType: ${requestType.key}, priority: ${priority}`,
      );
    }
  }

  console.log('All SLA policies seeded successfully.');
}

main()
  .catch((error) => {
    console.error('SLA policy seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
