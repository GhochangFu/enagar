import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

import type { DepositStatus } from './deposit-lifecycle';

const DEPOSIT_TYPES = ['emd', 'security', 'rent_deposit', 'other'] as const;

export class CreateDepositDto {
  @IsUUID('4')
  citizen_id!: string;

  @IsOptional()
  @IsUUID('4')
  application_id?: string;

  @IsIn([...DEPOSIT_TYPES])
  deposit_type!: (typeof DEPOSIT_TYPES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference_code?: string;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  amount_paise!: number;

  @IsOptional()
  @IsISO8601()
  expected_release_at?: string;

  @IsOptional()
  @IsUUID('4')
  capture_payment_id?: string;
}

export class ForfeitDepositDto {
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  reason!: string;
}

export class RefundDispatchNoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class RejectRefundDispatchDto {
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  reason!: string;
}

export class CompleteRefundDispatchDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  psp_note?: string;
}

export class CreateChallanDto {
  @IsString()
  @MaxLength(64)
  challan_no!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  issued_to_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(15)
  issued_to_mobile?: string;

  @IsOptional()
  @IsUUID('4')
  citizen_id?: string;

  @IsString()
  @MaxLength(80)
  violation_code!: string;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  amount_paise!: number;

  @IsOptional()
  @IsUUID('4')
  issued_by_user_id?: string;
}

export class WaiveChallanDto {
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  reason!: string;
}

export type DepositResponse = {
  id: string;
  tenant_id: string;
  citizen_id: string;
  application_id: string | null;
  deposit_type: string;
  reference_code: string | null;
  amount_paise: number;
  capture_payment_id: string | null;
  expected_release_at: string | null;
  status: DepositStatus;
  forfeiture_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type RefundDispatchResponse = {
  id: string;
  tenant_id: string;
  deposit_id: string;
  amount_paise: number;
  status: string;
  requested_by_subject: string;
  reviewed_by_subject: string | null;
  review_note: string | null;
  psp_completion_note: string | null;
  rejected_reason: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ChallanResponse = {
  id: string;
  tenant_id: string;
  challan_no: string;
  issued_to_name: string | null;
  issued_to_mobile: string | null;
  citizen_id: string | null;
  violation_code: string;
  issued_by_user_id: string | null;
  issued_at: string;
  amount_paise: number;
  status: string;
  paid_at: string | null;
  paid_payment_id: string | null;
  waived_reason: string | null;
  created_at: string;
  updated_at: string;
};
