import { Module } from '@nestjs/common';
import { OrganizerController } from './organizer.controller';
import { StaffModule } from '../staff/staff.module';

@Module({
  imports: [StaffModule],
  controllers: [OrganizerController],
})
export class OrganizerModule {}
