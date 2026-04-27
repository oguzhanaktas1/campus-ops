import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../core/prisma/prisma.service';
import { FilesService } from '../files/files.service';
import { CacheService } from '../infrastructure/cache/cache.service';
import { SlaService } from '../workflow/sla.service';
import { WorkflowEngineService } from '../workflow/workflow-engine.service';
import { FacultyService } from './faculty.service';

describe('FacultyService', () => {
  let service: FacultyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FacultyService,
        { provide: PrismaService, useValue: {} },
        { provide: SlaService, useValue: {} },
        { provide: CacheService, useValue: {} },
        { provide: FilesService, useValue: {} },
        { provide: WorkflowEngineService, useValue: {} },
      ],
    }).compile();

    service = module.get<FacultyService>(FacultyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
