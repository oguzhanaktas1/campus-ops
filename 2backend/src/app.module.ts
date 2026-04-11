import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './core/prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { StudentModule } from './student/student.module';
import { FacultyModule } from './faculty/faculty.module';
import { StaffModule } from './staff/staff.module';
import { RequestsModule } from './requests/requests.module';
import { WorkflowModule } from './workflow/workflow.module';
import { EquipmentRequestsModule } from './equipment-requests/equipment-requests.module';
import { TicketsModule } from './tickets/tickets.module';
import { ResourcesModule } from './resources/resources.module';
import { ReservationsModule } from './reservations/reservations.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { CalendarModule } from './calendar/calendar.module';
import { NotificationsModule } from './notifications/notifications.module';
import { DocumentsModule } from './documents/documents.module';
import { InternshipsModule } from './internships/internships.module';
import { AccessRequestsModule } from './access-requests/access-requests.module';
import { ProcurementModule } from './procurement/procurement.module';
import { EventsModule } from './events/events.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { CacheModule } from './infrastructure/cache/cache.module';
import { QueueModule } from './infrastructure/queue/queue.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    RedisModule,
    CacheModule,
    QueueModule,
    PrismaModule,
    AuthModule,
    NotificationsModule,
    AdminModule,
    StudentModule,
    FacultyModule,
    StaffModule,
    RequestsModule,
    WorkflowModule,
    EquipmentRequestsModule,
    TicketsModule,
    ResourcesModule,
    ReservationsModule,
    AppointmentsModule,
    CalendarModule,
    DocumentsModule,
    InternshipsModule,
    AccessRequestsModule,
    ProcurementModule,
    EventsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
