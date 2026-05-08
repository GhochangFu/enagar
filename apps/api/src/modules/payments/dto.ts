import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsNotEmpty, IsString, IsUUID, Min } from 'class-validator';

export const paymentMethods = ['upi', 'card', 'netbanking', 'wallet'] as const;

export type PaymentMethod = (typeof paymentMethods)[number];
export type PaymentStatus = 'requires_action' | 'settled' | 'failed';

export class InitiatePaymentDto {
  @ApiProperty({ example: '8c81a274-51de-42c2-97e7-8a41ce34c4f3' })
  @IsUUID()
  application_id!: string;

  @ApiProperty({ example: 5000, minimum: 1 })
  @IsInt()
  @Min(1)
  amount_paise!: number;

  @ApiProperty({ enum: paymentMethods, example: 'upi' })
  @IsString()
  @IsNotEmpty()
  @IsIn(paymentMethods)
  method!: PaymentMethod;
}

export interface PaymentResponse {
  id: string;
  tenant_id: string;
  citizen_subject: string;
  application_id: string;
  amount_paise: number;
  currency: 'INR';
  method: PaymentMethod;
  status: PaymentStatus;
  gateway: 'stub';
  gateway_order_id: string;
  redirect_url: string;
  created_at: string;
  updated_at: string;
}
