import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────
// REQUEST TYPE KEYS — domain servisleriyle hizalı
// ─────────────────────────────────────────────────────────────
const DOMAIN_KEYS = [
  'DOCUMENT_REQUEST',    // documents.service.ts
  'ROOM_RESERVATION',    // reservations.service.ts
  'APPOINTMENT',         // appointments.service.ts
  'IT_SUPPORT',          // tickets.service.ts
  'EQUIPMENT',           // equipment-requests.service.ts
  'INTERNSHIP_REQUEST',  // internships.service.ts
  'ACCESS_REQUEST',      // access-requests.service.ts
  'PROCUREMENT_REQUEST', // procurement.service.ts
  'EVENT_REQUEST',       // events.service.ts
];

// Eski key → yeni key (rename listesi)
const RENAMES: Record<string, string> = {
  it_support:          'IT_SUPPORT',
  equipment:           'EQUIPMENT',
  access_request:      'ACCESS_REQUEST',
  procurement_request: 'PROCUREMENT_REQUEST',
};

async function migrate() {
  console.log('🔄 Migrating existing request type keys...');

  for (const [oldKey, newKey] of Object.entries(RENAMES)) {
    const existing = await prisma.requestType.findUnique({ where: { key: oldKey } });
    if (!existing) continue;
    const conflict = await prisma.requestType.findUnique({ where: { key: newKey } });
    if (conflict) {
      await prisma.request.updateMany({
        where: { requestTypeId: existing.id },
        data: { requestTypeId: conflict.id },
      });
      await prisma.requestType.delete({ where: { id: existing.id } });
      console.log(`  ↔  ${oldKey} → merged into existing ${newKey}`);
    } else {
      await prisma.requestType.update({
        where: { id: existing.id },
        data: { key: newKey },
      });
      console.log(`  ✏  ${oldKey} → ${newKey}`);
    }
  }

  const all = await prisma.requestType.findMany({ select: { id: true, key: true } });
  const toDelete = all.filter((r) => !DOMAIN_KEYS.includes(r.key));
  if (toDelete.length > 0) {
    const ids = toDelete.map((r) => r.id);
    await prisma.request.deleteMany({ where: { requestTypeId: { in: ids } } });
    await prisma.requestType.deleteMany({ where: { id: { in: ids } } });
    console.log(
      `  🗑  Deleted ${toDelete.length} obsolete type(s): ${toDelete.map((r) => r.key).join(', ')}`,
    );
  }
}

async function main() {
  console.log('🌱 Seeding Domain Request Types...\n');

  await migrate();

  console.log('\n📦 Upserting 9 domain module request types...');

  const requestTypes = [
    {
      key: 'DOCUMENT_REQUEST',
      name: 'Document Request',
      category: 'DOCUMENT',
      description: 'Official document requests (transcript, enrollment certificate, diploma, etc.)',
    },
    {
      key: 'ROOM_RESERVATION',
      name: 'Room / Resource Reservation',
      category: 'RESERVATION',
      description: 'Room and resource reservation requests',
    },
    {
      key: 'APPOINTMENT',
      name: 'Appointment Request',
      category: 'APPOINTMENT',
      description: 'Appointment requests between students and faculty/staff',
    },
    {
      key: 'IT_SUPPORT',
      name: 'IT Support Ticket',
      category: 'IT_SUPPORT',
      description: 'Hardware, software, network or access issue report',
    },
    {
      key: 'EQUIPMENT',
      name: 'Equipment Request',
      category: 'INVENTORY',
      description: 'Equipment loan or hardware request',
    },
    {
      key: 'INTERNSHIP_REQUEST',
      name: 'Internship Application',
      category: 'ACADEMIC',
      description: 'Student internship application requiring advisor and faculty approval',
    },
    {
      key: 'ACCESS_REQUEST',
      name: 'Access / Permission Request',
      category: 'IT_SUPPORT',
      description: 'Request for system, resource or campus area access',
    },
    {
      key: 'PROCUREMENT_REQUEST',
      name: 'Procurement Request',
      category: 'ADMINISTRATIVE',
      description: 'Purchase or procurement request for goods and services',
    },
    {
      key: 'EVENT_REQUEST',
      name: 'Event / Activity Request',
      category: 'CAMPUS_SERVICES',
      description: 'Campus event or student activity approval request',
    },
  ];

  for (const rt of requestTypes) {
    await prisma.requestType.upsert({
      where: { key: rt.key },
      update: { name: rt.name, category: rt.category, description: rt.description, isActive: true, formSchemaJson: [] },
      create: { key: rt.key, name: rt.name, category: rt.category, description: rt.description, isActive: true, formSchemaJson: [] },
    });
    console.log(`  ✓ ${rt.key}`);
  }

  console.log('\n✅ 9 domain request types seeded.');
  console.log('   All types use dedicated service forms (formSchemaJson=[])');
}

main()
  .catch((e) => {
    console.error('❌ ERROR:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
