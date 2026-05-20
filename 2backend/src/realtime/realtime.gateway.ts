import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../core/prisma/prisma.service';
import { Server, Socket } from 'socket.io';
import { RealtimeRooms } from './utils/room-builder';

interface SocketUser {
  id: string;
  mainRole: string;
  subRoles: string[];
  portal: string;
  facultyId: string | null;
  departmentId: string | null;
  unitId: string | null;
}

const ROLE_PORTAL_MAP: Record<string, string> = {
  STUDENT: 'student',
  FACULTY: 'faculty',
  STAFF: 'staff',
  ADMIN: 'admin',
};

function resolvePortal(roles: string[]): string {
  for (const r of roles) {
    if (ROLE_PORTAL_MAP[r]) return ROLE_PORTAL_MAP[r];
  }
  return 'student';
}

// Security is enforced via JWT validation in handleConnection,
// so mirroring the request origin is safe here.
@WebSocketGateway({
  cors: { origin: true, credentials: true },
  namespace: '/realtime',
  transports: ['websocket', 'polling'],
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.toString().replace('Bearer ', '');

      if (!token) {
        client.disconnect();
        return;
      }

      const user = await this.validateTokenAndGetUser(token);
      client.data.user = user;

      await this.joinAllowedRooms(client, user);

      client.emit('connected', { status: 'ok', userId: user.id });
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(_client: Socket) {
    // intentionally empty
  }

  private async validateTokenAndGetUser(token: string): Promise<SocketUser> {
    const payload = this.jwtService.verify<{ sub: string; email: string; roles: string[] }>(token);

    const profile = await this.prisma.userProfile.findUnique({
      where: { userId: payload.sub },
      select: {
        facultyId: true,
        departmentId: true,
        unitId: true,
      },
    });

    const mainRole = payload.roles?.[0] ?? 'STUDENT';

    // Sub-roles are roles beyond the first (main) one
    const subRoles = payload.roles?.slice(1) ?? [];

    return {
      id: payload.sub,
      mainRole,
      subRoles,
      portal: resolvePortal(payload.roles ?? []),
      facultyId: profile?.facultyId ?? null,
      departmentId: profile?.departmentId ?? null,
      unitId: profile?.unitId ?? null,
    };
  }

  private async joinAllowedRooms(client: Socket, user: SocketUser) {
    await client.join(RealtimeRooms.user(user.id));
    await client.join(RealtimeRooms.role(user.mainRole));
    await client.join(RealtimeRooms.portal(user.portal));

    for (const subRole of user.subRoles) {
      await client.join(RealtimeRooms.subrole(subRole));
    }

    if (user.facultyId) {
      await client.join(RealtimeRooms.faculty(user.facultyId));
    }

    if (user.departmentId) {
      await client.join(RealtimeRooms.department(user.departmentId));
    }

    if (user.unitId) {
      await client.join(RealtimeRooms.unit(user.unitId));
    }
  }

  @SubscribeMessage('request.join')
  async joinRequestRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { requestId: string },
  ) {
    const user = client.data.user as SocketUser | undefined;
    if (!user) {
      client.emit('error', { message: 'Not authenticated.' });
      return;
    }

    const canView = await this.canViewRequest(user, body.requestId);
    if (!canView) {
      client.emit('error', { message: 'You are not allowed to join this request room.' });
      return;
    }

    await client.join(RealtimeRooms.request(body.requestId));
    client.emit('request.joined', { requestId: body.requestId });
  }

  @SubscribeMessage('request.leave')
  async leaveRequestRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { requestId: string },
  ) {
    const user = client.data.user as SocketUser | undefined;
    if (!user) return;
    await client.leave(RealtimeRooms.request(body.requestId));
    client.emit('request.left', { requestId: body.requestId });
  }

  private async canViewRequest(user: SocketUser, requestId: string): Promise<boolean> {
    if (user.mainRole === 'ADMIN') return true;

    const req = await this.prisma.request.findUnique({
      where: { id: requestId },
      select: {
        requesterUserId: true,
        currentAssigneeUserId: true,
        assignments: {
          where: { assignedToUserId: user.id, isActive: true },
          select: { id: true },
        },
        watchers: {
          where: { userId: user.id },
          select: { userId: true },
        },
      },
    });

    if (!req) return false;

    return (
      req.requesterUserId === user.id ||
      req.currentAssigneeUserId === user.id ||
      req.assignments.length > 0 ||
      req.watchers.length > 0
    );
  }
}
