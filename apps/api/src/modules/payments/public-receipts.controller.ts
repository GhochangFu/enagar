import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/auth/public.decorator';

import { ReceiptVerificationService } from './receipt-verification.service';

import type { ReceiptVerifierDto } from './dto';

@ApiTags('public-receipts')
@Controller('public/receipts')
export class PublicReceiptsController {
  constructor(private readonly verification: ReceiptVerificationService) {}

  @Public()
  @Get('verify/:token')
  @ApiOperation({
    summary: 'Public receipt verification payload (opaque token)',
    description:
      'Returns non-PII receipt metadata suitable for QR deep-links. Invalid or unknown tokens return valid=false without leaking existence.',
  })
  verify(@Param('token') token: string): Promise<ReceiptVerifierDto> {
    return this.verification.verifyByOpaqueToken(token);
  }
}
