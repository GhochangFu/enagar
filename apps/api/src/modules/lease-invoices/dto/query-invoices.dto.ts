import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export enum LeaseInvoiceFilterStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  WAIVED = 'WAIVED',
}

export class QueryLeaseInvoicesDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  agreementId?: string;

  /**
   * Filter to invoices whose parent asset has this id. Used by the
   * "filter by asset" dropdown on the Rental Invoices ledger so a single
   * stall's invoice history can be inspected in isolation.
   */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  assetId?: string;

  /**
   * Case-insensitive substring match on the lessor's name. Drives the
   * "filter by lessor" dropdown — the dropdown's values are pre-computed
   * distinct names, so a substring match is equivalent to an exact match
   * in practice but lets the API also accept free-text typing.
   */
  @ApiProperty({ required: false, example: 'Stall 13' })
  @IsOptional()
  @IsString()
  lessorName?: string;

  @ApiProperty({ required: false, enum: LeaseInvoiceFilterStatus })
  @IsOptional()
  @IsEnum(LeaseInvoiceFilterStatus)
  status?: LeaseInvoiceFilterStatus;

  @ApiProperty({ required: false, example: '2026-01-01' })
  @IsOptional()
  @IsString()
  fromDate?: string;

  @ApiProperty({ required: false, example: '2026-12-31' })
  @IsOptional()
  @IsString()
  toDate?: string;
}
