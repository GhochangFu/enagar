import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../common/database/database.module';
import { ObjectStorageModule } from '../../common/object-storage/object-storage.module';

import { LeaseReceiptsController } from './lease-receipts.controller';
import { LeaseReceiptsService } from './lease-receipts.service';
import { PublicLeaseReceiptsController } from './public/public-lease-receipts.controller';
import { PublicLeaseReceiptsService } from './public/public-lease-receipts.service';

@Module({
  imports: [DatabaseModule, ObjectStorageModule],
  controllers: [LeaseReceiptsController, PublicLeaseReceiptsController],
  providers: [LeaseReceiptsService, PublicLeaseReceiptsService],
  exports: [LeaseReceiptsService],
})
export class LeaseReceiptsModule {}
