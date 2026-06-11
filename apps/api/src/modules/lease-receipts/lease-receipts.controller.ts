import { BadRequestException, Controller, Get, Param, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentPrincipal } from '../../common/auth/current-principal.decorator';
import { assertTenantPortalStaff } from '../admin-tenant/tenant-admin-portal-roles';

import { LeaseReceiptsService } from './lease-receipts.service';

import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';
import type { Response } from 'express';

@ApiTags('lease-receipts')
@ApiBearerAuth()
@Controller('lease-receipts')
export class LeaseReceiptsController {
  constructor(private readonly service: LeaseReceiptsService) {}

  @Get(':id/pdf')
  async download(
    @Param('id') id: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Res({ passthrough: false }) res: Response,
  ) {
    assertTenantPortalStaff(principal);
    if (!principal.tenantId) throw new BadRequestException('Tenant id is required');
    const pdf = await this.service.getStoredPdf(principal.tenantId, id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="receipt-${id}.pdf"`);
    res.setHeader('Content-Length', pdf.byteLength.toString());
    res.end(pdf);
    return res;
  }
}
