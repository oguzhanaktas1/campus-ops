/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { UserStatus, Gender, AuditActionType } from '@prisma/client';
import { AssignRoleDto } from './dto/assign-role.dto';
import { AdminUpdateProfileDto } from './dto/admin-update-profile.dto';
import { UpdateRequestTypeDto } from '../requests/dto/update-request-type.dto';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getAllUsers() {
    const users = await this.prisma.user.findMany({
      include: {
        profile: true,
        primaryRoles: { include: { role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return users.map((user) => ({
      id: user.id,
      name: user.profile?.fullName || 'Unnamed User',
      email: user.email,
      phoneNumber: user.phoneNumber || '',
      department:
        user.profile?.departmentId ||
        user.profile?.bio ||
        'Department not specified',
      role: user.primaryRoles[0]?.role?.name?.toLowerCase() || 'student',
      lastLogin: user.updatedAt,
      status: user.status.toLowerCase(),
      title: user.profile?.title || '',
      staffNumber: user.profile?.staffNumber || '',
      studentNumber: user.profile?.studentNumber || '',
      gender: user.profile?.gender || 'MALE',
      birthDate: user.profile?.birthDate
        ? user.profile.birthDate.toISOString()
        : null,
      address: user.profile?.address || '',
      bio: user.profile?.bio || '',
      createdAt: user.createdAt,
    }));
  }

  async getRoles() {
    return this.prisma.role.findMany({
      select: { id: true, name: true },
    });
  }

  // YENİ KULLANICI OLUŞTUR (AUDIT LOG EKLENDİ)
  async createUser(adminId: string, data: any) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new ConflictException('This email address is already in use.');
    }

    if (!data.password) {
      throw new BadRequestException('Password is required.');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);
    const fullName = `${data.firstName} ${data.lastName}`.trim();

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: data.email,
          password: hashedPassword,
          phoneNumber: data.phoneNumber || null,
          status: (data.status as UserStatus) || UserStatus.ACTIVE,
          isEmailVerified: true,
          profile: {
            create: {
              firstName: data.firstName,
              lastName: data.lastName,
              fullName: fullName,
              title: data.title || null,
              staffNumber: data.staffNumber || null,
              studentNumber: data.studentNumber || null,
              gender: (data.gender as Gender) || null,
              birthDate: data.birthDate ? new Date(data.birthDate) : null,
              address: data.address || null,
              bio: data.bio || null,
            },
          },
        },
      });

      if (data.roleId) {
        await tx.userRole.create({
          data: { userId: user.id, roleId: data.roleId, isPrimary: true },
        });
      }

      // 🔥 AUDIT LOG: USER CREATED 🔥
      await tx.auditLog.create({
        data: {
          userId: adminId,
          actionType: AuditActionType.CREATE,
          entityType: 'User',
          entityId: user.id,
        },
      });

      return { message: 'User successfully created', userId: user.id };
    });
  }

  // KULLANICI GÜNCELLE (AUDIT LOG EKLENDİ)
  async updateUser(adminId: string, id: string, data: any) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { profile: true, primaryRoles: true },
    });

    if (!user) throw new NotFoundException('User not found.');

    let passwordData = {};
    if (data.password && data.password.trim() !== '') {
      passwordData = { password: await bcrypt.hash(data.password, 10) };
    }

    const fullName = `${data.firstName} ${data.lastName}`.trim();

    return this.prisma.$transaction(async (tx) => {
      // 1. Update Core User
      await tx.user.update({
        where: { id },
        data: {
          email: data.email,
          phoneNumber: data.phoneNumber || null,
          status: (data.status as UserStatus) || user.status,
          ...passwordData,
        },
      });

      // 2. Update Profile
      if (user.profile) {
        await tx.userProfile.update({
          where: { userId: id },
          data: {
            firstName: data.firstName,
            lastName: data.lastName,
            fullName: fullName || user.profile.fullName,
            title: data.title || null,
            staffNumber: data.staffNumber || null,
            studentNumber: data.studentNumber || null,
            gender: (data.gender as Gender) || null,
            birthDate: data.birthDate ? new Date(data.birthDate) : null,
            address: data.address || null,
            bio: data.bio || null,
          },
        });
      }

      // 3. Update Role
      if (data.roleId && user.primaryRoles[0]?.roleId !== data.roleId) {
        await tx.userRole.deleteMany({ where: { userId: id } });
        await tx.userRole.create({
          data: { userId: id, roleId: data.roleId, isPrimary: true },
        });
      }

      // 🔥 AUDIT LOG: USER UPDATED 🔥
      await tx.auditLog.create({
        data: {
          userId: adminId,
          actionType: AuditActionType.UPDATE,
          entityType: 'User',
          entityId: id,
        },
      });

      return { message: 'User successfully updated' };
    });
  }

  // KULLANICI SİL (AUDIT LOG EKLENDİ)
  async deleteUser(adminId: string, id: string) {
    try {
      await this.prisma.user.update({
        where: { id },
        data: { profile: { delete: true } },
      });
      // eslint-disable-next-line no-empty
    } catch (e) {}

    await this.prisma.user.delete({ where: { id } });

    // 🔥 AUDIT LOG: USER DELETED 🔥
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        actionType: AuditActionType.DELETE,
        entityType: 'User',
        entityId: id,
      },
    });

    return { message: 'User successfully deleted' };
  }

  // TOPLU SİLME FONKSİYONU (Requests)
  async bulkDeleteRequests(requestIds: string[]) {
    if (!requestIds || requestIds.length === 0) {
      throw new BadRequestException('No IDs provided for deletion');
    }
    return this.prisma.request.deleteMany({
      where: { id: { in: requestIds } },
    });
  }

  async getAllRequests() {
    const requests = await this.prisma.request.findMany({
      include: {
        requester: { include: { profile: true } },
        requestType: true,
        currentAssignee: { include: { profile: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return requests.map((req) => ({
      id: req.id,
      requestNo: req.requestNo,
      title: req.title,
      status: req.status,
      priority: req.priority,
      type: req.requestType.key,
      typeName: req.requestType.name,
      submittedByName: req.requester.profile?.fullName || req.requester.email,
      assignedToName: req.currentAssignee?.profile?.fullName || 'Unassigned',
      createdAt: req.createdAt,
      updatedAt: req.updatedAt,
    }));
  }

  async getRequestById(requestId: string) {
    const request = await this.prisma.request.findUnique({
      where: { id: requestId },
      include: {
        requester: { include: { profile: true } },
        requestType: true,
        currentAssignee: { include: { profile: true } },
        statusHistory: { orderBy: { changedAt: 'desc' } },
        comments: {
          include: { user: { include: { profile: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!request) throw new NotFoundException('Request not found');
    return request;
  }

  async deleteRequest(requestId: string) {
    const request = await this.prisma.request.findUnique({
      where: { id: requestId },
    });
    if (!request) throw new NotFoundException('Request not found');
    return this.prisma.request.delete({ where: { id: requestId } });
  }

  // 🔥 BİLDİRİM (NOTIFICATION) OPERASYONLARI 🔥
  async getNotifications(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId: userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markNotificationAsRead(userId: string, notificationId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, userId: userId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllNotificationsAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId: userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async deleteNotifications(userId: string, ids: string[]) {
    await this.prisma.notification.deleteMany({
      where: { userId: userId, id: { in: ids } },
    });
    return { message: 'Notifications successfully deleted.' };
  }

  // 🔥 AYARLAR VE GÜVENLİK YÖNETİMİ 🔥
  async getPreferences(userId: string) {
    let prefs = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });
    if (!prefs)
      prefs = await this.prisma.notificationPreference.create({
        data: { userId },
      });
    return prefs;
  }

  async updatePreferences(userId: string, data: any) {
    return this.prisma.notificationPreference.update({
      where: { userId },
      data: {
        emailEnabled: data.emailEnabled,
        inAppEnabled: data.inAppEnabled,
        marketingEmailEnabled: data.marketingEmailEnabled,
        reminderEmailEnabled: data.reminderEmailEnabled,
      },
    });
  }

  async changePassword(userId: string, body: any) {
    const { currentPassword, newPassword } = body;
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');

    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );
    if (!isPasswordValid)
      throw new BadRequestException('Current password is incorrect!');
    if (newPassword.length < 6)
      throw new BadRequestException(
        'New password must be at least 6 characters long.',
      );

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword },
    });
    return { message: 'Password successfully updated.' };
  }

  // Admin'in kendi bilgilerini çek ve güncelle
  async getMe(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
  }

  async updateMe(userId: string, data: any) {
    const nameParts = data.name.trim().split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

    return this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { email: data.email, phoneNumber: data.phoneNumber },
      });
      await tx.userProfile.update({
        where: { userId: userId },
        data: { firstName, lastName, fullName: data.name },
      });
      return { message: 'Profile updated successfully' };
    });
  }

  // 🔥 TALEP TİPLERİ (REQUEST TYPES) OPERASYONLARI 🔥

  async getRequestTypes() {
    return this.prisma.requestType.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async createRequestType(data: any) {
    const existing = await this.prisma.requestType.findUnique({
      where: { key: data.key },
    });

    if (existing) {
      throw new BadRequestException(
        'A request type with this unique key already exists.',
      );
    }

    return this.prisma.requestType.create({
      data: {
        name: data.name,
        key: data.key,
        category: data.category,
        description: data.description || null,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });
  }

  async bulkDeleteRequestTypes(ids: string[]) {
    if (!ids || ids.length === 0) {
      throw new BadRequestException('No IDs provided for deletion.');
    }

    try {
      const result = await this.prisma.requestType.deleteMany({
        where: {
          id: { in: ids },
        },
      });

      return {
        message: `${result.count} request types deleted successfully.`,
        count: result.count,
      };
    } catch (error) {
      throw new BadRequestException(
        'Cannot delete request types that have active requests linked to them. Delete the requests first.',
      );
    }
  }

  // 🔥 AUDIT (SİSTEM GEÇMİŞİ) İŞLEMLERİ 🔥
  async getAuditLogs(opts: { page?: number; limit?: number; search?: string } = {}) {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(200, Math.max(10, opts.limit ?? 100));
    const fetchCount = page * limit + limit; // fetch extra for pagination

    const [audits, logins] = await Promise.all([
      this.prisma.auditLog.findMany({
        include: { user: { include: { profile: true } } },
        orderBy: { createdAt: 'desc' },
        take: fetchCount,
      }),
      this.prisma.loginHistory.findMany({
        include: { user: { include: { profile: true } } },
        orderBy: { loginAt: 'desc' },
        take: fetchCount,
      }),
    ]);

    const combinedLogs: Array<{
      id: string;
      action: string;
      actor: string;
      target: string;
      ip: string;
      status: string;
      timestamp: Date;
    }> = [];

    audits.forEach((a) => {
      combinedLogs.push({
        id: a.id,
        action: a.actionType,
        actor: a.user?.profile?.fullName || a.user?.email || 'System',
        target: `${a.entityType} (${a.entityId})`,
        ip: a.ipAddress || 'Unknown',
        status: 'success',
        timestamp: a.createdAt,
      });
    });

    logins.forEach((l) => {
      combinedLogs.push({
        id: l.id,
        action: 'LOGIN',
        actor: l.user?.profile?.fullName || l.user?.email || 'Unknown User',
        target: 'System Authentication',
        ip: l.ipAddress || 'Unknown',
        status: l.success ? 'success' : 'failed',
        timestamp: l.loginAt,
      });
    });

    combinedLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    const search = opts.search?.toLowerCase();
    const filtered = search
      ? combinedLogs.filter(
          (l) =>
            l.action.toLowerCase().includes(search) ||
            l.actor.toLowerCase().includes(search) ||
            l.target.toLowerCase().includes(search) ||
            l.ip.includes(search),
        )
      : combinedLogs;

    const offset = (page - 1) * limit;
    const paginated = filtered.slice(offset, offset + limit);

    return {
      data: paginated,
      total: filtered.length,
      page,
      limit,
      totalPages: Math.ceil(filtered.length / limit),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ORGANIZATION MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────

  async getOrganization() {
    const [campuses, faculties, departments, units] = await Promise.all([
      this.prisma.campus.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.faculty.findMany({
        include: { campus: { select: { id: true, name: true } } },
        orderBy: { name: 'asc' },
      }),
      this.prisma.department.findMany({
        include: { faculty: { select: { id: true, name: true } } },
        orderBy: { name: 'asc' },
      }),
      this.prisma.unit.findMany({
        include: {
          campus: { select: { id: true, name: true } },
          faculty: { select: { id: true, name: true } },
          department: { select: { id: true, name: true } },
        },
        orderBy: { name: 'asc' },
      }),
    ]);
    return { campuses, faculties, departments, units };
  }

  // CAMPUS CRUD
  async getCampuses() {
    return this.prisma.campus.findMany({ orderBy: { name: 'asc' } });
  }

  async createCampus(adminId: string, data: any) {
    const campus = await this.prisma.campus.create({
      data: {
        name: data.name,
        code: data.code,
        address: data.address || null,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        actionType: AuditActionType.CREATE,
        entityType: 'Campus',
        entityId: campus.id,
      },
    });
    return campus;
  }

  async updateCampus(adminId: string, id: string, data: any) {
    const existing = await this.prisma.campus.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Campus not found.');
    const campus = await this.prisma.campus.update({
      where: { id },
      data: {
        name: data.name !== undefined ? data.name : existing.name,
        code: data.code !== undefined ? data.code : existing.code,
        address: data.address !== undefined ? data.address : existing.address,
        isActive: data.isActive !== undefined ? data.isActive : existing.isActive,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        actionType: AuditActionType.UPDATE,
        entityType: 'Campus',
        entityId: id,
      },
    });
    return campus;
  }

  async deleteCampus(adminId: string, id: string) {
    const existing = await this.prisma.campus.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Campus not found.');
    await this.prisma.campus.delete({ where: { id } });
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        actionType: AuditActionType.DELETE,
        entityType: 'Campus',
        entityId: id,
      },
    });
    return { message: 'Campus deleted successfully.' };
  }

  // FACULTY CRUD
  async getFaculties() {
    return this.prisma.faculty.findMany({
      include: { campus: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async createFaculty(adminId: string, data: any) {
    const faculty = await this.prisma.faculty.create({
      data: {
        campusId: data.campusId,
        name: data.name,
        code: data.code,
        deanUserId: data.deanUserId || null,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        actionType: AuditActionType.CREATE,
        entityType: 'Faculty',
        entityId: faculty.id,
      },
    });
    return faculty;
  }

  async updateFaculty(adminId: string, id: string, data: any) {
    const existing = await this.prisma.faculty.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Faculty not found.');
    const faculty = await this.prisma.faculty.update({
      where: { id },
      data: {
        campusId: data.campusId !== undefined ? data.campusId : existing.campusId,
        name: data.name !== undefined ? data.name : existing.name,
        code: data.code !== undefined ? data.code : existing.code,
        deanUserId: data.deanUserId !== undefined ? data.deanUserId : existing.deanUserId,
        isActive: data.isActive !== undefined ? data.isActive : existing.isActive,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        actionType: AuditActionType.UPDATE,
        entityType: 'Faculty',
        entityId: id,
      },
    });
    return faculty;
  }

  async deleteFaculty(adminId: string, id: string) {
    const existing = await this.prisma.faculty.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Faculty not found.');
    await this.prisma.faculty.delete({ where: { id } });
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        actionType: AuditActionType.DELETE,
        entityType: 'Faculty',
        entityId: id,
      },
    });
    return { message: 'Faculty deleted successfully.' };
  }

  // DEPARTMENT CRUD
  async getDepartments() {
    return this.prisma.department.findMany({
      include: { faculty: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async createDepartment(adminId: string, data: any) {
    const department = await this.prisma.department.create({
      data: {
        facultyId: data.facultyId,
        name: data.name,
        code: data.code,
        chairUserId: data.chairUserId || null,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        actionType: AuditActionType.CREATE,
        entityType: 'Department',
        entityId: department.id,
      },
    });
    return department;
  }

  async updateDepartment(adminId: string, id: string, data: any) {
    const existing = await this.prisma.department.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Department not found.');
    const department = await this.prisma.department.update({
      where: { id },
      data: {
        facultyId: data.facultyId !== undefined ? data.facultyId : existing.facultyId,
        name: data.name !== undefined ? data.name : existing.name,
        code: data.code !== undefined ? data.code : existing.code,
        chairUserId: data.chairUserId !== undefined ? data.chairUserId : existing.chairUserId,
        isActive: data.isActive !== undefined ? data.isActive : existing.isActive,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        actionType: AuditActionType.UPDATE,
        entityType: 'Department',
        entityId: id,
      },
    });
    return department;
  }

  async deleteDepartment(adminId: string, id: string) {
    const existing = await this.prisma.department.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Department not found.');
    await this.prisma.department.delete({ where: { id } });
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        actionType: AuditActionType.DELETE,
        entityType: 'Department',
        entityId: id,
      },
    });
    return { message: 'Department deleted successfully.' };
  }

  // UNIT CRUD
  async getUnits() {
    return this.prisma.unit.findMany({
      include: {
        campus: { select: { id: true, name: true } },
        faculty: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createUnit(adminId: string, data: any) {
    const unit = await this.prisma.unit.create({
      data: {
        name: data.name,
        code: data.code,
        type: data.type,
        campusId: data.campusId || null,
        facultyId: data.facultyId || null,
        departmentId: data.departmentId || null,
        managerUserId: data.managerUserId || null,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        actionType: AuditActionType.CREATE,
        entityType: 'Unit',
        entityId: unit.id,
      },
    });
    return unit;
  }

  async updateUnit(adminId: string, id: string, data: any) {
    const existing = await this.prisma.unit.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Unit not found.');
    const unit = await this.prisma.unit.update({
      where: { id },
      data: {
        name: data.name !== undefined ? data.name : existing.name,
        code: data.code !== undefined ? data.code : existing.code,
        type: data.type !== undefined ? data.type : existing.type,
        campusId: data.campusId !== undefined ? data.campusId : existing.campusId,
        facultyId: data.facultyId !== undefined ? data.facultyId : existing.facultyId,
        departmentId: data.departmentId !== undefined ? data.departmentId : existing.departmentId,
        managerUserId: data.managerUserId !== undefined ? data.managerUserId : existing.managerUserId,
        isActive: data.isActive !== undefined ? data.isActive : existing.isActive,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        actionType: AuditActionType.UPDATE,
        entityType: 'Unit',
        entityId: id,
      },
    });
    return unit;
  }

  async deleteUnit(adminId: string, id: string) {
    const existing = await this.prisma.unit.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Unit not found.');
    await this.prisma.unit.delete({ where: { id } });
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        actionType: AuditActionType.DELETE,
        entityType: 'Unit',
        entityId: id,
      },
    });
    return { message: 'Unit deleted successfully.' };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ROLES FULL CRUD
  // ─────────────────────────────────────────────────────────────────────────

  async getRolesFull() {
    const roles = await this.prisma.role.findMany({
      include: { _count: { select: { permissions: true, userRoles: true } } },
      orderBy: { name: 'asc' },
    });
    return roles.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      scopeType: r.scopeType,
      isSystem: r.isSystem,
      permissionsCount: r._count.permissions,
      usersCount: r._count.userRoles,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  async createRole(adminId: string, data: any) {
    const existing = await this.prisma.role.findUnique({ where: { name: data.name } });
    if (existing) throw new BadRequestException('A role with this name already exists.');
    const role = await this.prisma.role.create({
      data: {
        name: data.name,
        description: data.description || null,
        scopeType: data.scopeType,
        isSystem: data.isSystem !== undefined ? data.isSystem : false,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        actionType: AuditActionType.CREATE,
        entityType: 'Role',
        entityId: role.id,
      },
    });
    return role;
  }

  async updateRole(adminId: string, id: string, data: any) {
    const existing = await this.prisma.role.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Role not found.');
    if (existing.isSystem) throw new BadRequestException('System roles cannot be modified.');
    const role = await this.prisma.role.update({
      where: { id },
      data: {
        name: data.name !== undefined ? data.name : existing.name,
        description: data.description !== undefined ? data.description : existing.description,
        scopeType: data.scopeType !== undefined ? data.scopeType : existing.scopeType,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        actionType: AuditActionType.UPDATE,
        entityType: 'Role',
        entityId: id,
      },
    });
    return role;
  }

  async deleteRole(adminId: string, id: string) {
    const existing = await this.prisma.role.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Role not found.');
    if (existing.isSystem) throw new BadRequestException('System roles cannot be deleted.');
    await this.prisma.role.delete({ where: { id } });
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        actionType: AuditActionType.DELETE,
        entityType: 'Role',
        entityId: id,
      },
    });
    return { message: 'Role deleted successfully.' };
  }

  async getPermissions() {
    return this.prisma.permission.findMany({ orderBy: { name: 'asc' } });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RESOURCES CRUD
  // ─────────────────────────────────────────────────────────────────────────

  async getResources() {
    return this.prisma.resource.findMany({
      include: {
        campus: { select: { id: true, name: true } },
        faculty: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        unit: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createResource(adminId: string, data: any) {
    const resource = await this.prisma.resource.create({
      data: {
        resourceType: data.resourceType,
        code: data.code,
        name: data.name,
        description: data.description || null,
        campusId: data.campusId || null,
        facultyId: data.facultyId || null,
        departmentId: data.departmentId || null,
        unitId: data.unitId || null,
        locationText: data.locationText || null,
        capacity: data.capacity || null,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        actionType: AuditActionType.CREATE,
        entityType: 'Resource',
        entityId: resource.id,
      },
    });
    return resource;
  }

  async updateResource(adminId: string, id: string, data: any) {
    const existing = await this.prisma.resource.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Resource not found.');
    const resource = await this.prisma.resource.update({
      where: { id },
      data: {
        resourceType: data.resourceType !== undefined ? data.resourceType : existing.resourceType,
        code: data.code !== undefined ? data.code : existing.code,
        name: data.name !== undefined ? data.name : existing.name,
        description: data.description !== undefined ? data.description : existing.description,
        campusId: data.campusId !== undefined ? data.campusId : existing.campusId,
        facultyId: data.facultyId !== undefined ? data.facultyId : existing.facultyId,
        departmentId: data.departmentId !== undefined ? data.departmentId : existing.departmentId,
        unitId: data.unitId !== undefined ? data.unitId : existing.unitId,
        locationText: data.locationText !== undefined ? data.locationText : existing.locationText,
        capacity: data.capacity !== undefined ? data.capacity : existing.capacity,
        isActive: data.isActive !== undefined ? data.isActive : existing.isActive,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        actionType: AuditActionType.UPDATE,
        entityType: 'Resource',
        entityId: id,
      },
    });
    return resource;
  }

  async getResourceById(id: string) {
    const r = await this.prisma.resource.findUnique({
      where: { id },
      include: {
        campus: { select: { id: true, name: true } },
        faculty: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        unit: { select: { id: true, name: true } },
        availabilitySlots: { orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] },
      },
    });
    if (!r) throw new NotFoundException('Resource not found.');
    return r;
  }

  async deleteResource(adminId: string, id: string) {
    const existing = await this.prisma.resource.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Resource not found.');
    await this.prisma.resource.delete({ where: { id } });
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        actionType: AuditActionType.DELETE,
        entityType: 'Resource',
        entityId: id,
      },
    });
    return { message: 'Resource deleted successfully.' };
  }

  async replaceResourceAvailability(
    adminId: string,
    id: string,
    slots: { dayOfWeek: number; startTime: string; endTime: string; isAvailable?: boolean }[],
  ) {
    const existing = await this.prisma.resource.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Resource not found.');
    await this.prisma.$transaction(async (tx) => {
      await tx.resourceAvailability.deleteMany({ where: { resourceId: id } });
      if (slots.length > 0) {
        await tx.resourceAvailability.createMany({
          data: slots.map((s) => ({
            resourceId: id,
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
            isAvailable: s.isAvailable !== false,
          })),
        });
      }
    });
    await this.prisma.auditLog.create({
      data: { userId: adminId, actionType: AuditActionType.UPDATE, entityType: 'ResourceAvailability', entityId: id },
    });
    return this.prisma.resourceAvailability.findMany({
      where: { resourceId: id },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // READ-ONLY LISTS
  // ─────────────────────────────────────────────────────────────────────────

  async getReservations() {
    return this.prisma.reservation.findMany({
      include: {
        resource: { select: { id: true, name: true, resourceType: true } },
        reservedBy: { include: { profile: { select: { fullName: true } } } },
        approvedBy: { include: { profile: { select: { fullName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async getAppointments() {
    return this.prisma.appointment.findMany({
      include: {
        requester: { include: { profile: { select: { fullName: true } } } },
        host: { include: { profile: { select: { fullName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async getTickets() {
    return this.prisma.itTicket.findMany({
      include: {
        request: { select: { id: true, requestNo: true, title: true, status: true } },
        reportedBy: { include: { profile: { select: { fullName: true } } } },
        assignedTo: { include: { profile: { select: { fullName: true } } } },
        slaPolicy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async getSLAPolicies() {
    return this.prisma.slaPolicy.findMany({
      include: { requestType: { select: { id: true, name: true, key: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createSLAPolicy(adminId: string, data: any) {
    const policy = await this.prisma.slaPolicy.create({
      data: {
        name: data.name,
        requestTypeId: data.requestTypeId || null,
        priority: data.priority || null,
        firstResponseMinutes: data.firstResponseMinutes || null,
        resolutionMinutes: data.resolutionMinutes || null,
        escalationMinutes: data.escalationMinutes || null,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        actionType: AuditActionType.CREATE,
        entityType: 'SlaPolicy',
        entityId: policy.id,
      },
    });
    return policy;
  }

  async getSLAPolicyById(id: string) {
    const p = await this.prisma.slaPolicy.findUnique({
      where: { id },
      include: { requestType: { select: { id: true, name: true, key: true } } },
    });
    if (!p) throw new NotFoundException('SLA Policy not found.');
    return p;
  }

  async updateSLAPolicy(adminId: string, id: string, data: any) {
    const existing = await this.prisma.slaPolicy.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('SLA Policy not found.');
    const policy = await this.prisma.slaPolicy.update({
      where: { id },
      data: {
        name: data.name !== undefined ? data.name : existing.name,
        requestTypeId: data.requestTypeId !== undefined ? (data.requestTypeId || null) : existing.requestTypeId,
        priority: data.priority !== undefined ? (data.priority || null) : existing.priority,
        firstResponseMinutes: data.firstResponseMinutes !== undefined ? (data.firstResponseMinutes || null) : existing.firstResponseMinutes,
        resolutionMinutes: data.resolutionMinutes !== undefined ? (data.resolutionMinutes || null) : existing.resolutionMinutes,
        escalationMinutes: data.escalationMinutes !== undefined ? (data.escalationMinutes || null) : existing.escalationMinutes,
        isActive: data.isActive !== undefined ? data.isActive : existing.isActive,
      },
      include: { requestType: { select: { id: true, name: true, key: true } } },
    });
    await this.prisma.auditLog.create({
      data: { userId: adminId, actionType: AuditActionType.UPDATE, entityType: 'SlaPolicy', entityId: id },
    });
    return policy;
  }

  async deleteSLAPolicy(adminId: string, id: string) {
    const existing = await this.prisma.slaPolicy.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('SLA Policy not found.');
    await this.prisma.slaPolicy.delete({ where: { id } });
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        actionType: AuditActionType.DELETE,
        entityType: 'SlaPolicy',
        entityId: id,
      },
    });
    return { message: 'SLA Policy deleted successfully.' };
  }

  async getSystemEvents() {
    return this.prisma.systemEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async getWebhookLogs() {
    return this.prisma.webhookLog.findMany({
      include: {
        integration: { select: { id: true, name: true, provider: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WORKFLOWS CRUD
  // ─────────────────────────────────────────────────────────────────────────

  async getWorkflows() {
    return this.prisma.workflowDefinition.findMany({
      include: {
        _count: { select: { steps: true, instances: true } },
        createdBy: { include: { profile: { select: { fullName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createWorkflow(adminId: string, data: any) {
    const existing = await this.prisma.workflowDefinition.findUnique({ where: { key: data.key } });
    if (existing) throw new BadRequestException('A workflow with this key already exists.');
    const workflow = await this.prisma.workflowDefinition.create({
      data: {
        key: data.key,
        name: data.name,
        description: data.description || null,
        version: data.version || 1,
        isActive: data.isActive !== undefined ? data.isActive : true,
        isDefault: data.isDefault !== undefined ? data.isDefault : false,
        createdByUserId: adminId,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        actionType: AuditActionType.CREATE,
        entityType: 'WorkflowDefinition',
        entityId: workflow.id,
      },
    });
    return workflow;
  }

  async deleteWorkflow(adminId: string, id: string) {
    const existing = await this.prisma.workflowDefinition.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Workflow not found.');
    await this.prisma.workflowDefinition.delete({ where: { id } });
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        actionType: AuditActionType.DELETE,
        entityType: 'WorkflowDefinition',
        entityId: id,
      },
    });
    return { message: 'Workflow deleted successfully.' };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DASHBOARD METRICS
  // ─────────────────────────────────────────────────────────────────────────

  async getDashboardMetrics() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
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
      this.prisma.request.count({ where: { deletedAt: null } }),
      this.prisma.request.count({
        where: {
          deletedAt: null,
          status: { notIn: ['COMPLETED', 'APPROVED', 'REJECTED', 'CANCELLED', 'CLOSED', 'EXPIRED'] },
        },
      }),
      this.prisma.request.count({
        where: {
          deletedAt: null,
          dueAt: { lt: now },
          status: { notIn: ['COMPLETED', 'APPROVED', 'REJECTED', 'CANCELLED', 'CLOSED', 'EXPIRED'] },
        },
      }),
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
      this.prisma.request.count({ where: { deletedAt: null, status: 'APPROVED' } }),
      this.prisma.request.count({ where: { deletedAt: null, status: 'REJECTED' } }),
      this.prisma.request.count({ where: { deletedAt: null, createdAt: { gte: todayStart } } }),
      this.prisma.itTicket.count({
        where: { ticketStatus: { in: ['OPEN', 'IN_PROGRESS', 'TRIAGED', 'WAITING_USER', 'REOPENED'] } },
      }),
      this.prisma.reservation.count({ where: { startAt: { gte: todayStart } } }),
      this.prisma.appointment.count({ where: { startAt: { gte: todayStart } } }),
    ]);

    const total = totalApproved + totalRejected;
    const approvalRate = total > 0 ? Math.round((totalApproved / total) * 100) : 0;

    return {
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
  }

  async getLoginHistory(userId: string) {
    return this.prisma.loginHistory.findMany({
      where: { userId },
      orderBy: { loginAt: 'desc' },
      take: 20,
    });
  }

  async getIntegrations() {
    return this.prisma.integration.findMany({
      select: {
        id: true,
        name: true,
        provider: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REPORTS / ANALYTICS SUMMARY
  // ─────────────────────────────────────────────────────────────────────────

  async getReports() {
    const now = new Date();
    const [
      totalUsers,
      totalRequests,
      openRequests,
      resolvedRequests,
      openTickets,
      totalTickets,
      totalReservations,
      totalAppointments,
      requestsByStatus,
      requestsByTypRaw,
      ticketsByStatus,
      completedWithDates,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.request.count({ where: { deletedAt: null } }),
      this.prisma.request.count({
        where: {
          deletedAt: null,
          status: { notIn: ['COMPLETED', 'APPROVED', 'REJECTED', 'CANCELLED', 'CLOSED', 'EXPIRED'] },
        },
      }),
      this.prisma.request.count({
        where: { deletedAt: null, status: { in: ['COMPLETED', 'APPROVED'] } },
      }),
      this.prisma.itTicket.count({
        where: { ticketStatus: { in: ['OPEN', 'IN_PROGRESS', 'TRIAGED', 'WAITING_USER', 'REOPENED'] } },
      }),
      this.prisma.itTicket.count(),
      this.prisma.reservation.count(),
      this.prisma.appointment.count(),
      this.prisma.request.groupBy({
        by: ['status'],
        _count: { status: true },
        where: { deletedAt: null },
      }),
      this.prisma.request.groupBy({
        by: ['requestTypeId'],
        _count: { requestTypeId: true },
        where: { deletedAt: null },
      }),
      this.prisma.itTicket.groupBy({
        by: ['ticketStatus'],
        _count: { ticketStatus: true },
      }),
      this.prisma.request.findMany({
        where: { deletedAt: null, status: { in: ['COMPLETED', 'APPROVED'] }, submittedAt: { not: null } },
        select: { submittedAt: true, updatedAt: true },
        take: 500,
      }),
    ]);

    // Resolve request type names for the groupBy result
    const typeIds = requestsByTypRaw.map((r) => r.requestTypeId).filter(Boolean) as string[];
    const requestTypes = typeIds.length
      ? await this.prisma.requestType.findMany({ where: { id: { in: typeIds } }, select: { id: true, name: true } })
      : [];
    const typeMap = Object.fromEntries(requestTypes.map((rt) => [rt.id, rt.name]));

    // Average resolution days
    let avgResolutionDays: number | null = null;
    if (completedWithDates.length > 0) {
      const totalMs = completedWithDates.reduce((acc, r) => {
        const start = r.submittedAt?.getTime() ?? 0;
        const end = r.updatedAt?.getTime() ?? 0;
        return acc + Math.max(0, end - start);
      }, 0);
      avgResolutionDays = Math.round(totalMs / completedWithDates.length / (1000 * 60 * 60 * 24));
    }

    return {
      totalUsers,
      totalRequests,
      openRequests,
      resolvedRequests,
      openTickets,
      totalTickets,
      totalReservations,
      totalAppointments,
      avgResolutionDays,
      requestsByStatus: requestsByStatus.map((r) => ({ status: r.status, count: r._count.status })),
      requestsByType: requestsByTypRaw.map((r) => ({
        type: r.requestTypeId ? (typeMap[r.requestTypeId] ?? r.requestTypeId) : 'Unknown',
        count: r._count.requestTypeId,
      })).sort((a, b) => b.count - a.count),
      ticketsByStatus: ticketsByStatus.map((t) => ({ status: t.ticketStatus, count: t._count.ticketStatus })),
    };
  }

  async getAnalyticsOverview() {
    const [metrics, reports] = await Promise.all([
      this.getDashboardMetrics(),
      this.getReports(),
    ]);
    return { ...metrics, ...reports };
  }

  // ─── SINGLE USER ─────────────────────────────────────────────────────────

  async getUserById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        profile: {
          include: {
            faculty: { select: { id: true, name: true } },
            department: { select: { id: true, name: true } },
          },
        },
        primaryRoles: {
          include: {
            role: true,
            faculty: { select: { id: true, name: true } },
            department: { select: { id: true, name: true } },
            unit: { select: { id: true, name: true } },
          },
          orderBy: { isPrimary: 'desc' },
        },
      },
    });

    if (!user) throw new NotFoundException('User not found.');

    return {
      id: user.id,
      email: user.email,
      phoneNumber: user.phoneNumber,
      status: user.status,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      profile: user.profile,
      roles: user.primaryRoles.map((ur) => ({
        id: ur.id,
        name: ur.role.name,
        scopeType: ur.role.scopeType,
        isPrimary: ur.isPrimary,
        facultyId: ur.facultyId,
        facultyName: ur.faculty?.name ?? null,
        departmentId: ur.departmentId,
        departmentName: ur.department?.name ?? null,
        unitId: ur.unitId,
        unitName: ur.unit?.name ?? null,
        assignedAt: ur.assignedAt,
      })),
    };
  }

  // ─── USER ROLE MANAGEMENT ────────────────────────────────────────────────

  async getUserRoles(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');

    return this.prisma.userRole.findMany({
      where: { userId },
      include: {
        role: true,
        faculty: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        unit: { select: { id: true, name: true } },
      },
      orderBy: { isPrimary: 'desc' },
    });
  }

  async assignRole(adminId: string, userId: string, dto: AssignRoleDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');

    const role = await this.prisma.role.findUnique({ where: { id: dto.roleId } });
    if (!role) throw new NotFoundException('Role not found.');

    // Prevent duplicate assignment of same role + scope combo
    const existing = await this.prisma.userRole.findFirst({
      where: {
        userId,
        roleId: dto.roleId,
        facultyId: dto.facultyId ?? null,
        departmentId: dto.departmentId ?? null,
        unitId: dto.unitId ?? null,
      },
    });
    if (existing) throw new ConflictException('This role assignment already exists.');

    // If setting as primary, demote current primary
    if (dto.isPrimary) {
      await this.prisma.userRole.updateMany({
        where: { userId },
        data: { isPrimary: false },
      });
    }

    const userRole = await this.prisma.userRole.create({
      data: {
        userId,
        roleId: dto.roleId,
        facultyId: dto.facultyId ?? null,
        departmentId: dto.departmentId ?? null,
        unitId: dto.unitId ?? null,
        isPrimary: dto.isPrimary ?? false,
        assignedByUserId: adminId,
      },
      include: { role: true },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        actionType: AuditActionType.CREATE,
        entityType: 'UserRole',
        entityId: userRole.id,
      },
    });

    return userRole;
  }

  async removeRole(adminId: string, userId: string, userRoleId: string) {
    const userRole = await this.prisma.userRole.findFirst({
      where: { id: userRoleId, userId },
    });
    if (!userRole) throw new NotFoundException('Role assignment not found.');

    await this.prisma.userRole.delete({ where: { id: userRoleId } });

    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        actionType: AuditActionType.DELETE,
        entityType: 'UserRole',
        entityId: userRoleId,
      },
    });

    return { message: 'Role removed.' };
  }

  // ─── USER PROFILE (ADMIN) ────────────────────────────────────────────────

  async updateUserProfile(adminId: string, userId: string, dto: AdminUpdateProfileDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    if (!user) throw new NotFoundException('User not found.');

    if (dto.studentNumber) {
      const conflict = await this.prisma.userProfile.findFirst({
        where: { studentNumber: dto.studentNumber, userId: { not: userId } },
      });
      if (conflict) throw new ConflictException('Student number is already in use.');
    }
    if (dto.staffNumber) {
      const conflict = await this.prisma.userProfile.findFirst({
        where: { staffNumber: dto.staffNumber, userId: { not: userId } },
      });
      if (conflict) throw new ConflictException('Staff number is already in use.');
    }

    const firstName = dto.firstName ?? user.profile?.firstName ?? '';
    const lastName = dto.lastName ?? user.profile?.lastName ?? '';
    const fullName = [firstName, lastName].filter(Boolean).join(' ');

    if (dto.phoneNumber !== undefined) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { phoneNumber: dto.phoneNumber || null },
      });
    }

    const profile = await this.prisma.userProfile.upsert({
      where: { userId },
      create: {
        userId,
        firstName,
        lastName,
        fullName,
        title: dto.title ?? null,
        studentNumber: dto.studentNumber ?? null,
        staffNumber: dto.staffNumber ?? null,
        bio: dto.bio ?? null,
        address: dto.address ?? null,
        facultyId: dto.facultyId ?? null,
        departmentId: dto.departmentId ?? null,
      },
      update: {
        firstName: dto.firstName !== undefined ? dto.firstName : user.profile?.firstName ?? '',
        lastName: dto.lastName !== undefined ? dto.lastName : user.profile?.lastName ?? '',
        fullName,
        title: dto.title !== undefined ? dto.title : user.profile?.title,
        studentNumber: dto.studentNumber !== undefined ? dto.studentNumber : user.profile?.studentNumber,
        staffNumber: dto.staffNumber !== undefined ? dto.staffNumber : user.profile?.staffNumber,
        bio: dto.bio !== undefined ? dto.bio : user.profile?.bio,
        address: dto.address !== undefined ? dto.address : user.profile?.address,
        facultyId: dto.facultyId !== undefined ? dto.facultyId : user.profile?.facultyId,
        departmentId: dto.departmentId !== undefined ? dto.departmentId : user.profile?.departmentId,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        actionType: AuditActionType.UPDATE,
        entityType: 'UserProfile',
        entityId: userId,
      },
    });

    return profile;
  }

  // ─── REQUEST TYPE CRUD ────────────────────────────────────────────────────

  async getRequestTypeById(id: string) {
    const rt = await this.prisma.requestType.findUnique({ where: { id } });
    if (!rt) throw new NotFoundException('Request type not found.');
    return rt;
  }

  async updateRequestType(id: string, dto: UpdateRequestTypeDto) {
    const existing = await this.prisma.requestType.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Request type not found.');

    return this.prisma.requestType.update({
      where: { id },
      data: {
        name: dto.name !== undefined ? dto.name : existing.name,
        description: dto.description !== undefined ? dto.description : existing.description,
        category: dto.category !== undefined ? dto.category : existing.category,
        workflowDefinitionId:
          dto.workflowDefinitionId !== undefined
            ? dto.workflowDefinitionId
            : existing.workflowDefinitionId,
        isActive: dto.isActive !== undefined ? dto.isActive : existing.isActive,
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DOMAIN MODULE ADMIN VIEWS
  // ─────────────────────────────────────────────────────────────────────────

  async getEquipmentRequests() {
    const items = await this.prisma.equipmentRequest.findMany({
      include: {
        request: { select: { id: true, requestNo: true, title: true, status: true, createdAt: true } },
        requester: { include: { profile: { select: { fullName: true } } } },
        labResource: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
    const counts = await this.prisma.request.groupBy({
      by: ['status'],
      where: { equipmentRequest: { isNot: null } },
      _count: { _all: true },
    });
    const metrics = { total: 0, pending: 0, approved: 0, rejected: 0, completed: 0 };
    for (const c of counts) {
      metrics.total += c._count._all;
      if (['SUBMITTED', 'IN_REVIEW', 'WAITING_APPROVAL'].includes(c.status)) metrics.pending += c._count._all;
      if (c.status === 'APPROVED') metrics.approved += c._count._all;
      if (c.status === 'REJECTED') metrics.rejected += c._count._all;
      if (['COMPLETED', 'CLOSED'].includes(c.status)) metrics.completed += c._count._all;
    }
    return { items, metrics };
  }

  async getInternships() {
    const items = await this.prisma.internshipRequest.findMany({
      include: {
        request: { select: { id: true, requestNo: true, title: true, status: true, createdAt: true } },
        student: { include: { profile: { select: { fullName: true } } } },
        advisor: { include: { profile: { select: { fullName: true } } } },
        term: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
    const counts = await this.prisma.request.groupBy({
      by: ['status'],
      where: { internshipRequest: { isNot: null } },
      _count: { _all: true },
    });
    const metrics = { total: 0, pending: 0, approved: 0, rejected: 0, completed: 0 };
    for (const c of counts) {
      metrics.total += c._count._all;
      if (['SUBMITTED', 'IN_REVIEW', 'WAITING_APPROVAL'].includes(c.status)) metrics.pending += c._count._all;
      if (c.status === 'APPROVED') metrics.approved += c._count._all;
      if (c.status === 'REJECTED') metrics.rejected += c._count._all;
      if (['COMPLETED', 'CLOSED'].includes(c.status)) metrics.completed += c._count._all;
    }
    return { items, metrics };
  }

  async getProcurementRequests() {
    const items = await this.prisma.procurementRequest.findMany({
      include: {
        request: { select: { id: true, requestNo: true, title: true, status: true, createdAt: true } },
        requester: { include: { profile: { select: { fullName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
    const counts = await this.prisma.request.groupBy({
      by: ['status'],
      where: { procurementRequest: { isNot: null } },
      _count: { _all: true },
    });
    const metrics = { total: 0, pending: 0, approved: 0, rejected: 0, completed: 0 };
    for (const c of counts) {
      metrics.total += c._count._all;
      if (['SUBMITTED', 'IN_REVIEW', 'WAITING_APPROVAL'].includes(c.status)) metrics.pending += c._count._all;
      if (c.status === 'APPROVED') metrics.approved += c._count._all;
      if (c.status === 'REJECTED') metrics.rejected += c._count._all;
      if (['COMPLETED', 'CLOSED'].includes(c.status)) metrics.completed += c._count._all;
    }
    return { items, metrics };
  }

  async getEventRequests() {
    const items = await this.prisma.eventRequest.findMany({
      include: {
        request: { select: { id: true, requestNo: true, title: true, status: true, createdAt: true } },
        organizer: { include: { profile: { select: { fullName: true } } } },
        club: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
    const counts = await this.prisma.request.groupBy({
      by: ['status'],
      where: { eventRequest: { isNot: null } },
      _count: { _all: true },
    });
    const metrics = { total: 0, pending: 0, approved: 0, rejected: 0, completed: 0 };
    for (const c of counts) {
      metrics.total += c._count._all;
      if (['SUBMITTED', 'IN_REVIEW', 'WAITING_APPROVAL'].includes(c.status)) metrics.pending += c._count._all;
      if (c.status === 'APPROVED') metrics.approved += c._count._all;
      if (c.status === 'REJECTED') metrics.rejected += c._count._all;
      if (['COMPLETED', 'CLOSED'].includes(c.status)) metrics.completed += c._count._all;
    }
    return { items, metrics };
  }

  async getAdminAccessRequests() {
    const items = await this.prisma.accessRequest.findMany({
      include: {
        request: { select: { id: true, requestNo: true, title: true, status: true, createdAt: true } },
        requester: { include: { profile: { select: { fullName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
    const counts = await this.prisma.request.groupBy({
      by: ['status'],
      where: { accessRequest: { isNot: null } },
      _count: { _all: true },
    });
    const metrics = { total: 0, pending: 0, approved: 0, rejected: 0, completed: 0 };
    for (const c of counts) {
      metrics.total += c._count._all;
      if (['SUBMITTED', 'IN_REVIEW', 'WAITING_APPROVAL'].includes(c.status)) metrics.pending += c._count._all;
      if (c.status === 'APPROVED') metrics.approved += c._count._all;
      if (c.status === 'REJECTED') metrics.rejected += c._count._all;
      if (['COMPLETED', 'CLOSED'].includes(c.status)) metrics.completed += c._count._all;
    }
    return { items, metrics };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ACADEMIC TERMS
  // ─────────────────────────────────────────────────────────────────────────

  getAcademicTerms() {
    return this.prisma.academicTerm.findMany({ orderBy: { startDate: 'desc' } });
  }

  async createAcademicTerm(data: {
    name: string;
    code: string;
    startDate: string;
    endDate: string;
    isActive?: boolean;
  }) {
    const existing = await this.prisma.academicTerm.findUnique({ where: { code: data.code } });
    if (existing) throw new BadRequestException('A term with this code already exists.');
    return this.prisma.academicTerm.create({
      data: {
        name: data.name,
        code: data.code,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        isActive: data.isActive ?? false,
      },
    });
  }

  async updateAcademicTerm(
    id: string,
    data: { name?: string; startDate?: string; endDate?: string; isActive?: boolean },
  ) {
    const existing = await this.prisma.academicTerm.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Academic term not found.');
    return this.prisma.academicTerm.update({
      where: { id },
      data: {
        name: data.name ?? existing.name,
        startDate: data.startDate ? new Date(data.startDate) : existing.startDate,
        endDate: data.endDate ? new Date(data.endDate) : existing.endDate,
        isActive: data.isActive ?? existing.isActive,
      },
    });
  }
}
