import { Module } from '@nestjs/common';

import { TenantsModule } from '../tenants/tenants.module';

import { CitizenController } from './citizen.controller';
import { CitizenService } from './citizen.service';

@Module({
  imports: [TenantsModule],
  controllers: [CitizenController],
  providers: [CitizenService],
})
export class CitizenModule {}
