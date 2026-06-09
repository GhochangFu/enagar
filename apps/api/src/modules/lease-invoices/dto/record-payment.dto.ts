import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export const leasePaymentMethods = [
  'ONLINE_GATEWAY',
  'CASH_AT_DESK',
  'BANK_TRANSFER',
  'CHEQUE',
] as const;
export type LeasePaymentMethod = (typeof leasePaymentMethods)[number];

export class RecordLeasePaymentDto {
  @ApiProperty({ enum: leasePaymentMethods, example: 'CASH_AT_DESK' })
  @IsIn(leasePaymentMethods)
  method!: LeasePaymentMethod;

  @ApiProperty({ required: false, example: 'NEFT-2026-0001' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  referenceNumber?: string;

  @ApiProperty({ required: false, example: 'Paid by lessor at counter' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
