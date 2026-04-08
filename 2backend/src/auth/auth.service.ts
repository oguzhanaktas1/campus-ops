import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../core/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { UserStatus } from '@prisma/client';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  // ─── LOGIN ────────────────────────────────────────────────────────────────

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        primaryRoles: {
          include: { role: true },
          orderBy: { isPrimary: 'desc' },
        },
      },
    });

    if (!user) throw new UnauthorizedException('Invalid email or password.');

    if (user.status === UserStatus.SUSPENDED)
      throw new ForbiddenException('Your account has been suspended.');
    if (user.status === UserStatus.INACTIVE)
      throw new ForbiddenException('Your account is inactive. Contact an administrator.');
    if (user.status === UserStatus.PENDING)
      throw new ForbiddenException('Your account is pending approval.');

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid email or password.');

    // Record login history
    await this.prisma.loginHistory.create({
      data: {
        userId: user.id,
        success: true,
        ipAddress: 'web',
        userAgent: 'web-browser',
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
        role: primaryRole, // kept for AuthGuard localStorage check
        roles,
      },
    };
  }

  // ─── REGISTER ─────────────────────────────────────────────────────────────

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('This email is already registered.');

    const hashed = await bcrypt.hash(dto.password, 10);

    const firstName = dto.firstName ?? '';
    const lastName = dto.lastName ?? '';
    const fullName = [firstName, lastName].filter(Boolean).join(' ') || dto.email.split('@')[0];

    // Create user + profile in a transaction
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: dto.email,
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

      // Assign default STUDENT role (must exist in DB via seed)
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

  // ─── GET /auth/me (structured response) ───────────────────────────────────

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

  // ─── GET /auth/profile (legacy flat response — kept for portal layouts) ───

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
      studentId: profile?.studentNumber ?? '',
      staffNumber: profile?.staffNumber ?? '',
      title: profile?.title ?? '',
      department: profile?.department?.name ?? '',
      faculty: profile?.faculty?.name ?? '',
      bio: profile?.bio ?? '',
      role: roleName.toLowerCase(),
      roles: user.primaryRoles.map((ur) => ur.role.name.toUpperCase()),
      status: user.status,
    };
  }
}
