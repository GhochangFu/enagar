import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../common/database/database.module';
import { ObjectStorageModule } from '../../common/object-storage/object-storage.module';

import { RentalDocumentsController } from './rental-documents.controller';
import { RentalDocumentsService } from './rental-documents.service';

@Module({
  imports: [DatabaseModule, ObjectStorageModule],
  controllers: [RentalDocumentsController],
  providers: [RentalDocumentsService],
  exports: [RentalDocumentsService],
})
export class RentalDocumentsModule {}
