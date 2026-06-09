import { Module } from '@nestjs/common';

import { LeaseInvoicesController } from './lease-invoices.controller';
import { LeaseInvoicesService } from './lease-invoices.service';

@Module({
  controllers: [LeaseInvoicesController],
  providers: [LeaseInvoicesService],
  exports: [LeaseInvoicesService],
})
export class LeaseInvoicesModule {}
