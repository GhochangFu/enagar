import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { PublicLeaseReceiptsService } from './public-lease-receipts.service';

@ApiTags('public-verify')
@Controller('verify')
export class PublicLeaseReceiptsController {
  constructor(private readonly service: PublicLeaseReceiptsService) {}

  @Get(':token')
  @ApiOperation({ summary: 'Public receipt verification (no auth)' })
  async verify(@Param('token') token: string) {
    const view = await this.service.verify(token);
    if (!view) throw new NotFoundException('Receipt not in our records');
    return view;
  }
}
