import { PrismaClient, ResourceType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Resources...\n');

  // Ana kampüs ID'sini çek
  const campus = await prisma.campus.findUnique({ where: { code: 'MAIN' } });
  if (!campus) {
    console.error('❌ Campus MAIN not found. Run seed.ts first.');
    process.exit(1);
  }

  const facultyEng = await prisma.faculty.findUnique({ where: { code: 'ENG' } });
  const facultyArts = await prisma.faculty.findUnique({ where: { code: 'ARTS' } });
  const deptCS = await prisma.department.findUnique({ where: { code: 'CS' } });
  const unitIT = await prisma.unit.findUnique({ where: { code: 'IT-DEPT' } });

  const resources = [
    // ─────────────────────────────────────────────────────────────
    // ROOMS — Toplantı / Ders odaları (Rezervasyon için)
    // ─────────────────────────────────────────────────────────────
    {
      code: 'ROOM-A101',
      name: 'Lecture Hall A-101',
      resourceType: ResourceType.ROOM,
      campusId: campus.id,
      facultyId: facultyEng?.id ?? null,
      locationText: 'Engineering Building, Block A, Floor 1',
      capacity: 120,
      description: 'Large lecture hall with projector and sound system.',
      metadataJson: { hasProjector: true, hasWhiteboard: true, hasMicrophone: true },
    },
    {
      code: 'ROOM-A201',
      name: 'Seminar Room A-201',
      resourceType: ResourceType.ROOM,
      campusId: campus.id,
      facultyId: facultyEng?.id ?? null,
      locationText: 'Engineering Building, Block A, Floor 2',
      capacity: 40,
      description: 'Medium-sized seminar room with whiteboard and projector.',
      metadataJson: { hasProjector: true, hasWhiteboard: true },
    },
    {
      code: 'ROOM-B104',
      name: 'Conference Room B-104',
      resourceType: ResourceType.ROOM,
      campusId: campus.id,
      locationText: 'Main Building, Block B, Floor 1',
      capacity: 20,
      description: 'Conference room with video conferencing equipment.',
      metadataJson: { hasProjector: true, hasVideoConference: true },
    },
    {
      code: 'ROOM-C301',
      name: 'Arts Lecture Hall C-301',
      resourceType: ResourceType.ROOM,
      campusId: campus.id,
      facultyId: facultyArts?.id ?? null,
      locationText: 'Arts Building, Block C, Floor 3',
      capacity: 80,
      description: 'Lecture hall for arts and humanities faculty.',
      metadataJson: { hasProjector: true, hasWhiteboard: true },
    },
    {
      code: 'ROOM-MULTI',
      name: 'Multipurpose Hall',
      resourceType: ResourceType.ROOM,
      campusId: campus.id,
      locationText: 'Student Center, Ground Floor',
      capacity: 300,
      description: 'Large multipurpose hall for events, conferences and ceremonies.',
      metadataJson: { hasStage: true, hasAV: true, hasMicrophone: true },
    },

    // ─────────────────────────────────────────────────────────────
    // LABS — Laboratuvarlar (Rezervasyon için)
    // ─────────────────────────────────────────────────────────────
    {
      code: 'LAB-CS1',
      name: 'Computer Lab CS-1',
      resourceType: ResourceType.LAB,
      campusId: campus.id,
      facultyId: facultyEng?.id ?? null,
      departmentId: deptCS?.id ?? null,
      locationText: 'Engineering Building, Block D, Floor 1',
      capacity: 30,
      description: 'Computer lab with 30 workstations, dual monitors.',
      metadataJson: { computers: 30, os: 'Windows 11', software: ['MATLAB', 'Visual Studio', 'Python'] },
    },
    {
      code: 'LAB-CS2',
      name: 'Computer Lab CS-2',
      resourceType: ResourceType.LAB,
      campusId: campus.id,
      facultyId: facultyEng?.id ?? null,
      departmentId: deptCS?.id ?? null,
      locationText: 'Engineering Building, Block D, Floor 2',
      capacity: 25,
      description: 'Programming lab for software engineering courses.',
      metadataJson: { computers: 25, os: 'Ubuntu 22.04', software: ['GCC', 'Docker', 'VS Code'] },
    },
    {
      code: 'LAB-EE1',
      name: 'Electronics Lab EE-1',
      resourceType: ResourceType.LAB,
      campusId: campus.id,
      facultyId: facultyEng?.id ?? null,
      locationText: 'Engineering Building, Block E, Floor 1',
      capacity: 20,
      description: 'Electronics laboratory with oscilloscopes and soldering stations.',
      metadataJson: { equipment: ['Oscilloscope', 'Multimeter', 'Soldering Station'] },
    },

    // ─────────────────────────────────────────────────────────────
    // EQUIPMENT — Ekipmanlar (Ekipman talebi için)
    // ─────────────────────────────────────────────────────────────
    {
      code: 'EQ-PROJ-01',
      name: 'Portable Projector #1',
      resourceType: ResourceType.EQUIPMENT,
      campusId: campus.id,
      unitId: unitIT?.id ?? null,
      locationText: 'IT Department Storage',
      capacity: 1,
      description: 'Portable HDMI projector, 3000 lumens. Suitable for presentations.',
      metadataJson: { brand: 'Epson', model: 'EB-X41', lumens: 3000, connections: ['HDMI', 'VGA', 'USB'] },
    },
    {
      code: 'EQ-PROJ-02',
      name: 'Portable Projector #2',
      resourceType: ResourceType.EQUIPMENT,
      campusId: campus.id,
      unitId: unitIT?.id ?? null,
      locationText: 'IT Department Storage',
      capacity: 1,
      description: 'Portable HDMI projector, 4000 lumens.',
      metadataJson: { brand: 'BenQ', model: 'MX550', lumens: 4000, connections: ['HDMI', 'VGA'] },
    },
    {
      code: 'EQ-LAPTOP-01',
      name: 'Loaner Laptop #1',
      resourceType: ResourceType.EQUIPMENT,
      campusId: campus.id,
      unitId: unitIT?.id ?? null,
      locationText: 'IT Department',
      capacity: 1,
      description: 'Dell Latitude laptop for short-term loan. Windows 11.',
      metadataJson: { brand: 'Dell', model: 'Latitude 5540', os: 'Windows 11', ram: '16GB', storage: '512GB SSD' },
    },
    {
      code: 'EQ-LAPTOP-02',
      name: 'Loaner Laptop #2',
      resourceType: ResourceType.EQUIPMENT,
      campusId: campus.id,
      unitId: unitIT?.id ?? null,
      locationText: 'IT Department',
      capacity: 1,
      description: 'Dell Latitude laptop for short-term loan. Windows 11.',
      metadataJson: { brand: 'Dell', model: 'Latitude 5540', os: 'Windows 11', ram: '16GB', storage: '512GB SSD' },
    },
    {
      code: 'EQ-CAMERA-01',
      name: 'Digital Camera #1',
      resourceType: ResourceType.EQUIPMENT,
      campusId: campus.id,
      locationText: 'Media Center',
      capacity: 1,
      description: 'Canon DSLR camera kit for student projects and events.',
      metadataJson: { brand: 'Canon', model: 'EOS 850D', includes: ['24-55mm lens', 'Tripod', 'Memory card'] },
    },
    {
      code: 'EQ-TABLET-01',
      name: 'Drawing Tablet',
      resourceType: ResourceType.EQUIPMENT,
      campusId: campus.id,
      facultyId: facultyArts?.id ?? null,
      locationText: 'Arts Department',
      capacity: 1,
      description: 'Wacom Intuos Pro drawing tablet for design projects.',
      metadataJson: { brand: 'Wacom', model: 'Intuos Pro Medium' },
    },
    {
      code: 'EQ-TRIPOD-01',
      name: 'Camera Tripod',
      resourceType: ResourceType.EQUIPMENT,
      campusId: campus.id,
      locationText: 'Media Center',
      capacity: 2,
      description: 'Adjustable camera tripod (quantity: 2 available).',
      metadataJson: { maxHeight: '180cm', type: 'Universal' },
    },
    {
      code: 'EQ-AUDIO-01',
      name: 'Portable Speaker Set',
      resourceType: ResourceType.EQUIPMENT,
      campusId: campus.id,
      locationText: 'Student Activities Office',
      capacity: 1,
      description: 'Bluetooth portable speaker set for events.',
      metadataJson: { brand: 'JBL', model: 'EON615', includes: ['2 speakers', 'Mic', 'Cables'] },
    },

    // ─────────────────────────────────────────────────────────────
    // VEHICLE — Araçlar
    // ─────────────────────────────────────────────────────────────
    {
      code: 'VEH-VAN-01',
      name: 'Campus Minibus',
      resourceType: ResourceType.VEHICLE,
      campusId: campus.id,
      locationText: 'Campus Garage',
      capacity: 15,
      description: 'University minibus for field trips and campus transport.',
      metadataJson: { seats: 15, fuelType: 'Diesel', licenseRequired: 'D' },
    },
  ];

  let created = 0;
  let skipped = 0;

  for (const r of resources) {
    const existing = await prisma.resource.findUnique({ where: { code: r.code } });
    if (existing) {
      await prisma.resource.update({ where: { code: r.code }, data: { ...r, isActive: true } });
      skipped++;
    } else {
      await prisma.resource.create({ data: { ...r, isActive: true } });
      created++;
    }
    console.log(`  ${existing ? '↺' : '✓'} [${r.resourceType}] ${r.code} — ${r.name}`);
  }

  console.log(`\n✅ Resources seeded: ${created} created, ${skipped} updated.`);
  console.log(`   ROOM: 5  |  LAB: 3  |  EQUIPMENT: 8  |  VEHICLE: 1`);
}

main()
  .catch((e) => { console.error('❌ ERROR:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
