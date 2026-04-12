import { PrismaClient, Gender, RoleScope, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { seedWorkflows } from './seed-workflows';

const prisma = new PrismaClient();

type SeedRole = {
  name: string;
  description: string;
  scopeType: RoleScope;
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
  roles: Array<{
    roleName: string;
    isPrimary: boolean;
    facultyId?: string | null;
    departmentId?: string | null;
    unitId?: string | null;
  }>;
};

async function upsertRole(role: SeedRole) {
  return prisma.role.upsert({
    where: { name: role.name },
    update: {
      description: role.description,
      scopeType: role.scopeType,
      isSystem: true,
    },
    create: {
      ...role,
      isSystem: true,
    },
  });
}

async function upsertPermission(permission: {
  key: string;
  name: string;
  moduleName: string;
}) {
  return prisma.permission.upsert({
    where: { key: permission.key },
    update: {
      name: permission.name,
      moduleName: permission.moduleName,
    },
    create: permission,
  });
}

async function assignRolePermissions(
  roleName: string,
  permissionKeys: string[],
) {
  const role = await prisma.role.findUniqueOrThrow({
    where: { name: roleName },
  });
  for (const key of permissionKeys) {
    const permission = await prisma.permission.findUniqueOrThrow({
      where: { key },
    });
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: role.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: role.id,
        permissionId: permission.id,
      },
    });
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

  for (const roleAssignment of user.roles) {
    const role = await prisma.role.findUniqueOrThrow({
      where: { name: roleAssignment.roleName },
    });

    const existingRoleAssignment = await prisma.userRole.findFirst({
      where: {
        userId: record.id,
        roleId: role.id,
        facultyId: roleAssignment.facultyId ?? null,
        departmentId: roleAssignment.departmentId ?? null,
        unitId: roleAssignment.unitId ?? null,
      },
    });

    if (existingRoleAssignment) {
      await prisma.userRole.update({
        where: { id: existingRoleAssignment.id },
        data: {
          isPrimary: roleAssignment.isPrimary,
        },
      });
    } else {
      await prisma.userRole.create({
        data: {
          userId: record.id,
          roleId: role.id,
          isPrimary: roleAssignment.isPrimary,
          facultyId: roleAssignment.facultyId ?? null,
          departmentId: roleAssignment.departmentId ?? null,
          unitId: roleAssignment.unitId ?? null,
        },
      });
    }
  }

  const desiredRoleSignatures = new Set(
    user.roles.map((roleAssignment) =>
      [
        roleAssignment.roleName,
        roleAssignment.facultyId ?? '',
        roleAssignment.departmentId ?? '',
        roleAssignment.unitId ?? '',
      ].join('|'),
    ),
  );

  const currentUserRoles = await prisma.userRole.findMany({
    where: { userId: record.id },
    include: { role: true },
  });

  const obsoleteUserRoleIds = currentUserRoles
    .filter((userRole) => {
      const signature = [
        userRole.role.name,
        userRole.facultyId ?? '',
        userRole.departmentId ?? '',
        userRole.unitId ?? '',
      ].join('|');
      return !desiredRoleSignatures.has(signature);
    })
    .map((userRole) => userRole.id);

  if (obsoleteUserRoleIds.length > 0) {
    await prisma.userRole.deleteMany({
      where: { id: { in: obsoleteUserRoleIds } },
    });
  }

  return record;
}

async function main() {
  console.log('Seed starting...');

  const passwordHash = await bcrypt.hash('aaaaaa', 10);

  const baseRoles: SeedRole[] = [
    {
      name: 'ADMIN',
      description: 'System administrator with full access',
      scopeType: RoleScope.GLOBAL,
    },
    {
      name: 'STUDENT',
      description: 'Student portal user',
      scopeType: RoleScope.DEPARTMENT,
    },
    {
      name: 'FACULTY',
      description: 'Academic staff portal user',
      scopeType: RoleScope.FACULTY,
    },
    {
      name: 'STAFF',
      description: 'Operational staff portal user',
      scopeType: RoleScope.UNIT,
    },
  ];

  const operationalRoles: SeedRole[] = [
    {
      name: 'ADVISOR',
      description: 'Faculty advisor for internship and appointment flows',
      scopeType: RoleScope.FACULTY,
    },
    {
      name: 'DEPARTMENT_CHAIR',
      description: 'Department-level approval authority',
      scopeType: RoleScope.FACULTY,
    },
    {
      name: 'FACULTY_SECRETARY',
      description: 'Faculty secretary for document and appointment operations',
      scopeType: RoleScope.FACULTY,
    },
    {
      name: 'INTERNSHIP_COORDINATOR',
      description: 'Operational internship coordinator',
      scopeType: RoleScope.FACULTY,
    },
    {
      name: 'IT_AGENT',
      description: 'IT support ticket agent',
      scopeType: RoleScope.UNIT,
    },
    {
      name: 'IT_MANAGER',
      description: 'IT manager for escalation and approvals',
      scopeType: RoleScope.UNIT,
    },
    {
      name: 'RESOURCE_MANAGER',
      description: 'Resource and reservation manager',
      scopeType: RoleScope.UNIT,
    },
    {
      name: 'PROCUREMENT_OFFICER',
      description: 'Procurement officer',
      scopeType: RoleScope.UNIT,
    },
    {
      name: 'SECURITY_OFFICER',
      description: 'Security officer',
      scopeType: RoleScope.UNIT,
    },
    {
      name: 'DOCUMENT_OFFICER',
      description: 'Document processing officer',
      scopeType: RoleScope.UNIT,
    },
    {
      name: 'SYSTEM_OWNER',
      description: 'System owner responsible for platform governance',
      scopeType: RoleScope.UNIT,
    },
    {
      name: 'BUDGET_APPROVER',
      description: 'Budget approval authority for financial requests',
      scopeType: RoleScope.UNIT,
    },
    {
      name: 'FINANCE_OFFICER',
      description: 'Finance operations officer',
      scopeType: RoleScope.UNIT,
    },
    {
      name: 'LAB_TECHNICIAN',
      description: 'Laboratory technician for equipment and lab operations',
      scopeType: RoleScope.UNIT,
    },
    {
      name: 'EVENT_COORDINATOR',
      description: 'Event coordination and operational planning role',
      scopeType: RoleScope.UNIT,
    },
  ];

  for (const role of [...baseRoles, ...operationalRoles]) {
    await upsertRole(role);
  }

  const permissions = [
    { key: 'admin.users.manage', name: 'Manage Users', moduleName: 'admin' },
    { key: 'admin.roles.manage', name: 'Manage Roles', moduleName: 'admin' },
    {
      key: 'admin.org.manage',
      name: 'Manage Org Structure',
      moduleName: 'admin',
    },
    {
      key: 'admin.requests.manage',
      name: 'Manage All Requests',
      moduleName: 'admin',
    },
    {
      key: 'admin.workflows.manage',
      name: 'Manage Workflows',
      moduleName: 'admin',
    },
    { key: 'requests.create', name: 'Create Request', moduleName: 'requests' },
    {
      key: 'requests.view.own',
      name: 'View Own Requests',
      moduleName: 'requests',
    },
    {
      key: 'requests.view.assigned',
      name: 'View Assigned Requests',
      moduleName: 'requests',
    },
    {
      key: 'requests.approve',
      name: 'Approve Requests',
      moduleName: 'requests',
    },
    { key: 'requests.reject', name: 'Reject Requests', moduleName: 'requests' },
    {
      key: 'internships.manage',
      name: 'Manage Internships',
      moduleName: 'internships',
    },
    { key: 'tickets.manage', name: 'Manage IT Tickets', moduleName: 'tickets' },
    {
      key: 'reservations.manage',
      name: 'Manage Reservations',
      moduleName: 'reservations',
    },
    {
      key: 'appointments.manage',
      name: 'Manage Appointments',
      moduleName: 'appointments',
    },
    {
      key: 'equipment.manage',
      name: 'Manage Equipment',
      moduleName: 'equipment',
    },
  ];

  for (const permission of permissions) {
    await upsertPermission(permission);
  }

  await assignRolePermissions(
    'ADMIN',
    permissions.map((permission) => permission.key),
  );
  await assignRolePermissions('STUDENT', [
    'requests.create',
    'requests.view.own',
  ]);
  await assignRolePermissions('FACULTY', [
    'requests.view.assigned',
    'requests.approve',
    'requests.reject',
    'appointments.manage',
  ]);
  await assignRolePermissions('STAFF', ['requests.view.assigned']);
  await assignRolePermissions('ADVISOR', [
    'internships.manage',
    'appointments.manage',
  ]);
  await assignRolePermissions('DEPARTMENT_CHAIR', [
    'requests.approve',
    'requests.reject',
  ]);
  await assignRolePermissions('FACULTY_SECRETARY', ['appointments.manage']);
  await assignRolePermissions('INTERNSHIP_COORDINATOR', ['internships.manage']);
  await assignRolePermissions('IT_AGENT', ['tickets.manage']);
  await assignRolePermissions('IT_MANAGER', [
    'tickets.manage',
    'requests.approve',
  ]);
  await assignRolePermissions('RESOURCE_MANAGER', ['reservations.manage']);
  await assignRolePermissions('PROCUREMENT_OFFICER', ['requests.approve']);
  await assignRolePermissions('SECURITY_OFFICER', ['requests.approve']);
  await assignRolePermissions('DOCUMENT_OFFICER', ['requests.view.assigned']);
  await assignRolePermissions('SYSTEM_OWNER', [
    'admin.workflows.manage',
    'requests.view.assigned',
  ]);
  await assignRolePermissions('BUDGET_APPROVER', ['requests.approve']);
  await assignRolePermissions('FINANCE_OFFICER', [
    'requests.view.assigned',
    'requests.approve',
  ]);
  await assignRolePermissions('LAB_TECHNICIAN', [
    'equipment.manage',
    'requests.view.assigned',
  ]);
  await assignRolePermissions('EVENT_COORDINATOR', [
    'requests.view.assigned',
    'reservations.manage',
  ]);

  const campus = await prisma.campus.upsert({
    where: { code: 'MAIN' },
    update: {
      name: 'Main Campus',
      address: 'Campus Avenue No:1',
      isActive: true,
    },
    create: {
      name: 'Main Campus',
      code: 'MAIN',
      address: 'Campus Avenue No:1',
      isActive: true,
    },
  });

  const cityCampus = await prisma.campus.upsert({
    where: { code: 'CITY' },
    update: {
      name: 'City Campus',
      address: 'Downtown Campus Boulevard No:25',
      isActive: true,
    },
    create: {
      name: 'City Campus',
      code: 'CITY',
      address: 'Downtown Campus Boulevard No:25',
      isActive: true,
    },
  });

  const engineeringFaculty = await prisma.faculty.upsert({
    where: { code: 'ENG' },
    update: {
      campusId: campus.id,
      name: 'Faculty of Engineering',
      isActive: true,
    },
    create: {
      campusId: campus.id,
      name: 'Faculty of Engineering',
      code: 'ENG',
      isActive: true,
    },
  });

  const artsFaculty = await prisma.faculty.upsert({
    where: { code: 'ARTS' },
    update: {
      campusId: campus.id,
      name: 'Faculty of Arts and Sciences',
      isActive: true,
    },
    create: {
      campusId: campus.id,
      name: 'Faculty of Arts and Sciences',
      code: 'ARTS',
      isActive: true,
    },
  });

  const businessFaculty = await prisma.faculty.upsert({
    where: { code: 'BUS' },
    update: {
      campusId: cityCampus.id,
      name: 'Faculty of Business and Administrative Sciences',
      isActive: true,
    },
    create: {
      campusId: cityCampus.id,
      name: 'Faculty of Business and Administrative Sciences',
      code: 'BUS',
      isActive: true,
    },
  });

  const csDepartment = await prisma.department.upsert({
    where: { code: 'CS' },
    update: {
      facultyId: engineeringFaculty.id,
      name: 'Computer Engineering',
      isActive: true,
    },
    create: {
      facultyId: engineeringFaculty.id,
      name: 'Computer Engineering',
      code: 'CS',
      isActive: true,
    },
  });

  const eeDepartment = await prisma.department.upsert({
    where: { code: 'EE' },
    update: {
      facultyId: engineeringFaculty.id,
      name: 'Electrical and Electronics Engineering',
      isActive: true,
    },
    create: {
      facultyId: engineeringFaculty.id,
      name: 'Electrical and Electronics Engineering',
      code: 'EE',
      isActive: true,
    },
  });

  const mathDepartment = await prisma.department.upsert({
    where: { code: 'MATH' },
    update: {
      facultyId: artsFaculty.id,
      name: 'Mathematics',
      isActive: true,
    },
    create: {
      facultyId: artsFaculty.id,
      name: 'Mathematics',
      code: 'MATH',
      isActive: true,
    },
  });

  const physicsDepartment = await prisma.department.upsert({
    where: { code: 'PHYS' },
    update: {
      facultyId: artsFaculty.id,
      name: 'Physics',
      isActive: true,
    },
    create: {
      facultyId: artsFaculty.id,
      name: 'Physics',
      code: 'PHYS',
      isActive: true,
    },
  });

  const businessDepartment = await prisma.department.upsert({
    where: { code: 'BA' },
    update: {
      facultyId: businessFaculty.id,
      name: 'Business Administration',
      isActive: true,
    },
    create: {
      facultyId: businessFaculty.id,
      name: 'Business Administration',
      code: 'BA',
      isActive: true,
    },
  });

  const itUnit = await prisma.unit.upsert({
    where: { code: 'IT-DEPT' },
    update: {
      campusId: campus.id,
      facultyId: engineeringFaculty.id,
      departmentId: csDepartment.id,
      name: 'IT Department',
      type: 'TECHNICAL',
      isActive: true,
    },
    create: {
      campusId: campus.id,
      facultyId: engineeringFaculty.id,
      departmentId: csDepartment.id,
      name: 'IT Department',
      code: 'IT-DEPT',
      type: 'TECHNICAL',
      isActive: true,
    },
  });

  const adminUnit = await prisma.unit.upsert({
    where: { code: 'ADMIN-OPS' },
    update: {
      campusId: cityCampus.id,
      facultyId: businessFaculty.id,
      departmentId: businessDepartment.id,
      name: 'Administrative Operations',
      type: 'ADMINISTRATIVE',
      isActive: true,
    },
    create: {
      campusId: cityCampus.id,
      facultyId: businessFaculty.id,
      departmentId: businessDepartment.id,
      name: 'Administrative Operations',
      code: 'ADMIN-OPS',
      type: 'ADMINISTRATIVE',
      isActive: true,
    },
  });

  const resourceUnit = await prisma.unit.upsert({
    where: { code: 'RESOURCE-OPS' },
    update: {
      campusId: campus.id,
      facultyId: engineeringFaculty.id,
      departmentId: eeDepartment.id,
      name: 'Resource Operations',
      type: 'ADMINISTRATIVE',
      isActive: true,
    },
    create: {
      campusId: campus.id,
      facultyId: engineeringFaculty.id,
      departmentId: eeDepartment.id,
      name: 'Resource Operations',
      code: 'RESOURCE-OPS',
      type: 'ADMINISTRATIVE',
      isActive: true,
    },
  });

  const procurementUnit = await prisma.unit.upsert({
    where: { code: 'PROCUREMENT' },
    update: {
      campusId: cityCampus.id,
      facultyId: businessFaculty.id,
      departmentId: businessDepartment.id,
      name: 'Procurement Office',
      type: 'ADMINISTRATIVE',
      isActive: true,
    },
    create: {
      campusId: cityCampus.id,
      facultyId: businessFaculty.id,
      departmentId: businessDepartment.id,
      name: 'Procurement Office',
      code: 'PROCUREMENT',
      type: 'ADMINISTRATIVE',
      isActive: true,
    },
  });

  const securityUnit = await prisma.unit.upsert({
    where: { code: 'SECURITY' },
    update: {
      campusId: campus.id,
      facultyId: artsFaculty.id,
      departmentId: physicsDepartment.id,
      name: 'Security Office',
      type: 'ADMINISTRATIVE',
      isActive: true,
    },
    create: {
      campusId: campus.id,
      facultyId: artsFaculty.id,
      departmentId: physicsDepartment.id,
      name: 'Security Office',
      code: 'SECURITY',
      type: 'ADMINISTRATIVE',
      isActive: true,
    },
  });

  const documentUnit = await prisma.unit.upsert({
    where: { code: 'DOCS' },
    update: {
      campusId: campus.id,
      facultyId: artsFaculty.id,
      departmentId: mathDepartment.id,
      name: 'Document Services',
      type: 'ADMINISTRATIVE',
      isActive: true,
    },
    create: {
      campusId: campus.id,
      facultyId: artsFaculty.id,
      departmentId: mathDepartment.id,
      name: 'Document Services',
      code: 'DOCS',
      type: 'ADMINISTRATIVE',
      isActive: true,
    },
  });

  const systemOpsUnit = await prisma.unit.upsert({
    where: { code: 'SYSOPS' },
    update: {
      campusId: campus.id,
      facultyId: engineeringFaculty.id,
      departmentId: csDepartment.id,
      name: 'System Operations',
      type: 'ADMINISTRATIVE',
      isActive: true,
    },
    create: {
      campusId: campus.id,
      facultyId: engineeringFaculty.id,
      departmentId: csDepartment.id,
      name: 'System Operations',
      code: 'SYSOPS',
      type: 'ADMINISTRATIVE',
      isActive: true,
    },
  });

  const financeUnit = await prisma.unit.upsert({
    where: { code: 'FINANCE' },
    update: {
      campusId: campus.id,
      facultyId: businessFaculty.id,
      departmentId: businessDepartment.id,
      name: 'Finance Office',
      type: 'ADMINISTRATIVE',
      isActive: true,
    },
    create: {
      campusId: campus.id,
      facultyId: businessFaculty.id,
      departmentId: businessDepartment.id,
      name: 'Finance Office',
      code: 'FINANCE',
      type: 'ADMINISTRATIVE',
      isActive: true,
    },
  });

  const labUnit = await prisma.unit.upsert({
    where: { code: 'LABOPS' },
    update: {
      campusId: campus.id,
      facultyId: engineeringFaculty.id,
      departmentId: eeDepartment.id,
      name: 'Laboratory Operations',
      type: 'ACADEMIC',
      isActive: true,
    },
    create: {
      campusId: campus.id,
      facultyId: engineeringFaculty.id,
      departmentId: eeDepartment.id,
      name: 'Laboratory Operations',
      code: 'LABOPS',
      type: 'ACADEMIC',
      isActive: true,
    },
  });

  const eventUnit = await prisma.unit.upsert({
    where: { code: 'EVENTS' },
    update: {
      campusId: cityCampus.id,
      facultyId: artsFaculty.id,
      departmentId: mathDepartment.id,
      name: 'Event Coordination Office',
      type: 'ADMINISTRATIVE',
      isActive: true,
    },
    create: {
      campusId: cityCampus.id,
      facultyId: artsFaculty.id,
      departmentId: mathDepartment.id,
      name: 'Event Coordination Office',
      code: 'EVENTS',
      type: 'ADMINISTRATIVE',
      isActive: true,
    },
  });

  const users: SeedUser[] = [
    {
      email: 'student@campusops.edu.tr',
      firstName: 'Ali',
      lastName: 'Yilmaz',
      fullName: 'Ali Yilmaz',
      gender: Gender.MALE,
      studentNumber: 'ST-2024-001',
      facultyId: engineeringFaculty.id,
      departmentId: csDepartment.id,
      roles: [
        {
          roleName: 'STUDENT',
          isPrimary: true,
          facultyId: engineeringFaculty.id,
          departmentId: csDepartment.id,
        },
      ],
    },
    {
      email: 'faculty@campusops.edu.tr',
      firstName: 'Ayse',
      lastName: 'Demir',
      fullName: 'Ayse Demir',
      title: 'Assistant Professor',
      gender: Gender.FEMALE,
      staffNumber: 'FAC-2024-001',
      facultyId: engineeringFaculty.id,
      departmentId: csDepartment.id,
      roles: [
        {
          roleName: 'FACULTY',
          isPrimary: true,
          facultyId: engineeringFaculty.id,
          departmentId: csDepartment.id,
        },
      ],
    },
    {
      email: 'staff@campusops.edu.tr',
      firstName: 'Mehmet',
      lastName: 'Kaya',
      fullName: 'Mehmet Kaya',
      title: 'Operations Specialist',
      gender: Gender.MALE,
      staffNumber: 'STF-2024-001',
      facultyId: businessFaculty.id,
      departmentId: businessDepartment.id,
      unitId: adminUnit.id,
      roles: [
        {
          roleName: 'STAFF',
          isPrimary: true,
          facultyId: businessFaculty.id,
          departmentId: businessDepartment.id,
          unitId: adminUnit.id,
        },
      ],
    },
    {
      email: 'admin@campusops.edu.tr',
      firstName: 'Admin',
      lastName: 'User',
      fullName: 'Admin User',
      title: 'System Administrator',
      gender: Gender.PREFER_NOT_TO_SAY,
      staffNumber: 'ADM-2024-001',
      facultyId: businessFaculty.id,
      departmentId: businessDepartment.id,
      unitId: adminUnit.id,
      roles: [
        {
          roleName: 'ADMIN',
          isPrimary: true,
        },
      ],
    },
    {
      email: 'advisor@campusops.edu.tr',
      firstName: 'Selin',
      lastName: 'Advisor',
      fullName: 'Selin Advisor',
      title: 'Associate Professor',
      gender: Gender.FEMALE,
      staffNumber: 'FAC-2024-002',
      facultyId: engineeringFaculty.id,
      departmentId: csDepartment.id,
      roles: [
        {
          roleName: 'FACULTY',
          isPrimary: true,
          facultyId: engineeringFaculty.id,
          departmentId: csDepartment.id,
        },
        {
          roleName: 'ADVISOR',
          isPrimary: false,
          facultyId: engineeringFaculty.id,
          departmentId: csDepartment.id,
        },
      ],
    },
    {
      email: 'chair@campusops.edu.tr',
      firstName: 'Murat',
      lastName: 'Chair',
      fullName: 'Murat Chair',
      title: 'Professor',
      gender: Gender.MALE,
      staffNumber: 'FAC-2024-003',
      facultyId: engineeringFaculty.id,
      departmentId: csDepartment.id,
      roles: [
        {
          roleName: 'FACULTY',
          isPrimary: true,
          facultyId: engineeringFaculty.id,
          departmentId: csDepartment.id,
        },
        {
          roleName: 'DEPARTMENT_CHAIR',
          isPrimary: false,
          facultyId: engineeringFaculty.id,
          departmentId: csDepartment.id,
        },
      ],
    },
    {
      email: 'secretary@campusops.edu.tr',
      firstName: 'Zeynep',
      lastName: 'Secretary',
      fullName: 'Zeynep Secretary',
      title: 'Faculty Secretary',
      gender: Gender.FEMALE,
      staffNumber: 'STF-2024-002',
      facultyId: engineeringFaculty.id,
      departmentId: csDepartment.id,
      unitId: adminUnit.id,
      roles: [
        {
          roleName: 'STAFF',
          isPrimary: true,
          facultyId: businessFaculty.id,
          departmentId: businessDepartment.id,
          unitId: adminUnit.id,
        },
        {
          roleName: 'FACULTY_SECRETARY',
          isPrimary: false,
          facultyId: engineeringFaculty.id,
          departmentId: csDepartment.id,
        },
      ],
    },
    {
      email: 'internship.coordinator@campusops.edu.tr',
      firstName: 'Deniz',
      lastName: 'Coordinator',
      fullName: 'Deniz Coordinator',
      title: 'Internship Coordinator',
      gender: Gender.FEMALE,
      staffNumber: 'STF-2024-003',
      facultyId: engineeringFaculty.id,
      departmentId: csDepartment.id,
      unitId: adminUnit.id,
      roles: [
        {
          roleName: 'STAFF',
          isPrimary: true,
          facultyId: businessFaculty.id,
          departmentId: businessDepartment.id,
          unitId: adminUnit.id,
        },
        {
          roleName: 'INTERNSHIP_COORDINATOR',
          isPrimary: false,
          facultyId: engineeringFaculty.id,
          departmentId: csDepartment.id,
        },
      ],
    },
    {
      email: 'it.agent@campusops.edu.tr',
      firstName: 'Can',
      lastName: 'Agent',
      fullName: 'Can Agent',
      title: 'IT Support Specialist',
      gender: Gender.MALE,
      staffNumber: 'STF-2024-004',
      facultyId: engineeringFaculty.id,
      departmentId: csDepartment.id,
      unitId: itUnit.id,
      roles: [
        {
          roleName: 'STAFF',
          isPrimary: true,
          facultyId: engineeringFaculty.id,
          departmentId: csDepartment.id,
          unitId: itUnit.id,
        },
        {
          roleName: 'IT_AGENT',
          isPrimary: false,
          facultyId: engineeringFaculty.id,
          departmentId: csDepartment.id,
          unitId: itUnit.id,
        },
      ],
    },
    {
      email: 'it.manager@campusops.edu.tr',
      firstName: 'Ece',
      lastName: 'Manager',
      fullName: 'Ece Manager',
      title: 'IT Manager',
      gender: Gender.FEMALE,
      staffNumber: 'STF-2024-005',
      facultyId: engineeringFaculty.id,
      departmentId: csDepartment.id,
      unitId: itUnit.id,
      roles: [
        {
          roleName: 'STAFF',
          isPrimary: true,
          facultyId: engineeringFaculty.id,
          departmentId: csDepartment.id,
          unitId: itUnit.id,
        },
        {
          roleName: 'IT_MANAGER',
          isPrimary: false,
          facultyId: engineeringFaculty.id,
          departmentId: csDepartment.id,
          unitId: itUnit.id,
        },
      ],
    },
    {
      email: 'resource.manager@campusops.edu.tr',
      firstName: 'Burak',
      lastName: 'Resource',
      fullName: 'Burak Resource',
      title: 'Resource Manager',
      gender: Gender.MALE,
      staffNumber: 'STF-2024-006',
      facultyId: engineeringFaculty.id,
      departmentId: eeDepartment.id,
      unitId: resourceUnit.id,
      roles: [
        {
          roleName: 'STAFF',
          isPrimary: true,
          facultyId: engineeringFaculty.id,
          departmentId: eeDepartment.id,
          unitId: resourceUnit.id,
        },
        {
          roleName: 'RESOURCE_MANAGER',
          isPrimary: false,
          facultyId: engineeringFaculty.id,
          departmentId: eeDepartment.id,
          unitId: resourceUnit.id,
        },
      ],
    },
    {
      email: 'procurement.officer@campusops.edu.tr',
      firstName: 'Pelin',
      lastName: 'Procurement',
      fullName: 'Pelin Procurement',
      title: 'Procurement Officer',
      gender: Gender.FEMALE,
      staffNumber: 'STF-2024-007',
      facultyId: businessFaculty.id,
      departmentId: businessDepartment.id,
      unitId: procurementUnit.id,
      roles: [
        {
          roleName: 'STAFF',
          isPrimary: true,
          facultyId: businessFaculty.id,
          departmentId: businessDepartment.id,
          unitId: procurementUnit.id,
        },
        {
          roleName: 'PROCUREMENT_OFFICER',
          isPrimary: false,
          facultyId: businessFaculty.id,
          departmentId: businessDepartment.id,
          unitId: procurementUnit.id,
        },
      ],
    },
    {
      email: 'security.officer@campusops.edu.tr',
      firstName: 'Okan',
      lastName: 'Security',
      fullName: 'Okan Security',
      title: 'Security Officer',
      gender: Gender.MALE,
      staffNumber: 'STF-2024-008',
      facultyId: artsFaculty.id,
      departmentId: physicsDepartment.id,
      unitId: securityUnit.id,
      roles: [
        {
          roleName: 'STAFF',
          isPrimary: true,
          facultyId: artsFaculty.id,
          departmentId: physicsDepartment.id,
          unitId: securityUnit.id,
        },
        {
          roleName: 'SECURITY_OFFICER',
          isPrimary: false,
          facultyId: artsFaculty.id,
          departmentId: physicsDepartment.id,
          unitId: securityUnit.id,
        },
      ],
    },
    {
      email: 'document.officer@campusops.edu.tr',
      firstName: 'Irem',
      lastName: 'Document',
      fullName: 'Irem Document',
      title: 'Document Officer',
      gender: Gender.FEMALE,
      staffNumber: 'STF-2024-009',
      facultyId: artsFaculty.id,
      departmentId: mathDepartment.id,
      unitId: documentUnit.id,
      roles: [
        {
          roleName: 'STAFF',
          isPrimary: true,
          facultyId: artsFaculty.id,
          departmentId: mathDepartment.id,
          unitId: documentUnit.id,
        },
        {
          roleName: 'DOCUMENT_OFFICER',
          isPrimary: false,
          facultyId: artsFaculty.id,
          departmentId: mathDepartment.id,
          unitId: documentUnit.id,
        },
      ],
    },
    {
      email: 'system.owner@campusops.edu.tr',
      firstName: 'Kerem',
      lastName: 'Owner',
      fullName: 'Kerem Owner',
      title: 'System Owner',
      gender: Gender.MALE,
      staffNumber: 'STF-2024-010',
      facultyId: engineeringFaculty.id,
      departmentId: csDepartment.id,
      unitId: systemOpsUnit.id,
      roles: [
        {
          roleName: 'STAFF',
          isPrimary: true,
          facultyId: engineeringFaculty.id,
          departmentId: csDepartment.id,
          unitId: systemOpsUnit.id,
        },
        {
          roleName: 'SYSTEM_OWNER',
          isPrimary: false,
          facultyId: engineeringFaculty.id,
          departmentId: csDepartment.id,
          unitId: systemOpsUnit.id,
        },
      ],
    },
    {
      email: 'budget.approver@campusops.edu.tr',
      firstName: 'Buse',
      lastName: 'Budget',
      fullName: 'Buse Budget',
      title: 'Budget Approver',
      gender: Gender.FEMALE,
      staffNumber: 'STF-2024-011',
      facultyId: businessFaculty.id,
      departmentId: businessDepartment.id,
      unitId: financeUnit.id,
      roles: [
        {
          roleName: 'STAFF',
          isPrimary: true,
          facultyId: businessFaculty.id,
          departmentId: businessDepartment.id,
          unitId: financeUnit.id,
        },
        {
          roleName: 'BUDGET_APPROVER',
          isPrimary: false,
          facultyId: businessFaculty.id,
          departmentId: businessDepartment.id,
          unitId: financeUnit.id,
        },
      ],
    },
    {
      email: 'finance.officer@campusops.edu.tr',
      firstName: 'Selma',
      lastName: 'Finance',
      fullName: 'Selma Finance',
      title: 'Finance Officer',
      gender: Gender.FEMALE,
      staffNumber: 'STF-2024-012',
      facultyId: businessFaculty.id,
      departmentId: businessDepartment.id,
      unitId: financeUnit.id,
      roles: [
        {
          roleName: 'STAFF',
          isPrimary: true,
          facultyId: businessFaculty.id,
          departmentId: businessDepartment.id,
          unitId: financeUnit.id,
        },
        {
          roleName: 'FINANCE_OFFICER',
          isPrimary: false,
          facultyId: businessFaculty.id,
          departmentId: businessDepartment.id,
          unitId: financeUnit.id,
        },
      ],
    },
    {
      email: 'lab.technician@campusops.edu.tr',
      firstName: 'Emre',
      lastName: 'Lab',
      fullName: 'Emre Lab',
      title: 'Lab Technician',
      gender: Gender.MALE,
      staffNumber: 'STF-2024-013',
      facultyId: engineeringFaculty.id,
      departmentId: eeDepartment.id,
      unitId: labUnit.id,
      roles: [
        {
          roleName: 'STAFF',
          isPrimary: true,
          facultyId: engineeringFaculty.id,
          departmentId: eeDepartment.id,
          unitId: labUnit.id,
        },
        {
          roleName: 'LAB_TECHNICIAN',
          isPrimary: false,
          facultyId: engineeringFaculty.id,
          departmentId: eeDepartment.id,
          unitId: labUnit.id,
        },
      ],
    },
    {
      email: 'event.coordinator@campusops.edu.tr',
      firstName: 'Ceren',
      lastName: 'Event',
      fullName: 'Ceren Event',
      title: 'Event Coordinator',
      gender: Gender.FEMALE,
      staffNumber: 'STF-2024-014',
      facultyId: artsFaculty.id,
      departmentId: mathDepartment.id,
      unitId: eventUnit.id,
      roles: [
        {
          roleName: 'STAFF',
          isPrimary: true,
          facultyId: artsFaculty.id,
          departmentId: mathDepartment.id,
          unitId: eventUnit.id,
        },
        {
          roleName: 'EVENT_COORDINATOR',
          isPrimary: false,
          facultyId: artsFaculty.id,
          departmentId: mathDepartment.id,
          unitId: eventUnit.id,
        },
      ],
    },
  ];

  const adminUser = await upsertUser(
    users.find((user) => user.email === 'admin@campusops.edu.tr')!,
    passwordHash,
  );

  for (const user of users.filter(
    (item) => item.email !== 'admin@campusops.edu.tr',
  )) {
    await upsertUser(user, passwordHash);
  }

  const chairUser = await prisma.user.findUniqueOrThrow({
    where: { email: 'chair@campusops.edu.tr' },
  });
  const advisorUser = await prisma.user.findUniqueOrThrow({
    where: { email: 'advisor@campusops.edu.tr' },
  });
  const resourceManagerUser = await prisma.user.findUniqueOrThrow({
    where: { email: 'resource.manager@campusops.edu.tr' },
  });
  const itManagerUser = await prisma.user.findUniqueOrThrow({
    where: { email: 'it.manager@campusops.edu.tr' },
  });

  await prisma.department.update({
    where: { id: csDepartment.id },
    data: { chairUserId: chairUser.id },
  });

  await prisma.faculty.update({
    where: { id: engineeringFaculty.id },
    data: { deanUserId: advisorUser.id },
  });

  await prisma.unit.update({
    where: { id: resourceUnit.id },
    data: { managerUserId: resourceManagerUser.id },
  });

  await prisma.unit.update({
    where: { id: itUnit.id },
    data: { managerUserId: itManagerUser.id },
  });

  await prisma.notificationPreference.upsert({
    where: { userId: adminUser.id },
    update: {},
    create: { userId: adminUser.id },
  });

  await seedWorkflows();

  const userSummary = await prisma.user.findMany({
    where: { email: { in: users.map((user) => user.email) } },
    include: {
      primaryRoles: {
        include: { role: true, faculty: true, department: true, unit: true },
      },
      profile: true,
    },
    orderBy: { email: 'asc' },
  });

  console.log('');
  console.log('Seed completed. Password for all users: aaaaaa');
  console.log('');
  for (const user of userSummary) {
    const roles = user.primaryRoles
      .map((userRole) => userRole.role.name)
      .join(', ');
    console.log(`${user.email} -> ${roles}`);
  }

  console.log('');
  console.log(
    `Faculties seeded: ${engineeringFaculty.name}, ${artsFaculty.name}, ${businessFaculty.name}`,
  );
  console.log(
    `Departments seeded: ${csDepartment.name}, ${eeDepartment.name}, ${mathDepartment.name}, ${physicsDepartment.name}, ${businessDepartment.name}`,
  );
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
