import type { PaymentMethod } from './dto';

export interface PaymentGatewayInitiateInput {
  paymentId: string;
  tenantId: string;
  applicationId: string;
  amountPaise: number;
  currency: 'INR';
  method: PaymentMethod;
}

export interface PaymentGatewayInitiateResult {
  gateway: 'stub';
  gatewayOrderId: string;
  redirectUrl: string;
}

export interface IPaymentGateway {
  readonly id: 'stub';
  initiate(input: PaymentGatewayInitiateInput): Promise<PaymentGatewayInitiateResult>;
}
