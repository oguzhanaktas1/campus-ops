import { Global, Module } from '@nestjs/common';
import { FilesService } from './files.service';
import { PrismaModule } from '../core/prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}
