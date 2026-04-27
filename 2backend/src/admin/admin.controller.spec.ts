import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { OutboxProcessorService } from '../infrastructure/rabbitmq/outbox-processor.service';
import { RabbitmqMonitorService } from '../infrastructure/rabbitmq/rabbitmq-monitor.service';

describe('AdminController', () => {
  let controller: AdminController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        { provide: AdminService, useValue: {} },
        { provide: OutboxProcessorService, useValue: {} },
        { provide: RabbitmqMonitorService, useValue: {} },
      ],
    }).compile();

    controller = module.get<AdminController>(AdminController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
