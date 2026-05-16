import { Controller, Get, Header } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/auth/public.decorator';

import { TransparencyService } from './transparency.service';

@Controller('public/transparency')
@Public()
@ApiTags('public transparency')
export class TransparencyController {
  constructor(private readonly transparency: TransparencyService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Public-safe aggregate transparency summary' })
  summary() {
    return this.transparency.summary();
  }

  @Get('tenants.csv')
  @Header('content-type', 'text/csv; charset=utf-8')
  @Header('content-disposition', 'attachment; filename="transparency-tenants.csv"')
  @ApiOperation({ summary: 'Public-safe active tenant aggregate CSV' })
  tenantsCsv() {
    return this.transparency.tenantsCsv();
  }

  @Get('services.csv')
  @Header('content-type', 'text/csv; charset=utf-8')
  @Header('content-disposition', 'attachment; filename="transparency-services.csv"')
  @ApiOperation({ summary: 'Public-safe active service aggregate CSV' })
  servicesCsv() {
    return this.transparency.servicesCsv();
  }

  @Get('sla.csv')
  @Header('content-type', 'text/csv; charset=utf-8')
  @Header('content-disposition', 'attachment; filename="transparency-sla.csv"')
  @ApiOperation({ summary: 'Public-safe SLA aggregate CSV' })
  slaCsv() {
    return this.transparency.slaCsv();
  }
}
