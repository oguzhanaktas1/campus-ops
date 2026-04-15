import { PrismaClient, Gender, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

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
  staffNumber?: string;
  roles: SeedUserRole[];
};

// ─────────────────────────────────────────────────────────────────
// Retry-safe upsert (P1017 bağlantı kopması için)
// ─────────────────────────────────────────────────────────────────
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
      staffNumber: user.staffNumber ?? null,
    },
    create: {
      userId: record.id,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.fullName,
      title: user.title ?? null,
      gender: user.gender,
      staffNumber: user.staffNumber ?? null,
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
];

const FEMALE_NAMES = [
  'Ayşe', 'Fatma', 'Zeynep', 'Hatice', 'Emine', 'Elif', 'Meryem', 'Şule', 'Selin', 'Esra',
  'Cemre', 'Derya', 'Gül', 'Sevgi', 'Serap', 'Neslihan', 'Özlem', 'Büşra', 'Merve', 'Gamze',
  'Ebru', 'Gizem', 'Bahar', 'Tuğba', 'Aslı', 'Ceren', 'Dilara', 'Melike', 'İpek', 'Hande',
];

const SURNAMES = [
  'Yılmaz', 'Kaya', 'Demir', 'Çelik', 'Şahin', 'Yıldız', 'Yıldırım', 'Öztürk', 'Aydın', 'Özdemir',
  'Arslan', 'Doğan', 'Kılıç', 'Aslan', 'Çetin', 'Kara', 'Koç', 'Kurt', 'Özkan', 'Şimşek',
  'Polat', 'Güneş', 'Bulut', 'Acar', 'Tekin', 'Korkmaz', 'Duman', 'Coşkun', 'Yalçın', 'Güler',
];

function pick<T>(arr: T[], idx: number): T {
  return arr[idx % arr.length];
}

// Offset 620 — mevcut organizer'larla (600-609) çakışmaz
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
  console.log('🎪 Seeding 20 organizers (primary role only)...\n');

  const hash = await bcrypt.hash('aaaaaa', 10);

  for (let i = 0; i < 20; i++) {
    // offset 620 → users_seed.ts'deki org.001-010 (offset 600-609) ile çakışmaz
    const { firstName, lastName, gender } = makeName(i + 620);
    // org2.001 … org2.020 — mevcut org.001-010'dan ayrı prefix
    const num = String(i + 1).padStart(3, '0');

    await upsertUserSafe(
      {
        email: `org2.${num}@campusops.edu.tr`,
        firstName,
        lastName,
        fullName: `${firstName} ${lastName}`,
        title: 'Event Organizer',
        gender,
        staffNumber: `ORG2-B-${num}`,
        roles: [
          {
            roleName: 'ORGANIZER',
            isPrimary: true,
          },
        ],
      },
      hash,
    );

    console.log(`  ✓ [${num}] ${firstName} ${lastName} — ORGANIZER (org2.${num}@campusops.edu.tr)`);
  }

  console.log('\n✅ Organizer seed tamamlandı.');
  console.log('   20 kullanıcı oluşturuldu: org2.001 … org2.020@campusops.edu.tr');
  console.log('   Ana rol : ORGANIZER (isPrimary: true)');
  console.log('   Yan rol : YOK');
  console.log('   Şifre   : aaaaaa');
}

main()
  .catch((e) => {
    console.error('❌ Seed hatası:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
