import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../core/prisma/prisma.service';
import { FilesService } from '../files/files.service';
import { RabbitmqPublisher } from '../infrastructure/rabbitmq/rabbitmq.publisher';
import { WorkflowEngineService } from '../workflow/workflow-engine.service';
import { StudentService } from './student.service';

describe('StudentService', () => {
  let service: StudentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentService,
        { provide: PrismaService, useValue: {} },
        { provide: WorkflowEngineService, useValue: {} },
        { provide: FilesService, useValue: {} },
        { provide: RabbitmqPublisher, useValue: {} },
      ],
    }).compile();

    service = module.get<StudentService>(StudentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
