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
