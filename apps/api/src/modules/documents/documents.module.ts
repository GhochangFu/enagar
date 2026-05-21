import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../common/database/database.module';
import { DocumentScanModule } from '../../common/document-scan/document-scan.module';
import { ObjectStorageModule } from '../../common/object-storage/object-storage.module';
import { ApplicationsModule } from '../applications/applications.module';

import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

@Module({
  imports: [DatabaseModule, ObjectStorageModule, DocumentScanModule, ApplicationsModule],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
