import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

import { leasePaymentMethods, type LeasePaymentMethod } from './record-payment.dto';

/**
 * Citizen-facing payload for `POST /lease-invoices/:id/pay-as-citizen`.
 *
 * The body carries the citizen's phone so the service can verify the caller
 * owns the invoice (the phone must match the agreement's `lessorPhone`).
 * Only the `ONLINE_GATEWAY` method is permitted here — offline flows
 * (`CASH_AT_DESK` / `BANK_TRANSFER` / `CHEQUE`) are still recorded at the
 * tenant desk via the staff `POST /lease-invoices/:id/pay` endpoint.
 */
export class CitizenPayOnlineDto {
  @ApiProperty({
    description: 'Citizen phone (digits, with optional +91 / spaces).',
    example: '9836177767',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(6)
  @MaxLength(20)
  phone!: string;

  @ApiProperty({
    enum: leasePaymentMethods,
    example: 'ONLINE_GATEWAY',
  })
  @IsIn(leasePaymentMethods)
  method!: LeasePaymentMethod;
}
