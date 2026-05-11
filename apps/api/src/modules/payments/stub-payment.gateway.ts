import { Injectable } from '@nestjs/common';

import type {
  IPaymentGateway,
  PaymentGatewayInitiateInput,
  PaymentGatewayInitiateResult,
} from './payment-gateway';

@Injectable()
export class StubPaymentGateway implements IPaymentGateway {
  readonly id = 'stub' as const;

  static expectedOrderIdForPayment(paymentId: string): string {
    return `stub_order_${paymentId}`;
  }

  async initiate(input: PaymentGatewayInitiateInput): Promise<PaymentGatewayInitiateResult> {
    const gatewayOrderId = StubPaymentGateway.expectedOrderIdForPayment(input.paymentId);

    return {
      gateway: this.id,
      gatewayOrderId,
      redirectUrl: `/payments/stub/complete?payment_id=${input.paymentId}&order_id=${gatewayOrderId}`,
    };
  }
}
