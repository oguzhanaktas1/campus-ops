import { PrismaClient, RoleScope, UserStatus, Gender } from '@prisma/client';
import * as bcrypt from 'bcrypt';

// Run with: npx ts-node --transpile-only prisma/seed.ts
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seed başlatılıyor...');

  const PASSWORD = await bcrypt.hash('aaaaaa', 10);

  // ────────────────────────────────────────────────────────────────────────
  // 1. ROLES
  // ────────────────────────────────────────────────────────────────────────

  const adminRole = await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: {
      name: 'ADMIN',
      description: 'Sistem Yöneticisi – Tam erişim',
      scopeType: RoleScope.GLOBAL,
      isSystem: true,
    },
  });

  const studentRole = await prisma.role.upsert({
    where: { name: 'STUDENT' },
    update: {},
    create: {
      name: 'STUDENT',
      description: 'Öğrenci – Talep, randevu, rezervasyon',
      scopeType: RoleScope.DEPARTMENT,
      isSystem: true,
    },
  });

  const facultyRole = await prisma.role.upsert({
    where: { name: 'FACULTY' },
    update: {},
    create: {
      name: 'FACULTY',
      description: 'Akademik Personel – Onay, danışmanlık, staj',
      scopeType: RoleScope.FACULTY,
      isSystem: true,
    },
  });

  const staffRole = await prisma.role.upsert({
    where: { name: 'STAFF' },
    update: {},
    create: {
      name: 'STAFF',
      description: 'İdari/Teknik Personel – Bilet, ekipman, bakım',
      scopeType: RoleScope.UNIT,
      isSystem: true,
    },
  });

  console.log('✅ Roller oluşturuldu.');

  // ────────────────────────────────────────────────────────────────────────
  // 2. PERMISSIONS
  // ────────────────────────────────────────────────────────────────────────

  const permissions = [
    { key: 'admin.users.manage',       name: 'Manage Users',           moduleName: 'admin' },
    { key: 'admin.roles.manage',       name: 'Manage Roles',           moduleName: 'admin' },
    { key: 'admin.org.manage',         name: 'Manage Org Structure',   moduleName: 'admin' },
    { key: 'admin.requests.manage',    name: 'Manage All Requests',    moduleName: 'admin' },
    { key: 'admin.workflows.manage',   name: 'Manage Workflows',       moduleName: 'admin' },
    { key: 'requests.create',          name: 'Create Request',         moduleName: 'requests' },
    { key: 'requests.view.own',        name: 'View Own Requests',      moduleName: 'requests' },
    { key: 'requests.view.assigned',   name: 'View Assigned Requests', moduleName: 'requests' },
    { key: 'requests.approve',         name: 'Approve Requests',       moduleName: 'requests' },
    { key: 'requests.reject',          name: 'Reject Requests',        moduleName: 'requests' },
    { key: 'internships.manage',       name: 'Manage Internships',     moduleName: 'internships' },
    { key: 'tickets.manage',           name: 'Manage IT Tickets',      moduleName: 'tickets' },
    { key: 'reservations.manage',      name: 'Manage Reservations',    moduleName: 'reservations' },
    { key: 'appointments.manage',      name: 'Manage Appointments',    moduleName: 'appointments' },
    { key: 'equipment.manage',         name: 'Manage Equipment',       moduleName: 'equipment' },
  ];

  for (const p of permissions) {
    await prisma.permission.upsert({
      where: { key: p.key },
      update: {},
      create: p,
    });
  }

  console.log('✅ İzinler oluşturuldu.');

  // ────────────────────────────────────────────────────────────────────────
  // 3. CAMPUS / FACULTY / DEPARTMENT / UNIT
  // ────────────────────────────────────────────────────────────────────────

  const campus = await prisma.campus.upsert({
    where: { code: 'MAIN' },
    update: {},
    create: {
      name: 'Ana Kampüs',
      code: 'MAIN',
      address: 'Üniversite Cad. No:1, Ankara',
      isActive: true,
    },
  });

  const facultyEng = await prisma.faculty.upsert({
    where: { code: 'ENG' },
    update: {},
    create: {
      campusId: campus.id,
      name: 'Mühendislik Fakültesi',
      code: 'ENG',
      isActive: true,
    },
  });

  const facultyArts = await prisma.faculty.upsert({
    where: { code: 'ARTS' },
    update: {},
    create: {
      campusId: campus.id,
      name: 'Fen-Edebiyat Fakültesi',
      code: 'ARTS',
      isActive: true,
    },
  });

  const deptCS = await prisma.department.upsert({
    where: { code: 'CS' },
    update: {},
    create: {
      facultyId: facultyEng.id,
      name: 'Bilgisayar Mühendisliği',
      code: 'CS',
      isActive: true,
    },
  });

  const deptEE = await prisma.department.upsert({
    where: { code: 'EE' },
    update: {},
    create: {
      facultyId: facultyEng.id,
      name: 'Elektrik-Elektronik Mühendisliği',
      code: 'EE',
      isActive: true,
    },
  });

  const unitIT = await prisma.unit.upsert({
    where: { code: 'IT-DEPT' },
    update: {},
    create: {
      campusId: campus.id,
      name: 'Bilgi İşlem Daire Başkanlığı',
      code: 'IT-DEPT',
      type: 'TECHNICAL',
      isActive: true,
    },
  });

  const unitAdmin = await prisma.unit.upsert({
    where: { code: 'ADMIN-UNIT' },
    update: {},
    create: {
      campusId: campus.id,
      name: 'İdari İşler',
      code: 'ADMIN-UNIT',
      type: 'ADMINISTRATIVE',
      isActive: true,
    },
  });

  console.log('✅ Kampüs yapısı oluşturuldu.');

  // ────────────────────────────────────────────────────────────────────────
  // 4. USERS
  // ────────────────────────────────────────────────────────────────────────

  // ADMIN
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@campusops.edu.tr' },
    update: {},
    create: {
      email: 'admin@campusops.edu.tr',
      password: PASSWORD,
      isEmailVerified: true,
      status: UserStatus.ACTIVE,
      profile: {
        create: {
          firstName: 'Admin',
          lastName: 'Yönetici',
          fullName: 'Admin Yönetici',
          title: 'Sistem Yöneticisi',
          gender: Gender.MALE,
        },
      },
      primaryRoles: {
        create: { roleId: adminRole.id, isPrimary: true },
      },
    },
  });

  // STUDENT
  const studentUser = await prisma.user.upsert({
    where: { email: 'student@campusops.edu.tr' },
    update: {},
    create: {
      email: 'student@campusops.edu.tr',
      password: PASSWORD,
      isEmailVerified: true,
      status: UserStatus.ACTIVE,
      profile: {
        create: {
          firstName: 'Ali',
          lastName: 'Öğrenci',
          fullName: 'Ali Öğrenci',
          studentNumber: 'ST-2024-001',
          facultyId: facultyEng.id,
          departmentId: deptCS.id,
          gender: Gender.MALE,
        },
      },
      primaryRoles: {
        create: { roleId: studentRole.id, isPrimary: true, facultyId: facultyEng.id, departmentId: deptCS.id },
      },
    },
  });

  // FACULTY MEMBER
  const facultyUser = await prisma.user.upsert({
    where: { email: 'faculty@campusops.edu.tr' },
    update: {},
    create: {
      email: 'faculty@campusops.edu.tr',
      password: PASSWORD,
      isEmailVerified: true,
      status: UserStatus.ACTIVE,
      profile: {
        create: {
          firstName: 'Ayşe',
          lastName: 'Akademisyen',
          fullName: 'Ayşe Akademisyen',
          staffNumber: 'FAC-2024-001',
          title: 'Dr. Öğr. Üyesi',
          facultyId: facultyEng.id,
          departmentId: deptCS.id,
          gender: Gender.FEMALE,
        },
      },
      primaryRoles: {
        create: { roleId: facultyRole.id, isPrimary: true, facultyId: facultyEng.id, departmentId: deptCS.id },
      },
    },
  });

  // STAFF
  const staffUser = await prisma.user.upsert({
    where: { email: 'staff@campusops.edu.tr' },
    update: {},
    create: {
      email: 'staff@campusops.edu.tr',
      password: PASSWORD,
      isEmailVerified: true,
      status: UserStatus.ACTIVE,
      profile: {
        create: {
          firstName: 'Mehmet',
          lastName: 'Personel',
          fullName: 'Mehmet Personel',
          staffNumber: 'STF-2024-001',
          title: 'IT Destek Uzmanı',
          gender: Gender.MALE,
        },
      },
      primaryRoles: {
        create: { roleId: staffRole.id, isPrimary: true, unitId: unitIT.id },
      },
    },
  });

  console.log('✅ Kullanıcılar oluşturuldu. (Şifre: aaaaaa)');
  console.log('');
  console.log('📧 Hesaplar:');
  console.log('  admin@campusops.edu.tr   → ADMIN');
  console.log('  student@campusops.edu.tr → STUDENT');
  console.log('  faculty@campusops.edu.tr → FACULTY');
  console.log('  staff@campusops.edu.tr   → STAFF');
  console.log('');
  console.log('🌱 Seed tamamlandı!');
}

main()
  .catch((e) => {
    console.error('Seed hatası:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
