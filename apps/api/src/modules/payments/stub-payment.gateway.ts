import { Injectable } from '@nestjs/common';

import type {
  IPaymentGateway,
  PaymentGatewayInitiateInput,
  PaymentGatewayInitiateResult,
} from './payment-gateway';

@Injectable()
export class StubPaymentGateway implements IPaymentGateway {
  readonly id = 'stub' as const;

  async initiate(input: PaymentGatewayInitiateInput): Promise<PaymentGatewayInitiateResult> {
    const gatewayOrderId = `stub_order_${input.paymentId}`;

    return {
      gateway: this.id,
      gatewayOrderId,
      redirectUrl: `/payments/stub/complete?payment_id=${input.paymentId}&order_id=${gatewayOrderId}`,
    };
  }
}
