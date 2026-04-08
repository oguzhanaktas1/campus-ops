import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ResourcesService } from './resources.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ResourceType } from '@prisma/client';

@Controller('resources')
@UseGuards(JwtAuthGuard)
export class ResourcesController {
  constructor(private readonly resourcesService: ResourcesService) {}

  /** GET /resources */
  @Get()
  findAll(
    @Query('resourceType') resourceType?: ResourceType,
    @Query('campusId') campusId?: string,
    @Query('facultyId') facultyId?: string,
    @Query('departmentId') departmentId?: string,
    @Query('unitId') unitId?: string,
  ) {
    return this.resourcesService.findAll({
      resourceType,
      campusId,
      facultyId,
      departmentId,
      unitId,
    });
  }

  /** GET /resources/:id */
  @Get(':id')
  findById(@Param('id') id: string) {
    return this.resourcesService.findById(id);
  }

  /** GET /resources/:id/availability */
  @Get(':id/availability')
  findAvailability(@Param('id') id: string) {
    return this.resourcesService.findAvailability(id);
  }
}
