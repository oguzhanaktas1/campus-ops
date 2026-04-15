import { PrismaClient, Gender, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

// Supabase pgbouncer uzun süreli seed'lerde bağlantıyı kapatabilir.
// P1017 (server closed connection) hatası gelirse reconnect + retry yapar.
async function upsertUserSafe(user: SeedUser, hashedPassword: string): Promise<void> {
  const MAX_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await upsertUser(user, hashedPassword);
      return;
    } catch (err: unknown) {
      const isRetryable =
        err instanceof Error &&
        (err.message.includes('Server has closed the connection') ||
          err.message.includes("Can't reach database") ||
          (err as { code?: string }).code === 'P1017' ||
          (err as { code?: string }).code === 'P1001');

      if (isRetryable && attempt < MAX_RETRIES) {
        console.log(`  ⚠ Bağlantı koptu, yeniden bağlanılıyor... (deneme ${attempt}/${MAX_RETRIES})`);
        await prisma.$disconnect();
        await new Promise((r) => setTimeout(r, 3000 * attempt));
        await prisma.$connect();
      } else {
        throw err;
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────
type SeedUserRole = {
  roleName: string;
  isPrimary: boolean;
  facultyId?: string | null;
  departmentId?: string | null;
  unitId?: string | null;
};

type SeedUser = {
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  title?: string;
  gender: Gender;
  studentNumber?: string;
  staffNumber?: string;
  facultyId?: string | null;
  departmentId?: string | null;
  unitId?: string | null;
  roles: SeedUserRole[];
};

// ─────────────────────────────────────────────────────────────────
// upsertUser — aynı mantık seed.ts ile tutarlı
// ─────────────────────────────────────────────────────────────────
async function upsertUser(user: SeedUser, hashedPassword: string) {
  const existing = await prisma.user.findUnique({
    where: { email: user.email },
    include: { profile: true },
  });

  const record =
    existing ??
    (await prisma.user.create({
      data: {
        email: user.email,
        password: hashedPassword,
        isEmailVerified: true,
        status: UserStatus.ACTIVE,
      },
    }));

  await prisma.user.update({
    where: { id: record.id },
    data: {
      password: hashedPassword,
      isEmailVerified: true,
      status: UserStatus.ACTIVE,
    },
  });

  await prisma.userProfile.upsert({
    where: { userId: record.id },
    update: {
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.fullName,
      title: user.title ?? null,
      gender: user.gender,
      studentNumber: user.studentNumber ?? null,
      staffNumber: user.staffNumber ?? null,
      facultyId: user.facultyId ?? null,
      departmentId: user.departmentId ?? null,
      unitId: user.unitId ?? null,
    },
    create: {
      userId: record.id,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.fullName,
      title: user.title ?? null,
      gender: user.gender,
      studentNumber: user.studentNumber ?? null,
      staffNumber: user.staffNumber ?? null,
      facultyId: user.facultyId ?? null,
      departmentId: user.departmentId ?? null,
      unitId: user.unitId ?? null,
    },
  });

  for (const ra of user.roles) {
    const role = await prisma.role.findUniqueOrThrow({ where: { name: ra.roleName } });

    const existingRA = await prisma.userRole.findFirst({
      where: {
        userId: record.id,
        roleId: role.id,
        facultyId: ra.facultyId ?? null,
        departmentId: ra.departmentId ?? null,
        unitId: ra.unitId ?? null,
      },
    });

    if (existingRA) {
      await prisma.userRole.update({
        where: { id: existingRA.id },
        data: { isPrimary: ra.isPrimary },
      });
    } else {
      await prisma.userRole.create({
        data: {
          userId: record.id,
          roleId: role.id,
          isPrimary: ra.isPrimary,
          facultyId: ra.facultyId ?? null,
          departmentId: ra.departmentId ?? null,
          unitId: ra.unitId ?? null,
        },
      });
    }
  }

  return record;
}

// ─────────────────────────────────────────────────────────────────
// İsim havuzları
// ─────────────────────────────────────────────────────────────────
const MALE_NAMES = [
  'Ahmet', 'Mehmet', 'Mustafa', 'Ali', 'Hüseyin', 'İbrahim', 'Hasan', 'Ömer', 'Yusuf', 'İsmail',
  'Halil', 'Murat', 'Kadir', 'Osman', 'Orhan', 'Serkan', 'Burak', 'Emre', 'Cem', 'Bora',
  'Furkan', 'Fatih', 'Kemal', 'Tayfun', 'Selçuk', 'Recep', 'Soner', 'Uğur', 'Erkan', 'Levent',
  'Sinan', 'Ozan', 'Gökhan', 'Tuncay', 'Volkan', 'Erdem', 'Barış', 'Kaan', 'Alper', 'Tolga',
  'Onur', 'Umut', 'Taner', 'Cenk', 'Doğan', 'Berkay', 'Efe', 'Koray', 'Serhat', 'Aykut',
];

const FEMALE_NAMES = [
  'Ayşe', 'Fatma', 'Zeynep', 'Hatice', 'Emine', 'Elif', 'Meryem', 'Şule', 'Selin', 'Esra',
  'Cemre', 'Derya', 'Gül', 'Sevgi', 'Serap', 'Neslihan', 'Özlem', 'Büşra', 'Merve', 'Gamze',
  'Ebru', 'Gizem', 'Bahar', 'Tuğba', 'Aslı', 'Ceren', 'Dilara', 'Melike', 'İpek', 'Hande',
  'Tuba', 'Aysun', 'Nuray', 'Pınar', 'Sibel', 'Yasemin', 'Nilüfer', 'Arzu', 'Berna', 'Damla',
  'Hilal', 'Jale', 'Nazlı', 'Deniz', 'Sevinç', 'Gülay', 'Sevim', 'Ülkü', 'Füsun', 'Latife',
];

const SURNAMES = [
  'Yılmaz', 'Kaya', 'Demir', 'Çelik', 'Şahin', 'Yıldız', 'Yıldırım', 'Öztürk', 'Aydın', 'Özdemir',
  'Arslan', 'Doğan', 'Kılıç', 'Aslan', 'Çetin', 'Kara', 'Koç', 'Kurt', 'Özkan', 'Şimşek',
  'Polat', 'Güneş', 'Bulut', 'Acar', 'Tekin', 'Korkmaz', 'Duman', 'Coşkun', 'Yalçın', 'Güler',
  'Ateş', 'Bozkurt', 'Aktaş', 'Kaplan', 'Çakır', 'Keskin', 'Demirci', 'Özçelik', 'Karadağ', 'Durmaz',
  'Soylu', 'Başaran', 'Aksoy', 'Tunç', 'Güven', 'Uzun', 'Toprak', 'Sarı', 'Ercan', 'Erdoğan',
  'Karahan', 'Bektaş', 'Taşkın', 'Uçar', 'Önder', 'Doğru', 'Albayrak', 'Kuzu', 'Köse', 'Ay',
];

const FACULTY_TITLES = [
  'Professor',
  'Associate Professor',
  'Assistant Professor',
  'Lecturer',
  'Research Assistant',
];

function pick<T>(arr: T[], idx: number): T {
  return arr[idx % arr.length];
}

function makeName(offset: number): { firstName: string; lastName: string; gender: Gender } {
  const isMale = offset % 2 === 0;
  const firstName = isMale
    ? pick(MALE_NAMES, Math.floor(offset / 2))
    : pick(FEMALE_NAMES, Math.floor(offset / 2));
  const lastName = pick(SURNAMES, offset);
  return { firstName, lastName, gender: isMale ? Gender.MALE : Gender.FEMALE };
}

// ─────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────
async function main() {
  console.log('🌱 Seeding bulk users...\n');

  const hash = await bcrypt.hash('aaaaaa', 10);

  // ── Org varlıklarını çek ──────────────────────────────────────
  const engFaculty = await prisma.faculty.findUniqueOrThrow({ where: { code: 'ENG' } });
  const artsFaculty = await prisma.faculty.findUniqueOrThrow({ where: { code: 'ARTS' } });
  const busFaculty = await prisma.faculty.findUniqueOrThrow({ where: { code: 'BUS' } });

  const csDept = await prisma.department.findUniqueOrThrow({ where: { code: 'CS' } });
  const eeDept = await prisma.department.findUniqueOrThrow({ where: { code: 'EE' } });
  const mathDept = await prisma.department.findUniqueOrThrow({ where: { code: 'MATH' } });
  const physDept = await prisma.department.findUniqueOrThrow({ where: { code: 'PHYS' } });
  const baDept = await prisma.department.findUniqueOrThrow({ where: { code: 'BA' } });

  const itUnit = await prisma.unit.findUniqueOrThrow({ where: { code: 'IT-DEPT' } });
  const adminUnit = await prisma.unit.findUniqueOrThrow({ where: { code: 'ADMIN-OPS' } });
  const resourceUnit = await prisma.unit.findUniqueOrThrow({ where: { code: 'RESOURCE-OPS' } });
  const procurementUnit = await prisma.unit.findUniqueOrThrow({ where: { code: 'PROCUREMENT' } });
  const securityUnit = await prisma.unit.findUniqueOrThrow({ where: { code: 'SECURITY' } });
  const documentUnit = await prisma.unit.findUniqueOrThrow({ where: { code: 'DOCS' } });
  const systemOpsUnit = await prisma.unit.findUniqueOrThrow({ where: { code: 'SYSOPS' } });
  const financeUnit = await prisma.unit.findUniqueOrThrow({ where: { code: 'FINANCE' } });
  const labUnit = await prisma.unit.findUniqueOrThrow({ where: { code: 'LABOPS' } });
  const eventUnit = await prisma.unit.findUniqueOrThrow({ where: { code: 'EVENTS' } });

  // ─────────────────────────────────────────────────────────────
  // STUDENTS — 300 kişi
  // CS:80  EE:60  MATH:50  PHYS:50  BA:60
  // ─────────────────────────────────────────────────────────────
  console.log('📚 Creating 300 students...');

  const studentGroups = [
    { faculty: engFaculty,  dept: csDept,   count: 80 },
    { faculty: engFaculty,  dept: eeDept,   count: 60 },
    { faculty: artsFaculty, dept: mathDept, count: 50 },
    { faculty: artsFaculty, dept: physDept, count: 50 },
    { faculty: busFaculty,  dept: baDept,   count: 60 },
  ];

  let sIdx = 0; // global student offset for name picking
  for (const grp of studentGroups) {
    for (let i = 0; i < grp.count; i++, sIdx++) {
      const { firstName, lastName, gender } = makeName(sIdx);
      const num = String(sIdx + 1).padStart(5, '0');

      await upsertUserSafe(
        {
          email: `s.${num}@campusops.edu.tr`,
          firstName,
          lastName,
          fullName: `${firstName} ${lastName}`,
          gender,
          studentNumber: `STU-${num}`,
          facultyId: grp.faculty.id,
          departmentId: grp.dept.id,
          roles: [
            {
              roleName: 'STUDENT',
              isPrimary: true,
              facultyId: grp.faculty.id,
              departmentId: grp.dept.id,
            },
          ],
        },
        hash,
      );

      if ((sIdx + 1) % 50 === 0) {
        console.log(`  ↳ ${sIdx + 1}/300 students created`);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // FACULTY — 50 kişi (ana rol + yan rol dağılımı)
  //
  //  CS  (12): 5 saf FACULTY | 4 + ADVISOR | 2 + DEPT_CHAIR | 1 + INTERNSHIP_COORD
  //  EE   (8): 4 saf FACULTY | 3 + ADVISOR | 1 + DEPT_CHAIR
  //  MATH (8): 4 saf FACULTY | 2 + ADVISOR | 1 + DEPT_CHAIR | 1 + INTERNSHIP_COORD
  //  PHYS (7): 4 saf FACULTY | 2 + ADVISOR | 1 + ADVISOR+DEPT_CHAIR
  //  BA  (15): 7 saf FACULTY | 4 + ADVISOR | 1 + DEPT_CHAIR | 1 + INTERNSHIP_COORD
  //            1 + ADVISOR+INTERNSHIP_COORD | 1 + ADVISOR+DEPT_CHAIR
  // ─────────────────────────────────────────────────────────────
  console.log('\n🎓 Creating 50 faculty members...');

  type FacultyCfg = {
    faculty: typeof engFaculty;
    dept: typeof csDept;
    sideRoles?: string[];
  };

  const facultyCfg: FacultyCfg[] = [
    // ── CS ──────────────────────────────────────────────────────
    ...Array.from({ length: 5 }, () => ({ faculty: engFaculty, dept: csDept })),
    ...Array.from({ length: 4 }, () => ({ faculty: engFaculty, dept: csDept, sideRoles: ['ADVISOR'] })),
    ...Array.from({ length: 2 }, () => ({ faculty: engFaculty, dept: csDept, sideRoles: ['DEPARTMENT_CHAIR'] })),
    { faculty: engFaculty, dept: csDept, sideRoles: ['INTERNSHIP_COORDINATOR'] },

    // ── EE ──────────────────────────────────────────────────────
    ...Array.from({ length: 4 }, () => ({ faculty: engFaculty, dept: eeDept })),
    ...Array.from({ length: 3 }, () => ({ faculty: engFaculty, dept: eeDept, sideRoles: ['ADVISOR'] })),
    { faculty: engFaculty, dept: eeDept, sideRoles: ['DEPARTMENT_CHAIR'] },

    // ── MATH ────────────────────────────────────────────────────
    ...Array.from({ length: 4 }, () => ({ faculty: artsFaculty, dept: mathDept })),
    ...Array.from({ length: 2 }, () => ({ faculty: artsFaculty, dept: mathDept, sideRoles: ['ADVISOR'] })),
    { faculty: artsFaculty, dept: mathDept, sideRoles: ['DEPARTMENT_CHAIR'] },
    { faculty: artsFaculty, dept: mathDept, sideRoles: ['INTERNSHIP_COORDINATOR'] },

    // ── PHYS ────────────────────────────────────────────────────
    ...Array.from({ length: 4 }, () => ({ faculty: artsFaculty, dept: physDept })),
    ...Array.from({ length: 2 }, () => ({ faculty: artsFaculty, dept: physDept, sideRoles: ['ADVISOR'] })),
    { faculty: artsFaculty, dept: physDept, sideRoles: ['ADVISOR', 'DEPARTMENT_CHAIR'] },

    // ── BA ──────────────────────────────────────────────────────
    ...Array.from({ length: 7 }, () => ({ faculty: busFaculty, dept: baDept })),
    ...Array.from({ length: 4 }, () => ({ faculty: busFaculty, dept: baDept, sideRoles: ['ADVISOR'] })),
    { faculty: busFaculty, dept: baDept, sideRoles: ['DEPARTMENT_CHAIR'] },
    { faculty: busFaculty, dept: baDept, sideRoles: ['INTERNSHIP_COORDINATOR'] },
    { faculty: busFaculty, dept: baDept, sideRoles: ['ADVISOR', 'INTERNSHIP_COORDINATOR'] },
    { faculty: busFaculty, dept: baDept, sideRoles: ['ADVISOR', 'DEPARTMENT_CHAIR'] },
  ];
  // Toplam: (5+4+2+1)+(4+3+1)+(4+2+1+1)+(4+2+1)+(7+4+1+1+1+1) = 12+8+8+7+15 = 50 ✓

  for (let i = 0; i < facultyCfg.length; i++) {
    const cfg = facultyCfg[i];
    const { firstName, lastName, gender } = makeName(i + 300); // offset 300
    const num = String(i + 1).padStart(3, '0');
    const title = pick(FACULTY_TITLES, i);

    const roles: SeedUserRole[] = [
      {
        roleName: 'FACULTY',
        isPrimary: true,
        facultyId: cfg.faculty.id,
        departmentId: cfg.dept.id,
      },
      ...(cfg.sideRoles ?? []).map((r) => ({
        roleName: r,
        isPrimary: false,
        facultyId: cfg.faculty.id,
        departmentId: cfg.dept.id,
      })),
    ];

    await upsertUser(
      {
        email: `f.${num}@campusops.edu.tr`,
        firstName,
        lastName,
        fullName: `${firstName} ${lastName}`,
        title,
        gender,
        staffNumber: `FC-B-${num}`,
        facultyId: cfg.faculty.id,
        departmentId: cfg.dept.id,
        roles,
      },
      hash,
    );

    const roleStr = roles.map((r) => r.roleName).join(' + ');
    console.log(`  ✓ [${num}] ${firstName} ${lastName} — ${roleStr}`);
  }

  // ─────────────────────────────────────────────────────────────
  // STAFF — 25 kişi (ana STAFF + yan rol dağılımı)
  //
  //  IT birim       : 2× IT_AGENT | 1× IT_MANAGER
  //  Kaynak birim   : 2× RESOURCE_MANAGER
  //  Satın alma     : 2× PROCUREMENT_OFFICER
  //  Güvenlik       : 2× SECURITY_OFFICER
  //  Evrak          : 2× DOCUMENT_OFFICER
  //  Sistem ops     : 1× SYSTEM_OWNER
  //  Finans         : 1× BUDGET_APPROVER | 1× FINANCE_OFFICER | 1× FINANCE+BUDGET
  //  Lab            : 2× LAB_TECHNICIAN
  //  Etkinlik       : 2× EVENT_COORDINATOR | 1× EVENT_COORDINATOR+ORGANIZER
  //  Fakülte sek.   : 2× FACULTY_SECRETARY
  //  Organizatör    : 2× ORGANIZER
  //  Saf STAFF      : 2× (idari genel)
  // ─────────────────────────────────────────────────────────────
  console.log('\n🏢 Creating 25 staff members...');

  type StaffCfg = {
    facultyId: string;
    departmentId: string;
    unitId: string;
    sideRoles?: string[];
    title: string;
  };

  const staffCfg: StaffCfg[] = [
    // IT birimi
    { facultyId: engFaculty.id, departmentId: csDept.id, unitId: itUnit.id, sideRoles: ['IT_AGENT'], title: 'IT Support Specialist' },
    { facultyId: engFaculty.id, departmentId: csDept.id, unitId: itUnit.id, sideRoles: ['IT_AGENT'], title: 'IT Support Specialist' },
    { facultyId: engFaculty.id, departmentId: csDept.id, unitId: itUnit.id, sideRoles: ['IT_MANAGER'], title: 'IT Manager' },

    // Kaynak yönetimi
    { facultyId: engFaculty.id, departmentId: eeDept.id, unitId: resourceUnit.id, sideRoles: ['RESOURCE_MANAGER'], title: 'Resource Manager' },
    { facultyId: engFaculty.id, departmentId: eeDept.id, unitId: resourceUnit.id, sideRoles: ['RESOURCE_MANAGER'], title: 'Resource Coordinator' },

    // Satın alma
    { facultyId: busFaculty.id, departmentId: baDept.id, unitId: procurementUnit.id, sideRoles: ['PROCUREMENT_OFFICER'], title: 'Procurement Officer' },
    { facultyId: busFaculty.id, departmentId: baDept.id, unitId: procurementUnit.id, sideRoles: ['PROCUREMENT_OFFICER'], title: 'Procurement Specialist' },

    // Güvenlik
    { facultyId: artsFaculty.id, departmentId: physDept.id, unitId: securityUnit.id, sideRoles: ['SECURITY_OFFICER'], title: 'Security Officer' },
    { facultyId: artsFaculty.id, departmentId: physDept.id, unitId: securityUnit.id, sideRoles: ['SECURITY_OFFICER'], title: 'Security Supervisor' },

    // Evrak işleri
    { facultyId: artsFaculty.id, departmentId: mathDept.id, unitId: documentUnit.id, sideRoles: ['DOCUMENT_OFFICER'], title: 'Document Officer' },
    { facultyId: artsFaculty.id, departmentId: mathDept.id, unitId: documentUnit.id, sideRoles: ['DOCUMENT_OFFICER'], title: 'Records Officer' },

    // Sistem sahipliği
    { facultyId: engFaculty.id, departmentId: csDept.id, unitId: systemOpsUnit.id, sideRoles: ['SYSTEM_OWNER'], title: 'System Owner' },

    // Finans
    { facultyId: busFaculty.id, departmentId: baDept.id, unitId: financeUnit.id, sideRoles: ['BUDGET_APPROVER'], title: 'Budget Approver' },
    { facultyId: busFaculty.id, departmentId: baDept.id, unitId: financeUnit.id, sideRoles: ['FINANCE_OFFICER'], title: 'Finance Officer' },
    { facultyId: busFaculty.id, departmentId: baDept.id, unitId: financeUnit.id, sideRoles: ['FINANCE_OFFICER', 'BUDGET_APPROVER'], title: 'Senior Finance Officer' },

    // Lab
    { facultyId: engFaculty.id, departmentId: eeDept.id, unitId: labUnit.id, sideRoles: ['LAB_TECHNICIAN'], title: 'Lab Technician' },
    { facultyId: engFaculty.id, departmentId: eeDept.id, unitId: labUnit.id, sideRoles: ['LAB_TECHNICIAN'], title: 'Lab Coordinator' },

    // Etkinlik
    { facultyId: artsFaculty.id, departmentId: mathDept.id, unitId: eventUnit.id, sideRoles: ['EVENT_COORDINATOR'], title: 'Event Coordinator' },
    { facultyId: artsFaculty.id, departmentId: mathDept.id, unitId: eventUnit.id, sideRoles: ['EVENT_COORDINATOR'], title: 'Event Coordinator' },
    { facultyId: busFaculty.id,  departmentId: baDept.id,   unitId: eventUnit.id, sideRoles: ['EVENT_COORDINATOR', 'ORGANIZER'], title: 'Senior Event Coordinator' },

    // Fakülte sekreterleri
    { facultyId: engFaculty.id,  departmentId: csDept.id,   unitId: adminUnit.id, sideRoles: ['FACULTY_SECRETARY'], title: 'Faculty Secretary' },
    { facultyId: artsFaculty.id, departmentId: mathDept.id, unitId: adminUnit.id, sideRoles: ['FACULTY_SECRETARY'], title: 'Faculty Secretary' },

    // Organizatörler (standalone STAFF + ORGANIZER)
    { facultyId: artsFaculty.id, departmentId: mathDept.id, unitId: eventUnit.id, sideRoles: ['ORGANIZER'], title: 'Event Organizer' },
    { facultyId: busFaculty.id,  departmentId: baDept.id,   unitId: eventUnit.id, sideRoles: ['ORGANIZER'], title: 'Event Organizer' },

    // Genel idari
    { facultyId: busFaculty.id, departmentId: baDept.id, unitId: adminUnit.id, title: 'Administrative Specialist' },
  ];
  // Toplam: 3+2+2+2+2+1+3+2+3+2+2+1 = 25 ✓

  for (let i = 0; i < staffCfg.length; i++) {
    const cfg = staffCfg[i];
    const { firstName, lastName, gender } = makeName(i + 400); // offset 400
    const num = String(i + 1).padStart(3, '0');

    const roles: SeedUserRole[] = [
      {
        roleName: 'STAFF',
        isPrimary: true,
        facultyId: cfg.facultyId,
        departmentId: cfg.departmentId,
        unitId: cfg.unitId,
      },
      ...(cfg.sideRoles ?? []).map((r) => ({
        roleName: r,
        isPrimary: false,
        facultyId: cfg.facultyId,
        departmentId: cfg.departmentId,
        unitId: cfg.unitId,
      })),
    ];

    await upsertUser(
      {
        email: `p.${num}@campusops.edu.tr`,
        firstName,
        lastName,
        fullName: `${firstName} ${lastName}`,
        title: cfg.title,
        gender,
        staffNumber: `SF-B-${num}`,
        facultyId: cfg.facultyId,
        departmentId: cfg.departmentId,
        unitId: cfg.unitId,
        roles,
      },
      hash,
    );

    const roleStr = roles.map((r) => r.roleName).join(' + ');
    console.log(`  ✓ [${num}] ${firstName} ${lastName} — ${cfg.title} (${roleStr})`);
  }

  // ─────────────────────────────────────────────────────────────
  // ADMINS — 5 kişi
  // ─────────────────────────────────────────────────────────────
  console.log('\n🔑 Creating 5 admins...');

  const adminTitles = [
    'Chief Administrator',
    'System Administrator',
    'Platform Administrator',
    'Operations Administrator',
    'Security Administrator',
  ];

  for (let i = 0; i < 5; i++) {
    const { firstName, lastName, gender } = makeName(i + 500); // offset 500
    const num = String(i + 1).padStart(3, '0');

    await upsertUser(
      {
        email: `a.${num}@campusops.edu.tr`,
        firstName,
        lastName,
        fullName: `${firstName} ${lastName}`,
        title: adminTitles[i],
        gender,
        staffNumber: `AM-B-${num}`,
        roles: [{ roleName: 'ADMIN', isPrimary: true }],
      },
      hash,
    );

    console.log(`  ✓ [${num}] ${firstName} ${lastName} — ${adminTitles[i]}`);
  }

  // ─────────────────────────────────────────────────────────────
  // ORGANIZERS — 10 kişi (sadece ORGANIZER rolü, yan rol yok)
  // ─────────────────────────────────────────────────────────────
  console.log('\n🎪 Creating 10 organizers...');

  for (let i = 0; i < 10; i++) {
    const { firstName, lastName, gender } = makeName(i + 600); // offset 600
    const num = String(i + 1).padStart(3, '0');

    await upsertUserSafe(
      {
        email: `org.${num}@campusops.edu.tr`,
        firstName,
        lastName,
        fullName: `${firstName} ${lastName}`,
        title: 'Event Organizer',
        gender,
        staffNumber: `ORG-B-${num}`,
        roles: [{ roleName: 'ORGANIZER', isPrimary: true }],
      },
      hash,
    );

    console.log(`  ✓ [${num}] ${firstName} ${lastName} — ORGANIZER`);
  }

  // ─────────────────────────────────────────────────────────────
  // Özet
  // ─────────────────────────────────────────────────────────────
  const totalUsers = await prisma.user.count();
  const totalStudents = await prisma.userProfile.count({ where: { studentNumber: { startsWith: 'STU-' } } });

  console.log('\n✅ Bulk seed tamamlandı.');
  console.log(`   Toplam kullanıcı (veritabanında): ${totalUsers}`);
  console.log(`   Bu seed'den ogrenci  : ${totalStudents}`);
  console.log(`   Bu seed'den ogretim  : ${facultyCfg.length} (50 hedef)`);
  console.log(`   Bu seed'den personel : ${staffCfg.length} (25 hedef)`);
  console.log(`   Bu seed'den admin    : 5`);
  console.log('   Tum kullanici sifresi: aaaaaa');

  // Yan rollü kullanıcılar özeti
  console.log('\n📋 Yan rollü faculty:');
  facultyCfg.forEach((cfg, i) => {
    if (cfg.sideRoles && cfg.sideRoles.length > 0) {
      const num = String(i + 1).padStart(3, '0');
      console.log(`   f.${num}@campusops.edu.tr → FACULTY + ${cfg.sideRoles.join(' + ')}`);
    }
  });

  console.log('\n📋 Yan rollü staff:');
  staffCfg.forEach((cfg, i) => {
    if (cfg.sideRoles && cfg.sideRoles.length > 0) {
      const num = String(i + 1).padStart(3, '0');
      console.log(`   p.${num}@campusops.edu.tr → STAFF + ${cfg.sideRoles.join(' + ')}`);
    }
  });
}

main()
  .catch((e) => {
    console.error('❌ Seed hatası:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
