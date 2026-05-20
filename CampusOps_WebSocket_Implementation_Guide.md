# CampusOps WebSocket Implementation Guide

## Amaç

Bu doküman, CampusOps projesine **WebSocket tabanlı real-time özellikler** eklemek için hazırlanmıştır.

Bu rehberde load balancing kullanılmadığı varsayılmıştır.

Yani başlangıç mimarisi:

```txt
Next.js Frontend
    ↓
NestJS API - Single Instance
    ↓
PostgreSQL / Redis / RabbitMQ
```

Bu aşamada:
- Socket.IO Redis Adapter kullanılmayacak
- sticky session gerekmeyecek
- tek NestJS API instance üzerinde WebSocket Gateway çalışacak

İleride load balancing eklendiğinde Redis adapter ayrıca eklenebilir.

---

# 1. WebSocket Bu Projede Nerelerde Kullanılacak?

CampusOps içinde WebSocket sadece anlık güncelleme gereken yerlerde kullanılmalı.

## İlk eklenecek alanlar

1. Notification bell
2. Request detail live update
3. Staff ticket queue update
4. Faculty approvals live update
5. SLA warning / SLA breach alerts

## İleri aşama
6. Reservation availability update
7. Admin dashboard live cards
8. AI assistant streaming
9. Workflow instance live progress

---

# 2. Kullanılmayacak Yerler

WebSocket şu alanlarda gereksizdir:

- user listesi
- normal CRUD formları
- statik admin ayarları
- geçmiş audit log listesi
- ağır analytics chart hesapları
- report export işlemleri

Bu alanlarda HTTP + Redis cache daha doğru olur.

---

# 3. Teknoloji Seçimi

NestJS tarafında Socket.IO kullanılacak.

## Kurulum

```bash
npm install @nestjs/websockets @nestjs/platform-socket.io socket.io
```

Frontend için:

```bash
npm install socket.io-client
```

---

# 4. Genel Mimari

```txt
Backend Event
    ↓
Notification / Request / Workflow Service
    ↓
RealtimeGateway
    ↓
Socket.IO Rooms
    ↓
Authorized Users
```

Örnek:

```txt
request.status.changed
    ↓
RealtimeGateway.emitToUser(userId)
    ↓
user:{userId}
```

---

# 5. WebSocket Room Yapısı

Room yapısı server tarafından belirlenecek.

Client istediği room’a kendi kafasına göre join olamayacak.

## Kullanılacak room formatları

```txt
user:{userId}
role:{roleName}
subrole:{subRoleName}
faculty:{facultyId}
department:{departmentId}
unit:{unitId}
request:{requestId}
ticket:{ticketId}
workflow:{workflowInstanceId}
portal:{portalName}
```

## Örnekler

```txt
user:u123
portal:staff
subrole:it_agent
unit:it_unit_01
request:req_456
ticket:ticket_789
workflow:wf_123
```

---

# 6. Güvenlik Kuralı

WebSocket bağlantısında JWT doğrulanmalı.

## Yanlış yaklaşım

Client şunu gönderir:

```txt
join admin room
```

Server bunu kabul eder.

Bu yanlış.

## Doğru yaklaşım

1. Client socket bağlantısı açar
2. JWT gönderir
3. Server JWT doğrular
4. Server user context çıkarır
5. Server sadece izin verilen room’lara join eder

---

# 7. Backend Dosya Yapısı

Aşağıdaki yapı oluşturulacak:

```txt
src/
  realtime/
    realtime.module.ts
    realtime.gateway.ts
    realtime.service.ts
    realtime.types.ts
    guards/
      ws-jwt.guard.ts
    utils/
      room-builder.ts
```

---

# 8. Realtime Event Naming Standard

Event isimleri standart olmalı.

```txt
notification.created
request.created
request.updated
request.status.changed
request.comment.created
request.file.uploaded
workflow.step.changed
approval.created
approval.completed
ticket.assigned
ticket.status.changed
sla.warning
sla.breached
reservation.updated
appointment.updated
ai.response.completed
```

---

# 9. Backend Implementation

## 9.1 realtime.types.ts

```ts
export type RealtimeEventName =
  | 'notification.created'
  | 'request.created'
  | 'request.updated'
  | 'request.status.changed'
  | 'request.comment.created'
  | 'request.file.uploaded'
  | 'workflow.step.changed'
  | 'approval.created'
  | 'approval.completed'
  | 'ticket.assigned'
  | 'ticket.status.changed'
  | 'sla.warning'
  | 'sla.breached'
  | 'reservation.updated'
  | 'appointment.updated'
  | 'ai.response.completed';

export interface RealtimePayload<T = unknown> {
  event: RealtimeEventName;
  data: T;
  createdAt: string;
}
```

---

## 9.2 room-builder.ts

```ts
export const RealtimeRooms = {
  user: (userId: string) => `user:${userId}`,
  role: (role: string) => `role:${role}`,
  subrole: (subRole: string) => `subrole:${subRole}`,
  faculty: (facultyId: string) => `faculty:${facultyId}`,
  department: (departmentId: string) => `department:${departmentId}`,
  unit: (unitId: string) => `unit:${unitId}`,
  request: (requestId: string) => `request:${requestId}`,
  ticket: (ticketId: string) => `ticket:${ticketId}`,
  workflow: (workflowInstanceId: string) => `workflow:${workflowInstanceId}`,
  portal: (portal: string) => `portal:${portal}`,
};
```

---

## 9.3 realtime.module.ts

```ts
import { Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';

@Module({
  providers: [RealtimeGateway, RealtimeService],
  exports: [RealtimeService],
})
export class RealtimeModule {}
```

---

## 9.4 realtime.gateway.ts

```ts
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RealtimeRooms } from './utils/room-builder';

type SocketUser = {
  id: string;
  mainRole: string;
  subRoles?: string[];
  portal?: string;
  facultyId?: string | null;
  departmentId?: string | null;
  unitId?: string | null;
};

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/realtime',
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.toString().replace('Bearer ', '');

      if (!token) {
        client.disconnect();
        return;
      }

      // TODO:
      // Burada mevcut AuthService veya JwtService ile token doğrula.
      // Aşağıdaki user mock değil, gerçek JWT payload/context olmalı.
      const user = await this.validateTokenAndGetUser(token);

      client.data.user = user;

      await this.joinAllowedRooms(client, user);

      client.emit('connected', {
        status: 'ok',
        userId: user.id,
      });
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    // İstersen burada log tutabilirsin.
  }

  private async validateTokenAndGetUser(token: string): Promise<SocketUser> {
    // TODO:
    // JwtService.verify(token)
    // DB'den user roles/subroles/scope bilgilerini çek
    // return user context

    throw new Error('Implement validateTokenAndGetUser with existing auth system');
  }

  private async joinAllowedRooms(client: Socket, user: SocketUser) {
    await client.join(RealtimeRooms.user(user.id));
    await client.join(RealtimeRooms.role(user.mainRole));

    if (user.portal) {
      await client.join(RealtimeRooms.portal(user.portal));
    }

    for (const subRole of user.subRoles || []) {
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
    const user = client.data.user as SocketUser;

    // TODO:
    // Burada user bu request'i görebiliyor mu kontrol et.
    // PermissionService.canViewRequest(user.id, body.requestId)
    const canView = await this.canViewRequest(user, body.requestId);

    if (!canView) {
      client.emit('error', {
        message: 'You are not allowed to join this request room.',
      });
      return;
    }

    await client.join(RealtimeRooms.request(body.requestId));

    client.emit('request.joined', {
      requestId: body.requestId,
    });
  }

  @SubscribeMessage('request.leave')
  async leaveRequestRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { requestId: string },
  ) {
    await client.leave(RealtimeRooms.request(body.requestId));

    client.emit('request.left', {
      requestId: body.requestId,
    });
  }

  private async canViewRequest(user: SocketUser, requestId: string): Promise<boolean> {
    // TODO:
    // Mevcut PermissionService veya RequestVisibilityService ile bağla.
    // Admin ise true.
    // Request owner, assignee, workflow approver, related role/scope ise true.
    return user.mainRole === 'admin';
  }
}
```

---

## 9.5 realtime.service.ts

```ts
import { Injectable } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeEventName, RealtimePayload } from './realtime.types';
import { RealtimeRooms } from './utils/room-builder';

@Injectable()
export class RealtimeService {
  constructor(private readonly gateway: RealtimeGateway) {}

  emitToUser<T>(userId: string, event: RealtimeEventName, data: T) {
    this.gateway.server.to(RealtimeRooms.user(userId)).emit(event, this.payload(event, data));
  }

  emitToRole<T>(role: string, event: RealtimeEventName, data: T) {
    this.gateway.server.to(RealtimeRooms.role(role)).emit(event, this.payload(event, data));
  }

  emitToSubRole<T>(subRole: string, event: RealtimeEventName, data: T) {
    this.gateway.server.to(RealtimeRooms.subrole(subRole)).emit(event, this.payload(event, data));
  }

  emitToUnit<T>(unitId: string, event: RealtimeEventName, data: T) {
    this.gateway.server.to(RealtimeRooms.unit(unitId)).emit(event, this.payload(event, data));
  }

  emitToFaculty<T>(facultyId: string, event: RealtimeEventName, data: T) {
    this.gateway.server.to(RealtimeRooms.faculty(facultyId)).emit(event, this.payload(event, data));
  }

  emitToRequest<T>(requestId: string, event: RealtimeEventName, data: T) {
    this.gateway.server.to(RealtimeRooms.request(requestId)).emit(event, this.payload(event, data));
  }

  emitToTicket<T>(ticketId: string, event: RealtimeEventName, data: T) {
    this.gateway.server.to(RealtimeRooms.ticket(ticketId)).emit(event, this.payload(event, data));
  }

  emitToWorkflow<T>(workflowInstanceId: string, event: RealtimeEventName, data: T) {
    this.gateway.server
      .to(RealtimeRooms.workflow(workflowInstanceId))
      .emit(event, this.payload(event, data));
  }

  private payload<T>(event: RealtimeEventName, data: T): RealtimePayload<T> {
    return {
      event,
      data,
      createdAt: new Date().toISOString(),
    };
  }
}
```

---

# 10. AppModule'e Ekleme

`RealtimeModule` ana module’e import edilmeli.

```ts
@Module({
  imports: [
    RealtimeModule,
  ],
})
export class AppModule {}
```

---

# 11. Servislerde Kullanım Örnekleri

## 11.1 Notification oluşturulunca

```ts
await this.notificationService.create(...);

this.realtimeService.emitToUser(userId, 'notification.created', {
  title: 'New notification',
  message: 'Your request status has changed.',
});
```

---

## 11.2 Request status değişince

```ts
await this.requestService.updateStatus(requestId, newStatus);

this.realtimeService.emitToRequest(requestId, 'request.status.changed', {
  requestId,
  status: newStatus,
});
```

---

## 11.3 Comment eklenince

```ts
const comment = await this.commentService.create(...);

this.realtimeService.emitToRequest(requestId, 'request.comment.created', {
  requestId,
  comment,
});
```

---

## 11.4 Ticket atanırken

```ts
await this.ticketService.assign(ticketId, agentId);

this.realtimeService.emitToUser(agentId, 'ticket.assigned', {
  ticketId,
});

this.realtimeService.emitToUnit(itUnitId, 'ticket.assigned', {
  ticketId,
  assignedTo: agentId,
});
```

---

## 11.5 SLA breach olduğunda

```ts
this.realtimeService.emitToSubRole('it_manager', 'sla.breached', {
  requestId,
  ticketId,
  message: 'SLA has been breached.',
});
```

---

# 12. Frontend Socket Client

## 12.1 socket.ts

```ts
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(token: string) {
  if (!socket) {
    socket = io(`${process.env.NEXT_PUBLIC_API_URL}/realtime`, {
      auth: {
        token,
      },
      transports: ['websocket'],
      withCredentials: true,
    });
  }

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
```

---

## 12.2 Auth sonrası bağlantı

Kullanıcı login olduktan sonra socket bağlanmalı.

Logout olunca socket kapatılmalı.

```ts
const socket = getSocket(accessToken);

socket.on('connected', (payload) => {
  console.log('Realtime connected', payload);
});
```

Logout:

```ts
disconnectSocket();
```

---

# 13. Notification Bell Kullanımı

```ts
socket.on('notification.created', (payload) => {
  // unread count artır
  // notification list güncelle
  // toast göster
});
```

---

# 14. Request Detail Live Update

Detail sayfası açılınca:

```ts
socket.emit('request.join', {
  requestId,
});
```

Sayfa kapanınca:

```ts
socket.emit('request.leave', {
  requestId,
});
```

Event dinleme:

```ts
socket.on('request.status.changed', (payload) => {
  // detail query invalidate et
  // veya local state güncelle
});

socket.on('request.comment.created', (payload) => {
  // comment listesine ekle
});
```

---

# 15. Staff Ticket Queue Live Update

`/staff/tickets` sayfasında:

```ts
socket.on('ticket.assigned', () => {
  // react-query invalidate: staff tickets
});

socket.on('ticket.status.changed', () => {
  // ticket list refresh
});

socket.on('sla.breached', () => {
  // warning toast
});
```

---

# 16. Faculty Approvals Live Update

`/faculty/approvals` sayfasında:

```ts
socket.on('approval.created', () => {
  // approvals query invalidate
});

socket.on('approval.completed', () => {
  // approvals query invalidate
});
```

---

# 17. React Query Kullanıyorsan

WebSocket event geldiğinde direkt API çağırma yerine:

```ts
queryClient.invalidateQueries({
  queryKey: ['request-detail', requestId],
});
```

veya:

```ts
queryClient.invalidateQueries({
  queryKey: ['staff-tickets'],
});
```

Bu daha temizdir.

---

# 18. Load Balancing Olmadığı İçin Şimdilik Yapılmayacaklar

Bu projede şu an load balancing yoksa aşağıdakileri ekleme:

- Socket.IO Redis Adapter
- sticky session
- multi-instance socket sync
- Redis Pub/Sub socket bridge

Şu an tek API instance yeterli.

İleride load balancing eklenirse:
- Socket.IO Redis Adapter
- shared Redis Pub/Sub
- Nginx websocket proxy
- sticky session veya adapter-based sync

eklenebilir.

---

# 19. Nginx WebSocket Proxy Ayarı

Production’da Nginx varsa WebSocket için upgrade header gerekir.

```nginx
location /realtime/ {
    proxy_pass http://api:3000/realtime/;
    proxy_http_version 1.1;

    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";

    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    proxy_read_timeout 60s;
    proxy_send_timeout 60s;
}
```

---

# 20. Production Checklist

## Backend
- WebSocket Gateway eklendi
- JWT doğrulama eklendi
- allowed room join mantığı eklendi
- request room join için permission check eklendi
- RealtimeService servislerde kullanılabilir hale geldi

## Frontend
- socket.io-client kuruldu
- auth sonrası connect
- logout sonrası disconnect
- notification listener
- request detail listener
- staff ticket listener
- faculty approvals listener

## Security
- client serbest room join yapamıyor
- JWT olmadan bağlantı yok
- request room için permission check var
- internal note eventleri öğrenciye gitmiyor

## Production
- Nginx websocket proxy hazır
- load balancing olmadığı için Redis adapter eklenmedi
- tek API instance üzerinde çalışıyor

---

# 21. İleride Load Balancing Eklenirse

Eğer API instance sayısı artarsa bu rehber güncellenmeli.

Eklenecekler:
- `@socket.io/redis-adapter`
- Redis Pub/Sub config
- Nginx upstream websocket config
- multi-instance event propagation
- sticky session opsiyonel

---

# 22. Final Karar

Bu projede WebSocket ilk aşamada şu 5 alan için uygulanmalı:

1. Notification bell
2. Request detail live updates
3. Staff ticket queue updates
4. Faculty approval updates
5. SLA warning / breach alerts

Bu yapı load balancing olmadan tek API instance için yeterlidir.

## Ana prensip
WebSocket, CampusOps içinde sadece anlık kullanıcı deneyimi gereken yerlerde kullanılmalı; tüm sistem WebSocket'e bağımlı hale getirilmemelidir.
