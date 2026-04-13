import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../core/prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';

type AuthRequestMetadata = {
  ipAddress?: string;
  userAgent?: string | string[];
};

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  private normalizeMetadata(metadata?: AuthRequestMetadata) {
    return {
      ipAddress: metadata?.ipAddress ?? 'unknown',
      userAgent: Array.isArray(metadata?.userAgent)
        ? metadata.userAgent.join(', ')
        : metadata?.userAgent ?? 'unknown',
    };
  }

  async login(
    email: string,
    password: string,
    metadata?: AuthRequestMetadata,
  ) {
    const normalizedEmail = email.trim().toLowerCase();
    const requestMeta = this.normalizeMetadata(metadata);

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        primaryRoles: {
          include: { role: true },
          orderBy: { isPrimary: 'desc' },
        },
      },
    });

    if (!user) {
      await this.prisma.auditLog.create({
        data: {
          actionType: 'LOGIN',
          entityType: 'AuthAttempt',
          entityId: normalizedEmail,
          ipAddress: requestMeta.ipAddress,
          userAgent: requestMeta.userAgent,
          newValuesJson: { success: false, reason: 'invalid_credentials' },
        },
      });
      throw new UnauthorizedException('Invalid email or password.');
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenException('Your account has been suspended.');
    }
    if (user.status === UserStatus.INACTIVE) {
      throw new ForbiddenException(
        'Your account is inactive. Contact an administrator.',
      );
    }
    if (user.status === UserStatus.PENDING) {
      throw new ForbiddenException('Your account is pending approval.');
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      await this.prisma.loginHistory.create({
        data: {
          userId: user.id,
          success: false,
          ipAddress: requestMeta.ipAddress,
          userAgent: requestMeta.userAgent,
          failureReason: 'invalid_credentials',
        },
      });
      throw new UnauthorizedException('Invalid email or password.');
    }

    await this.prisma.loginHistory.create({
      data: {
        userId: user.id,
        success: true,
        ipAddress: requestMeta.ipAddress,
        userAgent: requestMeta.userAgent,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        actionType: 'LOGIN',
        entityType: 'UserSession',
        entityId: user.id,
        ipAddress: requestMeta.ipAddress,
        userAgent: requestMeta.userAgent,
      },
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const roles = user.primaryRoles.map((ur) => ur.role.name.toUpperCase());
    const primaryRole = roles[0] ?? 'STUDENT';
    const payload = { sub: user.id, email: user.email, roles };

    return {
      access_token: await this.jwtService.signAsync(payload),
      user: {
        id: user.id,
        email: user.email,
        role: primaryRole,
        roles,
      },
    };
  }

  async register(dto: RegisterDto, metadata?: AuthRequestMetadata) {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const requestMeta = this.normalizeMetadata(metadata);

    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) {
      throw new ConflictException('This email is already registered.');
    }

    const hashed = await bcrypt.hash(dto.password, 12);
    const firstName = dto.firstName?.trim() ?? '';
    const lastName = dto.lastName?.trim() ?? '';
    const fullName =
      [firstName, lastName].filter(Boolean).join(' ') ||
      normalizedEmail.split('@')[0];

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: normalizedEmail,
          password: hashed,
          status: UserStatus.ACTIVE,
          profile: {
            create: {
              firstName,
              lastName,
              fullName,
            },
          },
        },
      });

      const studentRole = await tx.role.findFirst({
        where: { name: { equals: 'STUDENT', mode: 'insensitive' } },
      });

      if (studentRole) {
        await tx.userRole.create({
          data: {
            userId: created.id,
            roleId: studentRole.id,
            isPrimary: true,
          },
        });
      }

      return created;
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        actionType: 'CREATE',
        entityType: 'User',
        entityId: user.id,
        ipAddress: requestMeta.ipAddress,
        userAgent: requestMeta.userAgent,
      },
    });

    const payload = { sub: user.id, email: user.email, roles: ['STUDENT'] };

    return {
      access_token: await this.jwtService.signAsync(payload),
      user: {
        id: user.id,
        email: user.email,
        role: 'STUDENT',
        roles: ['STUDENT'],
      },
    };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        status: true,
        profile: {
          select: {
            firstName: true,
            lastName: true,
            fullName: true,
          },
        },
        primaryRoles: {
          include: { role: true },
          orderBy: { isPrimary: 'desc' },
        },
      },
    });

    if (!user) throw new NotFoundException('User not found.');

    return {
      id: user.id,
      email: user.email,
      status: user.status,
      profile: user.profile
        ? {
            firstName: user.profile.firstName,
            lastName: user.profile.lastName,
            fullName: user.profile.fullName,
          }
        : null,
      roles: user.primaryRoles.map((ur) => ({
        name: ur.role.name.toUpperCase(),
        scopeType: ur.role.scopeType,
        facultyId: ur.facultyId ?? null,
        departmentId: ur.departmentId ?? null,
        unitId: ur.unitId ?? null,
        isPrimary: ur.isPrimary,
      })),
    };
  }

  async getFullProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: {
          include: {
            department: true,
            faculty: true,
          },
        },
        primaryRoles: {
          include: { role: true },
          orderBy: { isPrimary: 'desc' },
        },
      },
    });

    if (!user) throw new NotFoundException('User not found.');

    const profile = user.profile;
    const roleName = user.primaryRoles[0]?.role?.name?.toUpperCase() ?? 'STUDENT';

    let fullName = profile?.fullName ?? '';
    if (!fullName) {
      fullName = profile?.firstName
        ? `${profile.firstName} ${profile.lastName ?? ''}`.trim()
        : user.email.split('@')[0];
    }

    return {
      id: user.id,
      name: fullName,
      fullName,
      firstName: profile?.firstName ?? fullName.split(' ')[0],
      lastName: profile?.lastName ?? '',
      email: user.email,
      phoneNumber: user.phoneNumber ?? '',
      studentId: profile?.studentNumber ?? '',
      studentNumber: profile?.studentNumber ?? '',
      staffNumber: profile?.staffNumber ?? '',
      title: profile?.title ?? '',
      department: profile?.department?.name ?? '',
      faculty: profile?.faculty?.name ?? '',
      bio: profile?.bio ?? '',
      address: profile?.address ?? '',
      gender: profile?.gender ?? '',
      birthDate: profile?.birthDate
        ? profile.birthDate.toISOString().split('T')[0]
        : '',
      avatarUrl: profile?.avatarUrl ?? '',
      role: roleName.toLowerCase(),
      roles: user.primaryRoles.map((ur) => ur.role.name.toUpperCase()),
      status: user.status,
    };
  }
}
